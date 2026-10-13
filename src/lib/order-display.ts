/** Client-safe display helpers for orders (labels, payment instructions). `src/lib/repo/orders.ts` is server-only. */
import type { OrderStatus, PaymentMethod, PaymentStatus, StoreSettings } from "./types";

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cod: "Cash on Delivery",
  jazzcash: "JazzCash",
  easypaisa: "EasyPaisa",
  bank: "Bank Transfer",
  card: "Debit / Credit Card",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  "awaiting-verification": "Awaiting verification",
  paid: "Paid",
  refunded: "Refunded",
  partial: "Partially paid",
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
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

/** Account lines to show for an online payment method. */
export function paymentAccountLines(method: PaymentMethod, s: StoreSettings): { label: string; value: string }[] {
  switch (method) {
    case "bank":
      return [
        { label: "Bank", value: s.bank.bankName },
        { label: "Account title", value: s.bank.accountTitle },
        { label: "Account number", value: s.bank.accountNumber },
        { label: "IBAN", value: s.bank.iban },
      ];
    case "jazzcash":
      return [
        { label: "JazzCash account", value: s.jazzcash.title },
        { label: "Mobile number", value: s.jazzcash.number },
      ];
    case "easypaisa":
      return [
        { label: "EasyPaisa account", value: s.easypaisa.title },
        { label: "Mobile number", value: s.easypaisa.number },
      ];
    default:
      return [];
  }
}

/** 0342-6693115 → 923426693115 (wa.me / WhatsApp Cloud API format). */
export function toIntlPkPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("92")) return d;
  if (d.startsWith("0")) return `92${d.slice(1)}`;
  return d;
}
