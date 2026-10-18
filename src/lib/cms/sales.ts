import "server-only";
import { normalizePkMobile } from "@/lib/phone";
import { randomBytes } from "node:crypto";
import { sql } from "@payloadcms/db-postgres";
import type { OwedLine } from "@/payload/stock";
import type { FlashDiscount } from "@/lib/flash-pricing";
import { commitTransaction, createLocalReq, initTransaction, killTransaction, type Payload, type Where } from "payload";
import type { Coupon, FlashSale, Order, OrderEvent, OrderItem, PaymentMethod, PaymentStatus, SavedAddress, WholesaleInquiry } from "@/lib/types";
import { findProductDoc, inStore, payloadClient, storefrontId } from "./catalog-source";
import { currentOrigin, currentStoreId } from "@/lib/tenant";
import { checkVerifyToken, createVerifyToken, readVerifyToken, verifyEmailEmail } from "@/lib/account-email";
import { deliverEmail } from "@/lib/mailer";
import { log } from "@/lib/log";

/**
 * Orders, customers, discounts, flash sales, wholesale inquiries and contact messages in Payload (Phase 6).
 * Everything is mapped to the storefront's existing types. Ids stay the legacy ids for migrated records
 * (order links, sessions, carts keep working) and the Payload id for new ones.
 * Multi-store: orders, discounts, messages … belong to the store of the request (`currentStoreId()`); customer
 * ACCOUNTS are shared by every store (a shopper signs in once), with `customerOf` listing the stores they use.
 */

type Doc = Record<string, unknown>;
type Id = number | string;
const obj = (v: unknown): Doc | null => (v && typeof v === "object" ? (v as Doc) : null);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const opt = <T,>(v: T | null | undefined | "") => (v === null || v === undefined || v === "" ? undefined : v);

/**
 * Where-clause for a document addressed by storefront id: a number is the Payload id ITSELF, anything else an id from
 * the old system (cuid text). Never "id OR legacyId" – a legacyId that looks like a number could then stand in for
 * another record (another customer's account).
 */
export const byStorefrontId = (id: string): Where => (/^\d+$/.test(id) ? { id: { equals: Number(id) } } : { legacyId: { equals: id } });

async function findOne(payload: Payload, collection: string, where: Where, depth = 0): Promise<Doc | null> {
  const res = await payload.find({ collection: collection as never, where, limit: 1, depth, overrideAccess: true, showHiddenFields: true });
  return (res.docs[0] as Doc | undefined) ?? null;
}

// ───────────────────────────── orders ─────────────────────────────

export function toOrder(d: Doc): Order {
  const c = obj(d.customer) ?? {};
  return {
    id: storefrontId(d),
    orderNumber: str(d.orderNumber),
    createdAt: str(d.placedAt) || str(d.createdAt),
    status: (str(d.status) || "pending") as Order["status"],
    customer: { name: str(c.name), phone: str(c.phone), email: opt(str(c.email)), city: str(c.city), address: str(c.address), landmark: opt(str(c.landmark)), region: opt(str(c.region)), postalCode: opt(str(c.postalCode)), country: opt(str(c.country)) },
    items: (Array.isArray(d.items) ? (d.items as Doc[]) : []).map(
      (i): OrderItem => ({
        productId: obj(i.product) ? storefrontId(obj(i.product)) : str(i.productLegacyId) || (i.product != null ? String(i.product) : ""),
        slug: str(i.slug),
        name: str(i.title),
        image: str(i.image),
        url: str(i.url),
        unitPrice: num(i.unitPrice),
        qty: num(i.qty),
        upgrades: Array.isArray(i.upgrades) ? (i.upgrades as OrderItem["upgrades"]) : [],
        ...(i.availability === "preorder" || i.availability === "backorder" ? { availability: i.availability, owedQty: num(i.owedQty) || undefined } : {}),
      })
    ),
    subtotal: num(d.subtotal),
    discount: num(d.discount),
    couponCode: opt(str(d.couponCode)) ?? null,
    deliveryCharge: num(d.deliveryCharge),
    shippingMethod: opt(str(d.shippingMethod)) ?? null,
    giftCardCode: opt(str(d.giftCardCode)) ?? null,
    giftCardAmount: typeof d.giftCardAmount === "number" ? d.giftCardAmount : undefined,
    taxTotal: num(d.taxTotal) || undefined,
    taxBreakdown: Array.isArray(d.taxBreakdown) ? (d.taxBreakdown as Doc[]).map((t) => ({ rate: num(t.rate), base: num(t.base), tax: num(t.tax) })) : undefined,
    billing: obj(d.billing)?.name
      ? { name: str(obj(d.billing)!.name), company: opt(str(obj(d.billing)!.company)), taxId: opt(str(obj(d.billing)!.taxId)), address: str(obj(d.billing)!.address), city: str(obj(d.billing)!.city), postalCode: opt(str(obj(d.billing)!.postalCode)), country: opt(str(obj(d.billing)!.country)) }
      : null,
    total: num(d.total),
    advancePaid: typeof d.advancePaid === "number" ? d.advancePaid : undefined,
    paymentMethod: str(d.paymentMethod) as PaymentMethod,
    paymentMethodLabel: opt(str(d.paymentMethodLabel)) ?? null,
    paymentDue: d.paymentDue === "on-delivery" || d.paymentDue === "upfront" ? d.paymentDue : null,
    currency: opt(str(d.currency)),
    paymentStatus: str(d.paymentStatus) as PaymentStatus,
    paymentScreenshotUrl: opt(str(d.paymentScreenshotKey)) ?? null,
    courier: opt(str(d.courier)) ?? null,
    trackingNumber: opt(str(d.trackingNumber)) ?? null,
    // what the customer wrote at checkout – never the team's internal notes (this object reaches customers' pages and emails)
    notes: opt(str(d.customerNote)) ?? null,
    marketingConsent: d.marketingConsent === true,
    storeId: d.store && typeof d.store === "object" ? Number((d.store as Doc).id) || null : d.store != null ? Number(d.store) || null : null,
    history: (Array.isArray(d.history) ? (d.history as Doc[]) : []).map((h): OrderEvent => ({ status: str(h.status) as OrderEvent["status"], at: str(h.at), note: opt(str(h.note)) })),
    userId: obj(d.user) ? storefrontId(obj(d.user)) : d.user != null ? String(d.user) : null,
    confirmation: obj(d.confirmation)?.expiresAt
      ? { token: str(obj(d.confirmation)!.token), code: str(obj(d.confirmation)!.code), expiresAt: str(obj(d.confirmation)!.expiresAt), confirmedAt: opt(str(obj(d.confirmation)!.confirmedAt)) ?? null, via: opt(str(obj(d.confirmation)!.via)) ?? null }
      : null,
    risk: obj(d.risk)?.level ? { score: Number(obj(d.risk)!.score) || 0, level: str(obj(d.risk)!.level) as "low" | "medium" | "high", reasons: str(obj(d.risk)!.reasons) } : null,
  };
}

