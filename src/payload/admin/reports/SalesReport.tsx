"use client";
import { useEffect, useMemo, useState } from "react";
import { useAdminLocale, useAdminMoney } from "../ui/store-context";
import { addDays, dayIn } from "../../../lib/time";

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

const todayIn = (timezone: string) => dayIn(Date.now(), timezone);
/** Periods ending today (`today` = the store's day, "YYYY-MM-DD"). */
const PRESETS: readonly { key: string; label: string; range: (today: string) => readonly [string, string] }[] = [
  { key: "today", label: "Today", range: (today) => [today, today] },
  { key: "7", label: "7 days", range: (today) => [addDays(today, -6), today] },
  { key: "30", label: "30 days", range: (today) => [addDays(today, -29), today] },
  { key: "month", label: "This month", range: (today) => [`${today.slice(0, 8)}01`, today] },
  { key: "90", label: "90 days", range: (today) => [addDays(today, -89), today] },
  { key: "365", label: "1 year", range: (today) => [addDays(today, -364), today] },
];
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
  // days in the store's time zone (known once the store list has loaded), amounts in its currency
  const money = useAdminMoney();
  const { timezone } = useAdminLocale();
  const today = todayIn(timezone);
  const [preset, setPreset] = useState<string>("30");
  // dates picked by hand (no preset chosen)
  const [picked, setPicked] = useState<readonly [string, string]>(["", ""]);
  const [from, to] = PRESETS.find((pr) => pr.key === preset)?.range(today) ?? picked;
  const setFrom = (f: string) => setPicked([f, to]);
  const setTo = (t: string) => setPicked([from, t]);
  const [basis, setBasis] = useState<"booked" | "delivered">("booked");
  const [tab, setTab] = useState<Tab>("byProduct");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0); // "Try again" loads the same period once more

  useEffect(() => {
    setData(null);
    setError("");
    fetch(`/cms-api/reports/sales?from=${from}&to=${to}&basis=${basis}`, { credentials: "include" })
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error(((await r.json().catch(() => ({}))) as { error?: string }).error || "Could not load the report"))))
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, [from, to, basis, attempt]);
  // a failed load shows the error instead of skeletons that never finish
  const pending = error ? "–" : "…";
  const placeholder = (height: number) => (error ? <p className="urko-tip">No figures – the report didn&apos;t load.</p> : <div className="urko-skeleton" style={{ height }} />);

  const rows = data?.[tab] ?? [];
  const product = tab === "byProduct" || tab === "byCategory" || tab === "byBrand";
  const showProfit = Boolean(data?.owner && product);
  const max = useMemo(() => Math.max(1, ...(data?.series.map((s) => s.sales) ?? [1])), [data]);

  function downloadCsv() {
    if (!data) return;
    const c = money.symbol;
    const head = ["Name", product ? "Qty" : "", "Orders", `Sales (${c})`, ...(showProfit ? [`Cost (${c})`, `Profit (${c})`] : [])].filter(Boolean);
    const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = rows.map((r) =>
      [r.label, ...(product ? [r.qty ?? 0] : []), r.orders, money.round(r.sales), ...(showProfit ? [r.costKnown ? money.round(r.cost ?? 0) : "", r.costKnown ? money.round(r.profit ?? 0) : ""] : [])].map(cell).join(","),
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
              onClick={() => setPreset(pr.key)}
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
          <input type="date" value={to} min={from} max={today} onChange={(e) => (setPreset(""), setTo(e.target.value))} />
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

      {error && (
        <p className="urko-tip" role="alert">
          {error}{" "}
          <button type="button" className="urko-btn urko-btn--sm" onClick={() => setAttempt((a) => a + 1)}>
            Try again
          </button>
        </p>
      )}

      <div className="urko-grid urko-grid--stats" style={{ marginBottom: 16 }}>
        <Stat label="Booked sales" value={t ? money(t.bookedSales) : pending} hint="Went ahead + counter" />
        <Stat label="Delivered sales" value={t ? money(t.deliveredSales) : pending} hint="Money collected" />
        <Stat label={`${basis === "booked" ? "Booked" : "Delivered"} orders & sales`} value={t ? String(t.orders) : pending} hint={t ? `Average ${money(t.aov)}` : undefined} />
        <Stat label="Shop counter" value={t ? money(t.counter.value) : pending} hint={t ? `${t.counter.count} sale${t.counter.count === 1 ? "" : "s"}` : undefined} />
      </div>
      <div className="urko-grid urko-grid--stats" style={{ marginBottom: 16 }}>
        <Stat label="Open (not sales yet)" value={t ? String(t.open.count) : pending} hint={t ? `${money(t.open.value)} pending / to confirm` : undefined} />
        <Stat label="Refused (RTO)" value={t ? String(t.refused.count) : pending} hint={t ? `${t.refusalRate}% of deliveries · ${money(t.refused.value)}` : undefined} />
        <Stat label="Cancelled" value={t ? String(t.cancelled.count) : pending} hint={t ? money(t.cancelled.value) : undefined} />
        <Stat label="Refunds (returns)" value={t ? money(t.refunds) : pending} hint={t ? `${t.returned.count} order${t.returned.count === 1 ? "" : "s"} fully returned` : undefined} />
      </div>

      {p && (
        <section className="urko-card" style={{ marginBottom: 16 }} aria-labelledby="profit-h">
          <h2 id="profit-h" style={{ marginTop: 0 }}>
            Profit on delivered sales <span className="urko-badge urko-badge--n">owners only</span>
          </h2>
          <div className="urko-grid urko-grid--stats">
            <Stat label="Items sold" value={money(p.itemsRevenue)} />
            <Stat label="Discounts" value={`− ${money(p.discounts)}`} />
            <Stat label="Cost of goods" value={`− ${money(p.cost)}`} />
            <Stat label="Gross profit" value={money(p.grossProfit)} hint={`${p.margin}% margin`} />
          </div>
          {(p.refunds > 0 || p.restockedCost > 0) && (
            <div className="urko-grid urko-grid--stats" style={{ marginTop: 12 }}>
              <Stat label="Refunds paid" value={`− ${money(p.refunds)}`} />
              <Stat label="Returned to stock (cost)" value={`+ ${money(p.restockedCost)}`} />
              <Stat label="Profit after refunds" value={money(p.netProfit)} />
            </div>
          )}
          <p className="urko-tip" style={{ marginBottom: 0 }}>
            Delivery fees collected: {money(p.deliveryFees)} (not in profit – they pay the courier).{" "}
            {p.estimatedLines > 0 && `${p.estimatedLines} of ${p.lines} lines were sold before costs were saved per sale and use today's cost (estimated). `}
            {p.missingCostLines > 0 && `${p.missingCostLines} lines have no cost price at all – add “Your cost” on those products for a complete profit.`}
          </p>
        </section>
      )}

      <section className="urko-card" style={{ marginBottom: 16 }} aria-label="Sales per day">
        {data ? (
          <>
            <div className="urko-bars" role="img" aria-label={`Sales per day from ${data.range.from} to ${data.range.to}. Total ${money(data.totals.sales)}.`}>
              {data.series.map((s) => (
                <span key={s.day} title={`${s.day}: ${money(s.sales)} · ${s.orders} sale${s.orders === 1 ? "" : "s"}${s.counter ? ` (counter ${money(s.counter)})` : ""}`} style={{ height: `${Math.max(s.sales ? 3 : 1, (s.sales / max) * 100)}%` }} />
              ))}
            </div>
            <div className="urko-bars__legend urko-muted urko-small">
              <span>{data.range.from}</span>
              <span>
                Total <strong className="urko-text">{money(data.totals.sales)}</strong>
              </span>
              <span>{data.range.to}</span>
            </div>
          </>
        ) : (
          placeholder(160)
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
          placeholder(160)
        ) : rows.length === 0 ? (
          <p className="urko-tip">No sales in this period.</p>
        ) : (
          <div className="urko-table-wrap">
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
                      <td className="n">{money(r.sales)}</td>
                      <td className="n">{Math.round((r.sales / total) * 100)}%</td>
                      {showProfit && <td className="n">{r.costKnown ? money(r.cost ?? 0) : "—"}</td>}
                      {showProfit && (
                        <td className="n">
                          {r.costKnown ? <span className={`urko-badge urko-badge--${(r.profit ?? 0) < 0 ? "r" : "g"}`}>{money(r.profit ?? 0)}</span> : "—"}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
