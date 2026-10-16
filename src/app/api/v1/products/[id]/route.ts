import { createLocalReq, commitTransaction, initTransaction, killTransaction, type Where } from "payload";
import { apiError, authenticate, productOut } from "@/lib/store-api";

export const dynamic = "force-dynamic";

type Doc = Record<string, unknown>;

async function own(caller: { payload: import("payload").Payload; storeId: number }, idOrSku: string) {
  const where: Where = /^\d+$/.test(idOrSku) ? { id: { equals: Number(idOrSku) } } : { sku: { equals: idOrSku } };
  return (await caller.payload.find({ collection: "products", where: { and: [where, { store: { equals: caller.storeId } }] }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined;
}

/** GET /api/v1/products/{id or SKU}   (products:read) */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const caller = await authenticate(req, "products:read");
  if (caller instanceof Response) return caller;
  const p = await own(caller, decodeURIComponent((await ctx.params).id));
  return p ? Response.json({ data: productOut(p) }, { headers: { "cache-control": "no-store" } }) : apiError(404, "No such product in this store.");
}

/**
 * PATCH /api/v1/products/{id or SKU}   (products:write)
 * { "stock": 12, "price": 2499, "compareAtPrice": 2999 } – any of them. Stock changes are written to Stock history
 * ("Other – Store API"). A product with options (variants) keeps stock per option: update the option's SKU.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const caller = await authenticate(req, "products:write");
  if (caller instanceof Response) return caller;
  const p = await own(caller, decodeURIComponent((await ctx.params).id));
  if (!p) return apiError(404, "No such product in this store.");
  const body = (await req.json().catch(() => null)) as { stock?: unknown; price?: unknown; compareAtPrice?: unknown } | null;
  if (!body || typeof body !== "object") return apiError(400, "Send JSON: { \"stock\": 12, \"price\": 2499 }");
  const n = (v: unknown) => (v === null ? null : typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined);
  const stock = body.stock === undefined ? undefined : n(body.stock);
  const price = body.price === undefined ? undefined : n(body.price);
  const compare = body.compareAtPrice === undefined ? undefined : n(body.compareAtPrice);
  if (stock === undefined && body.stock !== undefined) return apiError(400, "“stock” must be a whole number of 0 or more.");
  if ((price === undefined && body.price !== undefined) || price === null) return apiError(400, "“price” must be a number of 0 or more.");
  if (compare === undefined && body.compareAtPrice !== undefined) return apiError(400, "“compareAtPrice” must be a number of 0 or more, or null.");
  if (stock === undefined && price === undefined && compare === undefined) return apiError(400, "Nothing to change – send stock, price and/or compareAtPrice.");

  const { payload } = caller;
  const r = await createLocalReq({}, payload);
  await initTransaction(r);
  try {
    if (stock !== undefined && stock !== null) {
      const { setStock, setStockLog, trackedProducts } = await import("@/payload/stock");
      if ((await trackedProducts(payload, [Number(p.id)], r)).has(Number(p.id))) throw Object.assign(new Error("This product's stock comes from its serial numbers – add or remove units in /cms instead."), { status: 400 });
      setStockLog(r, { reason: "other", note: `Store API (${caller.keyName})` });
      await setStock(payload, Number(p.id), Math.floor(stock), r);
    }
    if (price !== undefined || compare !== undefined) {
      const nextPrice = price ?? Number(p.price);
      if (compare != null && compare <= nextPrice) throw Object.assign(new Error("“compareAtPrice” must be higher than the price (or null to remove it)."), { status: 400 });
      await payload.update({ collection: "products", id: Number(p.id), data: { ...(price !== undefined ? { price } : {}), ...(compare !== undefined ? { compareAtPrice: compare } : {}) } as never, overrideAccess: true, req: r, context: { system: true } });
    }
    await commitTransaction(r);
  } catch (e) {
    await killTransaction(r);
    const status = (e as { status?: number }).status;
    return apiError(status && status < 500 ? status : 400, (e as Error).message || "Couldn’t update the product.");
  }
  const fresh = await own(caller, String(p.id));
  return Response.json({ data: fresh ? productOut(fresh) : null }, { headers: { "cache-control": "no-store" } });
}