/** Storefront fields → Payload data (relationships resolved). */
async function orderData(payload: Payload, o: Partial<Order>, storeId: number | null): Promise<Doc> {
  const data: Doc = {};
  if (storeId != null) data.store = storeId;
  if (o.orderNumber !== undefined) data.orderNumber = o.orderNumber;
  if (o.createdAt !== undefined) data.placedAt = o.createdAt;
  if (o.status !== undefined) data.status = o.status;
  if (o.customer) data.customer = { ...o.customer, email: o.customer.email ?? null, landmark: o.customer.landmark ?? null, region: o.customer.region ?? null, postalCode: o.customer.postalCode ?? null, country: o.customer.country ?? null };
  if (o.items) {
    data.items = await Promise.all(
      o.items.map(async (i) => {
        // never save a line without its product – cancelling it would then never give the stock back
        const doc = await findProductDoc(payload, i.productId, storeId);
        return {
        product: doc?.id ?? null,
        productLegacyId: i.productId,
        // what was sold as it was then (the product may be renamed or deleted later)
        sku: str(doc?.sku) || null,
        options: doc?.optionValues ?? null,
        title: i.name,
        slug: i.slug,
        url: i.url,
        image: i.image,
        unitPrice: i.unitPrice,
        qty: i.qty,
        upgrades: i.upgrades ?? [],
        };
      })
    );
  }
  for (const k of ["subtotal", "discount", "deliveryCharge", "shippingMethod", "giftCardCode", "giftCardAmount", "total", "advancePaid", "paymentMethod", "paymentMethodLabel", "paymentDue", "currency", "paymentStatus", "courier", "trackingNumber", "couponCode", "taxTotal", "paymentReference"] as const) {
    if (o[k] !== undefined) data[k] = o[k] ?? null;
  }
  if (o.taxBreakdown !== undefined) data.taxBreakdown = o.taxBreakdown ?? null;
  if (o.billing !== undefined) data.billing = o.billing ? { name: o.billing.name, company: o.billing.company ?? null, taxId: o.billing.taxId ?? null, address: o.billing.address, city: o.billing.city, postalCode: o.billing.postalCode ?? null, country: o.billing.country ?? null } : { name: null, company: null, taxId: null, address: null, city: null, postalCode: null, country: null };
  // the customer's own note (never the team's internal notes)
  if (o.notes !== undefined) data.customerNote = o.notes ?? null;
  if (o.marketingConsent !== undefined) data.marketingConsent = o.marketingConsent === true;
  if (o.paymentScreenshotUrl !== undefined) data.paymentScreenshotKey = o.paymentScreenshotUrl ?? null;
  if (o.confirmation !== undefined) data.confirmation = o.confirmation ?? { token: null, code: null, expiresAt: null, confirmedAt: null, via: null };
  if (o.risk !== undefined) data.risk = o.risk ?? { score: null, level: null, reasons: null };
  if (o.history) data.history = o.history.map((h) => ({ status: h.status, at: h.at, note: h.note ?? null }));
  if (o.userId !== undefined) data.user = o.userId ? (await findOne(payload, "users", byStorefrontId(o.userId)))?.id ?? null : null;
  return data;
}

