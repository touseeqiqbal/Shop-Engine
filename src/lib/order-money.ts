/**
 * What the rider collects and whether an order may be shipped. Client-safe; used by the order panel,
 * printed slips/invoices, customer messages, the thank-you page and the Orders hook – one rule everywhere.
 *
 * - An advance only counts once staff APPROVED it (payment status "Advance paid"). An uploaded but unchecked
 *   or rejected screenshot never lowers the amount to collect.
 * - JazzCash / EasyPaisa / bank / card orders are paid up front: they may not be confirmed or shipped until
 *   the payment is "Paid". If one is somehow shipped unpaid, the full amount must be collected.
 */
export const ONLINE_PAYMENT_METHODS = new Set(["jazzcash", "easypaisa", "bank", "card"]);

type MoneyOrder = { paymentMethod?: string | null; paymentStatus?: string | null; total?: number | null; advancePaid?: number | null };

export const creditedAdvance = (o: MoneyOrder) => (o.paymentStatus === "partial" ? Math.max(0, o.advancePaid ?? 0) : 0);

export function amountToCollect(o: MoneyOrder): number {
  if (o.paymentStatus === "paid" || o.paymentStatus === "refunded") return 0;
  return Math.max(0, (o.total ?? 0) - creditedAdvance(o));
}

/** Online payment not verified yet → can't be confirmed or shipped. */
export const paymentBlocksShipping = (o: MoneyOrder) => ONLINE_PAYMENT_METHODS.has(o.paymentMethod ?? "") && o.paymentStatus !== "paid";

/** Statuses that mean "we are going ahead with this order". */
export const PROCEED_STATUSES = new Set(["confirmed", "dispatched", "out-for-delivery", "delivered"]);
