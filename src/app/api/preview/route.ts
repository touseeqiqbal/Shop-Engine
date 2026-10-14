import { cookies, draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { safePath } from "@/lib/safe-path";
import { adminRequest, canSeeStore } from "@/payload/route-access";
import { PREVIEW_STORE_COOKIE } from "@/lib/tenant-shared";

/**
 * Entry point for /cms live preview & "Preview" buttons: /api/preview?path=/pages/about
 * Only a store's team (Payload session cookie) can switch Draft Mode on; then it redirects to the page.
 * The store being previewed is remembered in a cookie that the storefront only honours while Draft Mode is on
 * (which only this route can switch on) – so a store's drafts can be checked on the main address.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const { payload, t } = await adminRequest(request);
  if (!t.platformAdmin && !t.roles.size) return new Response("Sign in to /cms to preview drafts.", { status: 401 });
  let store = t.activeStoreId;

  // a product: its page address comes from the latest draft (name / category may have changed, may be unpublished)
  const productId = Number(params.get("product"));
  let path: string;
  if (productId) {
    const draft = (await payload.findByID({ collection: "products", id: productId, draft: true, depth: 1, overrideAccess: true }).catch(() => null)) as { slug?: string; category?: unknown; store?: unknown } | null;
    if (draft && !canSeeStore(t, draft.store)) return new Response("Product not found.", { status: 404 });
    if (!draft?.slug) return new Response("Save the product once (name and category) to preview it.", { status: 400 });
    store = Number((draft.store && typeof draft.store === "object" ? (draft.store as { id?: number }).id : draft.store) ?? store) || store;
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
  if (store != null) (await cookies()).set(PREVIEW_STORE_COOKIE, String(store), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 });
  redirect(path);
}
