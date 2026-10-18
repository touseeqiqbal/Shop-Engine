import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getSetting, listAll } from "./db";
import { isCmsConfigured } from "@/lib/db/config";
import { loadApprovedReviewsFromPayload, loadCatalogFromPayload, loadProductDescription, loadProductDraft } from "@/lib/cms/catalog-source";
import { loadCommerceSettings } from "@/lib/cms/commerce";
import { activeFlashSaleCms, discountedFlashSalesCms } from "@/lib/cms/sales";
import { applyFlashSales } from "@/lib/flash-pricing";
import { perStoreCache } from "@/lib/store-cache";
import { cmsBlogPosts, cmsFaqs, cmsTestimonials } from "@/lib/cms/site";
import { seedFaqs, seedSettings, seedTestimonials } from "@/lib/data/seed";
import type {
  Banner,
  BlogPost,
  Brand,
  CatalogProduct,
  Category,
  CategoryAttribute,
  CategoryNode,
  Condition,
  Facet,
  FaqItem,
  FlashSale,
  LaptopModel,
  Product,
  ProductQuery,
  ProductQueryResult,
  Review,
  StoreSettings,
  Testimonial,
} from "@/lib/types";
import { effectivePrice } from "@/lib/utils";
import { isExactMatch, rank, suggest } from "@/lib/search";
import { currentStoreId } from "@/lib/tenant";
import { log } from "@/lib/log";

/**
 * Everything here is for the store of the current request (`currentStoreId()` – the host, or `runInStore` in jobs).
 * The store id is part of every cache key, so stores never see each other's catalogue.
 */

/** Cache tags – invalidate from admin actions with updateTag(). */
export const TAGS = { catalog: "catalog", content: "content", settings: "settings", reviews: "reviews" } as const;
const REVALIDATE = 300;

// ───────────────────────────── catalog snapshot ─────────────────────────────

interface CatalogSnapshot {
  categories: Category[];
  brands: Brand[];
  products: CatalogProduct[];
  models: LaptopModel[];
}

/**
 * Variants (options like colour / size) are products of their own, grouped under their main product: the main product
 * gets `variants`, the price of its cheapest one, and stock = their total. A variant's address is its main product's
 * page with ?variant=… (it never has a page or a listing of its own).
 */
function groupVariants(products: CatalogProduct[]): CatalogProduct[] {
  const byParent = new Map<string, CatalogProduct[]>();
  const hasAnyVariant = new Set<string>();
  for (const p of products) {
    if (!p.variantOf) continue;
    hasAnyVariant.add(p.variantOf);
    if (p.status === "active") byParent.set(p.variantOf, [...(byParent.get(p.variantOf) ?? []), p]);
  }
  if (!hasAnyVariant.size) return products;
  const parents = new Map(products.map((p) => [p.id, p]));
  return products.map((p) => {
    if (p.variantOf) {
      const main = parents.get(p.variantOf);
      // a variant is sold only while its main product is on the store
      if (!main || main.status !== "active") return { ...p, status: "draft" };
      return { ...p, url: `${main.url}?variant=${encodeURIComponent(p.slug)}`, images: p.images.length ? p.images : main.images };
    }
    const kids = byParent.get(p.id);
    // options exist but none is on the store: nothing to buy (the main product itself can't be sold)
    if (!kids?.length) return hasAnyVariant.has(p.id) ? { ...p, stock: 0 } : p;
    const withUrl = kids.map((k) => ({ ...k, url: `${p.url}?variant=${encodeURIComponent(k.slug)}`, images: k.images.length ? k.images : p.images }));
    const cheapest = withUrl.reduce((a, b) => (effectivePrice(b) < effectivePrice(a) ? b : a));
    return { ...p, variants: withUrl, variantCount: withUrl.length, price: cheapest.price, salePrice: cheapest.salePrice, stock: withUrl.reduce((s, k) => s + Math.max(0, k.stock), 0) };
  });
}

function enrich(products: Product[], categories: Category[], brands: Brand[]): CatalogProduct[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const brandName = new Map(brands.map((b) => [b.slug, b.name]));
  return products.map((p) => {
    const cat = byId.get(p.categoryId);
    let top = cat;
    // hop limit: a broken parent loop must never freeze the server
    for (let hops = 0; hops < 20 && top?.parentId && byId.get(top.parentId); hops++) top = byId.get(top.parentId);
    const topSlug = top?.slug ?? "products";
    return {
      ...p,
      url: `/${topSlug}/${p.slug}`,
      brandName: brandName.get(p.brand) ?? p.brand,
      categoryName: cat?.name ?? "",
      categorySlug: cat?.slug ?? "",
      topCategoryId: top?.id ?? "",
      topCategorySlug: topSlug,
      topCategoryName: top?.name ?? "",
    };
  });
}

