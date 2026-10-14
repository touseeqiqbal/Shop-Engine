import { adminRequest, canSeeStore, storeOfPrivateFile } from "@/payload/route-access";
import { getObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** GET /cms-file?key=returns/… – private customer uploads (return / warranty photos) for signed-in staff only. */
const ALLOWED = /^(returns|warranty|tradein|reviews-pending)\/[A-Za-z0-9._/-]+$/;

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key") ?? "";
  if (!ALLOWED.test(key) || key.includes("..")) return Response.json({ error: "Not found" }, { status: 404 });
  // the team of the store whose record holds the file (owners/managers must have 2-step on – same rule as the rest of /cms)
  const { payload, t } = await adminRequest(req);
  if (!t.platformAdmin && !t.roles.size) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const store = await storeOfPrivateFile(payload, key);
  if (store === undefined || !canSeeStore(t, store)) return Response.json({ error: "Not found" }, { status: 404 });
  const obj = await getObject(key);
  if (!obj) return Response.json({ error: "Not found" }, { status: 404 });
  const type = /^image\/(jpeg|png|webp)$/.test(obj.contentType ?? "") ? obj.contentType! : "application/octet-stream";
  return new Response(obj.body, {
    headers: { "Content-Type": type, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'", "X-Robots-Tag": "noindex" },
  });
}
