"use client";
import { useEffect, useState } from "react";
import type { Funnel } from "../../shop-stats";

/** Shop funnel: product views → added to cart → checkout started → orders, with the products shoppers look at most. */
const RANGES = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 1000) / 10}%` : "–");

export function FunnelReport() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Funnel | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0); // "Try again" loads the same period once more
  useEffect(() => {
    setData(null);
    setError("");
    fetch(`/cms-api/shop-funnel?days=${days}`, { credentials: "include" })
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error(((await r.json().catch(() => null)) as { error?: string } | null)?.error ?? "Could not load the report"))))
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, [days, attempt]);
  // a failed load shows the error instead of skeletons that never finish
  const placeholder = (height: number) => (error ? <p className="urko-tip">No figures – the report didn&apos;t load.</p> : <div className="urko-skeleton" style={{ height }} />);

  const t = data?.totals;
  const steps = t
    ? [
        { label: "Product views", n: t.views, rate: "" },
        { label: "Added to cart", n: t.carts, rate: pct(t.carts, t.views) },
        { label: "Started checkout", n: t.checkouts, rate: pct(t.checkouts, t.carts) },
        { label: "Online orders", n: t.orders, rate: pct(t.orders, t.checkouts) },
      ]
    : [];
  const top = Math.max(1, ...steps.map((s) => s.n));
  return (
    <div className="urko-home">
      <div className="urko-pos__head">
        <div>
          <h1 style={{ margin: 0 }}>Shop funnel</h1>
          <p className="urko-tip" style={{ margin: "6px 0 0" }}>
            How shoppers move from looking to buying – counted by the shop itself (no cookies, nothing about the person), so it works without Google Analytics.
          </p>
        </div>
        <div className="urko-seg" role="group" aria-label="Period">
          {RANGES.map((r) => (
            <button key={r.days} type="button" aria-pressed={days === r.days} onClick={() => setDays(r.days)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p className="urko-tip" role="alert">
          {error}{" "}
          <button type="button" className="urko-btn urko-btn--sm" onClick={() => setAttempt((a) => a + 1)}>
            Try again
          </button>
        </p>
      )}
      <div className="urko-card" style={{ marginBottom: 16 }}>
        {!data ? (
          placeholder(180)
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {steps.map((s) => (
              <div key={s.label} style={{ display: "grid", gridTemplateColumns: "160px 1fr 110px", alignItems: "center", gap: 12 }}>
                <span>{s.label}</span>
                <span className="urko-history__bar" style={{ display: "block", height: 18, borderRadius: 6, background: "var(--theme-success-500, #6366f1)", width: `${Math.max(2, (s.n / top) * 100)}%` }} />
                <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  <strong>{s.n.toLocaleString()}</strong> {s.rate && <span className="urko-tip">({s.rate})</span>}
                </span>
              </div>
            ))}
          </div>
        )}
        {data && t && t.views === 0 && <p className="urko-tip">No visits counted yet in this period – numbers appear as shoppers browse.</p>}
      </div>

      <div className="urko-card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Most viewed products</h3>
        {!data ? (
          placeholder(140)
        ) : data.products.length === 0 ? (
          <p className="urko-tip">Nothing yet.</p>
        ) : (
          <div className="urko-table-wrap">
            <table className="urko-table">
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col" className="n">Views</th>
                  <th scope="col" className="n">Added to cart</th>
                  <th scope="col" className="n">Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.products.map((p) => (
                  <tr key={p.ref}>
                    <td>{p.id ? <a href={`/cms/collections/products/${p.id}`}>{p.title}</a> : p.title}</td>
                    <td className="n">{p.views}</td>
                    <td className="n">{p.carts}</td>
                    <td className="n">{pct(p.carts, p.views)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="urko-tip" style={{ marginTop: 8 }}>
          Many views but few carts? Check the price, the photos and the delivery charge for that product.
        </p>
      </div>

      <div className="urko-card">
        <h3 style={{ marginTop: 0 }}>Day by day</h3>
        {!data ? (
          placeholder(140)
        ) : data.days.length === 0 ? (
          <p className="urko-tip">Nothing yet.</p>
        ) : (
          <div className="urko-table-wrap">
            <table className="urko-table">
              <thead>
                <tr>
                  <th scope="col">Day</th>
                  <th scope="col" className="n">Views</th>
                  <th scope="col" className="n">Carts</th>
                  <th scope="col" className="n">Checkouts</th>
                  <th scope="col" className="n">Orders</th>
                </tr>
              </thead>
              <tbody>
                {[...data.days].reverse().map((d) => (
                  <tr key={d.day}>
                    <td>{d.day}</td>
                    <td className="n">{d.views}</td>
                    <td className="n">{d.carts}</td>
                    <td className="n">{d.checkouts}</td>
                    <td className="n">{d.orders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