/** Remember that this account shops at this store (its team then sees the customer). */
export const addCustomerOf = (payload: Payload, user: Id | null | undefined, storeId: number | null | undefined) => addStoreLink(payload, user, storeId, "customerOf");

/** Remember that this customer agreed to marketing emails from this store (never from any other). */
export const addMarketingConsent = (payload: Payload, user: Id | null | undefined, storeId: number | null | undefined) => addStoreLink(payload, user, storeId, "marketingConsent");

/** Adds a store to one of the account's store lists (plain SQL: no account hooks run for the shopper's own order). */
async function addStoreLink(payload: Payload, user: Id | null | undefined, storeId: number | null | undefined, path: "customerOf" | "marketingConsent") {
  if (user == null || storeId == null) return;
  // a storefront id may be a migrated account's legacy id
  const userId = typeof user === "number" || /^\d+$/.test(user) ? Number(user) : Number((await findOne(payload, "users", byStorefrontId(user)))?.id);
  if (!Number.isFinite(userId)) return;
  await (payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<unknown> } }).drizzle.execute(sql`
    INSERT INTO "payload"."cms_users_rels" ("order", "parent_id", "path", "cms_stores_id")
    SELECT 1, ${Number(userId)}, ${path}, ${storeId}
    WHERE NOT EXISTS (SELECT 1 FROM "payload"."cms_users_rels" WHERE "parent_id" = ${Number(userId)} AND "path" = ${path} AND "cms_stores_id" = ${storeId})`);
}

export type PlaceOrderResult =
  | { ok: true; order: Order; duplicate?: boolean }
  | { ok: false; reason: "sold-out"; short: string[] }
  | { ok: false; reason: "coupon" }
  | { ok: false; reason: "payment-reference" }
  | { ok: false; reason: "gift-card" }
  /** this checkout attempt was used for a different (or cancelled) order – submit again as a new attempt */
  | { ok: false; reason: "attempt-reused" };

/**
 * A repeated submit is the SAME order only while that order is still alive and has the same total and quantity: a
 * cancelled one (its card page couldn't be opened) or a changed cart is a new order – never "already placed" (the
 * shopper would land on a cancelled order with an emptied cart).
 */
export function isSameAttempt(earlier: { status?: unknown; total?: unknown; items?: unknown }, order: { total: number; items: { qty: number }[] }): boolean {
  if (earlier.status === "cancelled") return false;
  const qty = (list: unknown) => (Array.isArray(list) ? list.reduce((n, i) => n + (Number((i as { qty?: unknown })?.qty) || 0), 0) : 0);
  return Math.abs((Number(earlier.total) || 0) - order.total) < 0.005 && qty(earlier.items) === qty(order.items);
}

const isUniqueViolation = (e: unknown) => /unique|duplicate key|already exists/i.test(String((e as { message?: string })?.message ?? e));

/**
 * Checkout, all in ONE database transaction: use the coupon, take the stock, save the order and reserve the
 * serial-tracked units. If anything fails (sold out, a laptop just sold at the shop counter, a crash) nothing
 * is kept. `attemptId` makes a repeated submit (double click, retry after a lost response) return the order
 * that was already placed instead of creating a second one.
 */
