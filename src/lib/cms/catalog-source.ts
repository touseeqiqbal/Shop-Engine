import "server-only";
import type { Payload } from "payload";
import type { Brand, Category, CategoryAttribute, Condition, LaptopModel, Product, Review } from "@/lib/types";

/**
 * Catalog read/write against Payload (single source of truth since Phase 4).
 * Documents are mapped to the storefront's existing types. Storefront ids stay the legacy (Prisma) ids for
 * migrated records – carts, wishlists, orders and flash sales keep working – and the Payload id for new ones.
 */

type Doc = Record<string, unknown>;
type Rel = Doc | number | string | null | undefined;

const obj = (v: unknown): Doc | null => (v && typeof v === "object" ? (v as Doc) : null);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const opt = <T,>(v: T | null | undefined) => (v === null || v === undefined || v === "" ? undefined : v);

/** Storefront id of a Payload document: legacyId when migrated, otherwise the Payload id. */
export const storefrontId = (d: Doc | null | undefined) => (d ? str(d.legacyId) || String(d.id) : "");
const relId = (v: unknown) => {
  const d = obj(v as Rel);
  return d ? storefrontId(d) : v == null ? "" : String(v);
};
const media = (v: unknown) => {
  const m = obj(v as Rel);
  return m && str(m.url) ? { url: str(m.url), alt: str(m.alt) } : null;
};

export async function payloadClient(): Promise<Payload> {
  const [{ getPayload }, { default: config }] = await Promise.all([import("payload"), import("@payload-config")]);
  return getPayload({ config });
}

// Rich text → Markdown (the storefront renders product descriptions as Markdown)
let editorConfig: unknown;
export async function toMarkdown(payload: Payload, value: unknown): Promise<string> {
  const state = obj(value);
  if (!state?.root) return "";
  try {
    const { convertLexicalToMarkdown, editorConfigFactory } = await import("@payloadcms/richtext-lexical");
    editorConfig ??= await editorConfigFactory.default({ config: payload.config });
    return convertLexicalToMarkdown({ data: state as never, editorConfig: editorConfig as never }).trim();
  } catch (e) {
    console.error("[catalog] description conversion failed:", e);
    return "";
  }
}

const findAll = (payload: Payload, collection: string, extra: Record<string, unknown> = {}) =>
  payload
    // Insertion order (ascending id) – the same order the legacy tables returned, so lists don't reshuffle.
    .find({ collection: collection as never, limit: 0, pagination: false, depth: 1, overrideAccess: true, sort: "id", ...extra })
    .then((r) => r.docs as Doc[]);

function toCategory(c: Doc): Category {
  const meta = obj(c.meta);
  return {
    id: storefrontId(c),
    slug: str(c.slug),
    name: str(c.name),
    nameUr: opt(str(c.nameUr)),
    parentId: c.parent ? relId(c.parent) || null : null,
    icon: str(c.icon) || "Package",
    image: media(c.image)?.url,
    shortDescription: str(c.shortDescription),
    seoContent: opt(str(c.seoContent)),
    seoTitle: opt(str(meta?.title)),
    seoDescription: opt(str(meta?.description)),
    seoNoindex: meta?.noindex === true || undefined,
    seoCanonical: opt(str(meta?.canonical)),
    attributes: (Array.isArray(c.attributes) ? (c.attributes as Doc[]) : []).map(
      (a): CategoryAttribute => ({
        key: str(a.key),
        label: str(a.label),
        kind: (str(a.kind) || "select") as CategoryAttribute["kind"],
        options: Array.isArray(a.options) && a.options.length ? (a.options as string[]) : undefined,
        unit: opt(str(a.unit)),
      })
    ),
    compatibility: Boolean(c.compatibility),
    featured: Boolean(c.featured),
    sortOrder: num(c.sortOrder),
  };
}

const toBrand = (b: Doc): Brand => ({ slug: str(b.slug), name: str(b.name), logo: media(b.logo)?.url });

const toModel = (m: Doc): LaptopModel => ({ id: str(m.legacyId) || str(m.slug) || String(m.id), brand: str(obj(m.brand)?.slug), series: str(m.series), name: str(m.name) });

