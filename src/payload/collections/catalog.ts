import { commitTransaction, initTransaction, killTransaction, ValidationError, type CollectionAfterChangeHook, type CollectionAfterDeleteHook, type CollectionBeforeChangeHook, type CollectionBeforeDeleteHook, type CollectionConfig, type Endpoint, type PayloadRequest, type Where } from "payload";
import { assignStore, canWriteStore, createFor, getTenant, publicOrStore, readFor, sameStore, storeField, storeIdOf, storeRoleField, writeFor } from "../tenancy";
import { dbName, legacyIdField, slugField, copyTag, onCopy, perStoreUnique, uniqueInStore } from "../fields";
import { slugify } from "@/lib/utils";
import { productLimit } from "../entitlements";
import { REVIEWS_TAG, revalidate, revalidateCatalog } from "../revalidate";
import { productDeletedRedirect, slugRedirect } from "../slug-redirects";
import { userError } from "../errors";

const catalogHooks = { afterChange: [revalidateCatalog], afterDelete: [revalidateCatalog] };

/**
 * Stock is only written when someone really changed it – and never over a sale made meanwhile.
 * The edit screen and the list's quick edit send `stockSeen` (the stock they showed). Unchanged → the saved stock is
 * left alone (an order or the shop counter may have taken one since). Changed while it moved meanwhile → refused.
 * A save by a person WITHOUT stockSeen (a CSV import, an API call) never changes the stock of an existing product:
 * re-importing an old export would undo every sale since. Use Stock count or Purchases to correct stock; new
 * products from an import still get their stock.
 */
const relId = (v: unknown): number | null => (v == null || v === "" ? null : typeof v === "object" ? Number((v as { id?: number }).id ?? NaN) || null : Number(v) || null);

/** A variant added, moved to another product or removed: the parents' stock is the total of their variants again. */
const retotalVariantParents: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  const ids = new Set([relId(doc?.variantOf), relId(previousDoc?.variantOf)].filter((x): x is number => x != null));
  if (!ids.size) return doc;
  const { syncVariantParent } = await import("../stock");
  for (const id of ids) await syncVariantParent(req.payload, id, req);
  return doc;
};
const retotalAfterVariantDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const parent = relId(doc?.variantOf);
  if (parent != null) {
    const { syncVariantParent } = await import("../stock");
    await syncVariantParent(req.payload, parent, req);
  }
  return doc;
};

/**
 * POST /cms-api/products/:id/create-variants – makes one product per option combination that doesn't exist yet
 * (e.g. Black / S, Black / M …). Each starts from the parent: its price, cost, photos, brand, category, condition and
 * warranty, stock 0, an SKU and web address of its own. Staff only.
 */
const createVariantsEndpoint: Endpoint = {
  path: "/:id/create-variants",
  method: "post",
  handler: async (req) => {
    if (!req.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const id = Number(req.routeParams?.id);
    const parent = (await req.payload.findByID({ collection: "products", id, draft: true, depth: 0, overrideAccess: true, req }).catch(() => null)) as Record<string, unknown> | null;
    // only the product's own store team (a product of another store looks like it doesn't exist)
    if (!parent || !canWriteStore(await getTenant(req), storeIdOf(parent.store), "store_staff")) return Response.json({ error: "Product not found." }, { status: 404 });
    if (parent.variantOf) return Response.json({ error: "This product is itself a variant – add options on its main product." }, { status: 400 });
    const options = ((parent.variantOptions as { name?: string; values?: string[] }[] | undefined) ?? [])
      .map((o) => ({ name: String(o.name ?? "").trim(), values: [...new Set((o.values ?? []).map((v) => String(v).trim()).filter(Boolean))] }))
      .filter((o) => o.name && o.values.length);
    if (!options.length) return Response.json({ error: "Add at least one option with values (e.g. Colour: Black, Silver) and save first." }, { status: 400 });
    // every combination: Black/S, Black/M, Silver/S …
    const combos = options.reduce<Record<string, string>[]>((acc, o) => acc.flatMap((c) => o.values.map((v) => ({ ...c, [o.name]: v }))), [{}]);
    if (combos.length > 100) return Response.json({ error: `That makes ${combos.length} variants – keep it to 100 or fewer.` }, { status: 400 });
    const existing = (await req.payload.find({ collection: "products", where: { variantOf: { equals: id } }, limit: 200, depth: 0, overrideAccess: true, req })).docs as { optionValues?: Record<string, string> }[];
    const key = (v: Record<string, string>) => options.map((o) => `${o.name}=${v[o.name] ?? ""}`).join("|");
    const have = new Set(existing.map((e) => key(e.optionValues ?? {})));
    const images = ((parent.images as unknown[] | undefined) ?? []).map((m) => (m && typeof m === "object" ? (m as { id: number }).id : m));
    // a variant goes on the store only when its main product is on the store
    const canGoLive = images.length > 0 && Number(parent.price) > 0 && parent.status === "active";
    const created: string[] = [];
    // all variants or none: a SKU / address clash half-way leaves nothing behind
    await initTransaction(req);
    try {
      for (const combo of combos) {
        if (have.has(key(combo))) continue;
        const values = options.map((o) => combo[o.name]);
        const doc = (await req.payload.create({
          collection: "products",
          data: {
            store: storeIdOf(parent.store),
            title: `${String(parent.title)} – ${values.join(" / ")}`,
            variantOf: id,
            optionValues: combo,
            brand: parent.brand,
            category: parent.category,
            price: parent.price,
            compareAtPrice: parent.compareAtPrice ?? null,
            costPrice: parent.costPrice ?? null,
            shortDescription: parent.shortDescription ?? "",
            condition: parent.condition ?? undefined,
            warranty: parent.warranty ?? undefined,
            shippingClass: parent.shippingClass ?? undefined,
            weight: parent.weight ?? undefined,
            tags: parent.tags ?? undefined,
            images,
            sku: `${String(parent.sku ?? "SKU")}-${values.map((v) => slugify(v).toUpperCase()).join("-")}`.slice(0, 60),
            slug: `${String(parent.slug)}-${slugify(values.join("-"))}`,
            stock: 0,
            // on the store with the main product (it is only ever shown on the main product's page)
            status: canGoLive ? "active" : "draft",
            // published straight away (Payload would otherwise start a new product as a draft)
            _status: "published",
          } as never,
          overrideAccess: true,
          req,
        })) as { title: string };
        created.push(doc.title);
      }
      await commitTransaction(req);
    } catch (e) {
      await killTransaction(req);
      const msg = (e as { data?: { errors?: { message?: string }[] }; message?: string }).data?.errors?.[0]?.message ?? (e as Error).message;
      return Response.json({ error: `No variants were created: ${msg}` }, { status: 400 });
    }
    return Response.json({ created, existing: existing.length });
  },
};

/** Runs an after-change hook only for real (published) saves – a draft or autosave changes nothing on the store. */
const onPublishOnly =
  (hook: CollectionAfterChangeHook): CollectionAfterChangeHook =>
  (args) =>
    args.doc?._status === "draft" ? args.doc : hook(args);

/** Stock shown while a draft is open: the live number (the draft's copy may be from before today's sales). */
const liveStockWhenDraft = async ({ value, siblingData, data, req }: { value?: unknown; siblingData?: Record<string, unknown>; data?: Record<string, unknown>; req: PayloadRequest }) => {
  const own = typeof siblingData?.stock === "number" ? siblingData.stock : typeof value === "number" ? value : 0;
  if (data?._status !== "draft" || !data?.id) return own;
  const { liveProduct } = await import("../stock");
  return (await liveProduct(req.payload, Number(data.id)))?.stock ?? own;
};

/** /cms "Preview" / live preview: the product page with the editor's latest draft (staff only, see /api/preview). */
const productPreviewUrl = ({ data, req }: { data: Record<string, unknown>; req: PayloadRequest }) => {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? (host?.startsWith("localhost") || host?.startsWith("127.") ? "http" : "https");
  const origin = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL ?? "");
  return `${origin}/api/preview?product=${encodeURIComponent(String(data?.id ?? ""))}`;
};

