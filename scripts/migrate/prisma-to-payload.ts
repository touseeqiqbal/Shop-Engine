/**
 * One-way data migration: legacy Prisma tables (schema `public`) → Payload collections (schema `payload`).
 *
 *   npx payload run scripts/migrate/prisma-to-payload.ts                 # full, idempotent (re-runnable)
 *   npx payload run scripts/migrate/prisma-to-payload.ts -- --since=2026-10-06T00:00:00Z   # delta sync at cutover
 *   npx payload run scripts/migrate/prisma-to-payload.ts -- --report-only                  # just re-verify
 * (note the "--" before script flags; MIGRATE_SINCE=<iso> works too)
 *
 * Guarantees
 *  - The legacy tables are only READ (never written). Prove it with scripts/migrate/fingerprint-legacy.mjs.
 *  - Every document stores `legacyId`; re-running updates instead of duplicating.
 *  - Slugs are copied verbatim, so every product/category/blog URL stays the same.
 *  - Customers keep their passwords (bcrypt hash copied to `legacyPasswordHash`, upgraded on first login).
 *  - Ends with a migration report (counts, order totals, slug parity) written to migration-report.md;
 *    the process exits with code 1 if anything does not match.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { getPayload, type Payload } from "payload";
import { convertMarkdownToLexical, editorConfigFactory } from "@payloadcms/richtext-lexical";
import config from "@payload-config";
import { prisma } from "../../src/lib/db/prisma";
import { getObject } from "../../src/lib/storage";
import { mediaUrl } from "../../src/lib/media";
import { COMPANY_LINKS, SERVICE_LINKS } from "../../src/lib/cms/chrome-types";
import { mergeHomeConfig, type HomeConfig } from "../../src/lib/content/home";
import { legacyHomeToPage, type PageBlock } from "../../src/lib/cms/blocks-types";

const args = process.argv.slice(2);
const SINCE = args.find((a) => a.startsWith("--since="))?.slice(8) ?? process.env.MIGRATE_SINCE;
const REPORT_ONLY = args.includes("--report-only");
const since = SINCE ? new Date(SINCE) : null;
if (since && Number.isNaN(since.getTime())) throw new Error(`Invalid --since value: ${SINCE}`);

type Id = string | number;
const log = (...m: unknown[]) => console.log("[migrate]", ...m);

// ───────────────────────────── helpers ─────────────────────────────

const failures: string[] = [];

async function upsertByLegacy(payload: Payload, collection: string, legacyId: string, data: Record<string, unknown>, extra: Record<string, unknown> = {}): Promise<Id> {
  try {
    return await upsertByLegacyInner(payload, collection, legacyId, data, extra);
  } catch (e) {
    const detail = (e as { data?: { errors?: { path?: string; message?: string }[] } }).data?.errors?.map((x) => `${x.path}: ${x.message}`).join("; ");
    failures.push(`${collection} ${legacyId}: ${detail || (e as Error).message}`);
    console.error("[migrate] FAILED", collection, legacyId, detail || e);
    return "";
  }
}

/**
 * Collections that are edited in /cms since Phase 4 (single source of truth). Re-runs only ADD records that are
 * missing; existing documents are never overwritten with the frozen legacy data.
 */
const CMS_OWNED = new Set(["brands", "categories", "laptop-models", "products", "reviews", "orders", "wholesale-inquiries", "contact-messages", "discounts", "flash-sales", "redirects"]);
/** Documents created during this run (pass-2 relations are only set on these). */
const createdNow = new Set<string>();

async function upsertByLegacyInner(payload: Payload, collection: string, legacyId: string, data: Record<string, unknown>, extra: Record<string, unknown> = {}): Promise<Id> {
  // Migration writes skip storefront revalidation and derived-data hooks (e.g. review → product rating).
  extra = { context: { migrating: true, skipRevalidate: true }, ...extra };
  const found = await payload.find({ collection: collection as never, where: { legacyId: { equals: legacyId } }, limit: 1, depth: 0, overrideAccess: true, ...extra });
  const doc = found.docs[0] as { id: Id } | undefined;
  if (doc) {
    if (CMS_OWNED.has(collection)) return doc.id; // edited in /cms – leave as is
    await payload.update({ collection: collection as never, id: doc.id, data: data as never, depth: 0, overrideAccess: true, ...extra });
    return doc.id;
  }
  const created = (await payload.create({ collection: collection as never, data: { ...data, legacyId } as never, depth: 0, overrideAccess: true, ...extra })) as { id: Id };
  createdNow.add(`${collection}:${legacyId}`);
  return created.id;
}