async function toProduct(payload: Payload, p: Doc): Promise<Product> {
  const price = num(p.price);
  const compareAt = num(p.compareAtPrice);
  const onSale = compareAt > price && price > 0;
  const images = (Array.isArray(p.images) ? p.images : []).map(media).filter((m): m is { url: string; alt: string } => Boolean(m));
  const w = obj(p.wholesale) ?? {};
  const meta = obj(p.meta);
  return {
    id: storefrontId(p),
    slug: str(p.slug),
    name: str(p.title),
    brand: str(obj(p.brand)?.slug),
    categoryId: relId(p.category),
    sku: str(p.sku),
    shortDescription: str(p.shortDescription),
    description: await toMarkdown(payload, p.description),
    price: onSale ? compareAt : price,
    salePrice: onSale ? price : null,
    stock: num(p.stock),
    condition: opt(str(p.condition)) as Condition | undefined,
    conditionNotes: opt(str(p.conditionNotes)),
    warranty: str(p.warranty),
    images: images.map((i) => i.url),
    imageAlts: images.map((i) => i.alt),
    video: opt(str(p.video)),
    specs: (Array.isArray(p.specs) ? (p.specs as Doc[]) : []).map((s) => ({ label: str(s.label), value: str(s.value) })),
    attributes: (obj(p.attributes) ?? {}) as Product["attributes"],
    compatibility: (Array.isArray(p.compatibility) ? p.compatibility : []).map((m) => (obj(m) ? toModel(obj(m)!).id : String(m))),
    upgrades: (Array.isArray(p.upgrades) ? (p.upgrades as Doc[]) : []).map((u) => ({ id: str(u.optionId) || str(u.id), group: str(u.group), label: str(u.label), price: num(u.price) })),
    boughtTogether: (Array.isArray(p.boughtTogether) ? p.boughtTogether : []).map(relId).filter(Boolean),
    bundleDiscountPercent: opt(num(p.bundleDiscountPercent, NaN) || undefined),
    rating: num(p.rating),
    reviewCount: num(p.reviewCount),
    soldCount: num(p.soldCount),
    tags: Array.isArray(p.tags) ? (p.tags as string[]) : [],
    featured: Boolean(p.featured),
    hotDeal: Boolean(p.hotDeal),
    dealEndsAt: opt(str(p.dealEndsAt)) ?? null,
    bestSeller: Boolean(p.bestSeller),
    // on the store only when set to "On store" AND published (never-published drafts stay hidden)
    status: p.status === "active" && p._status !== "draft" ? "active" : "draft",
    seoTitle: opt(str(meta?.title)),
    seoDescription: opt(str(meta?.description)),
    seoNoindex: meta?.noindex === true || undefined,
    seoCanonical: opt(str(meta?.canonical)),
    priceOnRequest: Boolean(p.priceOnRequest),
    wholesale: w.available || w.minQty || w.lotSize || w.contents
      ? { available: Boolean(w.available), minQty: opt(num(w.minQty, NaN) || undefined), lotSize: opt(num(w.lotSize, NaN) || undefined), grades: opt(str(w.grades)), contents: opt(str(w.contents)), note: opt(str(w.note)) }
      : null,
    unit: opt(str(p.unit)),
    variantOf: p.variantOf ? storefrontId(obj(p.variantOf)) || String(p.variantOf) : undefined,
    optionValues: p.optionValues && typeof p.optionValues === "object" ? (p.optionValues as Record<string, string>) : undefined,
    variantOptions: Array.isArray(p.variantOptions) && p.variantOptions.length
      ? (p.variantOptions as Doc[]).map((o) => ({ name: str(o.name), values: Array.isArray(o.values) ? (o.values as string[]).map(String) : [] })).filter((o) => o.name && o.values.length)
      : undefined,
    createdAt: str(p.createdAt),
    updatedAt: opt(str(p.updatedAt)),
  };
}