const guardStock: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req, context }) => {
  // what the person's screen really sent (Payload fills `data` with the saved values, incl. the virtual stockSeen,
  // so only the raw request tells whether the stock shown was sent at all)
  const sent = (req.data ?? {}) as Record<string, unknown>;
  const seen = "stockSeen" in sent ? sent.stockSeen : req.user ? undefined : data.stockSeen;
  delete data.stockSeen;
  // a draft (Save draft / autosave) never changes the real stock – only publishing does
  if (data._status === "draft" || operation !== "update" || context?.migrating) return data;
  // With drafts on, Payload starts an update from the latest DRAFT – its stock, rating and sold count can be old.
  // The live row is the truth: keep it, unless the person typed a new stock over the number they saw.
  const { liveProduct } = await import("../stock");
  const live = originalDoc?.id ? await liveProduct(req.payload, Number(originalDoc.id), req, true) : null;
  if (!live) return data;
  data.rating = live.rating;
  data.reviewCount = live.reviewCount;
  data.soldCount = live.soldCount;
  if (typeof seen === "number" && Number.isFinite(seen) && data.stock != null && Number(data.stock) !== seen) {
    const { hasVariants } = await import("../stock");
    if (await hasVariants(req.payload, Number(originalDoc.id), req))
      throw userError("This product has options (variants) – its stock is the total of its variants. Change the stock on the variants (Variants tab).", 400);
    if (live.stock !== seen)
      throw userError(`Stock changed to ${live.stock} while you were editing (an order or a shop sale). Reload and enter the stock again.`, 409);
    return data; // the new stock the person typed
  }
  data.stock = live.stock;
  return data;
};

/** Checks that keep the shop correct: prices, was-price, photos for products on the store, no negative numbers. */
/** Two options of one product can't be the same choice (e.g. two "Black / 16 GB" variants). */
const uniqueOptions: CollectionBeforeChangeHook = async ({ data, originalDoc, req, context }) => {
  if (context?.migrating || !("optionValues" in data || "variantOf" in data)) return data;
  const parent = data.variantOf !== undefined ? data.variantOf : originalDoc?.variantOf;
  const values = (data.optionValues !== undefined ? data.optionValues : originalDoc?.optionValues) as Record<string, unknown> | null | undefined;
  const parentId = parent && typeof parent === "object" ? (parent as { id?: unknown }).id : parent;
  if (parentId == null || !values || typeof values !== "object") return data;
  const key = (v: Record<string, unknown>) => Object.keys(v).sort().map((k) => `${k.trim().toLowerCase()}=${String(v[k] ?? "").trim().toLowerCase()}`).join("|");
  const mine = key(values);
  const siblings = (await req.payload.find({ collection: "products", where: { variantOf: { equals: parentId } }, limit: 200, depth: 0, overrideAccess: true, req })).docs as { id: unknown; optionValues?: Record<string, unknown> }[];
  if (siblings.some((s) => String(s.id) !== String(originalDoc?.id ?? "") && s.optionValues && key(s.optionValues) === mine))
    throw new ValidationError({ errors: [{ path: "optionValues", message: "Another option of this product already has exactly these choices." }] });
  return data;
};

