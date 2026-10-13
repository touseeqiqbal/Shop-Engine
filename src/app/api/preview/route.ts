import { draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { getPayload } from "payload";
import config from "@payload-config";
import { safePath } from "@/lib/safe-path";
import { isStaffUser } from "@/payload/access";

/**
 * Entry point for /cms live preview & "Preview" buttons: /api/preview?path=/pages/about
 * Only signed-in staff (Payload session cookie) can switch Draft Mode on; then it redirects to the page.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: request.headers });
  if (!isStaffUser(user as never)) return new Response("Sign in to /cms to preview drafts.", { status: 401 });

  // a product: its page address comes from the latest draft (name / category may have changed, may be unpublished)
  const productId = Number(params.get("product"));
  let path: string;
  if (productId) {
    const draft = (await payload.findByID({ collection: "products", id: productId, draft: true, depth: 1, overrideAccess: true }).catch(() => null)) as { slug?: string; category?: unknown } | null;
    if (!draft?.slug) return new Response("Save the product once (name and category) to preview it.", { status: 400 });
    let cat = draft.category && typeof draft.category === "object" ? (draft.category as { slug?: string; parent?: unknown }) : null;
    for (let hops = 0; hops < 20 && cat?.parent; hops++) {
      const parentId = typeof cat.parent === "object" ? (cat.parent as { id?: number }).id : cat.parent;
      const parent = parentId ? ((await payload.findByID({ collection: "categories", id: Number(parentId), depth: 0, overrideAccess: true }).catch(() => null)) as { slug?: string; parent?: unknown } | null) : null;
      if (!parent) break;
      cat = parent;
    }
    path = `/${cat?.slug ?? "products"}/${draft.slug}`;
  } else {
    // Same-site paths only (no open redirects).
    path = safePath(params.get("path") ?? "/", "");
    if (!path) return new Response("Invalid path", { status: 400 });
  }

  (await draftMode()).enable();
  redirect(path);
}