export async function placeOrderCms(order: Order, lines: { id: string; qty: number; title: string }[], opts: { attemptId?: string | null; couponCode?: string | null; giftCard?: { code: string; amount: number } | null; afterSave?: (orderId: number, req: Awaited<ReturnType<typeof createLocalReq>>) => Promise<void> }): Promise<PlaceOrderResult> {
  const payload = await payloadClient();
  const storeId = order.storeId ?? null;
  const previous = async () => (opts.attemptId ? await findOne(payload, "orders", { and: [{ attemptId: { equals: opts.attemptId } }, inStore(storeId)] }) : null);
  const earlier = await previous();
  if (earlier) return isSameAttempt(earlier, order) ? { ok: true, order: toOrder(earlier), duplicate: true } : { ok: false, reason: "attempt-reused" };
  // one payment receipt (transfer / wallet transaction id) pays for one order only
  if (order.paymentReference && (await findOne(payload, "orders", { and: [{ paymentReference: { equals: order.paymentReference } }, inStore(storeId)] })))
    return { ok: false, reason: "payment-reference" };

  const resolved: { productId: number; qty: number; title: string }[] = [];
  for (const l of lines) {
    const doc = await findProductDoc(payload, l.id, storeId);
    if (!doc) return { ok: false, reason: "sold-out", short: [l.title] };
    resolved.push({ productId: Number(doc.id), qty: l.qty, title: l.title });
  }

  // read everything the order needs BEFORE the transaction: a lookup inside it without `req` takes a second pool
  // connection while the first is held – a burst of checkouts then waits on each other (pool exhausted)
  const base = await orderData(payload, order, storeId);

  const { takeStockForLines, consumeCoupon, setStockLog } = await import("@/payload/stock");
  const req = await createLocalReq({}, payload);
  setStockLog(req, { reason: "order", ref: order.orderNumber });
  await initTransaction(req);
  try {
    if (opts.couponCode && !(await consumeCoupon(payload, opts.couponCode, storeId, req))) {
      await killTransaction(req);
      return { ok: false, reason: "coupon" };
    }
    // the gift card pays its part in the same transaction (its balance can't be spent twice)
    if (opts.giftCard && opts.giftCard.amount > 0) {
      const { takeFromGiftCard } = await import("@/payload/gift-cards");
      if (!(await takeFromGiftCard(payload, { code: opts.giftCard.code, storeId, amount: opts.giftCard.amount, orderNumber: order.orderNumber }, req))) {
        await killTransaction(req);
        return { ok: false, reason: "gift-card" };
      }
    }
    // pre-order / keep-selling products may sell beyond their stock; what is owed is marked on the order's lines
    const owed = new Map<number, OwedLine>();
    const short = await takeStockForLines(payload, resolved, req, { backorders: true, owed });
    if (short.length) {
      await killTransaction(req);
      return { ok: false, reason: "sold-out", short };
    }
    if (owed.size && Array.isArray(base.items)) {
      const left = new Map(owed);
      base.items = (base.items as Doc[]).map((i) => {
        const o = left.get(Number(i.product));
        if (!o) return i;
        left.delete(Number(i.product));
        return { ...i, availability: o.kind, owedQty: o.qty };
      });
    }
    const data = { ...base, stockHeld: true, attemptId: opts.attemptId || null, couponConsumed: Boolean(opts.couponCode), giftCardCharged: Boolean(opts.giftCard && opts.giftCard.amount > 0) };
    // context.fromStorefront: the stock was taken just above, so the Orders hook must not take it again
    const doc = (await payload.create({ collection: "orders" as never, data: data as never, overrideAccess: true, depth: 0, context: { fromStorefront: true, storefront: true, storeId }, req })) as Doc;
    // in the same transaction: the confirmation messages (sent only if the order is really saved), online payment …
    if (opts.afterSave) await opts.afterSave(Number(doc.id), req);
    // a card order is announced once it is paid (src/lib/payments) – until then it's only a payment attempt
    if (order.status !== "awaiting-payment") {
      const { queueNotification } = await import("@/lib/notify");
      await queueNotification(payload, "order-placed", storeId, { orderId: doc.id }, { req, dedupeKey: `order-placed:${doc.id}` });
    }
    await commitTransaction(req);
    return { ok: true, order: { ...toOrder(doc), id: String(doc.id) } };
  } catch (e) {
    await killTransaction(req);
    const msg = String((e as Error)?.message ?? e);
    if (/UNITS_SHORT/.test(msg)) return { ok: false, reason: "sold-out", short: [msg.split("UNITS_SHORT:")[1]?.split(" – ")[0]?.trim() || "an item"] };
    // The same attempt saved meanwhile (double click): the database refused the 2nd copy – return the 1st.
    // (Payload reports this as a validation error, so look it up whatever the message says.)
    const dup = await previous().catch(() => null);
    if (dup) return isSameAttempt(dup, order) ? { ok: true, order: toOrder(dup), duplicate: true } : { ok: false, reason: "attempt-reused" };
    if (isUniqueViolation(e)) log.warn("checkout.unique_violation", { order: order.orderNumber, error: msg.slice(0, 200) });
    throw e;
  }
}

/** An order of the current store (a shopper only ever sees the store they are on). */
export async function getOrderCms(where: Where, storeId?: number | null): Promise<Order | null> {
  const store = storeId === undefined ? await currentStoreId() : storeId;
  const doc = await findOne(await payloadClient(), "orders", { and: [where, inStore(store)] }, 1);
  return doc ? toOrder(doc) : null;
}

export async function listOrdersCms(where: Where, opts: { page?: number; perPage?: number; storeId?: number | null } = {}): Promise<{ items: Order[]; total: number }> {
  const payload = await payloadClient();
  const store = opts.storeId === undefined ? await currentStoreId() : opts.storeId;
  const res = await payload.find({
    collection: "orders" as never,
    where: { and: [where, inStore(store)] },
    sort: "-placedAt",
    depth: 1,
    // only the ids of related products / customers are needed – not every whole product document
    populate: { products: { legacyId: true }, users: { legacyId: true } } as never,
    overrideAccess: true,
    ...(opts.perPage ? { limit: opts.perPage, page: opts.page ?? 1 } : { limit: 0, pagination: false }),
  });
  return { items: (res.docs as Doc[]).map(toOrder), total: res.totalDocs };
}