const validateProduct: CollectionBeforeChangeHook = ({ data, originalDoc, context }) => {
  // only when a person edits these fields (internal updates like rating/sold counts never get blocked);
  // a draft may be unfinished – it's checked when it is published
  if (context?.migrating || data._status === "draft" || !["price", "compareAtPrice", "status", "priceOnRequest", "images", "upgrades", "stock"].some((k) => k in data)) return data;
  const v = <T,>(k: string): T => (data[k] !== undefined ? data[k] : originalDoc?.[k]) as T;
  const errors: { path: string; message: string }[] = [];
  const price = Number(v<number>("price") ?? 0);
  const was = v<number | null>("compareAtPrice");
  const active = v<string>("status") === "active";
  if (was != null && Number(was) > 0 && Number(was) <= price) errors.push({ path: "compareAtPrice", message: "The “Was price” must be higher than the price (or leave it empty)." });
  if (active && !v<boolean>("priceOnRequest") && price <= 0) errors.push({ path: "price", message: "A product on the store needs a price (or tick “Price on request”)." });
  // below 0 = units owed to customers: only for products that keep selling when sold out (pre-orders / backorders)
  const keepsSelling = ["backorder", "preorder"].includes(String(v<string>("backorders"))) && !v<boolean>("trackUnits");
  if (data.stock !== undefined && Number(data.stock) < 0 && !keepsSelling)
    errors.push({ path: "stock", message: `Stock is ${Number(data.stock)}: ${-Number(data.stock)} sold beyond the stock are still owed to customers. Add stock first, or keep “When sold out” on pre-order / keep selling.` });
  const images = v<unknown[] | null>("images");
  if (active && (!Array.isArray(images) || images.length === 0)) errors.push({ path: "images", message: "Add at least one photo before putting the product on the store." });
  const upgrades = (v<{ price?: number; group?: string; label?: string }[] | null>("upgrades") ?? []);
  upgrades.forEach((u, i) => {
    if (Number(u?.price) < 0) errors.push({ path: `upgrades.${i}.price`, message: "An option can't have a negative price." });
  });
  if (errors.length) throw new ValidationError({ errors });
  return data;
};

/** A category can't be inside itself (directly or through others) – the shop would loop forever building its links. */
const noCategoryLoop: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const id = originalDoc?.id;
  const rel = (v: unknown) => (v && typeof v === "object" ? (v as { id: number }).id : (v as number | null | undefined));
  let next = rel(data.parent !== undefined ? data.parent : originalDoc?.parent);
  for (let hops = 0; next != null; hops++) {
    if (hops >= 20) throw new ValidationError({ errors: [{ path: "parent", message: "Too many levels of parent categories." }] });
    if (id != null && String(next) === String(id)) throw new ValidationError({ errors: [{ path: "parent", message: "A category can't be inside itself – choose a different parent." }] });
    const parent = (await req.payload.findByID({ collection: "categories", id: next, depth: 0, overrideAccess: true, req }).catch(() => null)) as { parent?: unknown } | null;
    next = rel(parent?.parent);
  }
  // Top-level categories are the first part of product links (/laptops/…) – they can't take the site's own addresses
  const slug = String(data.slug ?? originalDoc?.slug ?? "");
  const topLevel = rel(data.parent !== undefined ? data.parent : originalDoc?.parent) == null;
  if (topLevel && RESERVED_SLUGS.has(slug)) throw new ValidationError({ errors: [{ path: "slug", message: `“${slug}” is used by the website itself – choose another web address.` }] });
  return data;
};

/** First path parts the website itself uses (src/app routes + /cms) – not allowed as top-level category slugs. */
const RESERVED_SLUGS = new Set([
  "account", "api", "about", "admin", "blog", "brands", "cart", "category", "checkout", "cms", "cms-api", "cms-file", "cms-print", "cms-proof",
  "collections", "compare", "confirm-order", "contact", "deals", "faqs", "feeds", "find-parts", "installments", "llms.txt", "media", "og",
  "order-confirmation", "pages", "privacy-policy", "products", "returns", "search", "sell-your-laptop", "shipping-policy", "shop", "sitemap.xml",
  "robots.txt", "terms", "track-order", "warranty-returns", "wholesale", "wishlist", "images", "brand", "_next",
]);

/**
 * A product with variants can't be deleted (its variants would turn into separate products on the store), and nor can a
 * product an open order still holds stock for – hide it instead (Status → Hidden).
 */
const refuseProductDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const variants = await req.payload.count({ collection: "products", where: { variantOf: { equals: id } }, overrideAccess: true, req });
  if (variants.totalDocs) throw userError(`This product has ${variants.totalDocs} variant(s). Delete or move the variants first, or hide the product (Status → Hidden).`, 409);
  const open = await req.payload.count({
    collection: "orders",
    where: { and: [{ "items.product": { equals: id } }, { status: { not_in: ["delivered", "cancelled", "refused", "returned"] } }] },
    overrideAccess: true,
    req,
  });
  if (open.totalDocs) throw userError(`${open.totalDocs} open order(s) include this product. Finish or cancel them first, or hide the product (Status → Hidden).`, 409);
};

/** Deleting is refused while products (or sub-categories) still use it – they would lose their links. */
const refuseDeleteInUse =
  (field: "category" | "brand"): CollectionBeforeDeleteHook =>
  async ({ id, req }) => {
    const used = await req.payload.count({ collection: "products", where: { [field]: { equals: id } }, overrideAccess: true, req });
    const children = field === "category" ? await req.payload.count({ collection: "categories", where: { parent: { equals: id } }, overrideAccess: true, req }) : { totalDocs: 0 };
    if (used.totalDocs || children.totalDocs)
      throw userError(
        `Still in use by ${used.totalDocs} product(s)${children.totalDocs ? ` and ${children.totalDocs} sub-categor${children.totalDocs === 1 ? "y" : "ies"}` : ""}. Move them first, or hide this ${field} instead of deleting it.`,
        409
      );
  };

