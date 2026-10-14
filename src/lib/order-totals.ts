import { codFee, deliveryCharge } from "./cities";
import type { StoreSettings } from "./types";

/**
 * An order's money, worked out the SAME way in the browser (cart, checkout) and on the server (which is the only one
 * that counts – the browser's total is just shown and compared):
 *   items − discount → delivery (free above the zone's threshold, judged AFTER the discount; free with a free-delivery
 *   discount) → COD fee → tax (included in the prices, or added on top) → total.
 */
export type Totals = { subtotal: number; discount: number; delivery: number | null; fee: number; tax: number; taxAdded: number; total: number };

export function orderTotals(input: {
  subtotal: number;
  discount: number;
  city: string | null | undefined;
  method: string;
  settings: StoreSettings;
  freeShipping?: boolean;
}): Totals {
  const { settings } = input;
  const subtotal = Math.max(0, Math.round(input.subtotal));
  const discount = Math.min(subtotal, Math.max(0, Math.round(input.discount)));
  const goods = subtotal - discount;
  const delivery = input.freeShipping
    ? 0
    : input.city
      ? deliveryCharge(input.city, goods, settings)
      : settings.freeDeliveryThreshold > 0 && goods >= settings.freeDeliveryThreshold
        ? 0
        : null;
  const fee = input.method === "cod" ? codFee(settings) : 0;
  const t = settings.tax;
  let tax = 0;
  let taxAdded = 0;
  if (t?.enabled && t.rate > 0) {
    const base = goods + (t.taxDelivery ? (delivery ?? 0) + fee : 0);
    if (t.inclusive) tax = Math.round((base * t.rate) / (100 + t.rate));
    else tax = taxAdded = Math.round((base * t.rate) / 100);
  }
  return { subtotal, discount, delivery, fee, tax, taxAdded, total: Math.max(0, goods + (delivery ?? 0) + fee + taxAdded) };
}
