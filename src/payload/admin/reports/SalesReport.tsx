"use client";
import { useEffect, useMemo, useState } from "react";

/**
 * Sales & profit report. Sales = website orders that went ahead + shop-counter sales; "Delivered" = money collected.
 * Pending/unconfirmed, cancelled, refused (RTO) and returned orders are listed separately, never as sales.
 * Profit (owners only) is on delivered sales: items − discount − cost of goods.
 */

type Group = { key: string; label: string; orders: number; qty?: number; sales: number; cost?: number; profit?: number; costKnown?: boolean };
type CountValue = { count: number; value: number };
type Data = {
  range: { from: string; to: string };
  basis: "booked" | "delivered";
  owner: boolean;
  totals: {
    sales: number;
    orders: number;
    aov: number;
    bookedSales: number;
    deliveredSales: number;
    counter: CountValue;
    open: CountValue;
    cancelled: CountValue;
    refused: CountValue;
    returned: CountValue;
    refusalRate: number;
    refunds: number;
    profit?: { itemsRevenue: number; discounts: number; deliveryFees: number; cost: number; grossProfit: number; refunds: number; restockedCost: number; netProfit: number; margin: number; lines: number; estimatedLines: number; missingCostLines: number };
  };
  series: { day: string; orders: number; sales: number; counter: number }[];
  byProduct: Group[];
  byCategory: Group[];
  byBrand: Group[];
  byCity: Group[];
  byPayment: Group[];
  byChannel: Group[];
};

const rs = (n: number) => `Rs ${Math.round(n).toLocaleString("en-PK")}`;
const pktToday = () => new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() + 5 * 3600e3 - n * 864e5).toISOString().slice(0, 10);
const PRESETS = [
  { key: "today", label: "Today", range: () => [pktToday(), pktToday()] },
  { key: "7", label: "7 days", range: () => [daysAgo(6), pktToday()] },
  { key: "30", label: "30 days", range: () => [daysAgo(29), pktToday()] },
  { key: "month", label: "This month", range: () => [`${pktToday().slice(0, 8)}01`, pktToday()] },
  { key: "90", label: "90 days", range: () => [daysAgo(89), pktToday()] },
  { key: "365", label: "1 year", range: () => [daysAgo(364), pktToday()] },
] as const;
const TABS = [
  ["byProduct", "Products"],
  ["byCategory", "Categories"],
  ["byBrand", "Brands"],
  ["byCity", "Cities"],
  ["byPayment", "Payment"],
  ["byChannel", "Website vs counter"],
] as const;
type Tab = (typeof TABS)[number][0];