/** Stock is 0 or more – below 0 (units owed to customers) only for products that keep selling when sold out. */
const stockValue = (v: unknown, { data }: { data?: Record<string, unknown> }) => {
  if (v == null || v === "") return true;
  if (typeof v !== "number" || !Number.isFinite(v)) return "Enter a number.";
  if (v >= 0) return true;
  const owedOk = (data?.backorders === "backorder" || data?.backorders === "preorder") && !data?.trackUnits;
  return owedOk ? true : `Stock is ${v}: ${-v} sold beyond the stock are still owed to customers. Add stock first, or keep “When sold out” on pre-order / keep selling.`;
};

/** Keeps `stockStatus` in sync so the product list can be filtered by it (Inventory view). */
const setStockStatus: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req }) => {
  // serial-tracked products: stock is the number of In-stock units, never typed by hand
  if (operation === "update" && data._status !== "draft" && (data.trackUnits ?? originalDoc?.trackUnits) && originalDoc?.trackUnits) {
    const { liveProduct } = await import("../stock");
    data.stock = (await liveProduct(req.payload, Number(originalDoc.id), req))?.stock ?? originalDoc.stock;
  }
  const stock = Number(data.stock ?? originalDoc?.stock ?? 0);
  const threshold = Number(data.lowStockThreshold ?? originalDoc?.lowStockThreshold ?? 2);
  data.stockStatus = stock <= 0 ? "out" : stock <= threshold ? "low" : "in";
  return data;
};

/** Turning on "Track each unit": stock becomes the number of its In-stock units straight away. */
const recountWhenTracking: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  if (doc.trackUnits && !previousDoc?.trackUnits) {
    const { recountUnits } = await import("../stock");
    await recountUnits(req.payload, Number(doc.id), req);
  }
  return doc;
};

