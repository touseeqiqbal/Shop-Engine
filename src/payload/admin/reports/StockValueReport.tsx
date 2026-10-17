"use client";
import { useEffect, useState } from "react";
import { useAdminMoney } from "../ui/store-context";
import type { StockValueReport as Data } from "../../../lib/stock-value";

/** Stock value and ageing: what the shelves are worth, and what has sat there without selling. */
export function StockValueReport() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const money = useAdminMoney();
  useEffect(() => {
    fetch("/cms-api/stock-value", { credentials: "include" })
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error(((await r.json().catch(() => null)) as { error?: string } | null)?.error ?? "Could not load the report"))))
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, []);

  const total = data?.totals.costValue || 0;
  return (
    <div className="urko-home">
      <div className="urko-pos__head">
        <div>
          <h1 style={{ margin: 0 }}>Stock value</h1>
          <p className="urko-tip" style={{ margin: "6px 0 0" }}>
            What the stock on your shelves is worth at your cost (Products → Your cost) and at today&apos;s prices – and how long it has gone without a sale, online or in the shop.
          </p>
        </div>
      </div>
      {error && <p className="urko-tip">{error}</p>}
      <div className="urko-grid urko-grid--stats" style={{ marginBottom: 16 }}>
        <Stat label="At cost" value={data ? money(data.totals.costValue) : "…"} />
        <Stat label="At today's prices" value={data ? money(data.totals.retailValue) : "…"} />
        <Stat label="Units on the shelves" value={data ? String(data.totals.units) : "…"} />
        <Stat label="Products in stock" value={data ? String(data.totals.products) : "…"} />
      </div>
      {data && data.totals.missingCost > 0 && (
        <p className="urko-tip" role="note">
          ⚠️ {data.totals.missingCost} product{data.totals.missingCost === 1 ? " has" : "s have"} no cost price – {data.totals.missingCost === 1 ? "it isn't" : "they aren't"} in the “At cost” total. Add it under Products → Your cost.
        </p>
      )}
      {data && data.totals.owed > 0 && (
        <p className="urko-tip" role="note">
          ⏳ {data.totals.owed} unit{data.totals.owed === 1 ? " is" : "s are"} sold as pre-orders / backorders and still owed to customers (not counted above).
        </p>
      )}

      <div className="urko-card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>How long since it last sold</h3>
        {!data ? (
          <div className="urko-skeleton" style={{ height: 120 }} />
        ) : (
          <table className="urko-table">
            <thead>
              <tr>
                <th scope="col">Last sale</th>
                <th scope="col" className="n">Products</th>
                <th scope="col" className="n">Units</th>
                <th scope="col" className="n">At cost</th>
                <th scope="col" className="n">Share</th>
              </tr>
            </thead>
            <tbody>
              {data.buckets.map((b, i) => (
                <tr key={b.key}>
                  <td>{b.label}</td>
                  <td className="n">{b.products}</td>
                  <td className="n">{b.units}</td>
                  <td className="n">{money(b.costValue)}</td>
                  <td className="n">
                    <span className={`urko-badge urko-badge--${i === 0 ? "g" : i === 1 ? "y" : "r"}`}>{total > 0 ? Math.round((b.costValue / total) * 100) : 0}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="urko-card">
        <h3 style={{ marginTop: 0 }}>Slow movers – no sale for over 3 months</h3>
        {!data ? (
          <div className="urko-skeleton" style={{ height: 160 }} />
        ) : data.slow.length === 0 ? (
          <p className="urko-tip">Nothing has sat for over 3 months. 🎉</p>
        ) : (
          <table className="urko-table">
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col" className="n">Units</th>
                <th scope="col" className="n">At cost</th>
                <th scope="col" className="n">No sale for</th>
              </tr>
            </thead>
            <tbody>
              {data.slow.map((s) => (
                <tr key={s.id}>
                  <td>
                    <a href={`/cms/collections/products/${s.id}`}>{s.title}</a> <span className="urko-tip">{s.sku}</span>
                  </td>
                  <td className="n">{s.units}</td>
                  <td className="n">{money(s.costValue)}</td>
                  <td className="n">
                    {s.days} days{s.neverSold ? " (never sold)" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="urko-tip" style={{ marginTop: 12 }}>
        Money stuck in slow stock? Put it in a flash sale with “% off” (Sales → Flash sales), bundle it with a best seller, or stop re-ordering it.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="urko-card">
      <p className="urko-tip" style={{ margin: 0 }}>
        {label}
      </p>
      <p style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 800 }}>{value}</p>
    </div>
  );
}