export function SalesReport() {
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(pktToday());
  const [preset, setPreset] = useState<string>("30");
  const [basis, setBasis] = useState<"booked" | "delivered">("booked");
  const [tab, setTab] = useState<Tab>("byProduct");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setData(null);
    setError("");
    fetch(`/cms-api/reports/sales?from=${from}&to=${to}&basis=${basis}`, { credentials: "include" })
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error(((await r.json().catch(() => ({}))) as { error?: string }).error || "Could not load the report"))))
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, [from, to, basis]);

  const rows = data?.[tab] ?? [];
  const product = tab === "byProduct" || tab === "byCategory" || tab === "byBrand";
  const showProfit = Boolean(data?.owner && product);
  const max = useMemo(() => Math.max(1, ...(data?.series.map((s) => s.sales) ?? [1])), [data]);

  function downloadCsv() {
    if (!data) return;
    const head = ["Name", product ? "Qty" : "", "Orders", "Sales (Rs)", ...(showProfit ? ["Cost (Rs)", "Profit (Rs)"] : [])].filter(Boolean);
    const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = rows.map((r) =>
      [r.label, ...(product ? [r.qty ?? 0] : []), r.orders, Math.round(r.sales), ...(showProfit ? [r.costKnown ? Math.round(r.cost ?? 0) : "", r.costKnown ? Math.round(r.profit ?? 0) : ""] : [])].map(cell).join(","),
    );
    const blob = new Blob([[head.map(cell).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sales-${TABS.find((t) => t[0] === tab)?.[1].toLowerCase().replace(/\W+/g, "-")}-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const t = data?.totals;
  const p = t?.profit;
  return (
    <div className="urko-home">
      <div className="urko-pos__head">
        <div>
          <h1 style={{ margin: 0 }}>Sales &amp; profit</h1>
          <p className="urko-tip" style={{ margin: "6px 0 0" }}>
            Sales = website orders that went ahead (confirmed, shipped, delivered) + shop-counter sales. Pending, unconfirmed, cancelled, refused and returned orders are never counted as sales.
          </p>
        </div>
        <div className="urko-seg" role="group" aria-label="Period">
          {PRESETS.map((pr) => (
            <button
              key={pr.key}
              type="button"
              aria-pressed={preset === pr.key}
              onClick={() => {
                const [f, tt] = pr.range();
                setPreset(pr.key);
                setFrom(f);
                setTo(tt);
              }}
            >
              {pr.label}
            </button>
          ))}
        </div>
      </div>

      <div className="urko-card" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end", marginBottom: 16 }}>
        <label className="urko-pos__amount" style={{ maxWidth: 170 }}>
          From
          <input type="date" value={from} max={to} onChange={(e) => (setPreset(""), setFrom(e.target.value))} />
        </label>
        <label className="urko-pos__amount" style={{ maxWidth: 170 }}>
          To
          <input type="date" value={to} min={from} max={pktToday()} onChange={(e) => (setPreset(""), setTo(e.target.value))} />
        </label>
        <div className="urko-seg" role="group" aria-label="Count as sales">
          <button type="button" aria-pressed={basis === "booked"} onClick={() => setBasis("booked")} title="Confirmed, shipped and delivered orders + counter sales">
            Booked
          </button>
          <button type="button" aria-pressed={basis === "delivered"} onClick={() => setBasis("delivered")} title="Delivered orders + counter sales – money collected">
            Delivered
          </button>
        </div>
      </div>

      {error && <p className="urko-tip">{error}</p>}

      <div className="urko-grid urko-grid--stats" style={{ marginBottom: 16 }}>
        <Stat label="Booked sales" value={t ? rs(t.bookedSales) : "…"} hint="Went ahead + counter" />
        <Stat label="Delivered sales" value={t ? rs(t.deliveredSales) : "…"} hint="Money collected" />
        <Stat label={`${basis === "booked" ? "Booked" : "Delivered"} orders & sales`} value={t ? String(t.orders) : "…"} hint={t ? `Average ${rs(t.aov)}` : undefined} />
        <Stat label="Shop counter" value={t ? rs(t.counter.value) : "…"} hint={t ? `${t.counter.count} sale${t.counter.count === 1 ? "" : "s"}` : undefined} />
      </div>
      <div className="urko-grid urko-grid--stats" style={{ marginBottom: 16 }}>
        <Stat label="Open (not sales yet)" value={t ? String(t.open.count) : "…"} hint={t ? `${rs(t.open.value)} pending / to confirm` : undefined} />
        <Stat label="Refused (RTO)" value={t ? String(t.refused.count) : "…"} hint={t ? `${t.refusalRate}% of deliveries · ${rs(t.refused.value)}` : undefined} />
        <Stat label="Cancelled" value={t ? String(t.cancelled.count) : "…"} hint={t ? rs(t.cancelled.value) : undefined} />
        <Stat label="Refunds (returns)" value={t ? rs(t.refunds) : "…"} hint={t ? `${t.returned.count} order${t.returned.count === 1 ? "" : "s"} fully returned` : undefined} />
      </div>

      {p && (
        <section className="urko-card" style={{ marginBottom: 16 }} aria-labelledby="profit-h">
          <h2 id="profit-h" style={{ marginTop: 0 }}>
            Profit on delivered sales <span className="urko-badge urko-badge--n">owners only</span>
          </h2>
          <div className="urko-grid urko-grid--stats">
            <Stat label="Items sold" value={rs(p.itemsRevenue)} />
            <Stat label="Discounts" value={`− ${rs(p.discounts)}`} />
            <Stat label="Cost of goods" value={`− ${rs(p.cost)}`} />
            <Stat label="Gross profit" value={rs(p.grossProfit)} hint={`${p.margin}% margin`} />
          </div>
          {(p.refunds > 0 || p.restockedCost > 0) && (
            <div className="urko-grid urko-grid--stats" style={{ marginTop: 12 }}>
              <Stat label="Refunds paid" value={`− ${rs(p.refunds)}`} />
              <Stat label="Returned to stock (cost)" value={`+ ${rs(p.restockedCost)}`} />
              <Stat label="Profit after refunds" value={rs(p.netProfit)} />
            </div>
          )}
          <p className="urko-tip" style={{ marginBottom: 0 }}>
            Delivery fees collected: {rs(p.deliveryFees)} (not in profit – they pay the courier).{" "}
            {p.estimatedLines > 0 && `${p.estimatedLines} of ${p.lines} lines were sold before costs were saved per sale and use today's cost (estimated). `}
            {p.missingCostLines > 0 && `${p.missingCostLines} lines have no cost price at all – add “Your cost” on those products for a complete profit.`}
          </p>
        </section>
      )}

      <section className="urko-card" style={{ marginBottom: 16 }} aria-label="Sales per day">
        {data ? (
          <>
            <div className="urko-bars" role="img" aria-label={`Sales per day from ${data.range.from} to ${data.range.to}. Total ${rs(data.totals.sales)}.`}>
              {data.series.map((s) => (
                <span key={s.day} title={`${s.day}: ${rs(s.sales)} · ${s.orders} sale${s.orders === 1 ? "" : "s"}${s.counter ? ` (counter ${rs(s.counter)})` : ""}`} style={{ height: `${Math.max(s.sales ? 3 : 1, (s.sales / max) * 100)}%` }} />
              ))}
            </div>
            <div className="urko-bars__legend urko-muted urko-small">
              <span>{data.range.from}</span>
              <span>
                Total <strong className="urko-text">{rs(data.totals.sales)}</strong>
              </span>
              <span>{data.range.to}</span>
            </div>
          </>
        ) : (
          <div className="urko-skeleton" style={{ height: 160 }} />
        )}
      </section>

      <nav className="urko-tabs" aria-label="Group by">
        {TABS.map(([k, l]) => (
          <button key={k} type="button" className={tab === k ? "is-active" : undefined} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </nav>
      <div className="urko-card">
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <button type="button" className="urko-btn urko-btn--sm" disabled={!rows.length} onClick={downloadCsv}>
            Download CSV
          </button>
        </div>
        {!data ? (
          <div className="urko-skeleton" style={{ height: 160 }} />
        ) : rows.length === 0 ? (
          <p className="urko-tip">No sales in this period.</p>
        ) : (
          <table className="urko-table">
            <thead>
              <tr>
                <th scope="col">{TABS.find((x) => x[0] === tab)?.[1]}</th>
                {product && <th scope="col" className="n">Qty</th>}
                <th scope="col" className="n">{product ? "Orders" : "Sales"}</th>
                <th scope="col" className="n">Amount</th>
                <th scope="col" className="n">Share</th>
                {showProfit && <th scope="col" className="n">Cost</th>}
                {showProfit && <th scope="col" className="n">Profit</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const total = rows.reduce((s, x) => s + x.sales, 0) || 1;
                return (
                  <tr key={r.key}>
                    <td>{r.label}</td>
                    {product && <td className="n">{r.qty ?? 0}</td>}
                    <td className="n">{r.orders}</td>
                    <td className="n">{rs(r.sales)}</td>
                    <td className="n">{Math.round((r.sales / total) * 100)}%</td>
                    {showProfit && <td className="n">{r.costKnown ? rs(r.cost ?? 0) : "—"}</td>}
                    {showProfit && (
                      <td className="n">
                        {r.costKnown ? <span className={`urko-badge urko-badge--${(r.profit ?? 0) < 0 ? "r" : "g"}`}>{rs(r.profit ?? 0)}</span> : "—"}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {product && (
          <p className="urko-tip" style={{ marginTop: 12, marginBottom: 0 }}>
            Product amounts are line prices before order discounts{data?.owner ? "; profit here = line price − cost." : "."} {basis === "booked" ? "Showing booked sales." : "Showing delivered sales."}
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="urko-card">
      <p className="urko-tip" style={{ margin: 0 }}>
        {label}
      </p>
      <p style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 800 }}>{value}</p>
      {hint && (
        <p className="urko-tip" style={{ margin: "2px 0 0" }}>
          {hint}
        </p>
      )}
    </div>
  );
}