/**
 * Catalog source: Payload (/cms) whenever it is configured – the single source of truth since Phase 4.
 * A Payload error is thrown, not hidden: Next.js then keeps serving the last good cached catalog instead of
 * silently falling back to the frozen legacy tables. Without a database the in-memory demo catalog is used.
 */
async function loadRaw(storeId: number | null) {
  if (isCmsConfigured) return loadCatalogFromPayload(storeId);
  const [categories, brands, products, models] = await Promise.all([listAll("categories"), listAll("brands"), listAll("products"), listAll("laptop_models")]);
  return { categories, brands, products, models };
}

/**
 * The whole catalogue in one cache entry – WITHOUT the long descriptions (Next.js won't cache an entry over 2 MB,
 * so with hundreds of products every page would rebuild it). Descriptions are cached per product below.
 */
const loadSnapshotCached = perStoreCache(
  "catalog-snapshot-v6",
  async (storeId: number | null): Promise<CatalogSnapshot> => {
    const { categories, brands, products, models } = await loadRaw(storeId);
    categories.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    // running flash sales with "% off" lower their products' prices here – every page, the cart and checkout read this
    // snapshot (housekeeping refreshes it when such a sale starts or ends)
    const flash = isCmsConfigured ? await discountedFlashSalesCms(storeId) : [];
    const snapshot = { categories, brands, products: applyFlashSales(groupVariants(enrich(products, categories, brands)), flash).map((p) => ({ ...p, description: "" })), models };
    // Next.js silently skips caching an entry over 2 MB – then EVERY page reloads the whole catalogue from the
    // database. Say so well before that happens (a store with ~1,000+ products, fewer with many variants).
    const bytes = Buffer.byteLength(JSON.stringify(snapshot));
    if (bytes > 1_500_000) log.warn("catalog.snapshot_large", { store: storeId, bytes, products: products.length, limit: 2_000_000 });
    return snapshot;
  },
  REVALIDATE,
);
/** Once per request (per store), however many components ask. */
const loadSnapshotFor = cache(loadSnapshotCached);
const loadSnapshot = async () => loadSnapshotFor(await currentStoreId());

const productDescriptionCached = perStoreCache("product-description-v3", async (storeId: number | null, productId: string): Promise<string> => {
  if (isCmsConfigured) return loadProductDescription(productId, storeId);
  return ((await listAll("products")) as CatalogProduct[]).find((p) => p.id === productId)?.description ?? "";
}, REVALIDATE);
/** A product's full description (Markdown), cached per product. */
export const getProductDescription = async (productId: string) => productDescriptionCached(await currentStoreId(), productId);

/** Products shoppers browse: on the store, and not a variant (variants are chosen on their main product's page). */
async function activeProducts() {
  // listings and cards only need to know a product HAS options – not every variant's data (keeps pages small)
  return (await loadSnapshot()).products.filter((p) => p.status === "active" && !p.variantOf).map((p) => (p.variants ? { ...p, variants: undefined } : p));
}

/** Every product on the store, variants included – for looking one up by id or address (cart, checkout, redirects). */
async function allActiveProducts() {
  return (await loadSnapshot()).products.filter((p) => p.status === "active");
}

// ───────────────────────────── categories ─────────────────────────────

export async function getCategories() {
  return (await loadSnapshot()).categories;
}

export async function getTopCategories() {
  return (await getCategories()).filter((c) => !c.parentId);
}

export async function getCategoryTree(): Promise<CategoryNode[]> {
  const cats = await getCategories();
  const nodes = new Map<string, CategoryNode>(cats.map((c) => [c.id, { ...c, children: [] }]));
  const roots: CategoryNode[] = [];
  for (const n of nodes.values()) {
    const parent = n.parentId ? nodes.get(n.parentId) : undefined;
    if (parent) parent.children.push(n);
    else roots.push(n);
  }
  return roots;
}

export async function getCategoryBySlug(slug: string) {
  return (await getCategories()).find((c) => c.slug === slug) ?? null;
}

/** Root → … → category, for breadcrumbs. */
export async function getCategoryLineage(category: Category) {
  const cats = await getCategories();
  const byId = new Map(cats.map((c) => [c.id, c]));
  const chain: Category[] = [category];
  let cur = category;
  for (let hops = 0; hops < 20 && cur.parentId && byId.get(cur.parentId); hops++) {
    cur = byId.get(cur.parentId)!;
    if (chain.includes(cur)) break;
    chain.unshift(cur);
  }
  return chain;
}

