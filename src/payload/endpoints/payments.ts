import type { Endpoint } from "payload";
import { sameStoreAs, storeGate } from "./guard";
import { logActivity } from "../collections/history";

/**
 * Online payments from /cms (the store being worked in) – any provider plugin (lib/payments/gateways.ts).
 *   GET  /cms-api/payments/order/:id          the order's online payments and refunds
 *   POST /cms-api/payments/refund             { orderId, amount, reason }   refund through the provider (managers)
 */

type Doc = Record<string, unknown>;

const forOrder: Endpoint = {
  path: "/payments/order/:id",
  method: "get",
  handler: async (req) => {
    const gate = await storeGate(req, "store_staff", { allowAll: true });
    if (gate instanceof Response) return gate;
    const id = Number(req.routeParams?.id);
    const order = (await req.payload.findByID({ collection: "orders", id, depth: 0, overrideAccess: true }).catch(() => null)) as unknown as Doc | null;
    if (!order || !sameStoreAs(gate, order)) return Response.json({ error: "Order not found" }, { status: 404 });
    const res = await req.payload.find({ collection: "payment-transactions", where: { order: { equals: id } }, sort: "createdAt", limit: 50, depth: 0, overrideAccess: true });
    const rows = (res.docs as unknown as Doc[]).map((p) => ({ id: p.id, kind: p.kind, status: p.status, amount: p.amount, refundedAmount: p.refundedAmount ?? 0, currency: p.currency, provider: p.provider, at: p.createdAt, failureReason: p.failureReason ?? null }));
    const charge = rows.find((r) => r.kind === "charge" && (r.status === "succeeded" || r.status === "partially_refunded"));
    return Response.json({ payments: rows, refundable: charge ? Number(charge.amount) - Number(charge.refundedAmount) : 0 });
  },
};

const refund: Endpoint = {
  path: "/payments/refund",
  method: "post",
  handler: async (req) => {
    // money goes back to the customer: a manager's decision
    const gate = await storeGate(req, "store_manager", { write: true });
    if (gate instanceof Response) return gate;
    const body = (await req.json?.().catch(() => null)) as { orderId?: number; amount?: number; reason?: string } | null;
    const orderId = Number(body?.orderId);
    const amount = Number(body?.amount);
    if (!Number.isFinite(orderId) || !(amount > 0)) return Response.json({ error: "Enter the amount to refund." }, { status: 400 });
    const order = (await req.payload.findByID({ collection: "orders", id: orderId, depth: 0, overrideAccess: true }).catch(() => null)) as unknown as Doc | null;
    if (!order || !sameStoreAs(gate, order)) return Response.json({ error: "Order not found" }, { status: 404 });
    // the provider that took the payment refunds it
    const charge = (await req.payload.find({ collection: "payment-transactions", where: { and: [{ order: { equals: orderId } }, { kind: { equals: "charge" } }, { status: { in: ["succeeded", "partially_refunded"] } }] }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined;
    if (!charge) return Response.json({ error: "Only online payments are refunded here – record other refunds in Orders → Returns." }, { status: 400 });
    try {
      const { getGateway } = await import("../../lib/payments/gateways");
      const gateway = getGateway(String(charge.provider));
      if (!gateway) return Response.json({ error: `Refunds through “${String(charge.provider)}” aren't available.` }, { status: 400 });
      const r = await gateway.refund(req.payload, req, { orderId, amount, reason: String(body?.reason ?? "").slice(0, 200) });
      await logActivity(req, { action: "update", entity: "orders", entityLabel: "Order", docId: String(orderId), title: String(order.orderNumber ?? orderId), changes: [{ field: `${gateway.label} refund`, from: "", to: `${amount} ${String(charge.currency ?? "")}${body?.reason ? ` – ${body.reason}` : ""}` }], storeId: gate.store });
      return Response.json({ ok: true, ...r });
    } catch (e) {
      return Response.json({ error: (e as Error)?.message || "The refund failed." }, { status: 400 });
    }
  },
};

export const paymentEndpoints: Endpoint[] = [forOrder, refund];