/** Recompute a product's rating & review count from its approved reviews. */
async function refreshRating(req: Parameters<CollectionAfterChangeHook>[0]["req"], productId: unknown) {
  const id = productId && typeof productId === "object" ? (productId as { id: number }).id : productId;
  if (id == null) return;
  const { docs } = await req.payload.find({ collection: "reviews", where: { and: [{ product: { equals: id } }, { approved: { equals: true } }] }, limit: 0, pagination: false, depth: 0, req });
  const ratings = (docs as { rating?: number }[]).map((r) => Number(r.rating) || 0);
  const rating = ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : 0;
  // straight to the live product: an update through Payload would publish an editor's unfinished draft
  const { setProductRating } = await import("../stock");
  await setProductRating(req.payload, Number(id), rating, ratings.length, req);
  revalidate([REVIEWS_TAG, "catalog"]);
}
/** Approving a review publishes its photos (copied from the private upload area to the public "reviews/" folder). */
const publishReviewPhotos: CollectionBeforeChangeHook = async ({ data, originalDoc }) => {
  const approved = data.approved ?? originalDoc?.approved;
  const keys = ((data.photoKeys ?? originalDoc?.photoKeys) as string[] | null) ?? [];
  if (!approved || !keys.length || (originalDoc?.approved && originalDoc?.photos?.length)) return data;
  const { getObject, uploadObject } = await import("../../lib/storage");
  const published: string[] = [];
  for (const key of keys) {
    if (!key.startsWith("reviews-pending/")) continue;
    const obj = await getObject(key);
    if (!obj) continue;
    const buf = Buffer.from(await new Response(obj.body).arrayBuffer());
    const to = key.replace(/^reviews-pending\//, "reviews/");
    await uploadObject(to, buf, obj.contentType);
    published.push(to);
  }
  data.photos = published;
  return data;
};

const reviewAfterChange: CollectionAfterChangeHook = async ({ doc, previousDoc, req, context }) => {
  if (context?.migrating) return doc; // imported reviews keep the migrated rating figures
  // a new (unapproved) review changes nothing on the shop – only approved ones count
  if (!doc.approved && !previousDoc?.approved) return doc;
  await refreshRating(req, doc.product);
  const before = previousDoc?.product && typeof previousDoc.product === "object" ? previousDoc.product.id : previousDoc?.product;
  const now = doc.product && typeof doc.product === "object" ? doc.product.id : doc.product;
  if (before && before !== now) await refreshRating(req, before);
  return doc;
};
const reviewAfterDelete: CollectionAfterDeleteHook = async ({ doc, req, context }) => {
  if (context?.migrating || !doc.approved) return doc;
  await refreshRating(req, doc.product);
  return doc;
};

const CONDITIONS = [
  { label: "New", value: "new" },
  { label: "Used A+", value: "used-a-plus" },
  { label: "Used A", value: "used-a" },
  { label: "Refurbished", value: "refurbished" },
  { label: "Open Box", value: "open-box" },
];

export const Categories: CollectionConfig = {
  slug: "categories",
  dbName: dbName("categories"),
  admin: { useAsTitle: "name", group: "Catalog", defaultColumns: ["name", "slug", "parent", "sortOrder"] },
  access: { read: publicOrStore("store_staff"), create: createFor("store_staff"), update: writeFor("store_staff"), delete: writeFor("store_manager") },
  indexes: perStoreUnique("slug"),
  hooks: { ...catalogHooks, beforeValidate: [assignStore()], beforeChange: [noCategoryLoop], beforeDelete: [refuseDeleteInUse("category")], afterChange: [...catalogHooks.afterChange, slugRedirect("categories")] },
  fields: [
    storeField(),
    { name: "name", type: "text", required: true },
    { name: "nameUr", type: "text", label: "Name (Urdu)" },
    slugField("name"),
    {
      name: "parent",
      type: "relationship",
      relationTo: "categories",
      // a category can't be inside itself (directly or through others) – that would loop forever on the shop; same store only
      filterOptions: ({ id, data }) => {
        const same = sameStore({ data });
        return id ? (same === true ? { id: { not_equals: id } } : { and: [{ id: { not_equals: id } }, same] }) : same;
      },
      admin: { position: "sidebar" },
    },
    { name: "icon", type: "text", defaultValue: "Package", admin: { components: { Field: "/payload/admin/IconPickerField#IconPickerField" } } },
    { name: "image", type: "upload", relationTo: "media", filterOptions: sameStore, admin: { description: "Picture for the big tile when this is the first category in the home-page Category grid (transparent PNG or a product photo works best). Empty = built-in laptop drawing." } },
    { name: "shortDescription", type: "textarea" },
    { name: "seoContent", type: "textarea", admin: { description: "Long SEO copy shown at the bottom of the category page (Markdown)." } },
    {
      name: "attributes",
      type: "array",
      labels: { singular: "Filter attribute", plural: "Filter attributes" },
      admin: { description: "Specification fields used as storefront filters. Sub-categories inherit their parent's attributes." },
      fields: [
        { type: "row", fields: [
          { name: "key", type: "text", required: true, admin: { width: "30%" } },
          { name: "label", type: "text", required: true, admin: { width: "40%" } },
          { name: "kind", type: "select", required: true, defaultValue: "select", options: ["select", "boolean", "range"], admin: { width: "30%" } },
        ] },
        { name: "options", type: "text", hasMany: true },
        { name: "unit", type: "text" },
      ],
    },
    { name: "compatibility", type: "checkbox", label: "Show “Find parts for your laptop”", admin: { position: "sidebar" } },
    { name: "featured", type: "checkbox", admin: { position: "sidebar" } },
    { name: "sortOrder", type: "number", defaultValue: 0, admin: { position: "sidebar" } },
    legacyIdField,
  ],
};

export const Brands: CollectionConfig = {
  slug: "brands",
  dbName: dbName("brands"),
  admin: { useAsTitle: "name", group: "Catalog" },
  access: { read: publicOrStore("store_staff"), create: createFor("store_staff"), update: writeFor("store_staff"), delete: writeFor("store_manager") },
  indexes: perStoreUnique("slug"),
  hooks: { ...catalogHooks, beforeValidate: [assignStore()], beforeDelete: [refuseDeleteInUse("brand")], afterChange: [...catalogHooks.afterChange, slugRedirect("brands")] },
  fields: [
    storeField(),
    { name: "name", type: "text", required: true },
    slugField("name"), { name: "logo", type: "upload", relationTo: "media", filterOptions: sameStore }, legacyIdField,
  ],
};

export const LaptopModels: CollectionConfig = {
  slug: "laptop-models",
  dbName: dbName("laptop-models"),
  labels: { singular: "Laptop model", plural: "Laptop models" },
  admin: { useAsTitle: "name", group: "Catalog", defaultColumns: ["name", "brand", "series"], description: "Models used by the “Find parts for your laptop” compatibility finder." },
  access: { read: publicOrStore("store_staff"), create: createFor("store_staff"), update: writeFor("store_staff"), delete: writeFor("store_manager") },
  indexes: perStoreUnique("slug"),
  hooks: { ...catalogHooks, beforeValidate: [assignStore()] },
  fields: [
    storeField(),
    { name: "name", type: "text", required: true },
    { name: "brand", type: "relationship", relationTo: "brands", required: true, filterOptions: sameStore },
    { name: "series", type: "text" },
    slugField("name", { admin: { position: "sidebar", description: "Stable id used in compatibility links." } }),
    legacyIdField,
  ],
};

/** Stock typed into the product (edit, CSV import, new product) goes to Stock history too – SQL changes log themselves. */
const stockEditLog: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req, context }) => {
  if (context?.migrating || doc.trackUnits) return doc;
  const before = operation === "create" ? 0 : Number(previousDoc?.stock ?? 0);
  const after = Number(doc.stock ?? 0);
  if (after === before) return doc;
  const { recordStockChange } = await import("../stock");
  await recordStockChange(req.payload, req, Number(doc.id), doc.title, after - before, after, operation === "create" ? "new-product" : "edited");
  return doc;
};

