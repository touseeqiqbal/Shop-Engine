/**
 * Stock value and ageing (Reports → Stock value): what the stock on the shelves is worth at cost and at today's
 * prices, and how long it has sat without selling. Pure – the endpoint (src/payload/endpoints/stock-value.ts) feeds it
 * one row per product. Client-safe.
 */

export type StockRow = {
  id: number;
  title: string;
  sku: string;
  stock: number;
  costPrice: number | null;
  price: number;
  /** last sale – online or at the shop counter (ISO), null = never */
  lastSoldAt: string | null;
  /** when it was added to the shop (ISO) */
  createdAt: string;
};

export const AGE_BUCKETS = [
  { key: "0-30", label: "Sold in the last 30 days", max: 30 },
  { key: "31-90", label: "No sale for 1–3 months", max: 90 },
  { key: "91-180", label: "No sale for 3–6 months", max: 180 },
  { key: "180+", label: "No sale for over 6 months", max: Infinity },
] as const;
export type AgeKey = (typeof AGE_BUCKETS)[number]["key"];

export type StockValueReport = {
  totals: { products: number; units: number; costValue: number; retailValue: number; missingCost: number; owed: number };
  buckets: { key: AgeKey; label: string; products: number; units: number; costValue: number }[];
  /** what ties up the most money without selling (90+ days), dearest first */
  slow: { id: number; title: string; sku: string; units: number; costValue: number; days: number; neverSold: boolean }[];
};

const round = (n: number) => Math.round(n * 100) / 100;
/** Whole days since `iso` (never below 0). */
export const daysSince = (iso: string, now = Date.now()) => Math.max(0, Math.floor((now - Date.parse(iso)) / 86_400_000));

export function stockValueReport(rows: StockRow[], now = Date.now()): StockValueReport {
  const totals = { products: 0, units: 0, costValue: 0, retailValue: 0, missingCost: 0, owed: 0 };
  const buckets = AGE_BUCKETS.map((b) => ({ key: b.key, label: b.label, products: 0, units: 0, costValue: 0 }));
  const slow: StockValueReport["slow"] = [];
  for (const r of rows) {
    // below 0 = pre-orders / backorders still owed: nothing on the shelf
    if (r.stock < 0) totals.owed += -r.stock;
    const units = Math.max(0, r.stock);
    if (!units) continue;
    const cost = r.costPrice != null && r.costPrice > 0 ? r.costPrice : null;
    const costValue = cost == null ? 0 : units * cost;
    totals.products++;
    totals.units += units;
    totals.costValue += costValue;
    totals.retailValue += units * Math.max(0, r.price);
    if (cost == null) totals.missingCost++;
    const days = daysSince(r.lastSoldAt ?? r.createdAt, now);
    const b = buckets[AGE_BUCKETS.findIndex((x) => days <= x.max)];
    b.products++;
    b.units += units;
    b.costValue += costValue;
    if (days > 90) slow.push({ id: r.id, title: r.title, sku: r.sku, units, costValue: round(costValue), days, neverSold: !r.lastSoldAt });
  }
  slow.sort((a, b) => b.costValue - a.costValue || b.days - a.days);
  return {
    totals: { ...totals, costValue: round(totals.costValue), retailValue: round(totals.retailValue) },
    buckets: buckets.map((b) => ({ ...b, costValue: round(b.costValue) })),
    slow: slow.slice(0, 50),
  };
}
