import type { Payload, PayloadRequest } from "payload";

/**
 * One refund ledger per order, across both ways money goes back:
 *  - finished returns ("Refunded" – cash, bank transfer, wallet, store credit: Orders → Returns), and
 *  - refunds through the payment provider (the order's card / wallet payment), unless they failed.
 * Both refund paths check against it (with the order row locked), so together they never give back more than the
 * order's total – a card refund plus a cash refund for the same order used to both pass.
 */
export async function refundedOnOrder(payload: Payload, orderId: number, req?: PayloadRequest, opts: { exceptReturn?: number | string | null } = {}): Promise<{ returns: number; online: number; total: number }> {
  const withReq = req ? { req } : {};
  const [returns, online] = await Promise.all([
    payload.find({
      collection: "return-requests",
      where: { and: [{ order: { equals: orderId } }, { status: { equals: "refunded" } }, ...(opts.exceptReturn != null ? [{ id: { not_equals: opts.exceptReturn } }] : [])] },
      limit: 500,
      depth: 0,
      overrideAccess: true,
      ...withReq,
    }),
    payload.find({ collection: "payment-transactions", where: { and: [{ order: { equals: orderId } }, { kind: { equals: "refund" } }, { status: { not_equals: "failed" } }] }, limit: 500, depth: 0, overrideAccess: true, ...withReq }),
  ]);
  const sum = (docs: unknown[], field: string) => docs.reduce<number>((s, d) => s + (Number((d as Record<string, unknown>)[field]) || 0), 0);
  const r = Math.round(sum(returns.docs, "refundAmount") * 1000) / 1000;
  const o = Math.round(sum(online.docs, "amount") * 1000) / 1000;
  return { returns: r, online: o, total: Math.round((r + o) * 1000) / 1000 };
}

/** What can still be refunded on an order (its total minus everything refunded so far, never below 0). */
export async function refundableOnOrder(payload: Payload, order: { id: number | string; total?: unknown }, req?: PayloadRequest): Promise<number> {
  const done = await refundedOnOrder(payload, Number(order.id), req);
  return Math.max(0, Math.round(((Number(order.total) || 0) - done.total) * 1000) / 1000);
}