export const Products: CollectionConfig = {
  slug: "products",
  dbName: dbName("products"),
  admin: {
    useAsTitle: "title",
    group: "Catalog",
    defaultColumns: ["title", "status", "price", "stock", "category", "brand"],
    listSearchableFields: ["title", "sku", "slug", "model"],
    components: { beforeListTable: ["/payload/admin/products/ListTabs#ProductListTabs", { path: "/payload/admin/inventory/PrintLabelsButton#PrintLabelsButton", clientProps: { type: "products" } }] },
    // see the product page with the unpublished changes (Preview button / live preview pane)
    preview: (data, { req }) => productPreviewUrl({ data: data as Record<string, unknown>, req }),
    livePreview: {
      url: productPreviewUrl,
      breakpoints: [
        { label: "Mobile", name: "mobile", width: 390, height: 844 },
        { label: "Desktop", name: "desktop", width: 1440, height: 900 },
      ],
    },
  },
  // shoppers: products on the store (and published); a store's team: all of its own products incl. drafts.
  // readVersions: drafts and old versions are for the store's team only. Deleting: managers.
  access: {
    read: publicOrStore("store_staff", { and: [{ status: { equals: "active" } }, { _status: { not_equals: "draft" } }] }),
    // versions keep the fields under "version." – a plain "store" filter can't be queried there (blank edit page)
    readVersions: readFor("store_staff", { field: "version.store" }),
    create: createFor("store_staff"),
    update: writeFor("store_staff"),
    delete: writeFor("store_manager"),
  },
  indexes: perStoreUnique("slug", "sku"),
  // drafts (Save draft / autosave) change nothing on the store – stock log, catalogue refresh, redirects run on publish
  hooks: {
    beforeValidate: [assignStore()],
    beforeChange: [productLimit, guardStock, validateProduct, uniqueOptions, setStockStatus],
    ...catalogHooks,
    afterChange: [...catalogHooks.afterChange, slugRedirect("products"), recountWhenTracking, stockEditLog, retotalVariantParents].map(onPublishOnly),
    beforeDelete: [refuseProductDelete],
    afterDelete: [...catalogHooks.afterDelete, productDeletedRedirect, retotalAfterVariantDelete],
  },
  // Save draft / autosave while editing, Publish when ready, schedule a publish, restore an older version
  versions: { drafts: { autosave: { interval: 3000 }, schedulePublish: true }, maxPerDoc: 25 },
  endpoints: [createVariantsEndpoint],
  fields: [
    storeField(),
    {
      type: "tabs",
      tabs: [
        {
          label: "Product",
          fields: [
            { name: "title", type: "text", required: true, label: "Product name", hooks: { beforeDuplicate: [({ value }) => (value ? `${String(value)} (copy)` : value)] }, admin: { components: { Cell: "/payload/admin/products/Cells#ProductTitleCell" } } },
            { type: "row", fields: [
              { name: "brand", type: "relationship", relationTo: "brands", required: true, filterOptions: sameStore, admin: { width: "50%" } },
              { name: "model", type: "text", admin: { width: "50%" } },
            ] },
            { name: "category", type: "relationship", relationTo: "categories", required: true, filterOptions: sameStore },
            { name: "shortDescription", type: "textarea", label: "Short summary", admin: { description: "One or two lines shown near the price. Example: “Core i5 11th gen, 16GB RAM, 512GB SSD – tested, 6-month warranty.”" } },
            { name: "description", type: "richText", label: "Full description" },
            { name: "images", type: "upload", relationTo: "media", hasMany: true, filterOptions: sameStore, label: "Photos", admin: { description: "Add at least 3 clear photos. Drag to reorder – the first photo is the main one shoppers see." } },
            { name: "video", type: "text", label: "Video link", admin: { description: "Optional. Paste a YouTube link." } },
          ],
        },
        {
          label: "Pricing & stock",
          fields: [
            { type: "row", fields: [
              { name: "price", type: "number", required: true, min: 0, label: "Price", access: { update: storeRoleField("store_manager") }, admin: { width: "33%", description: "What the customer pays, in your store's currency. Only owners and managers can change it.", components: { Cell: "/payload/admin/products/Cells#ProductPriceCell" } } },
              { name: "compareAtPrice", type: "number", min: 0, label: "Was price", access: { update: storeRoleField("store_manager") }, admin: { width: "33%", description: "Optional. Shown crossed out to show a sale. Must be higher than the price." } },
              { name: "costPrice", type: "number", min: 0, access: { read: storeRoleField("store_owner"), update: storeRoleField("store_owner"), create: storeRoleField("store_owner") }, label: "Your cost", admin: { width: "33%", description: "What you paid. Only owners see this. Never shown to customers." } },
            ] },
            { name: "priceOnRequest", type: "checkbox", label: "Price on request (wholesale lot – can't be bought online)" },
            { name: "taxClass", type: "select", defaultValue: "standard", label: "Tax", options: [
              { label: "Normal rate", value: "standard" },
              { label: "Reduced rate", value: "reduced" },
              { label: "No tax (exempt)", value: "exempt" },
            ], admin: { description: "Uses the rates in Settings → Delivery & payments → Tax (only when the store charges tax)." } },
            { type: "row", fields: [
              { name: "sku", type: "text", required: true, index: true, label: "SKU (your stock code)", hooks: {
                  // left empty → made from the product name (e.g. P-LOGITECH-M185-7K2Q); the column stays required
                  beforeValidate: [({ value, data }) => (typeof value === "string" && value.trim() ? value.trim() : `P-${slugify(String(data?.title ?? "item")).toUpperCase().slice(0, 28).replace(/-+$/, "")}-${copyTag().toUpperCase()}`)],
                  beforeDuplicate: [({ value }) => `${String(value ?? "SKU").replace(/\s+/g, "-")}-COPY-${copyTag().toUpperCase()}`],
                },
                // empty is fine here – the hook above fills it in before saving; unique within the store
                validate: async (v: unknown, opts: unknown) => (v == null || typeof v === "string" ? uniqueInStore("sku", "Another product in this store already has this SKU.")(v, opts as never) : "Enter a code or leave it empty."),
                admin: { width: "34%", description: "Leave empty and one is made for you." } },
              { name: "stock", type: "number", defaultValue: 0, label: "Stock", validate: stockValue, hooks: { ...onCopy(0).hooks, afterRead: [liveStockWhenDraft] }, access: { read: storeRoleField("store_staff") }, admin: { width: "33%", description: "How many you have.", components: { Cell: "/payload/admin/products/Cells#ProductStockCell" } } },
              // the stock this screen showed – lets the server tell "unchanged" from "changed" (see guardStock)
              { name: "stockSeen", type: "number", virtual: true, admin: { hidden: true }, hooks: { afterRead: [liveStockWhenDraft] } },
              { name: "lowStockThreshold", type: "number", defaultValue: 2, min: 0, access: { read: storeRoleField("store_staff") }, label: "Warn me at", admin: { width: "33%", description: "You get a low-stock alert when stock reaches this number." } },
            ] },
            // pre-orders and backorders: keep taking orders when the stock runs out (online and staff orders – never at the
            // shop counter); the stock then goes below 0 = units owed to customers
            { type: "row", admin: { condition: (d) => !d?.trackUnits }, fields: [
              { name: "backorders", type: "select", defaultValue: "no", label: "When sold out", options: [
                { label: "Stop selling (out of stock)", value: "no" },
                { label: "Keep selling – ships when back in stock", value: "backorder" },
                { label: "Pre-order – not released yet", value: "preorder" },
              ], admin: { width: "34%", description: "Laptops tracked by serial number always stop at 0." } },
              { name: "releaseDate", type: "date", label: "Ships from", admin: { width: "33%", condition: (d) => d?.backorders === "preorder", date: { pickerAppearance: "dayOnly" }, description: "Shown as “Pre-order · ships from …”. Until then every order is a pre-order." } },
              { name: "backorderNote", type: "text", label: "Note for shoppers", maxLength: 80, admin: { width: "33%", condition: (d) => d?.backorders === "backorder" || d?.backorders === "preorder", description: "e.g. Ships in 2–3 weeks. Optional." } },
            ] },
            // digital products: files the customer downloads once the order is paid (Catalog → Digital files)
            {
              name: "digital",
              type: "group",
              label: "Digital product (download)",
              admin: { description: "Sell e-books, software, courses … The customer gets signed download links on their order page and by email once the order is paid." },
              fields: [
                { name: "files", type: "relationship", relationTo: "digital-files", hasMany: true, filterOptions: sameStore, label: "Files the customer downloads", admin: { description: "Upload them first in Catalog → Digital files." } },
                { type: "row", fields: [
                  { name: "noShipping", type: "checkbox", label: "Nothing to ship (download only)", admin: { width: "34%", style: { alignSelf: "center" }, description: "A cart of only such products pays no delivery." } },
                  { name: "downloadLimit", type: "number", min: 1, max: 100, defaultValue: 5, label: "Downloads per file", admin: { width: "33%" } },
                  { name: "downloadDays", type: "number", min: 1, max: 3650, defaultValue: 30, label: "Days to download", admin: { width: "33%", description: "Counted from the order." } },
                ] },
              ],
            },
            { type: "row", fields: [
              // what a scanner reads at the counter (EAN / UPC / GTIN); optional, unique within the store
              { name: "barcode", type: "text", index: true, label: "Barcode", validate: async (v: unknown, opts: unknown) => (v == null || v === "" ? true : typeof v === "string" ? uniqueInStore("barcode", "Another product in this store already has this barcode.")(v, opts as never) : "Enter the number under the barcode."), admin: { width: "50%", description: "EAN / UPC / GTIN – scan it at the shop counter. Optional." } },
              { name: "productType", type: "text", index: true, label: "Product type", admin: { width: "50%", description: "Your own grouping for reports and filters, e.g. Laptop, Charger, Gift card. Optional." } },
            ] },
            { name: "stockHistoryLink", type: "ui", admin: { condition: (_, __, { user }) => Boolean(user && (user as { role?: string }).role !== "customer"), components: { Field: "/payload/admin/products/StockHistoryLink#StockHistoryLink" } } },
            { type: "row", fields: [
              { name: "unit", type: "text", label: "Selling unit", admin: { width: "50%", description: "e.g. piece, pair, box of 10. Empty = piece." } },
              { name: "stockStatus", type: "select", label: "Stock status", index: true, options: [
                { label: "In stock", value: "in" },
                { label: "Low stock", value: "low" },
                { label: "Out of stock", value: "out" },
              ], admin: { width: "50%", readOnly: true, description: "Set automatically from stock and the low-stock threshold." } },
            ] },
            { type: "row", fields: [
              { name: "condition", type: "select", options: CONDITIONS, admin: { width: "50%" } },
              { name: "warranty", type: "text", admin: { width: "50%" } },
            ] },
            { name: "conditionNotes", type: "textarea", admin: { description: "e.g. Battery health 91%, minor scratches on lid." } },
            { name: "inTheBox", type: "textarea", label: "What's in the box" },
            { type: "row", fields: [
              { name: "shippingClass", type: "select", defaultValue: "small", options: [
                { label: "Laptop", value: "laptop" },
                { label: "Small accessory", value: "small" },
                { label: "Large item", value: "large" },
              ], admin: { width: "50%" } },
              { name: "weight", type: "number", min: 0, admin: { width: "50%", description: "kg – for your courier bookings. Delivery prices come from Delivery & payments → Delivery charges." } },
            ] },
            {
              name: "wholesale",
              type: "group",
              fields: [
                { name: "available", type: "checkbox", label: "Available for wholesale (quote)" },
                { type: "row", fields: [
                  { name: "minQty", type: "number", admin: { width: "50%" } },
                  { name: "lotSize", type: "number", admin: { width: "50%" } },
                ] },
                { name: "grades", type: "text" },
                { name: "contents", type: "textarea" },
                { name: "note", type: "textarea" },
              ],
            },
          ],
        },
        {
          label: "Specs & compatibility",
          fields: [
            { name: "specs", type: "array", fields: [{ type: "row", fields: [
              { name: "label", type: "text", required: true, admin: { width: "40%" } },
              { name: "value", type: "text", required: true, admin: { width: "60%" } },
            ] }] },
            { name: "attributes", type: "json", admin: { components: { Field: "/payload/admin/AttributesField#AttributesField" } } },
            { name: "compatibility", type: "relationship", relationTo: "laptop-models", hasMany: true, filterOptions: sameStore },
            { name: "upgrades", type: "array", label: "Options & upgrades", labels: { singular: "Option", plural: "Options" }, admin: { description: "Choices shoppers can add at checkout, grouped (e.g. RAM: 16GB +6,000; SSD: 512GB +5,500)." }, fields: [{ type: "row", fields: [
              { name: "optionId", type: "text", admin: { width: "20%" } },
              { name: "group", type: "text", required: true, admin: { width: "20%" } },
              { name: "label", type: "text", required: true, admin: { width: "40%" } },
              { name: "price", type: "number", required: true, min: 0, access: { update: storeRoleField("store_manager") }, admin: { width: "20%" } },
            ] }] },
            { name: "boughtTogether", type: "relationship", relationTo: "products", hasMany: true, filterOptions: sameStore, label: "Frequently bought together" },
            { name: "bundleDiscountPercent", type: "number", min: 0, max: 90 },
          ],
        },
        {
          label: "Variants",
          description: "Sell this product in options such as colour or size – each option gets its own SKU, price, stock and photo.",
          fields: [
            {
              name: "variantOf",
              type: "relationship",
              relationTo: "products",
              index: true,
              label: "Variant of",
              filterOptions: ({ data }): Where => {
                const same = sameStore({ data });
                return same === true ? { variantOf: { exists: false } } : { and: [{ variantOf: { exists: false } }, same] };
              },
              admin: { readOnly: true, condition: (d) => Boolean(d?.variantOf), description: "This product is one option of another product – shoppers choose it on that product's page." },
            },
            { name: "optionValues", type: "json", label: "Option", admin: { condition: (d) => Boolean(d?.variantOf), components: { Field: "/payload/admin/products/VariantFields#OptionValuesField" } } },
            {
              name: "variantOptions",
              type: "array",
              label: "Options",
              labels: { singular: "Option", plural: "Options" },
              maxRows: 3,
              admin: { condition: (d) => !d?.variantOf, description: "e.g. Colour: Black, Silver · Size: S, M, L. Save, then press “Create variants” below." },
              fields: [{ type: "row", fields: [
                { name: "name", type: "text", required: true, label: "Option name", admin: { width: "30%", placeholder: "Colour" } },
                { name: "values", type: "text", hasMany: true, required: true, label: "Values", admin: { width: "70%", placeholder: "Type a value and press Enter" } },
              ] }],
            },
            { name: "variantsPanel", type: "ui", admin: { condition: (d) => !d?.variantOf, components: { Field: "/payload/admin/products/VariantFields#VariantsPanel" } } },
          ],
        },
      ],
    },
    { name: "summary", type: "ui", admin: { position: "sidebar", components: { Field: "/payload/admin/products/ProductSummary#ProductSummary" } } },
    { name: "status", type: "select", required: true, defaultValue: "draft", index: true, label: "Status", ...onCopy("draft"),
      // own type name: Payload's draft/published marker (_status) uses "enum_cms_products_status"
      enumName: "enum_cms_products_visibility",
      options: [
      { label: "Draft – not on store yet", value: "draft" },
      { label: "On store", value: "active" },
      { label: "Hidden", value: "archived" },
    ], admin: { position: "sidebar", components: { Cell: "/payload/admin/products/Cells#ProductStatusCell" } } },
    slugField("title"),
    { name: "trackUnits", type: "checkbox", label: "Track each unit by serial number", admin: { position: "sidebar", description: "For laptops: stock becomes the number of units (Products → Laptop units) that are In stock. Each sale – online or in the shop – is tied to a serial." } },
    { name: "tags", type: "text", hasMany: true, admin: { position: "sidebar" } },
    { name: "featured", type: "checkbox", ...onCopy(false), admin: { position: "sidebar" } },
    { name: "bestSeller", type: "checkbox", ...onCopy(false), admin: { position: "sidebar" } },
    { name: "hotDeal", type: "checkbox", ...onCopy(false), admin: { position: "sidebar" } },
    { name: "dealEndsAt", type: "date", admin: { position: "sidebar", date: { pickerAppearance: "dayAndTime" }, condition: (d) => Boolean(d?.hotDeal) } },
    { name: "rating", type: "number", defaultValue: 0, ...onCopy(0), admin: { position: "sidebar", readOnly: true } },
    { name: "reviewCount", type: "number", defaultValue: 0, ...onCopy(0), admin: { position: "sidebar", readOnly: true } },
    { name: "soldCount", type: "number", defaultValue: 0, ...onCopy(0), access: { read: storeRoleField("store_staff") }, admin: { position: "sidebar", readOnly: true } },
    legacyIdField,
  ],
};

