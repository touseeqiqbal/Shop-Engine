import { authenticate, paging, productOut, updatedSince } from "@/lib/store-api";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/products?page=&limit=&updated_since=&sku=   (permission: products:read)
 * The store's products, newest change first. docs/STORE-API.md
 */
export async function GET(req: Request) {
  const caller = await authenticate(req, "products:read");
  if (caller instanceof Response) return caller;
  const url = new URL(req.url);
  const { page, limit } = paging(url);
  const sku = url.searchParams.get("sku");
  const res = await caller.payload.find({
    collection: "products",
    where: { and: [{ store: { equals: caller.storeId } }, ...updatedSince(url), ...(sku ? [{ sku: { equals: sku } }] : [])] },
    sort: "-updatedAt",
    page,
    limit,
    depth: 0,
    overrideAccess: true,
    draft: false,
  });
  return Response.json({ data: res.docs.map((p) => productOut(p as unknown as Record<string, unknown>)), page: res.page, totalPages: res.totalPages, total: res.totalDocs }, { headers: { "cache-control": "no-store" } });
}