/** Whole catalog (all statuses – callers filter). */
export async function loadCatalogFromPayload(): Promise<{ categories: Category[]; brands: Brand[]; products: Product[]; models: LaptopModel[] }> {
  const payload = await payloadClient();
  const [cats, brands, products, models] = await Promise.all([
    findAll(payload, "categories", { depth: 1 }),
    findAll(payload, "brands", { depth: 1 }),
    findAll(payload, "products", { depth: 1 }),
    findAll(payload, "laptop-models", { depth: 1 }),
  ]);
  return {
    categories: cats.map(toCategory),
    brands: brands.map(toBrand),
    products: await Promise.all(products.map((p) => toProduct(payload, p))),
    models: models.map(toModel),
  };
}

/** Preview (staff, Draft Mode): the latest DRAFT of a product, uncached – shown on its product page before publishing. */
export async function loadProductDraft(slug: string): Promise<{ product: Product; description: string } | null> {
  const payload = await payloadClient();
  const res = await payload.find({ collection: "products" as never, where: { slug: { equals: slug } } as never, draft: true, limit: 1, depth: 1, overrideAccess: true });
  const doc = res.docs[0] as Doc | undefined;
  if (!doc) return null;
  const product = await toProduct(payload, doc);
  return { product: { ...product, status: "active" }, description: await toMarkdown(payload, doc.description) };
}

/** One product's full description as Markdown (the catalogue cache leaves descriptions out). */
export async function loadProductDescription(id: string): Promise<string> {
  const payload = await payloadClient();
  const doc = await findProductDoc(payload, id);
  return doc ? toMarkdown(payload, doc.description) : "";
}

/** Approved reviews – of one product (its newest 50) when `productId` is given. */
export async function loadApprovedReviewsFromPayload(productId?: string): Promise<Review[]> {
  const payload = await payloadClient();
  const product = productId ? await findProductDoc(payload, productId) : null;
  if (productId && !product) return [];
  const where = product ? { and: [{ approved: { equals: true } }, { product: { equals: product.id } }] } : { approved: { equals: true } };
  const res = await payload.find({ collection: "reviews" as never, where: where as never, depth: 1, populate: { products: { legacyId: true } } as never, sort: "-createdAt", limit: product ? 50 : 500, overrideAccess: true });
  const docs = res.docs as unknown as Doc[];
  return docs.map((r) => ({
    id: str(r.legacyId) || String(r.id),
    productId: relId(r.product),
    name: str(r.name),
    city: opt(str(r.city)),
    rating: num(r.rating),
    title: opt(str(r.title)),
    body: str(r.body),
    approved: true,
    verified: Boolean(r.verified),
    createdAt: str(r.createdAt),
    photos: (Array.isArray(r.photos) ? (r.photos as string[]) : []).filter((k) => typeof k === "string" && k.startsWith("reviews/")).map((k) => `/media/${k}`),
  }));
}

// ───────────────────────────── writes ─────────────────────────────

/** Payload document of a product by storefront id (legacy id or Payload id). */
export async function findProductDoc(payload: Payload, id: string): Promise<Doc | null> {
  const where = /^\d+$/.test(id) ? { or: [{ id: { equals: Number(id) } }, { legacyId: { equals: id } }] } : { legacyId: { equals: id } };
  const res = await payload.find({ collection: "products" as never, where: where as never, limit: 1, depth: 0, overrideAccess: true });
  return (res.docs[0] as Doc | undefined) ?? null;
}

/** Live stock (bypasses caches) – used right before an order is placed. */
export async function freshStock(id: string): Promise<number | null> {
  const doc = await findProductDoc(await payloadClient(), id);
  return doc ? num(doc.stock) : null;
}

/** A shopper's review (unapproved until staff approve it in /cms → Reviews). */
export async function submitReview(productId: string, r: { name: string; city?: string; rating: number; title?: string; body: string; photoKeys?: string[] }) {
  const payload = await payloadClient();
  const doc = await findProductDoc(payload, productId);
  if (!doc || doc.status !== "active") return false;
  await payload.create({ collection: "reviews" as never, data: { product: doc.id, ...r, approved: false, verified: false } as never, overrideAccess: true });
  return true;
}
