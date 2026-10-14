import { adminRequest, canSeeStore } from "@/payload/route-access";
import { getObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** GET /cms-proof/<orderId> – streams an order's private payment screenshot to signed-in staff (/cms session). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // the store's team only (owners/managers must have 2-step on – same rule as the rest of /cms)
  const { payload, t } = await adminRequest(req);
  if (!t.platformAdmin && !t.roles.size) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!/^\d+$/.test(id)) return Response.json({ error: "Invalid id" }, { status: 400 });

  const order = (await payload.findByID({ collection: "orders" as never, id: Number(id), depth: 0, overrideAccess: true }).catch(() => null)) as { paymentScreenshotKey?: string; store?: unknown } | null;
  if (!order || !canSeeStore(t, order.store)) return Response.json({ error: "No screenshot" }, { status: 404 });
  const raw = order?.paymentScreenshotKey ?? "";
  // Older orders stored the admin URL (…?key=payments/…); new ones store the key itself.
  const key = raw.includes("key=") ? decodeURIComponent(raw.split("key=")[1].split("&")[0]) : raw;
  if (!key.startsWith("payments/") || key.includes("..") || key.includes("\\")) return Response.json({ error: "No screenshot" }, { status: 404 });

  const obj = await getObject(key);
  if (!obj) return Response.json({ error: "Not found" }, { status: 404 });
  const type = /^image\/(jpeg|png|webp|gif|avif)$|^application\/pdf$/.test(obj.contentType ?? "") ? obj.contentType! : "application/octet-stream";
  return new Response(obj.body, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
      "X-Robots-Tag": "noindex",
    },
  });
}