export const Reviews: CollectionConfig = {
  slug: "reviews",
  dbName: dbName("reviews"),
  admin: { useAsTitle: "name", group: "Catalog", defaultColumns: ["name", "product", "rating", "approved", "createdAt"] },
  access: { read: publicOrStore("store_staff", { approved: { equals: true } }), create: createFor("store_staff"), update: writeFor("store_staff"), delete: writeFor("store_manager") },
  hooks: { beforeValidate: [assignStore()], beforeChange: [publishReviewPhotos], afterChange: [reviewAfterChange], afterDelete: [reviewAfterDelete] },
  fields: [
    storeField(),
    { name: "product", type: "relationship", relationTo: "products", required: true, index: true, filterOptions: sameStore },
    { type: "row", fields: [
      { name: "name", type: "text", required: true, admin: { width: "40%" } },
      { name: "city", type: "text", admin: { width: "30%" } },
      { name: "rating", type: "number", required: true, min: 1, max: 5, admin: { width: "30%" } },
    ] },
    { name: "title", type: "text" },
    { name: "body", type: "textarea", required: true },
    { name: "photoKeys", type: "json", label: "Customer photos", admin: { components: { Field: "/payload/admin/aftersales/Photos#Photos" }, description: "Shown on the product page once you approve the review." } },
    { name: "photos", type: "json", admin: { hidden: true } },
    { name: "approved", type: "checkbox", defaultValue: false, admin: { position: "sidebar" } },
    { name: "verified", type: "checkbox", defaultValue: false, admin: { position: "sidebar" } },
    legacyIdField,
  ],
};