export async function getSubcategories(categoryId: string) {
  return (await getCategories()).filter((c) => c.parentId === categoryId);
}

/** Own attributes merged with all ancestors' attributes (child definitions win). */
export async function getCategoryAttributes(category: Category): Promise<CategoryAttribute[]> {
  const lineage = await getCategoryLineage(category);
  const map = new Map<string, CategoryAttribute>();
  for (const c of lineage) for (const a of c.attributes ?? []) map.set(a.key, a);
  return [...map.values()];
}

async function descendantIds(categoryId: string) {
  const cats = await getCategories();
  const ids = new Set([categoryId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of cats) {
      if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) {
        ids.add(c.id);
        grew = true;
      }
    }
  }
  return ids;
}

// ───────────────────────────── brands ─────────────────────────────

export async function getBrands() {
  return (await loadSnapshot()).brands;
}

export async function getBrand(slug: string) {
  return (await getBrands()).find((b) => b.slug === slug) ?? null;
}

// ───────────────────────────── products ─────────────────────────────

export async function getAllProducts() {
  return activeProducts();
}

export async function getProductBySlug(slug: string) {
  const p = (await allActiveProducts()).find((x) => x.slug === slug) ?? null;
  return p ? { ...p, description: await getProductDescription(p.id) } : null;
}

/** Preview only: the product with its latest unpublished changes (staff in Draft Mode). */
export async function getPreviewProductBySlug(slug: string) {
  if (!isCmsConfigured) return null;
  const draft = await loadProductDraft(slug, await currentStoreId()).catch(() => null);
  if (!draft) return null;
  const snap = await loadSnapshot();
  // the draft with its (published) variants, so the option picker works in preview too
  const variants = snap.products.filter((v) => v.variantOf === draft.product.id && v.status === "active");
  const [p] = groupVariants(enrich([draft.product], snap.categories, snap.brands).concat(variants)).filter((x) => x.id === draft.product.id);
  return p ? { ...p, description: draft.description } : null;
}

