import { apiError, authenticate, orderOut } from "@/lib/store-api";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/orders/{order number}/status   (orders:write)
 * { "status": "dispatched", "courier": "TCS", "trackingNumber": "779412326902", "note": "…" }
 * The same moves a member of staff may make in /cms (confirm, ship, out for delivery, deliver, refused, returned,
 * cancel before shipping); anything else needs a manager in /cms. The customer gets the usual message.
 */
export async function POST(req: Request, ctx: { params: Promise<{ orderNumber: string }> }) {
  const caller = await authenticate(req, "orders:write");
  if (caller instanceof Response) return caller;
  const orderNumber = decodeURIComponent((await ctx.params).orderNumber);
  const { payload, storeId } = caller;
  const o = (await payload.find({ collection: "orders", where: { and: [{ orderNumber: { equals: orderNumber } }, { store: { equals: storeId } }] }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Record<string, unknown> | undefined;
  if (!o) return apiError(404, "No such order in this store.");
  const body = (await req.json().catch(() => null)) as { status?: string; courier?: string; trackingNumber?: string; note?: string } | null;
  const next = String(body?.status ?? "");
  const current = String(o.status);
  const { STAFF_MOVES } = await import("@/payload/collections/content");
  if (!(STAFF_MOVES[current] ?? []).includes(next)) return apiError(409, `An order that is “${current}” can't become “${next || "?"}” through the API.`, { allowed: STAFF_MOVES[current] ?? [] });
  // a paid (or advance-paid) order: cancelling it means refunding the customer – the store's owner or a manager does that
  // in /cms, where the refund reminder goes out; an API key (an ERP, an automation) can't
  if (next === "cancelled" && ["paid", "partial", "awaiting-verification"].includes(String(o.paymentStatus ?? "")))
    return apiError(409, "This order is already paid (or has an advance) – cancel it in /cms, where the payment is refunded.");
  const courier = String(body?.courier ?? "").trim().slice(0, 60);
  const trackingNumber = String(body?.trackingNumber ?? "").trim().slice(0, 80);
  const note = String(body?.note ?? "").trim().slice(0, 300);
  try {
    const saved = await payload.update({
      collection: "orders",
      id: Number(o.id),
      data: { status: next, ...(courier ? { courier } : {}), ...(trackingNumber ? { trackingNumber } : {}), history: [{ status: next, at: new Date().toISOString(), note: `Store API (${caller.keyName})${note ? ` – ${note}` : ""}` }] } as never,
      overrideAccess: true,
      context: { expectStatus: current },
    });
    const [{ logActivity }, { createLocalReq }] = await Promise.all([import("@/payload/collections/history"), import("payload")]);
    await logActivity(await createLocalReq({}, payload), { action: "update", entity: "orders", entityLabel: "Order", docId: String(o.id), title: orderNumber, changes: [{ field: "status", from: current, to: next }, ...(trackingNumber ? [{ field: "trackingNumber", from: String(o.trackingNumber ?? ""), to: trackingNumber }] : [])], storeId, actor: { id: null, email: `API key: ${caller.keyName}` } });
    return Response.json({ data: orderOut(saved as unknown as Record<string, unknown>) }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    const status = (e as { status?: number }).status;
    return apiError(status && status < 500 ? status : 400, (e as Error).message || "Couldn’t update the order.");
  }
}