export async function updateOrderCms(id: string, patch: Partial<Order>): Promise<Order> {
  const payload = await payloadClient();
  const store = await currentStoreId();
  const doc = await findOne(payload, "orders", { and: [byStorefrontId(id), inStore(store)] });
  if (!doc) throw new Error("Order not found");
  const updated = (await payload.update({ collection: "orders" as never, id: doc.id as Id, data: (await orderData(payload, patch, null)) as never, overrideAccess: true, depth: 1 })) as Doc;
  return toOrder(updated);
}

// ───────────────────────────── customers (users) ─────────────────────────────

export type CmsRole = "owner" | "manager" | "staff" | "customer";
export interface CmsUser {
  id: string; // storefront id
  docId: Id;
  email: string;
  name?: string;
  phone?: string;
  role: CmsRole;
  blocked: boolean;
  emailVerified: boolean;
  /** false = a customer record made from a guest order (no password yet) */
  hasAccount: boolean;
  sessionsValidAfter?: string;
  addresses: SavedAddress[];
  wishlist: string[];
}

const toUser = (u: Doc): CmsUser => ({
  id: storefrontId(u),
  docId: u.id as Id,
  email: str(u.email),
  name: opt(str(u.name)),
  phone: opt(str(u.phone)),
  role: (str(u.role) || "customer") as CmsRole,
  blocked: Boolean(u.blocked),
  emailVerified: Boolean(u.emailVerified),
  hasAccount: u.hasAccount !== false,
  sessionsValidAfter: opt(str(u.sessionsValidAfter)),
  addresses: Array.isArray(u.addresses) ? (u.addresses as SavedAddress[]) : [],
  wishlist: Array.isArray(u.wishlist) ? (u.wishlist as string[]) : [],
});

/** A phone as stored: a Pakistani mobile ("0300-1234567", or typed "03001234567"), else international ("+447700900123"). */
function phoneWhere(phone: string): Where[] {
  const pk = normalizePkMobile(phone);
  if (pk) return [{ phone: { equals: pk } }, { phone: { equals: pk.replace("-", "") } }];
  return [{ phone: { equals: phone.trim() } }, { phone: { equals: `+${phone.replace(/\D/g, "")}` } }];
}

/** Is there a BLOCKED customer account with this phone or email? (/cms → Customers → "Blocked") */
export async function isBlockedCustomer(phone: string, email?: string | null): Promise<boolean> {
  const payload = await payloadClient();
  const or: Where[] = phoneWhere(phone);
  if (email) or.push({ email: { equals: email.trim().toLowerCase() } });
  const r = await payload.count({ collection: "users" as never, where: { and: [{ blocked: { equals: true } }, { or }] }, overrideAccess: true });
  return r.totalDocs > 0;
}

export async function getUserCms(storefrontUserId: string): Promise<CmsUser | null> {
  const doc = await findOne(await payloadClient(), "users", byStorefrontId(storefrontUserId));
  return doc ? toUser(doc) : null;
}

export async function getUserByEmailCms(email: string): Promise<CmsUser | null> {
  const doc = await findOne(await payloadClient(), "users", { email: { equals: email.trim().toLowerCase() } });
  return doc ? toUser(doc) : null;
}

/** Verify a password (Payload login: lockout after repeated failures, lazy upgrade of old bcrypt hashes). */
export async function verifyPasswordCms(email: string, password: string): Promise<CmsUser | null> {
  const payload = await payloadClient();
  // the shopper's network, for Platform → Security events (sign-ins happen in a server action)
  let clientIp = "";
  try {
    const [{ headers }, { ipFromHeaders }] = await Promise.all([import("next/headers"), import("@/lib/client-ip")]);
    clientIp = ipFromHeaders(await headers());
  } catch {
    // outside a request
  }
  try {
    const res = await payload.login({ collection: "users" as never, data: { email: email.trim().toLowerCase(), password } as never, overrideAccess: true, context: { storefront: true, clientIp } });
    return res.user ? toUser(res.user as unknown as Doc) : null;
  } catch {
    const { recordSecurityEvent } = await import("@/lib/security-events");
    await recordSecurityEvent(payload, { kind: "sign-in-failed", area: "shop", email, ip: clientIp });
    return null;
  }
}

export async function createCustomerCms(input: { email: string; name: string; phone?: string; password: string }): Promise<CmsUser> {
  const payload = await payloadClient();
  const doc = (await payload.create({
    collection: "users" as never,
    data: { email: input.email.trim().toLowerCase(), name: input.name.trim(), phone: input.phone?.trim() || undefined, password: input.password, role: "customer" } as never,
    overrideAccess: true,
    disableVerificationEmail: true,
    context: { storefrontSignup: true },
  })) as Doc;
  return toUser(doc);
}