export async function getProductsByIds(ids: string[]) {
  const all = await allActiveProducts();
  const byId = new Map(all.map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter((p): p is CatalogProduct => Boolean(p));
}

export async function getProductsBySlugs(slugs: string[]) {
  const all = await activeProducts();
  const bySlug = new Map(all.map((p) => [p.slug, p]));
  return slugs.map((s) => bySlug.get(s)).filter((p): p is CatalogProduct => Boolean(p));
}

export async function getRelatedProducts(product: CatalogProduct, limit = 8) {
  const all = await activeProducts();
  const score = (p: CatalogProduct) =>
    (p.categoryId === product.categoryId ? 4 : 0) +
    (p.topCategoryId === product.topCategoryId ? 2 : 0) +
    (p.brand === product.brand ? 1 : 0) -
    Math.abs(effectivePrice(p) - effectivePrice(product)) / Math.max(effectivePrice(product), 1);
  return all
    .filter((p) => p.id !== product.id)
    .sort((a, b) => score(b) - score(a))
    .slice(0, limit);
}

const SORTERS: Record<Exclude<NonNullable<ProductQuery["sort"]>, "relevance">, (a: CatalogProduct, b: CatalogProduct) => number> = {
  popular: (a, b) => b.soldCount - a.soldCount,
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
  // quote-only lots (no public price) always sort after priced products
  "price-asc": (a, b) => Number(!!a.priceOnRequest) - Number(!!b.priceOnRequest) || effectivePrice(a) - effectivePrice(b),
  "price-desc": (a, b) => Number(!!a.priceOnRequest) - Number(!!b.priceOnRequest) || effectivePrice(b) - effectivePrice(a),
  rating: (a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount,
};

/** Instant search (header search box): best matches first – typos, synonyms and Urdu product words included. */
export async function searchProducts(q: string, limit = 8) {
  return rank(await activeProducts(), q, { closest: true }).slice(0, limit).map((x) => x.item);
}

/** "Did you mean …?" for a search with no results. */
export async function searchSuggestion(q: string) {
  return suggest(await activeProducts(), q);
}

/** Filter, facet, sort and paginate the catalog. Facet counts ignore the facet's own filter. */
export async function queryProducts(query: ProductQuery): Promise<ProductQueryResult> {
  let base = await activeProducts();
  let attributes: CategoryAttribute[] = [];

  if (query.categorySlug) {
    const cat = await getCategoryBySlug(query.categorySlug);
    if (cat) {
      const ids = await descendantIds(cat.id);
      base = base.filter((p) => ids.has(p.categoryId));
      attributes = await getCategoryAttributes(cat);
    } else base = [];
  }
  // search: keep only matches, in best-match order (used when the sort is "relevance", the default while searching)
  const approximate = Boolean(query.q) && !isExactMatch(base, query.q!);
  if (query.q) base = rank(base, query.q, { closest: true }).map((x) => x.item);

  const matches = (p: CatalogProduct, skip?: string) => {
    if (skip !== "brand" && query.brand?.length && !query.brand.includes(p.brand)) return false;
    if (skip !== "condition" && query.condition?.length && !(p.condition && query.condition.includes(p.condition))) return false;
    const price = effectivePrice(p);
    // Quote-only lots have no public price – they never match a price filter.
    if (skip !== "price" && p.priceOnRequest && (query.minPrice != null || query.maxPrice != null)) return false;
    if (skip !== "price" && query.minPrice != null && price < query.minPrice) return false;
    if (skip !== "price" && query.maxPrice != null && price > query.maxPrice) return false;
    if (query.inStock && p.stock <= 0) return false;
    for (const [key, vals] of Object.entries(query.attrs ?? {})) {
      if (key === skip || !vals.length) continue;
      if (!vals.includes(String(p.attributes[key]))) return false;
    }
    for (const [key, [min, max]] of Object.entries(query.ranges ?? {})) {
      if (key === skip) continue;
      const v = Number(p.attributes[key]);
      if (Number.isNaN(v) || v < min || v > max) return false;
    }
    return true;
  };

  const filtered = base.filter((p) => matches(p));
  const sort = query.sort ?? (query.q ? "relevance" : "popular");
  if (sort !== "relevance") filtered.sort(SORTERS[sort]);
  else if (!query.q) filtered.sort(SORTERS.popular);

  const count = (items: CatalogProduct[], get: (p: CatalogProduct) => string | undefined) => {
    const m = new Map<string, number>();
    for (const p of items) {
      const v = get(p);
      if (v != null && v !== "" && v !== "undefined") m.set(v, (m.get(v) ?? 0) + 1);
    }
    return m;
  };

  const facets: Facet[] = attributes.map((a) => {
    const pool = base.filter((p) => matches(p, a.key));
    if (a.kind === "range") {
      const nums = pool.map((p) => Number(p.attributes[a.key])).filter((n) => !Number.isNaN(n));
      return { key: a.key, label: a.label, kind: a.kind, unit: a.unit, options: [], min: Math.min(...nums), max: Math.max(...nums) };
    }
    const counts = count(pool, (p) => (p.attributes[a.key] == null ? undefined : String(p.attributes[a.key])));
    const ordered = a.options?.length ? a.options.filter((o) => counts.has(o)) : [...counts.keys()].sort();
    return {
      key: a.key,
      label: a.label,
      kind: a.kind,
      unit: a.unit,
      options: (a.kind === "boolean" ? ["true"] : ordered).map((value) => ({ value, count: counts.get(value) ?? 0 })),
    };
  }).filter((f) => (f.kind === "range" ? Number.isFinite(f.min) && f.min !== f.max : f.options.some((o) => o.count > 0)));

  const brandList = await getBrands();
  const brandCounts = count(base.filter((p) => matches(p, "brand")), (p) => p.brand);
  const conditionCounts = count(base.filter((p) => matches(p, "condition")), (p) => p.condition);
  const prices = base.filter((p) => !p.priceOnRequest).map(effectivePrice);

  const perPage = query.perPage ?? 24;
  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const page = Math.min(Math.max(1, query.page ?? 1), pages);

  return {
    items: filtered.slice((page - 1) * perPage, page * perPage),
    total: filtered.length,
    page,
    pages,
    facets,
    brands: [...brandCounts.entries()]
      .map(([value, c]) => ({ value, label: brandList.find((b) => b.slug === value)?.name ?? value, count: c }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    conditions: [...conditionCounts.entries()].map(([value, c]) => ({ value: value as Condition, count: c })),
    priceRange: prices.length ? [Math.min(...prices), Math.max(...prices)] : [0, 0],
    didYouMean: query.q && (filtered.length === 0 || approximate) ? suggest(await activeProducts(), query.q) : null,
    approximate: approximate && filtered.length > 0,
  };
}

// ───────────────────────────── compatibility ─────────────────────────────

export async function getLaptopModels(): Promise<LaptopModel[]> {
  return [...(await loadSnapshot()).models].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCompatibleProducts(modelId: string) {
  return (await activeProducts()).filter((p) => p.compatibility.includes(modelId));
}

// ───────────────────────────── reviews ─────────────────────────────

const approvedReviewsCached = unstable_cache(
  async (storeId: number | null, productId: string): Promise<Review[]> =>
    (isCmsConfigured ? await loadApprovedReviewsFromPayload(storeId, productId) : await listAll("reviews"))
      .filter((r) => r.productId === productId && r.approved)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  ["reviews-v2"],
  { tags: [TAGS.reviews], revalidate: REVALIDATE }
);
export const getApprovedReviews = async (productId: string) => approvedReviewsCached(await currentStoreId(), productId);

// ───────────────────────────── content ─────────────────────────────

/** Legacy banners (demo mode only – with /cms the home page's banner blocks are used, and the old tables may not exist). */
export const getBanners = unstable_cache(
  async (placement: Banner["placement"]): Promise<Banner[]> =>
    isCmsConfigured ? [] : (await listAll("banners")).filter((b) => b.active && b.placement === placement).sort((a, b) => a.sortOrder - b.sortOrder),
  ["banners-v2"],
  { tags: [TAGS.content], revalidate: REVALIDATE }
);

const blogPostsCached = unstable_cache(
  async (storeId: number | null): Promise<BlogPost[]> =>
    // Blog posts are written in /cms → Content → Blog posts
    (isCmsConfigured ? await cmsBlogPosts(storeId) : (await listAll("blog_posts")).filter((p) => p.status === "published")).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
  ["blog-posts-v3"],
  { tags: [TAGS.content], revalidate: REVALIDATE }
);
export const getBlogPosts = async () => blogPostsCached(await currentStoreId());

export async function getBlogPost(slug: string) {
  return (await getBlogPosts()).find((p) => p.slug === slug) ?? null;
}

const activeFlashSaleCached = unstable_cache(
  async (storeId: number | null): Promise<FlashSale | null> => {
    if (isCmsConfigured) return activeFlashSaleCms(storeId); // /cms → Sales → Flash sales
    const now = new Date().toISOString();
    return (await listAll("flash_sales")).find((f) => f.active && f.endsAt > now) ?? null;
  },
  ["flash-sale-v3"],
  { tags: [TAGS.content], revalidate: 60 }
);
export const getActiveFlashSale = async () => activeFlashSaleCached(await currentStoreId());

/** With /cms: safe defaults only – never the demo bank account or demo announcement. */
const CMS_DEFAULTS: StoreSettings = { ...seedSettings, bank: { bankName: "", accountTitle: "", accountNumber: "", iban: "" }, announcement: "" };

const storeSettingsCached = unstable_cache(
  async (storeId: number | null): Promise<StoreSettings> =>
    isCmsConfigured
      ? // Shipping & payments from /cms (an error is thrown so the last good settings stay cached)
        { ...CMS_DEFAULTS, ...(await loadCommerceSettings(storeId)) }
      : { ...seedSettings, ...(await getSetting<Partial<StoreSettings>>("store", seedSettings)) },
  ["store-settings-v4"],
  { tags: [TAGS.settings], revalidate: REVALIDATE }
);
/** Shipping & payment settings of the current store (or of `storeId`, e.g. an order's store). */
export const getStoreSettings = async (storeId?: number | null) => storeSettingsCached(storeId === undefined ? await currentStoreId() : storeId);

const testimonialsCached = unstable_cache(
  // with /cms only real testimonials (Online store → Testimonials) – never the demo ones
  async (storeId: number | null): Promise<Testimonial[]> => (isCmsConfigured ? ((await cmsTestimonials(storeId)) ?? []) : getSetting<Testimonial[]>("testimonials", seedTestimonials)),
  ["testimonials-v3"],
  { tags: [TAGS.settings], revalidate: REVALIDATE }
);
export const getTestimonials = async () => testimonialsCached(await currentStoreId());

const faqsCached = unstable_cache(
  async (storeId: number | null): Promise<FaqItem[]> => (await cmsFaqs(storeId)) ?? (isCmsConfigured ? [] : getSetting<FaqItem[]>("faqs", seedFaqs)),
  ["faqs-v3"],
  { tags: [TAGS.settings], revalidate: REVALIDATE }
);
export const getFaqs = async () => faqsCached(await currentStoreId());