/** Create a document only if none with this legacyId exists yet – never overwrites what editors changed in /cms. */
async function createIfMissing(payload: Payload, collection: string, legacyId: string, data: Record<string, unknown>, extra: Record<string, unknown> = {}): Promise<{ id: Id; created: boolean } | null> {
  try {
    const found = await payload.find({ collection: collection as never, where: { legacyId: { equals: legacyId } }, limit: 1, depth: 0, overrideAccess: true, draft: true });
    const doc = found.docs[0] as { id: Id } | undefined;
    if (doc) return { id: doc.id, created: false };
    const created = (await payload.create({ collection: collection as never, data: { ...data, legacyId } as never, depth: 0, overrideAccess: true, ...extra })) as { id: Id };
    return { id: created.id, created: true };
  } catch (e) {
    const detail = (e as { data?: { errors?: { path?: string; message?: string }[] } }).data?.errors?.map((x) => `${x.path}: ${x.message}`).join("; ");
    failures.push(`${collection} ${legacyId}: ${detail || (e as Error).message}`);
    console.error("[migrate] FAILED", collection, legacyId, detail || e);
    return null;
  }
}

const MIME: Record<string, string> = { webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", svg: "image/svg+xml", gif: "image/gif" };

/** Loads the bytes behind any URL the old site used for an image. */
async function readImage(url: string): Promise<{ data: Buffer; mimetype: string; name: string } | null> {
  const name = decodeURIComponent(url.split("?")[0].split("/").pop() || "image");
  const mimetype = MIME[name.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
  try {
    if (url.startsWith("/media/")) {
      const key = url.slice("/media/".length).split("/").map(decodeURIComponent).join("/");
      const obj = await getObject(key);
      if (!obj) return null;
      return { data: Buffer.from(await new Response(obj.body).arrayBuffer()), mimetype: obj.contentType || mimetype, name };
    }
    if (url.startsWith("/")) return { data: await fs.readFile(path.join(process.cwd(), "public", url)), mimetype, name };
    const res = await fetch(url);
    if (!res.ok) return null;
    return { data: Buffer.from(await res.arrayBuffer()), mimetype: res.headers.get("content-type") || mimetype, name };
  } catch {
    return null;
  }
}

const mediaCache = new Map<string, Id>();
const mediaMissing: string[] = [];

/** Media doc for an image URL (deduplicated by original URL; re-runs reuse the existing doc). */
async function mediaFor(payload: Payload, url: string | null | undefined, alt: string): Promise<Id | null> {
  if (!url) return null;
  if (mediaCache.has(url)) return mediaCache.get(url)!;
  const existing = await payload.find({ collection: "media", where: { sourceUrl: { equals: url } }, limit: 1, depth: 0, overrideAccess: true });
  if (existing.docs[0]) {
    mediaCache.set(url, existing.docs[0].id);
    return existing.docs[0].id;
  }
  const file = await readImage(url);
  if (!file) {
    mediaMissing.push(url);
    return null;
  }
  const doc = await payload.create({
    collection: "media",
    data: { alt: alt.slice(0, 300) || "Product image", sourceUrl: url },
    file: { data: file.data, mimetype: file.mimetype, name: file.name, size: file.data.length },
    overrideAccess: true,
  });
  mediaCache.set(url, doc.id);
  return doc.id;
}

let editorConfig: Awaited<ReturnType<typeof editorConfigFactory.default>> | null = null;
async function richText(payload: Payload, markdown: string | null | undefined) {
  if (!markdown?.trim()) return null;
  editorConfig ??= await editorConfigFactory.default({ config: payload.config });
  return convertMarkdownToLexical({ editorConfig, markdown });
}

const changedSince = (d: Date | null | undefined) => !since || !d || d >= since;

// ───────────────────────────── migration ─────────────────────────────

async function migrate(payload: Payload) {
  const map = { users: new Map<string, Id>(), brands: new Map<string, Id>(), categories: new Map<string, Id>(), models: new Map<string, Id>(), products: new Map<string, Id>() };
  const idsOf = async (collection: string, target: Map<string, Id>) => {
    const res = await payload.find({ collection: collection as never, limit: 0, pagination: false, depth: 0, overrideAccess: true, select: { legacyId: true } as never });
    for (const d of res.docs as { id: Id; legacyId?: string }[]) if (d.legacyId) target.set(d.legacyId, d.id);
  };

  // Users (customers + staff). Passwords: random unusable password + legacy bcrypt hash for lazy upgrade.
  const roleMap: Record<string, string> = { admin: "owner", staff: "staff", customer: "customer" };
  const users = await prisma.user.findMany();
  for (const u of users) {
    if (!changedSince(u.updatedAt)) continue;
    const existing = await payload.find({ collection: "users", where: { legacyId: { equals: u.id } }, limit: 1, depth: 0, overrideAccess: true });
    const data = {
      email: u.email.toLowerCase(),
      name: u.name ?? undefined,
      phone: u.phone ?? undefined,
      role: roleMap[u.role] ?? "customer",
      addresses: u.addresses ?? [],
      wishlist: u.wishlist ?? [],
      legacyPasswordHash: u.passwordHash,
    };
    if (existing.docs[0]) {
      continue; // accounts are managed in /cms since Phase 6 – never overwrite profiles, passwords or roles
    } else {
      await payload.create({ collection: "users", data: { ...data, legacyId: u.id, password: randomBytes(24).toString("base64url") } as never, overrideAccess: true, disableVerificationEmail: true });
    }
  }
  await idsOf("users", map.users);
  log(`users: ${users.length}`);

  if (!since) {
    // Brands
    for (const b of await prisma.brand.findMany()) map.brands.set(b.slug, await upsertByLegacy(payload, "brands", b.slug, { name: b.name, slug: b.slug }));
    log(`brands: ${map.brands.size}`);

    // Categories – pass 1 without parents, pass 2 sets parents
    const cats = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
    for (const c of cats) {
      map.categories.set(c.id, await upsertByLegacy(payload, "categories", c.id, {
        name: c.name, nameUr: c.nameUr ?? undefined, slug: c.slug, icon: c.icon, shortDescription: c.shortDescription,
        seoContent: c.seoContent ?? undefined, attributes: (c.attributes as unknown[]) ?? [], compatibility: c.compatibility,
        featured: c.featured, sortOrder: c.sortOrder,
        image: await mediaFor(payload, c.image, c.name),
        meta: { title: c.seoTitle ?? undefined, description: c.seoDescription ?? undefined },
      }));
    }
    for (const c of cats) if (c.parentId && createdNow.has(`categories:${c.id}`)) await payload.update({ collection: "categories", id: map.categories.get(c.id)!, data: { parent: map.categories.get(c.parentId) } as never, overrideAccess: true });
    log(`categories: ${cats.length}`);

    // Laptop models
    for (const m of await prisma.laptopModel.findMany()) {
      const brand = map.brands.get(m.brand);
      if (brand) map.models.set(m.id, await upsertByLegacy(payload, "laptop-models", m.id, { name: m.name, series: m.series, slug: m.id, brand }));
    }
    log(`laptop models: ${map.models.size}`);
  } else {
    await Promise.all([idsOf("brands", map.brands), idsOf("categories", map.categories), idsOf("laptop-models", map.models)]);
    // brands are keyed by slug
    const res = await payload.find({ collection: "brands", limit: 0, pagination: false, depth: 0, overrideAccess: true });
    for (const b of res.docs as { id: Id; slug: string }[]) map.brands.set(b.slug, b.id);
  }

  // Products (+ uploaded photos, in order, falling back to legacy image URLs)
  const products = await prisma.product.findMany({ include: { productImages: { orderBy: { sortOrder: "asc" } } } });
  for (const p of products) {
    if (since && !changedSince(p.updatedAt)) continue;
    const imageUrls = p.productImages.length ? p.productImages.map((i) => ({ url: mediaUrl(i.key), alt: i.alt })) : p.images.map((u) => ({ url: u, alt: "" }));
    const images: Id[] = [];
    for (const [i, img] of imageUrls.entries()) {
      const id = await mediaFor(payload, img.url, img.alt || `${p.name}${i ? ` – image ${i + 1}` : ""}`);
      if (id) images.push(id);
    }
    const onSale = p.salePrice != null && p.salePrice > 0 && p.salePrice < p.price;
    const wholesale = (p.wholesale as Record<string, unknown> | null) ?? {};
    map.products.set(p.id, await upsertByLegacy(payload, "products", p.id, {
      title: p.name, slug: p.slug, brand: map.brands.get(p.brand), category: map.categories.get(p.categoryId),
      sku: p.sku, shortDescription: p.shortDescription, description: await richText(payload, p.description),
      price: onSale ? p.salePrice : p.price, compareAtPrice: onSale ? p.price : null,
      priceOnRequest: p.priceOnRequest, stock: p.stock, condition: p.condition ?? undefined, conditionNotes: p.conditionNotes ?? undefined,
      warranty: p.warranty, images, video: p.video ?? undefined,
      specs: (p.specs as { label: string; value: string }[]) ?? [], attributes: p.attributes ?? {},
      compatibility: p.compatibility.map((m) => map.models.get(m)).filter(Boolean),
      upgrades: ((p.upgrades as { id: string; group: string; label: string; price: number }[]) ?? []).map((u) => ({ optionId: u.id, group: u.group, label: u.label, price: u.price })),
      bundleDiscountPercent: p.bundleDiscountPercent ?? undefined,
      wholesale: { available: Boolean(wholesale.available), minQty: wholesale.minQty, lotSize: wholesale.lotSize, grades: wholesale.grades, contents: wholesale.contents, note: wholesale.note },
      rating: p.rating, reviewCount: p.reviewCount, soldCount: p.soldCount, tags: p.tags,
      featured: p.featured, hotDeal: p.hotDeal, dealEndsAt: p.dealEndsAt?.toISOString() ?? null, bestSeller: p.bestSeller,
      status: p.status === "active" ? "active" : "draft",
      meta: { title: p.seoTitle ?? undefined, description: p.seoDescription ?? undefined, image: images[0] },
      createdAt: p.createdAt.toISOString(),
    }));
  }
  await idsOf("products", map.products);
  // pass 2: product → product relations
  for (const p of products) {
    if (since && !changedSince(p.updatedAt)) continue;
    if (!createdNow.has(`products:${p.id}`)) continue; // existing products are edited in /cms
    const related = p.boughtTogether.map((x) => map.products.get(x)).filter(Boolean);
    await payload.update({ collection: "products", id: map.products.get(p.id)!, data: { boughtTogether: related } as never, overrideAccess: true });
  }
  log(`products: ${products.length}`);

  if (!since) {
    for (const r of await prisma.review.findMany()) {
      const product = map.products.get(r.productId);
      if (product) await upsertByLegacy(payload, "reviews", r.id, { product, name: r.name, city: r.city ?? undefined, rating: r.rating, title: r.title ?? undefined, body: r.body, approved: r.approved, verified: Boolean(r.verified), createdAt: r.createdAt.toISOString() });
    }
    const posts = await prisma.blogPost.findMany();
    for (const post of posts) {
      const cover = await mediaFor(payload, post.cover, post.title);
      // Posts are written in /cms since the old admin was retired: only refresh ones nobody has edited there yet.
      const existing = (await payload.find({ collection: "posts", where: { legacyId: { equals: post.id } }, limit: 1, depth: 0, overrideAccess: true, draft: true })).docs[0] as { editedInCms?: boolean } | undefined;
      if (existing?.editedInCms) continue;
      await upsertByLegacy(payload, "posts", post.id, {
        title: post.title, slug: post.slug, excerpt: post.excerpt, cover, content: await richText(payload, post.content),
        category: post.category, tags: post.tags, author: post.author, publishedAt: post.publishedAt.toISOString(),
        relatedProducts: post.relatedProducts.map((s) => products.find((p) => p.slug === s)?.id).map((id) => (id ? map.products.get(id) : null)).filter(Boolean),
        relatedCategories: await (async () => {
          const cats = await prisma.category.findMany({ where: { slug: { in: post.relatedCategories } } });
          return post.relatedCategories.map((s) => cats.find((c) => c.slug === s)).map((c) => (c ? map.categories.get(c.id) : null)).filter(Boolean); // keep the post's order
        })(),
        lastEdited: post.updatedAt?.toISOString() ?? null,
        meta: { title: post.seoTitle ?? undefined, description: post.seoDescription ?? undefined, image: cover ?? undefined },
        _status: post.status === "published" ? "published" : "draft",
      });
    }
    log(`posts: ${posts.length}`);
    for (const r of await prisma.redirect.findMany()) {
      await upsertByLegacy(payload, "redirects", r.fromPath, { from: r.fromPath, to: { type: "custom", url: r.toPath } });
    }
  }

  // Orders (delta-aware)
  const orders = await prisma.order.findMany({ orderBy: { createdAt: "asc" } });
  for (const o of orders) {
    if (since && o.createdAt < since && !(o.history as { at: string }[]).some((h) => new Date(h.at) >= since)) continue;
    const items = (o.items as { productId: string; slug: string; name: string; image: string; url: string; unitPrice: number; qty: number; upgrades: unknown[] }[]).map((i) => ({
      product: map.products.get(i.productId) ?? null, title: i.name, slug: i.slug, url: i.url, image: i.image, unitPrice: i.unitPrice, qty: i.qty, upgrades: i.upgrades ?? [],
    }));
    const c = o.customer as Record<string, string>;
    await upsertByLegacy(payload, "orders", o.id, {
      orderNumber: o.orderNumber, status: o.status, placedAt: o.createdAt.toISOString(),
      customer: { name: c.name, phone: c.phone, email: c.email, city: c.city, address: c.address, landmark: c.landmark },
      items, subtotal: o.subtotal, discount: o.discount, deliveryCharge: o.deliveryCharge, total: o.total, advancePaid: o.advancePaid ?? undefined,
      couponCode: o.couponCode ?? undefined, paymentMethod: o.paymentMethod, paymentStatus: o.paymentStatus,
      paymentScreenshotKey: o.paymentScreenshotUrl ?? undefined, courier: o.courier ?? undefined, trackingNumber: o.trackingNumber ?? undefined,
      notes: o.notes ?? undefined, history: (o.history as { status: string; at: string; note?: string }[]) ?? [],
      user: o.userId ? map.users.get(o.userId) ?? null : null, createdAt: o.createdAt.toISOString(),
    });
  }
  log(`orders: ${orders.length}`);

  for (const w of await prisma.wholesaleInquiry.findMany()) {
    if (!changedSince(w.createdAt)) continue;
    await upsertByLegacy(payload, "wholesale-inquiries", w.id, {
      name: w.name, businessName: w.businessName ?? undefined, phone: w.phone, email: w.email ?? undefined, city: w.city, buyerType: w.buyerType,
      items: w.items, message: w.message ?? undefined, budget: w.budget ?? undefined, adminNotes: w.adminNotes ?? undefined, source: w.source ?? undefined,
      status: w.status, receivedAt: w.createdAt.toISOString(),
    });
  }
  // Phase 6: discount codes and flash sales (create-only)
  for (const c of await prisma.coupon.findMany()) {
    await upsertByLegacy(payload, "discounts", c.code, { code: c.code, kind: c.kind, value: c.value, minOrder: c.minOrder, usageLimit: c.usageLimit ?? undefined, used: c.used, active: c.active, expiresAt: c.expiresAt?.toISOString() ?? undefined });
  }
  for (const f of await prisma.flashSale.findMany()) {
    const products = f.productIds.map((id) => map.products.get(id)).filter(Boolean);
    if (products.length) await upsertByLegacy(payload, "flash-sales", f.id, { title: f.title, endsAt: f.endsAt.toISOString(), active: f.active, products });
  }

  for (const m of await prisma.contactMessage.findMany()) {
    if (!changedSince(m.createdAt)) continue;
    await upsertByLegacy(payload, "contact-messages", m.id, { name: m.name, phone: m.phone ?? undefined, email: m.email ?? undefined, subject: m.subject ?? undefined, message: m.message, handled: m.handled, receivedAt: m.createdAt.toISOString() });
  }

  if (!since) await seedOnlineStore(payload);
}

// ─────────────────────── online store (Phase 2) ───────────────────────

/**
 * Seeds editable copies of today's navigation as Menus (Online store → Menus) and carries the old admin's
 * announcement text over. Menus are NOT assigned to the Header / Footer – until an admin picks one there,
 * the storefront keeps its automatic menus (all categories), so nothing changes on the live site.
 * Idempotent: menus are upserted by legacyId; globals are only written while still untouched.
 */
async function seedOnlineStore(payload: Payload) {
  const cats = await prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const ids = new Map<string, Id>();
  const res = await payload.find({ collection: "categories", limit: 0, pagination: false, depth: 0, overrideAccess: true, select: { legacyId: true } as never });
  for (const d of res.docs as { id: Id; legacyId?: string }[]) if (d.legacyId) ids.set(d.legacyId, d.id);
  const catLink = (c: { id: string }) => ({ type: "category", category: ids.get(c.id) });
  const custom = (url: string, label: string) => ({ type: "custom", url, label });
  const roots = cats.filter((c) => !c.parentId && ids.has(c.id));
  const laptops = roots.find((c) => c.slug === "laptops");

  const menus: [string, string, string, Record<string, unknown>[]][] = [
    ["menu-main", "Main menu", "main-menu", [
      {
        ...custom("/category", "Categories"), megaMenu: true, icon: "LayoutGrid",
        children: roots.map((c) => ({ ...catLink(c), links: cats.filter((s) => s.parentId === c.id && ids.has(s.id)).map(catLink) })),
      },
      laptops ? { ...catLink(laptops), label: "Laptops" } : custom("/category/laptops", "Laptops"),
      custom("/deals", "Hot Deals"),
      custom("/find-parts", "Find Parts"),
      custom("/wholesale", "Wholesale"),
      custom("/blog", "Blog"),
    ]],
    ["menu-footer-shop", "Footer – Shop", "footer-shop", roots.map(catLink)],
    ["menu-footer-service", "Footer – Customer service", "footer-customer-service", SERVICE_LINKS.map(([url, label]) => custom(url, label))],
    ["menu-footer-company", "Footer – Company", "footer-company", COMPANY_LINKS.map(([url, label]) => custom(url, label))],
  ];
  let createdMenus = 0;
  for (const [legacyId, name, handle, items] of menus) if ((await createIfMissing(payload, "menus", legacyId, { name, handle, items }))?.created) createdMenus++;
  log(`menus: ${createdMenus} created, ${menus.length - createdMenus} already there (left as edited)`);

  // Home page (Phase 3 page builder): the old admin's home builder config → published "Home" page with blocks.
  const homeConfig = mergeHomeConfig((await prisma.setting.findUnique({ where: { key: "home" } }))?.value as Partial<HomeConfig> | null);
  const productIds = new Map<string, Id>();
  const prodRes = await payload.find({ collection: "products", limit: 0, pagination: false, depth: 0, overrideAccess: true, select: { legacyId: true } as never });
  for (const d of prodRes.docs as { id: Id; legacyId?: string }[]) if (d.legacyId) productIds.set(d.legacyId, d.id);
  const pick = (map: Map<string, Id>, list: string[]) => list.map((x) => map.get(x)).filter((x): x is Id => x != null);
  const toLayout = (b: PageBlock): Record<string, unknown> | null => {
    switch (b.type) {
      case "hero": return { blockType: "hero", slides: [] };
      case "trust": return { blockType: "trust", badges: b.badges };
      case "categories": return { blockType: "categories", ...b.text, categories: pick(ids, b.categoryIds) };
      case "deals": return { blockType: "deals", ...b.text, source: b.source, products: pick(productIds, b.productIds), limit: b.limit };
      case "products": return { blockType: "products", ...b.text, source: b.source, products: pick(productIds, b.productIds), limit: b.limit };
      case "richText": return { blockType: "richText", markdown: b.markdown, boxed: b.boxed, width: b.width };
      case "finder": case "brands": case "installment": case "testimonials": case "social": case "location":
        return { blockType: b.type, ...b.text };
      default: return null;
    }
  };
  const home = legacyHomeToPage(homeConfig);
  const homeDoc = await createIfMissing(payload, "pages", "page-home", {
    title: "Home", slug: "home", h1Highlight: home.h1Highlight, h1Text: home.h1Text,
    layout: home.blocks.map(toLayout).filter(Boolean), _status: "published",
  });
  // Phase 5: Settings → Shipping / Payments, from the old admin's Store settings (only while never saved in /cms)
  const store = { ...((await prisma.setting.findUnique({ where: { key: "store" } }))?.value as Record<string, unknown> | null) } as Record<string, never>;
  const legacy = { freeDeliveryThreshold: 15000, defaultDeliveryCharge: 350, cityCharges: { Karachi: 200, Lahore: 300, Islamabad: 300, Rawalpindi: 300 } as Record<string, number>, advanceThreshold: 100000, advanceAmount: 5000, ...store } as {
    freeDeliveryThreshold: number; defaultDeliveryCharge: number; cityCharges: Record<string, number>; advanceThreshold: number; advanceAmount: number;
    bank?: { bankName?: string; accountTitle?: string; accountNumber?: string; iban?: string }; jazzcash?: { title?: string; number?: string }; easypaisa?: { title?: string; number?: string };
  };
  const ship = (await payload.findGlobal({ slug: "shipping" as never, depth: 0, overrideAccess: true })) as { updatedAt?: string };
  if (!ship.updatedAt) {
    // One zone per charge level keeps today's prices exactly; delivery times stay automatic.
    const byCharge = new Map<number, string[]>();
    for (const [city, charge] of Object.entries(legacy.cityCharges ?? {})) byCharge.set(charge, [...(byCharge.get(charge) ?? []), city]);
    const zones = [...byCharge.entries()].sort((a, b) => a[0] - b[0]).map(([charge, cities]) => ({ name: cities.length === 1 ? cities[0] : cities.join(", "), cities, charge }));
    zones.push({ name: "Rest of Pakistan", cities: [], charge: legacy.defaultDeliveryCharge, rest: true } as never);
    await payload.updateGlobal({ slug: "shipping" as never, data: { freeDeliveryThreshold: legacy.freeDeliveryThreshold, defaultCharge: legacy.defaultDeliveryCharge, zones } as never, overrideAccess: true, context: { skipRevalidate: true } });
    log(`shipping: ${zones.length} zones copied from the old Store settings`);
  }
  const pay = (await payload.findGlobal({ slug: "payments" as never, depth: 0, overrideAccess: true })) as { updatedAt?: string };
  if (!pay.updatedAt) {
    await payload.updateGlobal({
      slug: "payments" as never,
      data: {
        cod: { enabled: true, fee: 0, advanceThreshold: legacy.advanceThreshold, advanceAmount: legacy.advanceAmount },
        jazzcash: { enabled: true, ...legacy.jazzcash },
        easypaisa: { enabled: true, ...legacy.easypaisa },
        bank: { enabled: true, ...legacy.bank },
      } as never,
      overrideAccess: true,
    });
    log("payments: copied from the old Store settings");
  }

  // Retiring the old admin: copy its remaining settings into /cms globals (only while never saved there)
  const setting = async <T,>(key: string) => ((await prisma.setting.findUnique({ where: { key } }))?.value as T | null) ?? null;
  const seedGlobal = async (slug: string, data: Record<string, unknown> | null, what: string) => {
    if (!data) return;
    const g = (await payload.findGlobal({ slug: slug as never, depth: 0, overrideAccess: true })) as { updatedAt?: string };
    if (g.updatedAt) return;
    await payload.updateGlobal({ slug: slug as never, data: data as never, overrideAccess: true, context: { skipRevalidate: true } });
    log(`${what}: copied from the old admin`);
  };
  type Obj = Record<string, unknown>;
  const business = await setting<Obj>("business");
  await seedGlobal("store-info", business ? {
    ...business,
    phones: Array.isArray(business.phones) ? business.phones : undefined,
    hours: Array.isArray(business.hours) ? business.hours : undefined,
    social: business.social ?? undefined,
    couriers: Array.isArray(business.couriers) ? business.couriers : undefined,
  } : null, "store info");
  const seo = await setting<Obj>("seo");
  const pageSeo = await setting<Record<string, Obj>>("pageSeo");
  await seedGlobal("seo-settings", seo || pageSeo ? {
    ...(seo ?? {}),
    keywords: Array.isArray(seo?.keywords) ? seo!.keywords : undefined,
    pages: Object.entries(pageSeo ?? {}).filter(([, v]) => v && (v.title || v.description || v.ogImage || typeof v.noindex === "boolean")).map(([page, v]) => ({
      page, title: v.title, description: v.description, ogImage: v.ogImage, indexing: v.noindex === true ? "noindex" : v.noindex === false ? "index" : "default",
    })),
  } : null, "SEO settings");
  const pagesContent = await setting<Record<string, Obj>>("pages");
  await seedGlobal("page-texts", pagesContent ? { pages: Object.entries(pagesContent).filter(([, v]) => v && Object.values(v).some(Boolean)).map(([page, v]) => ({ page, ...v, updated: v.updated || undefined })) } : null, "page texts");
  const testimonials = await setting<Obj[]>("testimonials");
  await seedGlobal("testimonials", testimonials ? { items: testimonials } : null, "testimonials");
  const faqs = await setting<Obj[]>("faqs");
  await seedGlobal("faqs", faqs ? { items: faqs } : null, "FAQs");

  // Hero banners (old admin → Marketing → Banners) → slides of the Home page's hero section, if it has none yet
  const homeId = homeDoc?.id;
  if (homeId) {
    const page = (await payload.findByID({ collection: "pages" as never, id: homeId, depth: 0, overrideAccess: true, draft: true })) as { layout?: Obj[] };
    const hero = page.layout?.find((b) => b.blockType === "hero");
    if (hero && !(Array.isArray(hero.slides) && hero.slides.length)) {
      const banners = await prisma.banner.findMany({ where: { placement: "hero", active: true }, orderBy: { sortOrder: "asc" } });
      if (banners.length) {
        hero.slides = banners.map((b) => ({ imageUrl: b.image, accent: b.accent ?? undefined, eyebrow: b.eyebrow ?? undefined, title: b.title, subtitle: b.subtitle, ctaLabel: b.ctaLabel, ctaHref: b.ctaHref }));
        await payload.update({ collection: "pages" as never, id: homeId, data: { layout: page.layout, _status: "published" } as never, overrideAccess: true, context: { skipRevalidate: true } });
        log(`home hero: ${banners.length} slides copied from the old banners`);
      }
    }
  }

  // Stock status for products imported before it existed (used by the Low / Out of stock views)
  const noStatus = await payload.find({ collection: "products", where: { stockStatus: { exists: false } }, limit: 0, pagination: false, depth: 0, overrideAccess: true, select: { stock: true, lowStockThreshold: true } as never });
  for (const p of noStatus.docs as { id: Id; stock?: number; lowStockThreshold?: number }[]) {
    const stock = Number(p.stock ?? 0);
    const stockStatus = stock <= 0 ? "out" : stock <= Number(p.lowStockThreshold ?? 2) ? "low" : "in";
    await payload.update({ collection: "products", id: p.id, data: { stockStatus } as never, depth: 0, overrideAccess: true, context: { migrating: true, skipRevalidate: true } });
  }
  if (noStatus.docs.length) log(`stock status set on ${noStatus.docs.length} products`);

  log(homeDoc?.created ? `home page created from the old home builder (${home.blocks.length} sections)` : "home page already exists (left as edited)");

  const ann = (await payload.findGlobal({ slug: "announcement-bar" as never, depth: 0, overrideAccess: true })) as { updatedAt?: string };
  const legacyText = ((await prisma.setting.findUnique({ where: { key: "store" } }))?.value as { announcement?: string } | null)?.announcement;
  if (!ann.updatedAt && legacyText) {
    await payload.updateGlobal({ slug: "announcement-bar" as never, data: { text: legacyText } as never, overrideAccess: true });
    log("announcement text copied from the old admin");
  }
}

// ───────────────────────────── report ─────────────────────────────

async function report(payload: Payload) {
  const count = (collection: string, where?: object) => payload.count({ collection: collection as never, where: where as never, overrideAccess: true }).then((r) => r.totalDocs);
  const legacyProducts = await prisma.product.findMany({ include: { productImages: true } });
  const legacyImageUrls = new Set([
    ...legacyProducts.flatMap((p) => (p.productImages.length ? p.productImages.map((i) => mediaUrl(i.key)) : p.images)),
    ...(await prisma.blogPost.findMany({ select: { cover: true } })).map((p) => p.cover).filter(Boolean),
    ...(await prisma.category.findMany({ select: { image: true } })).map((c) => c.image).filter((x): x is string => Boolean(x)),
  ]);
  const legacyOrders = await prisma.order.findMany();
  const payloadOrders = (await payload.find({ collection: "orders", limit: 0, pagination: false, depth: 0, overrideAccess: true })).docs as { legacyId?: string; total: number; subtotal: number }[];
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const totalsMismatch = legacyOrders.filter((o) => {
    const p = payloadOrders.find((x) => x.legacyId === o.id);
    return !p || p.total !== o.total || p.subtotal !== o.subtotal;
  });
  const productDocs = (await payload.find({ collection: "products", limit: 0, pagination: false, depth: 0, overrideAccess: true })).docs as { legacyId?: string; slug: string; images?: unknown[] }[];
  const slugMismatch = legacyProducts.filter((p) => productDocs.find((d) => d.legacyId === p.id)?.slug !== p.slug);
  const migratedImageCount = productDocs.reduce((n, d) => n + (d.images?.length ?? 0), 0);
  const legacyImageCount = legacyProducts.reduce((n, p) => n + (p.productImages.length || p.images.length), 0);
  const legacyCats = await prisma.category.findMany();
  const catDocs = (await payload.find({ collection: "categories", limit: 0, pagination: false, depth: 0, overrideAccess: true })).docs as { legacyId?: string; slug: string }[];
  const catSlugMismatch = legacyCats.filter((c) => catDocs.find((d) => d.legacyId === c.id)?.slug !== c.slug);
  const legacyPosts = await prisma.blogPost.findMany();
  const postDocs = (await payload.find({ collection: "posts", limit: 0, pagination: false, depth: 0, overrideAccess: true, draft: true })).docs as { legacyId?: string; slug: string }[];
  const postSlugMismatch = legacyPosts.filter((p) => postDocs.find((d) => d.legacyId === p.id)?.slug !== p.slug);

  const rows: [string, number, number][] = [
    ["Products", legacyProducts.length, await count("products")],
    ["Product images (photo slots)", legacyImageCount, migratedImageCount],
    ["Distinct image files (products, blog covers, categories) → Media", legacyImageUrls.size, await count("media", { sourceUrl: { exists: true } })],
    ["Categories", legacyCats.length, await count("categories")],
    ["Brands", await prisma.brand.count(), await count("brands")],
    ["Laptop models", await prisma.laptopModel.count(), await count("laptop-models")],
    ["Reviews", await prisma.review.count(), await count("reviews")],
    ["Blog posts", legacyPosts.length, await count("posts")],
    ["Orders", legacyOrders.length, await count("orders", { legacyId: { exists: true } })],
    ["Customers (role customer)", await prisma.user.count({ where: { role: "customer" } }), await count("users", { and: [{ role: { equals: "customer" } }, { legacyId: { exists: true } }] })],
    ["Staff & admins", await prisma.user.count({ where: { role: { in: ["staff", "admin"] } } }), await count("users", { and: [{ role: { not_equals: "customer" } }, { legacyId: { exists: true } }] })],
    ["Wholesale inquiries", await prisma.wholesaleInquiry.count(), await count("wholesale-inquiries", { legacyId: { exists: true } })],
    ["Contact messages", await prisma.contactMessage.count(), await count("contact-messages", { legacyId: { exists: true } })],
    ["Discount codes", await prisma.coupon.count(), await count("discounts", { legacyId: { exists: true } })],
    ["Redirects", await prisma.redirect.count(), await count("redirects")],
  ];
  const legacyTotal = sum(legacyOrders.map((o) => o.total));
  // Orders placed after Phase 6 exist only in /cms – compare the migrated ones
  const payloadTotal = sum(payloadOrders.filter((o) => o.legacyId).map((o) => o.total));
  // Catalog rows are informational since Phase 4: the catalog is edited in /cms, so it is expected to diverge.
  const INFO = new Set(["Products", "Product images (photo slots)", "Distinct image files (products, blog covers, categories) → Media", "Categories", "Brands", "Laptop models", "Reviews"]);
  const checks: { name: string; ok: boolean; detail: string; info?: boolean }[] = [
    ...rows.map(([name, a, b]) => ({ name, ok: a === b, detail: `${a} → ${b}`, info: INFO.has(name) })),
    { name: "Sum of order totals (Rs)", ok: legacyTotal === payloadTotal, detail: `${legacyTotal.toLocaleString("en-PK")} → ${payloadTotal.toLocaleString("en-PK")}` },
    { name: "Every order's subtotal & total match", ok: totalsMismatch.length === 0, detail: totalsMismatch.length ? totalsMismatch.map((o) => o.orderNumber).join(", ") : "all match" },
    { info: true, name: "Product slugs identical (URLs preserved)", ok: slugMismatch.length === 0, detail: slugMismatch.length ? slugMismatch.map((p) => p.slug).join(", ") : `${legacyProducts.length}/${legacyProducts.length}` },
    { info: true, name: "Category slugs identical", ok: catSlugMismatch.length === 0, detail: catSlugMismatch.length ? catSlugMismatch.map((c) => c.slug).join(", ") : `${legacyCats.length}/${legacyCats.length}` },
    { name: "Blog post slugs identical", ok: postSlugMismatch.length === 0, detail: postSlugMismatch.length ? postSlugMismatch.map((p) => p.slug).join(", ") : `${legacyPosts.length}/${legacyPosts.length}` },
    { name: "Image files that could not be read", ok: mediaMissing.length === 0, detail: mediaMissing.length ? mediaMissing.join(", ") : "none" },
    { name: "Records that failed to migrate", ok: failures.length === 0, detail: failures.length ? failures.join(" · ") : "none" },
  ];
  const md = [
    `# Migration report – ${new Date().toISOString()}`,
    since ? `Mode: delta sync since ${since.toISOString()}` : "Mode: full",
    "",
    "| Check | Legacy → Payload | Result |",
    "|---|---|---|",
    ...checks.map((c) => `| ${c.name} | ${c.detail} | ${c.ok ? "✅" : c.info ? "ℹ️ edited in /cms" : "❌"} |`),
    "",
    "ℹ️ = catalog data that is managed in /cms since Phase 4; differences there are expected and never block a cutover.",
    "",
    checks.every((c) => c.ok || c.info) ? "**All checks passed.**" : "**Some checks FAILED – do not cut over.**",
  ].join("\n");
  await fs.writeFile(path.join(process.cwd(), "migration-report.md"), md + "\n");
  console.log("\n" + md);
  return checks.every((c) => c.ok || c.info);
}

const payload = await getPayload({ config });
if (!REPORT_ONLY) await migrate(payload);
const ok = await report(payload);
await prisma.$disconnect();
process.exit(ok ? 0 : 1);
