/**
 * What the rider collects and whether an order may be shipped. Client-safe; used by the order panel,
 * printed slips/invoices, customer messages, the thank-you page and the Orders hook – one rule everywhere.
 *
 * - An advance only counts once staff APPROVED it (payment status "Advance paid"). An uploaded but unchecked
 *   or rejected screenshot never lowers the amount to collect.
 * - Methods paid up front (wallets, bank transfer, cards, a store's own "before shipping" methods) may not be
 *   confirmed or shipped until the payment is "Paid". If one is somehow shipped unpaid, the full amount must be collected.
 *   Cash on delivery (and a store's own "on delivery" methods) is collected by the rider.
 */

type MoneyOrder = { paymentMethod?: string | null; paymentDue?: string | null; paymentStatus?: string | null; total?: number | null; advancePaid?: number | null };

/** Paid when the order arrives? Orders say so themselves (paymentDue); older orders: cash on delivery only. */
export const paidOnDelivery = (o: MoneyOrder) => (o.paymentDue ? o.paymentDue === "on-delivery" : o.paymentMethod === "cod");
/** Paid before the order ships (checked by staff, or confirmed by the payment provider). */
export const paidUpfront = (o: MoneyOrder) => Boolean(o.paymentMethod) && !paidOnDelivery(o);

export const creditedAdvance = (o: MoneyOrder) => (o.paymentStatus === "partial" ? Math.max(0, o.advancePaid ?? 0) : 0);

export function amountToCollect(o: MoneyOrder): number {
  if (o.paymentStatus === "paid" || o.paymentStatus === "refunded" || o.paymentStatus === "partially-refunded") return 0;
  return Math.max(0, (o.total ?? 0) - creditedAdvance(o));
}

/** Online payment not verified yet → can't be confirmed or shipped. */
export const paymentBlocksShipping = (o: MoneyOrder) => paidUpfront(o) && o.paymentStatus !== "paid" && o.paymentStatus !== "partially-refunded";

/** Statuses that mean "we are going ahead with this order". */
export const PROCEED_STATUSES = new Set(["confirmed", "dispatched", "out-for-delivery", "delivered"]);
