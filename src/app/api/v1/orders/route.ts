import { authenticate, orderOut, paging, updatedSince } from "@/lib/store-api";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/orders?page=&limit=&status=&updated_since=   (permission: orders:read)
 * The store's orders, most recently changed first. docs/STORE-API.md
 */
export async function GET(req: Request) {
  const caller = await authenticate(req, "orders:read");
  if (caller instanceof Response) return caller;
  const url = new URL(req.url);
  const { page, limit } = paging(url);
  const status = url.searchParams.get("status");
  const res = await caller.payload.find({
    collection: "orders",
    where: { and: [{ store: { equals: caller.storeId } }, ...updatedSince(url), ...(status ? [{ status: { equals: status } }] : [])] },
    sort: "-updatedAt",
    page,
    limit,
    depth: 0,
    overrideAccess: true,
  });
  return Response.json({ data: res.docs.map((o) => orderOut(o as unknown as Record<string, unknown>)), page: res.page, totalPages: res.totalPages, total: res.totalDocs }, { headers: { "cache-control": "no-store" } });
}
