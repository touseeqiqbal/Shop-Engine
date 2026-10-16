import { DEFAULT_LOCALE, type StoreLocale } from "../../../lib/locale";
import { intlDigits } from "../../../lib/phone";
import { formatDate } from "../../../lib/time";

/** Plain-language order wording and colours used across the admin (list, order page, search, dashboard). Money: useAdminMoney. */

export type Tone = "y" | "b" | "g" | "r" | "n";

export const ORDER_STATUS: Record<string, { label: string; tone: Tone; help: string }> = {
  "awaiting-payment": { label: "Waiting for online payment", tone: "y", help: "The customer is paying online. It moves on by itself once the payment provider confirms it (or is cancelled if it isn't paid)." },
  "awaiting-confirmation": { label: "Waiting for customer", tone: "y", help: "Customer has not confirmed this order yet." },
  pending: { label: "To confirm", tone: "y", help: "New order. Check it and confirm with the customer." },
  confirmed: { label: "To ship", tone: "b", help: "Confirmed. Pack it and hand it to the courier." },
  dispatched: { label: "Shipped", tone: "b", help: "With the courier." },
  "out-for-delivery": { label: "Out for delivery", tone: "b", help: "The rider has it today." },
  delivered: { label: "Delivered", tone: "g", help: "Done." },
  cancelled: { label: "Cancelled", tone: "n", help: "Cancelled – nothing more to do." },
  refused: { label: "Refused (returned to us)", tone: "r", help: "Customer refused the parcel." },
  returned: { label: "Returned", tone: "r", help: "Customer sent it back." },
};

export const PAYMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  unpaid: { label: "Not paid", tone: "n" },
  "awaiting-verification": { label: "Payment to check", tone: "y" },
  paid: { label: "Paid", tone: "g" },
  partial: { label: "Advance paid", tone: "b" },
  refunded: { label: "Refunded", tone: "r" },
  "partially-refunded": { label: "Partly refunded", tone: "r" },
};

export const PAYMENT_METHOD: Record<string, string> = {
  cod: "Cash on delivery",
  jazzcash: "JazzCash",
  easypaisa: "EasyPaisa",
  bank: "Bank transfer",
  card: "Card",
};

/** The one obvious next step for an order, shown as the main button. */
export const NEXT_STEP: Record<string, { to: string; label: string; askCourier?: boolean } | undefined> = {
  "awaiting-confirmation": { to: "confirmed", label: "Customer confirmed (by phone)" },
  pending: { to: "confirmed", label: "Confirm order" },
  confirmed: { to: "dispatched", label: "Mark as shipped", askCourier: true },
  dispatched: { to: "out-for-delivery", label: "Out for delivery" },
  "out-for-delivery": { to: "delivered", label: "Mark as delivered" },
};

/** "3 hours ago", or the date in the store's time zone (`loc` from useAdminLocale) once it's a week old. */
export function timeAgo(iso: string, loc: Pick<StoreLocale, "timezone" | "locale"> = DEFAULT_LOCALE) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const min = Math.round((Date.now() - t) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`;
  return formatDate(t, loc, { day: "numeric", month: "short", year: "numeric" });
}

/** WhatsApp / tel links: the number with its country code, no "+" (Pakistan 03xx… → 923xx…; `country` = the store's). */
export const intlPhone = (phone: string, country?: string) => intlDigits(phone, country);