export async function updateUserCms(storefrontUserId: string, patch: { name?: string; phone?: string; addresses?: SavedAddress[]; wishlist?: string[] }) {
  const payload = await payloadClient();
  const doc = await findOne(payload, "users", byStorefrontId(storefrontUserId));
  if (!doc) return;
  const data: Doc = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.phone !== undefined) data.phone = patch.phone;
  if (patch.addresses) data.addresses = patch.addresses;
  if (patch.wishlist) data.wishlist = patch.wishlist.slice(0, 200);
  await payload.update({ collection: "users" as never, id: doc.id as Id, data: data as never, overrideAccess: true, depth: 0 });
}

/**
 * Every order belongs to a customer in /cms → Customers: the customer with this email, or a new record marked
 * "no account yet" (random password nobody knows – it becomes a real account when they set a password through
 * the emailed link). Runs after the order is saved; sets the order's customer only if it has none.
 *
 * Privacy: an order is only ever attached to an account whose owner PROVED the email (confirmed it, or a guest
 * record that only the mailbox owner can claim). Anyone can sign up with someone else's email or type their phone,
 * so unconfirmed accounts and phone matches are never used – otherwise a stranger could read that person's
 * orders (name, phone, address) in "My account". Staff accounts are never attached.
 */
export async function linkOrderToCustomerCms(orderNumber: string, c: { email?: string | null; name: string; phone: string; storeId?: number | null; marketingConsent?: boolean }): Promise<void> {
  const email = c.email?.trim().toLowerCase() || null;
  if (!email) return;
  const payload = await payloadClient();
  const storeId = c.storeId === undefined ? await currentStoreId() : c.storeId;
  let customer = await findOne(payload, "users", { email: { equals: email } });
  if (customer && (str(customer.role) !== "customer" || (customer.hasAccount !== false && !customer.emailVerified))) return;
  if (!customer) {
    try {
      customer = (await payload.create({
        collection: "users" as never,
        data: { email, name: c.name.trim(), phone: c.phone, role: "customer", hasAccount: false, emailVerified: false, password: randomBytes(24).toString("base64url") } as never,
        overrideAccess: true,
        disableVerificationEmail: true,
        context: { guestCustomer: true },
      })) as Doc;
    } catch (err) {
      // two orders with a new email at the same moment – the other one created the record; anything else is logged
      customer = await findOne(payload, "users", { email: { equals: email } });
      if (!customer) log.error("customer.guest_record_failed", err, { order: orderNumber });
    }
  }
  if (!customer || str(customer.role) !== "customer" || (customer.hasAccount !== false && !customer.emailVerified)) return;
  // plain SQL: attaching the customer must not re-run the order's stock / status hooks
  await (payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<unknown> } }).drizzle.execute(
    sql`UPDATE "payload"."cms_orders" SET "user_id" = ${customer.id as number} WHERE "order_number" = ${orderNumber} AND "user_id" IS NULL`,
  );
  await addCustomerOf(payload, customer.id as Id, storeId);
  if (c.marketingConsent) await addMarketingConsent(payload, customer.id as Id, storeId);
}

/**
 * Sign-up on an email that so far only has a guest record, while email sending is off (nobody can prove the inbox):
 * the record becomes this person's account with their name, phone and password – but its orders are detached first,
 * so signing up with someone else's email never shows their orders. Orders placed with the email come back in
 * "My orders" once the email is confirmed (account orders also list orders by CONFIRMED email).
 */
export async function claimGuestRecordCms(email: string, input: { name: string; phone?: string; password: string }): Promise<void> {
  const payload = await payloadClient();
  const doc = await findOne(payload, "users", { email: { equals: email.trim().toLowerCase() } });
  if (!doc || str(doc.role) !== "customer" || doc.hasAccount !== false) throw new Error("No guest record for this email");
  await (payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<unknown> } }).drizzle.execute(
    sql`UPDATE "payload"."cms_orders" SET "user_id" = NULL WHERE "user_id" = ${doc.id as number}`,
  );
  await payload.update({
    collection: "users" as never,
    id: doc.id as Id,
    data: { name: input.name.trim(), phone: input.phone?.trim() || null, password: input.password, hasAccount: true, emailVerified: false, sessionsValidAfter: new Date().toISOString() } as never,
    overrideAccess: true,
    depth: 0,
  });
}

// ───────────────────────────── password reset & email confirmation ─────────────────────────────

/** Emails a reset link when the account exists (silently does nothing otherwise – no account probing). */
export async function requestPasswordResetCms(email: string): Promise<void> {
  const payload = await payloadClient();
  await payload.forgotPassword({ collection: "users" as never, data: { email: email.trim().toLowerCase() }, overrideAccess: true });
}

/**
 * Sets a new password from the emailed token. The link proves the customer owns the mailbox, so the email
 * also counts as confirmed. Staff (who reset in /cms) still need 10+ characters here.
 */
