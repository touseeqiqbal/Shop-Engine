import "server-only";
import { perStoreCache } from "@/lib/store-cache";
import { currentStoreId } from "@/lib/tenant";
import { isCmsConfigured } from "@/lib/db/config";
import { getAllProducts, getCategories, getProductsByIds } from "@/lib/repo/catalog";
import { effectivePrice } from "@/lib/utils";
import type { CatalogProduct } from "@/lib/types";
import { inStore, payloadClient, storefrontId } from "./catalog-source";

/** Product collections from /cms → Catalog → Collections, resolved against the live catalog. */

type Doc = Record<string, unknown>;
const obj = (v: unknown): Doc | null => (v && typeof v === "object" ? (v as Doc) : null);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export interface CollectionData {
  slug: string;
  title: string;
  description: string;
  image?: string;
  products: CatalogProduct[];
  updatedAt: string;
  seoTitle?: string;
  seoDescription?: string;
  seoImage?: string;
  seoNoindex?: boolean;
  seoCanonical?: string;
}

interface Rule {
  field: string;
  category?: string; // storefront category id
  brand?: string; // brand slug
  value: string;
}

const loadDocsCached = perStoreCache(
  "cms-collections-v4",
  async (storeId: number | null): Promise<Doc[]> => {
    if (!isCmsConfigured) return [];
    const payload = await payloadClient();
    // published, and inside its Show from / Show until dates (housekeeping refreshes the cache when one passes)
    const now = new Date().toISOString();
    const res = await payload.find({
      collection: "product-collections" as never,
      where: { and: [{ published: { equals: true } }, { or: [{ showFrom: { exists: false } }, { showFrom: { less_than_equal: now } }] }, { or: [{ showUntil: { exists: false } }, { showUntil: { greater_than: now } }] }, inStore(storeId)] },
      limit: 0,
      pagination: false,
      depth: 1,
      overrideAccess: true,
    });
    // Keep only what the storefront needs (relationships reduced to storefront ids / slugs).
    return (res.docs as Doc[]).map((d) => ({
      id: String(d.id),
      slug: d.slug,
      title: d.title,
      description: d.description,
      image: obj(d.image)?.url,
      type: d.type,
      match: d.match,
      sort: d.sort,
      limit: d.limit,
      updatedAt: d.updatedAt,
      // SEO fields (Collections → SEO) – they were stored but never used
      seoTitle: str(obj(d.meta)?.title) || undefined,
      seoDescription: str(obj(d.meta)?.description) || undefined,
      seoImage: obj(obj(d.meta)?.image)?.url,
      seoNoindex: obj(d.meta)?.noindex === true || undefined,
      seoCanonical: str(obj(d.meta)?.canonical) || undefined,
      productIds: (Array.isArray(d.products) ? d.products : []).map((p) => storefrontId(obj(p))).filter(Boolean),
      rules: (Array.isArray(d.rules) ? (d.rules as Doc[]) : []).map((r) => ({ field: str(r.field), category: storefrontId(obj(r.category)) || undefined, brand: str(obj(r.brand)?.slug) || undefined, value: str(r.value) })),
    }));
  },
  300,
);
/** The current store's published collections. */
const loadDocs = async () => loadDocsCached(await currentStoreId());

async function resolve(d: Doc): Promise<CollectionData> {
  let products: CatalogProduct[];
  if (d.type === "automatic") {
    const [all, categories] = await Promise.all([getAllProducts(), getCategories()]);
    const parentOf = new Map(categories.map((c) => [c.id, c.parentId]));
    const inCategory = (p: CatalogProduct, id: string) => {
      let cur: string | null | undefined = p.categoryId;
      for (let i = 0; cur && i < 20; i++) {
        if (cur === id) return true;
        cur = parentOf.get(cur);
      }
      return false;
    };
    const test = (p: CatalogProduct, r: Rule): boolean => {
      const price = effectivePrice(p);
      switch (r.field) {
        case "category": return !!r.category && inCategory(p, r.category);
        case "brand": return !!r.brand && p.brand === r.brand;
        case "condition": return p.condition === r.value;
        case "tag": return p.tags.some((t) => t.toLowerCase() === r.value.toLowerCase());
        case "priceMax": return Number(r.value) > 0 && price <= Number(r.value);
        case "priceMin": return price >= Number(r.value || 0);
        case "onSale": return p.salePrice != null && p.salePrice < p.price;
        case "hotDeal": return Boolean(p.hotDeal);
        case "bestSeller": return Boolean(p.bestSeller);
        case "featured": return Boolean(p.featured);
        case "inStock": return p.stock > 0;
        default: return false;
      }
    };
    const rules = (d.rules as Rule[]).filter((r) => r.field);
    products = rules.length ? all.filter((p) => (d.match === "any" ? rules.some((r) => test(p, r)) : rules.every((r) => test(p, r)))) : [];
  } else {
    products = await getProductsByIds(d.productIds as string[]);
  }
  const sorted = [...products];
  switch (d.sort) {
    case "popular": sorted.sort((a, b) => b.soldCount - a.soldCount); break;
    case "newest": sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt)); break;
    case "price-asc": sorted.sort((a, b) => effectivePrice(a) - effectivePrice(b)); break;
    case "price-desc": sorted.sort((a, b) => effectivePrice(b) - effectivePrice(a)); break;
  }
  const limit = Number(d.limit) > 0 ? Number(d.limit) : undefined;
  return {
    slug: str(d.slug),
    title: str(d.title),
    description: str(d.description),
    image: str(d.image) || undefined,
    products: limit ? sorted.slice(0, limit) : sorted,
    updatedAt: str(d.updatedAt),
    seoTitle: (d.seoTitle as string | undefined) || undefined,
    seoDescription: (d.seoDescription as string | undefined) || undefined,
    seoImage: (d.seoImage as string | undefined) || undefined,
    seoNoindex: d.seoNoindex === true || undefined,
    seoCanonical: (d.seoCanonical as string | undefined) || undefined,
  };
}

/** Storefront ids of the products in a collection (by its Payload id) – e.g. for a collection discount. */
export async function collectionProductIds(collectionId: string): Promise<string[]> {
  const d = (await loadDocs()).find((x) => x.id === collectionId);
  if (!d) return [];
  const all = d.type === "automatic" ? { ...d, limit: 0 } : d;
  return (await resolve(all)).products.map((p) => p.id);
}

export async function getCollection(slug: string): Promise<CollectionData | null> {
  const d = (await loadDocs()).find((x) => x.slug === slug);
  return d ? resolve(d) : null;
}

export async function listCollections(): Promise<{ slug: string; title: string; updatedAt: string }[]> {
  // hidden from search engines (or pointing at another original) → not in the sitemap
  return (await loadDocs())
    .filter((d) => d.seoNoindex !== true && !d.seoCanonical)
    .map((d) => ({ slug: str(d.slug), title: str(d.title), updatedAt: str(d.updatedAt) }));
}
