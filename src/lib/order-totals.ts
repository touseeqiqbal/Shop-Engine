import { codFee, shippingOptions } from "./cities";
import { roundMoney } from "./money";
import type { ShippingOption, StoreSettings, TaxBreakdownLine, TaxClass } from "./types";

/**
 * An order's money, worked out the SAME way in the browser (cart, checkout) and on the server (which is the only one
 * that counts – the browser's total is just shown and compared):
 *   items − discount → delivery (free above the zone's threshold, judged AFTER the discount; free with a free-delivery
 *   discount) → COD fee → tax (included in the prices, or added on top) → total.
 * Amounts are rounded to the store currency's smallest unit (whole rupees, cents …).
 */
export type Totals = { subtotal: number; discount: number; delivery: number | null; fee: number; tax: number; taxAdded: number; total: number; shipping: ShippingOption | null; taxBreakdown: TaxBreakdownLine[] };

/** One cart line for tax: its amount (price × quantity) and how its product is taxed. */
export type TaxLine = { amount: number; taxClass?: TaxClass | null };

export function orderTotals(input: {
  subtotal: number;
  discount: number;
  city: string | null | undefined;
  postalCode?: string | null;
  /** the address's country (ISO); default the store's own */
  country?: string | null;
  method: string;
  settings: StoreSettings;
  freeShipping?: boolean;
  /** the delivery method chosen at checkout (ShippingOption id; default "standard") */
  shipping?: string | null;
  /** the cart's weight in kg (for zones that price by weight) */
  weightKg?: number;
  /** the lines with their products' tax class – products on the reduced rate or without tax (default: all normal) */
  lines?: TaxLine[];
  /** every item is a download: nothing to deliver */
  noShipping?: boolean;
}): Totals {
  const { settings } = input;
  const round = (n: number) => roundMoney(n, settings.currency || "PKR");
  const subtotal = Math.max(0, round(input.subtotal));
  const discount = Math.min(subtotal, Math.max(0, round(input.discount)));
  const goods = round(subtotal - discount);
  // the chosen way of delivery (Standard unless the zone offers others), priced for this cart
  const options = input.city && !input.noShipping ? shippingOptions(input.city, goods, settings, input.postalCode ?? "", input.country, input.weightKg ?? 0) : [];
  const shipping = options.find((o) => o.id === (input.shipping || "standard")) ?? options[0] ?? null;
  const delivery = input.noShipping ? 0 : input.freeShipping ? 0 : input.city ? (shipping?.charge ?? 0) : settings.freeDeliveryThreshold > 0 && goods >= settings.freeDeliveryThreshold ? 0 : null;
  const fee = input.method === "cod" ? codFee(settings) : 0;
  const t = settings.tax;
  let tax = 0;
  let taxAdded = 0;
  const taxBreakdown: TaxBreakdownLine[] = [];
  if (t?.enabled && t.rate > 0) {
    // what each rate is charged on: the lines of its products (the discount shared out by value), and delivery at the
    // normal rate when it is taxed
    const rateOf = (c?: TaxClass | null) => (c === "exempt" ? 0 : c === "reduced" ? Math.max(0, t.reducedRate ?? t.rate) : t.rate);
    const bases = new Map<number, number>();
    const lineSum = (input.lines ?? []).reduce((s, l) => s + Math.max(0, l.amount), 0);
    if (input.lines?.length && lineSum > 0) for (const l of input.lines) bases.set(rateOf(l.taxClass), (bases.get(rateOf(l.taxClass)) ?? 0) + (Math.max(0, l.amount) / lineSum) * goods);
    else bases.set(t.rate, goods);
    if (t.taxDelivery) bases.set(t.rate, (bases.get(t.rate) ?? 0) + (delivery ?? 0) + fee);
    for (const [rate, base] of [...bases].sort((a, b) => b[0] - a[0])) {
      if (rate <= 0 || base <= 0) continue;
      const part = round(t.inclusive ? (base * rate) / (100 + rate) : (base * rate) / 100);
      taxBreakdown.push({ rate, base: round(base), tax: part });
      tax += part;
    }
    tax = round(tax);
    if (!t.inclusive) taxAdded = tax;
  }
  return { subtotal, discount, delivery, fee, tax, taxAdded, total: Math.max(0, round(goods + (delivery ?? 0) + fee + taxAdded)), shipping, taxBreakdown };
}
