import { apiError, authenticate, orderOut } from "@/lib/store-api";

export const dynamic = "force-dynamic";

/** GET /api/v1/orders/{order number}   (orders:read) */
export async function GET(req: Request, ctx: { params: Promise<{ orderNumber: string }> }) {
  const caller = await authenticate(req, "orders:read");
  if (caller instanceof Response) return caller;
  const orderNumber = decodeURIComponent((await ctx.params).orderNumber);
  const o = (await caller.payload.find({ collection: "orders", where: { and: [{ orderNumber: { equals: orderNumber } }, { store: { equals: caller.storeId } }] }, limit: 1, depth: 0, overrideAccess: true })).docs[0];
  return o ? Response.json({ data: orderOut(o as unknown as Record<string, unknown>) }, { headers: { "cache-control": "no-store" } }) : apiError(404, "No such order in this store.");
}
