import { getPayload } from "payload";
import config from "@payload-config";
import { isStaffUser } from "@/payload/access";
import { getObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** GET /cms-file?key=returns/… – private customer uploads (return / warranty photos) for signed-in staff only. */
const ALLOWED = /^(returns|warranty|tradein|reviews-pending)\/[A-Za-z0-9._/-]+$/;

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key") ?? "";
  if (!ALLOWED.test(key) || key.includes("..")) return Response.json({ error: "Not found" }, { status: 404 });
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: req.headers });
  // full staff rights only (owners/managers must have 2-step on – same rule as the rest of /cms)
  if (!isStaffUser(user as never)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const obj = await getObject(key);
  if (!obj) return Response.json({ error: "Not found" }, { status: 404 });
  const type = /^image\/(jpeg|png|webp)$/.test(obj.contentType ?? "") ? obj.contentType! : "application/octet-stream";
  return new Response(obj.body, {
    headers: { "Content-Type": type, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'", "X-Robots-Tag": "noindex" },
  });
}
