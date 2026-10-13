import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, PayloadRequest } from "payload";
import { revalidate } from "./revalidate";

/**
 * SEO safety net: when the URL handle of a live document changes in /cms, add a 301 redirect from the old
 * address to the new one (Settings → Redirects), so search rankings and old links keep working.
 * An existing redirect from the new address back to the old one is removed to avoid loops.
 */

type Doc = Record<string, unknown>;

/** Storefront path of a product: /<top-level category slug>/<product slug> */
async function productPath(req: PayloadRequest, doc: Doc): Promise<string | null> {
  let catId = doc.category && typeof doc.category === "object" ? (doc.category as Doc).id : doc.category;
  let topSlug = "products";
  for (let i = 0; catId && i < 10; i++) {
    const cat = (await req.payload.findByID({ collection: "categories", id: catId as number, depth: 0, overrideAccess: true, req }).catch(() => null)) as Doc | null;
    if (!cat) break;
    topSlug = String(cat.slug);
    catId = cat.parent && typeof cat.parent === "object" ? (cat.parent as Doc).id : cat.parent;
  }
  return doc.slug ? `/${topSlug}/${doc.slug}` : null;
}

const PATHS: Record<string, (req: PayloadRequest, doc: Doc) => Promise<string | null> | string | null> = {
  products: productPath,
  categories: (_req, d) => (d.slug ? `/category/${d.slug}` : null),
  posts: (_req, d) => (d.slug ? `/blog/${d.slug}` : null),
  pages: (_req, d) => (d.slug ? (d.slug === "home" ? "/" : `/pages/${d.slug}`) : null),
  "product-collections": (_req, d) => (d.slug ? `/collections/${d.slug}` : null),
  brands: (_req, d) => (d.slug ? `/brands/${d.slug}` : null),
};

/** A page that is live (again) must never be redirected away from. */
async function clearRedirectsFrom(req: PayloadRequest, path: string) {
  await req.payload.delete({ collection: "redirects", where: { from: { equals: path } }, overrideAccess: true, req });
}

const isLive = (collection: string, d: Doc | undefined) =>
  !!d && (collection === "products" ? d.status === "active" : collection === "product-collections" ? d.published !== false : d._status === undefined || d._status === "published");

export const slugRedirect =
  (collection: keyof typeof PATHS): CollectionAfterChangeHook =>
  async ({ doc, previousDoc, operation, req, context }) => {
    if (context?.migrating) return doc;
    // a product that goes (back) on the store: drop any redirect away from its own address
    if (collection === "products" && isLive(collection, doc) && (!previousDoc || !isLive(collection, previousDoc))) {
      const path = await productPath(req, doc).catch(() => null);
      if (path) await clearRedirectsFrom(req, path).catch(() => undefined);
    }
    // only when a live URL is replaced by another live URL (drafts don't move the public page yet)
    if (operation !== "update" || !previousDoc || !isLive(collection, previousDoc) || !isLive(collection, doc)) return doc;
    const changed = previousDoc.slug !== doc.slug || (collection === "products" && JSON.stringify(previousDoc.category) !== JSON.stringify(doc.category));
    if (!changed) return doc;
    try {
      const [from, to] = await Promise.all([PATHS[collection](req, previousDoc), PATHS[collection](req, doc)]);
      if (!from || !to || from === to) return doc;
      const existing = await req.payload.find({ collection: "redirects", where: { from: { equals: from } }, limit: 1, depth: 0, overrideAccess: true, req });
      const data = { from, to: { type: "custom", url: to } };
      if (existing.docs[0]) await req.payload.update({ collection: "redirects", id: existing.docs[0].id, data: data as never, overrideAccess: true, req });
      else await req.payload.create({ collection: "redirects", data: data as never, overrideAccess: true, req });
      // never leave a loop behind (new → old)
      await clearRedirectsFrom(req, to);
      // no chains: older redirects that pointed to the old address now go straight to the new one
      const pointing = await req.payload.find({ collection: "redirects", where: { "to.url": { equals: from } }, limit: 100, depth: 0, overrideAccess: true, req });
      for (const r of pointing.docs) await req.payload.update({ collection: "redirects", id: r.id, data: { to: { type: "custom", url: to } } as never, overrideAccess: true, req });
      revalidate([], [from]);
      req.payload.logger.info(`[seo] redirect ${from} → ${to}`);
    } catch (e) {
      req.payload.logger.error({ err: e, msg: "[seo] could not create redirect after a URL change" });
    }
    return doc;
  };

/** A deleted product's page sends visitors (and Google) to its category instead of a dead "not found". */
export const productDeletedRedirect: CollectionAfterDeleteHook = async ({ doc, req, context }) => {
  if (context?.migrating || doc?.status !== "active") return doc;
  try {
    const from = await productPath(req, doc as Doc);
    const catId = doc.category && typeof doc.category === "object" ? (doc.category as Doc).id : doc.category;
    const cat = catId ? ((await req.payload.findByID({ collection: "categories", id: catId as number, depth: 0, overrideAccess: true, req }).catch(() => null)) as Doc | null) : null;
    const to = cat?.slug ? `/category/${cat.slug}` : "/shop";
    if (!from) return doc;
    const existing = await req.payload.find({ collection: "redirects", where: { from: { equals: from } }, limit: 1, depth: 0, overrideAccess: true, req });
    if (!existing.docs[0]) await req.payload.create({ collection: "redirects", data: { from, to: { type: "custom", url: to } } as never, overrideAccess: true, req });
    revalidate([], [from]);
  } catch (e) {
    req.payload.logger.error({ err: e, msg: "[seo] could not add a redirect for a deleted product" });
  }
  return doc;
};