export async function resetPasswordCms(token: string, password: string): Promise<{ ok: true; email: string; staff: boolean } | { ok: false; error: string }> {
  const payload = await payloadClient();
  const found = await payload.find({
    collection: "users" as never,
    where: { and: [{ resetPasswordToken: { equals: token } }, { resetPasswordExpiration: { greater_than: new Date().toISOString() } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    showHiddenFields: true,
  });
  const user = found.docs[0] as Doc | undefined;
  if (!user) return { ok: false, error: "This reset link has expired or was already used. Please ask for a new one." };
  if (str(user.role) !== "customer" && password.length < 10) return { ok: false, error: "Staff passwords need at least 10 characters." };
  try {
    // Payload's reset also signs the person in and runs the sign-in hooks: as a storefront operation the /cms 2-step
    // check lets it through (it used to refuse every reset), and the /cms token it makes is thrown away here – a reset
    // link never opens /cms; the team signs in there with the new password and their 2-step code
    await payload.resetPassword({ collection: "users" as never, data: { token, password }, overrideAccess: true, context: { storefront: true, passwordReset: true } });
  } catch (e) {
    log.warn("account.reset_failed", { error: e instanceof Error ? e.message : String(e) });
    return { ok: false, error: "This reset link has expired or was already used. Please ask for a new one." };
  }
  // the reset link proves the mailbox is theirs (email confirmed, a guest record becomes a real account);
  // every earlier shop sign-in ends
  await payload
    .update({ collection: "users" as never, id: user.id as Id, data: { emailVerified: true, hasAccount: true, sessionsValidAfter: new Date().toISOString() } as never, overrideAccess: true, depth: 0 })
    .catch((e) => log.error("account.reset_followup_failed", e));
  return { ok: true, email: str(user.email), staff: str(user.role) !== "customer" };
}

/** Sends the "confirm your email" link. Returns false when there's nothing to send (already confirmed / no email set up). */
export async function sendVerificationEmailCms(storefrontUserId: string): Promise<boolean> {
  const payload = await payloadClient();
  const doc = await findOne(payload, "users", byStorefrontId(storefrontUserId));
  if (!doc || doc.emailVerified || !str(doc.email)) return false;
  // from the current store: its name and its own address (loaded here – site-content imports this module)
  const { getSiteInfo } = await import("@/lib/repo/site-content");
  const [info, origin] = await Promise.all([getSiteInfo(), currentOrigin()]);
  const { html, text } = verifyEmailEmail(createVerifyToken(payload.secret, doc.id as Id, str(doc.email)), { name: info.name, origin }, opt(str(doc.name)));
  return deliverEmail({ to: str(doc.email), subject: "Confirm your email", html, text });
}

/** Confirms the email from the link in the confirmation email. */
export async function confirmEmailCms(token: string): Promise<"ok" | "expired" | "invalid"> {
  const t = readVerifyToken(token);
  if (!t) return "invalid";
  const payload = await payloadClient();
  const doc = await findOne(payload, "users", { id: { equals: Number(t.id) } });
  if (!doc) return "invalid";
  const result = checkVerifyToken(payload.secret, t, str(doc.email));
  if (result !== "ok") return result;
  if (!doc.emailVerified) await payload.update({ collection: "users" as never, id: doc.id as Id, data: { emailVerified: true } as never, overrideAccess: true, depth: 0 });
  return "ok";
}

// ───────────────────────────── discounts ─────────────────────────────

/** Related products / categories as storefront ids (legacy id for migrated records), collections by their own id. */
const ids = (v: unknown, storefront = true) => (Array.isArray(v) ? v : []).map((x) => (obj(x) ? (storefront ? storefrontId(obj(x)) : String(obj(x)!.id)) : String(x))).filter(Boolean);

export const toCoupon = (d: Doc): Coupon => ({
  id: String(d.id),
  code: str(d.code).toUpperCase(),
  kind: d.kind === "fixed" ? "fixed" : d.kind === "free_shipping" ? "free_shipping" : "percent",
  value: num(d.value),
  minOrder: num(d.minOrder),
  startsAt: opt(str(d.startsAt)) ?? null,
  expiresAt: opt(str(d.expiresAt)) ?? null,
  usageLimit: typeof d.usageLimit === "number" ? d.usageLimit : null,
  perCustomerLimit: typeof d.perCustomerLimit === "number" && d.perCustomerLimit > 0 ? d.perCustomerLimit : null,
  used: num(d.used),
  active: d.active !== false,
  automatic: d.automatic === true,
  combinable: d.combinable === true,
  appliesTo: (["products", "categories", "collections"].includes(str(d.appliesTo)) ? str(d.appliesTo) : "all") as Coupon["appliesTo"],
  productIds: ids(d.products),
  categoryIds: ids(d.categories),
  collectionIds: ids(d.collections, false),
});

/** A discount code of this store. */
export async function findCouponCms(code: string, storeId: number | null): Promise<Coupon | null> {
  const doc = await findOne(await payloadClient(), "discounts", { and: [{ code: { equals: code.trim().toUpperCase() } }, inStore(storeId)] }, 1);
  return doc ? toCoupon(doc) : null;
}

/** This store's automatic discounts that are switched on (checked against the cart by lib/coupons.ts). */
export async function automaticDiscountsCms(storeId: number | null): Promise<Coupon[]> {
  const payload = await payloadClient();
  const res = await payload.find({ collection: "discounts" as never, where: { and: [{ automatic: { equals: true } }, { active: { not_equals: false } }, inStore(storeId)] }, limit: 50, depth: 1, overrideAccess: true });
  return (res.docs as Doc[]).map(toCoupon);
}

/** How many orders of this store a customer (email / phone) has placed with a code (cancelled ones don't count). */
export async function couponUsesByCustomerCms(code: string, storeId: number | null, customer: { email?: string | null; phone?: string | null }): Promise<number> {
  const who: Where[] = [];
  if (customer.email) who.push({ "customer.email": { equals: customer.email.trim().toLowerCase() } });
  if (customer.phone) who.push(...phoneWhere(customer.phone).map((w) => ({ "customer.phone": (w as { phone: unknown }).phone }) as Where));
  if (!who.length) return 0;
  const res = await (await payloadClient()).count({
    collection: "orders" as never,
    where: { and: [{ couponCode: { equals: code.trim().toUpperCase() } }, { status: { not_in: ["cancelled", "refused"] } }, inStore(storeId), { or: who }] },
    overrideAccess: true,
  });
  return res.totalDocs;
}

export async function activeFlashSaleCms(storeId: number | null): Promise<FlashSale | null> {
  const payload = await payloadClient();
  const res = await payload.find({
    collection: "flash-sales" as never,
    where: { and: [{ active: { equals: true } }, { endsAt: { greater_than: new Date().toISOString() } }, { or: [{ startsAt: { exists: false } }, { startsAt: { less_than_equal: new Date().toISOString() } }] }, inStore(storeId)] },
    sort: "endsAt",
    limit: 1,
    depth: 1,
    overrideAccess: true,
  });
  const d = res.docs[0] as Doc | undefined;
  if (!d) return null;
  return {
    id: storefrontId(d),
    title: str(d.title),
    endsAt: str(d.endsAt),
    productIds: (Array.isArray(d.products) ? d.products : []).map((p) => storefrontId(obj(p))).filter(Boolean),
    active: true,
    discountPercent: typeof d.discountPercent === "number" ? d.discountPercent : null,
  };
}

/** Running flash sales with a discount (their products' prices are lowered in the catalog snapshot). */
export async function discountedFlashSalesCms(storeId: number | null): Promise<FlashDiscount[]> {
  const payload = await payloadClient();
  const now = new Date().toISOString();
  const res = await payload.find({
    collection: "flash-sales" as never,
    where: { and: [{ active: { equals: true } }, { discountPercent: { greater_than: 0 } }, { endsAt: { greater_than: now } }, { or: [{ startsAt: { exists: false } }, { startsAt: { less_than_equal: now } }] }, inStore(storeId)] },
    limit: 50,
    depth: 1,
    overrideAccess: true,
  });
  return (res.docs as Doc[]).map((d) => ({
    productIds: (Array.isArray(d.products) ? d.products : []).map((p) => storefrontId(obj(p))).filter(Boolean),
    percent: Number(d.discountPercent) || 0,
    endsAt: str(d.endsAt),
  }));
}

// ───────────────────────────── wholesale inquiries & contact messages ─────────────────────────────

export const toInquiry = (d: Doc): WholesaleInquiry => ({
  id: storefrontId(d),
  createdAt: str(d.receivedAt) || str(d.createdAt),
  status: (str(d.status) || "new") as WholesaleInquiry["status"],
  name: str(d.name),
  businessName: opt(str(d.businessName)),
  phone: str(d.phone),
  email: opt(str(d.email)),
  city: str(d.city),
  buyerType: (str(d.buyerType) || "other") as WholesaleInquiry["buyerType"],
  items: Array.isArray(d.items) ? (d.items as WholesaleInquiry["items"]) : [],
  message: opt(str(d.message)),
  budget: opt(str(d.budget)),
  adminNotes: opt(str(d.adminNotes)),
  source: opt(str(d.source)),
});

export async function saveInquiryCms(input: Omit<WholesaleInquiry, "id" | "createdAt" | "status" | "adminNotes">): Promise<WholesaleInquiry> {
  const payload = await payloadClient();
  const store = await currentStoreId();
  const doc = (await payload.create({ collection: "wholesale-inquiries" as never, data: { ...input, store, status: "new", receivedAt: new Date().toISOString() } as never, overrideAccess: true, depth: 0, context: { storefront: true } })) as Doc;
  return toInquiry(doc);
}

export async function saveContactMessageCms(input: { name: string; phone?: string | null; email?: string | null; subject?: string | null; message: string }) {
  const payload = await payloadClient();
  const store = await currentStoreId();
  return (await payload.create({ collection: "contact-messages" as never, data: { ...input, store, handled: false, receivedAt: new Date().toISOString() } as never, overrideAccess: true, depth: 0, context: { storefront: true } })) as Doc;
}

