/** Client-safe display helpers for orders (labels, payment instructions). `src/lib/repo/orders.ts` is server-only. */
import { intlDigits } from "./phone";
import { countryName } from "./locale";
import { BUILT_IN_METHODS, findCheckoutMethod, paymentLabel } from "./payments/methods";
import type { OrderStatus, PaymentMethod, PaymentStatus, StoreSettings } from "./types";

/** Names of the built-in payment methods. An order's own method name: `paymentLabel(order.paymentMethod, order.paymentMethodLabel)`. */
export const PAYMENT_LABEL: Record<string, string> = Object.fromEntries(Object.entries(BUILT_IN_METHODS).map(([id, m]) => [id, m.label]));
export { paymentLabel };

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  "awaiting-verification": "Awaiting verification",
  paid: "Paid",
  refunded: "Refunded",
  partial: "Partially paid",
  "partially-refunded": "Partly refunded",
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  "awaiting-payment": "Waiting for payment",
  "awaiting-confirmation": "Awaiting your confirmation",
  pending: "Pending",
  confirmed: "Confirmed",
  dispatched: "Dispatched",
  "out-for-delivery": "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refused: "Refused",
  returned: "Returned",
};

/** Happy-path progression shown in the tracking timeline. */
export const ORDER_FLOW: OrderStatus[] = ["pending", "confirmed", "dispatched", "out-for-delivery", "delivered"];

/** Where to send the money for a method paid before shipping (wallets, bank, the store's own methods). */
export function paymentAccountLines(method: PaymentMethod, s: StoreSettings): { label: string; value: string }[] {
  return findCheckoutMethod(method, s)?.account ?? [];
}

/** 0342-6693115 → 923426693115 (wa.me / WhatsApp Cloud API format); other countries' numbers by `country`. */
export function toIntlPkPhone(phone: string, country = "PK") {
  return intlDigits(phone, country);
}

/**
 * "Lahore" / "Austin, TX 78701" – the city line of an address (state and postcode when the customer gave them), with
 * the country's name when the parcel goes abroad (`home` = the store's country).
 */
export function cityLine(c: { city?: string | null; region?: string | null; postalCode?: string | null; country?: string | null }, home?: string) {
  const tail = [c.region, c.postalCode].map((v) => (v ?? "").trim()).filter(Boolean).join(" ");
  const abroad = c.country && home && c.country !== home ? countryName(c.country) : "";
  return [c.city?.trim(), tail, abroad].filter(Boolean).join(", ");
}
