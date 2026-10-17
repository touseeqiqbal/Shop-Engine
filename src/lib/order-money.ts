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

type MoneyOrder = { paymentMethod?: string | null; paymentDue?: string | null; paymentStatus?: string | null; total?: number | null; advancePaid?: number | null; giftCardAmount?: number | null };

/** What a gift card already paid of the order. */
export const giftCardPaid = (o: MoneyOrder) => Math.max(0, Number(o.giftCardAmount) || 0);
/** What is left to pay after the gift card (online payments are for this much). */
export const dueAfterGiftCard = (o: MoneyOrder) => Math.max(0, (o.total ?? 0) - giftCardPaid(o));

/** Paid when the order arrives? Orders say so themselves (paymentDue); older orders: cash on delivery only. */
export const paidOnDelivery = (o: MoneyOrder) => (o.paymentDue ? o.paymentDue === "on-delivery" : o.paymentMethod === "cod");
/** Paid before the order ships (checked by staff, or confirmed by the payment provider). */
export const paidUpfront = (o: MoneyOrder) => Boolean(o.paymentMethod) && !paidOnDelivery(o);

export const creditedAdvance = (o: MoneyOrder) => (o.paymentStatus === "partial" ? Math.max(0, o.advancePaid ?? 0) : 0);

export function amountToCollect(o: MoneyOrder): number {
  if (o.paymentStatus === "paid" || o.paymentStatus === "refunded" || o.paymentStatus === "partially-refunded") return 0;
  return Math.max(0, (o.total ?? 0) - giftCardPaid(o) - creditedAdvance(o));
}

/** Online payment not verified yet → can't be confirmed or shipped. */
export const paymentBlocksShipping = (o: MoneyOrder) => paidUpfront(o) && o.paymentStatus !== "paid" && o.paymentStatus !== "partially-refunded";

/** Statuses that mean "we are going ahead with this order". */
export const PROCEED_STATUSES = new Set(["confirmed", "dispatched", "out-for-delivery", "delivered"]);

/**
 * The tax lines of an order for invoices and receipts: one per rate ("Tax 17%", or "incl. tax 17%" when the prices
 * already included it). `added`: the tax came on top of the prices (it is shown before the total, not after).
 */
export function taxLines(o: { subtotal?: number; discount?: number; deliveryCharge?: number; total?: number; taxTotal?: number; taxBreakdown?: { rate: number; tax: number }[] | null }): { added: boolean; lines: { label: string; amount: number }[] } {
  const tax = Number(o.taxTotal) || 0;
  if (tax <= 0) return { added: false, lines: [] };
  // added on top: the total is more than items − discount + delivery
  const added = Math.round(((o.total ?? 0) - ((o.subtotal ?? 0) - (o.discount ?? 0) + (o.deliveryCharge ?? 0))) * 100) > 0;
  const name = added ? "Tax" : "incl. tax";
  const parts = (o.taxBreakdown ?? []).filter((t) => t.tax > 0);
  return { added, lines: parts.length ? parts.map((t) => ({ label: `${name} ${t.rate}%`, amount: t.tax })) : [{ label: added ? "Tax" : "Tax included", amount: tax }] };
}
