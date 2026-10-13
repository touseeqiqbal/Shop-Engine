import "server-only";
import { randomBytes } from "node:crypto";
import { sql } from "@payloadcms/db-postgres";
import { commitTransaction, createLocalReq, initTransaction, killTransaction, type Payload, type Where } from "payload";
import type { Coupon, FlashSale, Order, OrderEvent, OrderItem, PaymentMethod, PaymentStatus, SavedAddress, WholesaleInquiry } from "@/lib/types";
import { findProductDoc, payloadClient, storefrontId } from "./catalog-source";
import { checkVerifyToken, createVerifyToken, readVerifyToken, verifyEmailEmail } from "@/lib/account-email";
import { deliverEmail } from "@/lib/mailer";
import { log } from "@/lib/log";

/**
 * Orders, customers, discounts, flash sales, wholesale inquiries and contact messages in Payload (Phase 6).
 * Everything is mapped to the storefront's existing types. Ids stay the legacy ids for migrated records
 * (order links, sessions, carts keep working) and the Payload id for new ones.
 */

type Doc = Record<string, unknown>;
type Id = number | string;
const obj = (v: unknown): Doc | null => (v && typeof v === "object" ? (v as Doc) : null);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const opt = <T,>(v: T | null | undefined | "") => (v === null || v === undefined || v === "" ? undefined : v);

/** Where-clause for a document addressed by storefront id (legacy id or numeric Payload id). */
export const byStorefrontId = (id: string): Where =>
  /^\d+$/.test(id) ? { or: [{ id: { equals: Number(id) } }, { legacyId: { equals: id } }] } : { legacyId: { equals: id } };

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
    customer: { name: str(c.name), phone: str(c.phone), email: opt(str(c.email)), city: str(c.city), address: str(c.address), landmark: opt(str(c.landmark)) },
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
      })
    ),
    subtotal: num(d.subtotal),
    discount: num(d.discount),
    couponCode: opt(str(d.couponCode)) ?? null,
    deliveryCharge: num(d.deliveryCharge),
    total: num(d.total),
    advancePaid: typeof d.advancePaid === "number" ? d.advancePaid : undefined,
    paymentMethod: str(d.paymentMethod) as PaymentMethod,
    paymentStatus: str(d.paymentStatus) as PaymentStatus,
    paymentScreenshotUrl: opt(str(d.paymentScreenshotKey)) ?? null,
    courier: opt(str(d.courier)) ?? null,
    trackingNumber: opt(str(d.trackingNumber)) ?? null,
    notes: opt(str(d.notes)) ?? null,
    history: (Array.isArray(d.history) ? (d.history as Doc[]) : []).map((h): OrderEvent => ({ status: str(h.status) as OrderEvent["status"], at: str(h.at), note: opt(str(h.note)) })),
    userId: obj(d.user) ? storefrontId(obj(d.user)) : d.user != null ? String(d.user) : null,
    confirmation: obj(d.confirmation)?.expiresAt
      ? { token: str(obj(d.confirmation)!.token), code: str(obj(d.confirmation)!.code), expiresAt: str(obj(d.confirmation)!.expiresAt), confirmedAt: opt(str(obj(d.confirmation)!.confirmedAt)) ?? null, via: opt(str(obj(d.confirmation)!.via)) ?? null }
      : null,
    risk: obj(d.risk)?.level ? { score: Number(obj(d.risk)!.score) || 0, level: str(obj(d.risk)!.level) as "low" | "medium" | "high", reasons: str(obj(d.risk)!.reasons) } : null,
  };
}

/** Storefront fields → Payload data (relationships resolved). */
async function orderData(payload: Payload, o: Partial<Order>): Promise<Doc> {
  const data: Doc = {};
  if (o.orderNumber !== undefined) data.orderNumber = o.orderNumber;
  if (o.createdAt !== undefined) data.placedAt = o.createdAt;
  if (o.status !== undefined) data.status = o.status;
  if (o.customer) data.customer = { ...o.customer, email: o.customer.email ?? null, landmark: o.customer.landmark ?? null };
  if (o.items) {
    data.items = await Promise.all(
      o.items.map(async (i) => ({
        // never save a line without its product – cancelling it would then never give the stock back
        product: (await findProductDoc(payload, i.productId))?.id ?? null,
        productLegacyId: i.productId,
        title: i.name,
        slug: i.slug,
        url: i.url,
        image: i.image,
        unitPrice: i.unitPrice,
        qty: i.qty,
        upgrades: i.upgrades ?? [],
      }))
    );
  }
  for (const k of ["subtotal", "discount", "deliveryCharge", "total", "advancePaid", "paymentMethod", "paymentStatus", "courier", "trackingNumber", "notes", "couponCode"] as const) {
    if (o[k] !== undefined) data[k] = o[k] ?? null;
  }
  if (o.paymentScreenshotUrl !== undefined) data.paymentScreenshotKey = o.paymentScreenshotUrl ?? null;
  if (o.confirmation !== undefined) data.confirmation = o.confirmation ?? { token: null, code: null, expiresAt: null, confirmedAt: null, via: null };
  if (o.risk !== undefined) data.risk = o.risk ?? { score: null, level: null, reasons: null };
  if (o.history) data.history = o.history.map((h) => ({ status: h.status, at: h.at, note: h.note ?? null }));
  if (o.userId !== undefined) data.user = o.userId ? (await findOne(payload, "users", byStorefrontId(o.userId)))?.id ?? null : null;
  return data;
}

export type PlaceOrderResult =
  | { ok: true; order: Order; duplicate?: boolean }
  | { ok: false; reason: "sold-out"; short: string[] }
  | { ok: false; reason: "coupon" };

const isUniqueViolation = (e: unknown) => /unique|duplicate key|already exists/i.test(String((e as { message?: string })?.message ?? e));

/**
 * Checkout, all in ONE database transaction: use the coupon, take the stock, save the order and reserve the
 * serial-tracked units. If anything fails (sold out, a laptop just sold at the shop counter, a crash) nothing
 * is kept. `attemptId` makes a repeated submit (double click, retry after a lost response) return the order
 * that was already placed instead of creating a second one.
 */
export async function placeOrderCms(order: Order, lines: { id: string; qty: number; title: string }[], opts: { attemptId?: string | null; couponCode?: string | null }): Promise<PlaceOrderResult> {
  const payload = await payloadClient();
  const previous = async () => (opts.attemptId ? await findOne(payload, "orders", { attemptId: { equals: opts.attemptId } }) : null);
  const earlier = await previous();
  if (earlier) return { ok: true, order: toOrder(earlier), duplicate: true };

  const resolved: { productId: number; qty: number; title: string }[] = [];
  for (const l of lines) {
    const doc = await findProductDoc(payload, l.id);
    if (!doc) return { ok: false, reason: "sold-out", short: [l.title] };
    resolved.push({ productId: Number(doc.id), qty: l.qty, title: l.title });
  }

  const { takeStockForLines, consumeCoupon, setStockLog } = await import("@/payload/stock");
  const req = await createLocalReq({}, payload);
  setStockLog(req, { reason: "order", ref: order.orderNumber });
  await initTransaction(req);
  try {
    if (opts.couponCode && !(await consumeCoupon(payload, opts.couponCode, req))) {
      await killTransaction(req);
      return { ok: false, reason: "coupon" };
    }
    const short = await takeStockForLines(payload, resolved, req);
    if (short.length) {
      await killTransaction(req);
      return { ok: false, reason: "sold-out", short };
    }
    const data = { ...(await orderData(payload, order)), stockHeld: true, attemptId: opts.attemptId || null };
    // context.fromStorefront: the stock was taken just above, so the Orders hook must not take it again
    const doc = (await payload.create({ collection: "orders" as never, data: data as never, overrideAccess: true, depth: 0, context: { fromStorefront: true }, req })) as Doc;
    await commitTransaction(req);
    return { ok: true, order: { ...toOrder(doc), id: String(doc.id) } };
  } catch (e) {
    await killTransaction(req);
    const msg = String((e as Error)?.message ?? e);
    if (/UNITS_SHORT/.test(msg)) return { ok: false, reason: "sold-out", short: [msg.split("UNITS_SHORT:")[1]?.split(" – ")[0]?.trim() || "an item"] };
    // The same attempt saved meanwhile (double click): the database refused the 2nd copy – return the 1st.
    // (Payload reports this as a validation error, so look it up whatever the message says.)
    const dup = await previous().catch(() => null);
    if (dup) return { ok: true, order: toOrder(dup), duplicate: true };
    if (isUniqueViolation(e)) log.warn("checkout.unique_violation", { order: order.orderNumber, error: msg.slice(0, 200) });
    throw e;
  }
}

export async function insertOrderCms(order: Order): Promise<Order> {
  const payload = await payloadClient();
  // context.fromStorefront: checkout already took the stock (reserveStock), so the Orders hook must not take it again
  const doc = (await payload.create({ collection: "orders" as never, data: { ...(await orderData(payload, order)), stockHeld: true } as never, overrideAccess: true, depth: 0, context: { fromStorefront: true } })) as Doc;
  return { ...toOrder(doc), id: String(doc.id) };
}

export async function getOrderCms(where: Where): Promise<Order | null> {
  const doc = await findOne(await payloadClient(), "orders", where, 1);
  return doc ? toOrder(doc) : null;
}

export async function listOrdersCms(where: Where, opts: { page?: number; perPage?: number } = {}): Promise<{ items: Order[]; total: number }> {
  const payload = await payloadClient();
  const res = await payload.find({
    collection: "orders" as never,
    where,
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
  const doc = await findOne(payload, "orders", byStorefrontId(id));
  if (!doc) throw new Error("Order not found");
  const updated = (await payload.update({ collection: "orders" as never, id: doc.id as Id, data: (await orderData(payload, patch)) as never, overrideAccess: true, depth: 1 })) as Doc;
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

/** A Pakistani mobile as stored ("0300-1234567") or typed ("03001234567"). */
function phoneWhere(phone: string): Where[] {
  const d = phone.replace(/\D/g, "").replace(/^92/, "0");
  const formatted = d.length === 11 ? `${d.slice(0, 4)}-${d.slice(4)}` : phone;
  return [{ phone: { equals: formatted } }, { phone: { equals: d } }];
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
  try {
    const res = await payload.login({ collection: "users" as never, data: { email: email.trim().toLowerCase(), password } as never, overrideAccess: true, context: { storefront: true } });
    return res.user ? toUser(res.user as unknown as Doc) : null;
  } catch {
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
export async function linkOrderToCustomerCms(orderNumber: string, c: { email?: string | null; name: string; phone: string }): Promise<void> {
  const email = c.email?.trim().toLowerCase() || null;
  if (!email) return;
  const payload = await payloadClient();
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
export async function resetPasswordCms(token: string, password: string): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
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
    await payload.resetPassword({ collection: "users" as never, data: { token, password }, overrideAccess: true });
  } catch {
    return { ok: false, error: "This reset link has expired or was already used. Please ask for a new one." };
  }
  // the reset link proves the mailbox is theirs (email confirmed, a guest record becomes a real account);
  // every earlier shop sign-in ends
  await payload
    .update({ collection: "users" as never, id: user.id as Id, data: { emailVerified: true, hasAccount: true, sessionsValidAfter: new Date().toISOString() } as never, overrideAccess: true, depth: 0 })
    .catch((e) => log.error("account.reset_followup_failed", e));
  return { ok: true, email: str(user.email) };
}

/** Sends the "confirm your email" link. Returns false when there's nothing to send (already confirmed / no email set up). */
export async function sendVerificationEmailCms(storefrontUserId: string): Promise<boolean> {
  const payload = await payloadClient();
  const doc = await findOne(payload, "users", byStorefrontId(storefrontUserId));
  if (!doc || doc.emailVerified || !str(doc.email)) return false;
  const { html, text } = verifyEmailEmail(createVerifyToken(payload.secret, doc.id as Id, str(doc.email)), opt(str(doc.name)));
  return deliverEmail({ to: str(doc.email), subject: "Confirm your email – Urko Tech Store", html, text });
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

const toCoupon = (d: Doc): Coupon => ({
  code: str(d.code).toUpperCase(),
  kind: d.kind === "fixed" ? "fixed" : "percent",
  value: num(d.value),
  minOrder: num(d.minOrder),
  expiresAt: opt(str(d.expiresAt)) ?? null,
  usageLimit: typeof d.usageLimit === "number" ? d.usageLimit : null,
  used: num(d.used),
  active: d.active !== false,
});

export async function findCouponCms(code: string): Promise<Coupon | null> {
  const doc = await findOne(await payloadClient(), "discounts", { code: { equals: code.trim().toUpperCase() } });
  return doc ? toCoupon(doc) : null;
}

export async function recordCouponUseCms(code: string) {
  const payload = await payloadClient();
  const doc = await findOne(payload, "discounts", { code: { equals: code.trim().toUpperCase() } });
  if (doc) await payload.update({ collection: "discounts" as never, id: doc.id as Id, data: { used: num(doc.used) + 1 } as never, overrideAccess: true, depth: 0 });
}

export async function activeFlashSaleCms(): Promise<FlashSale | null> {
  const payload = await payloadClient();
  const res = await payload.find({
    collection: "flash-sales" as never,
    where: { and: [{ active: { equals: true } }, { endsAt: { greater_than: new Date().toISOString() } }] },
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
  };
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
  const doc = (await payload.create({ collection: "wholesale-inquiries" as never, data: { ...input, status: "new", receivedAt: new Date().toISOString() } as never, overrideAccess: true, depth: 0 })) as Doc;
  return toInquiry(doc);
}

export async function saveContactMessageCms(input: { name: string; phone?: string | null; email?: string | null; subject?: string | null; message: string }) {
  const payload = await payloadClient();
  return (await payload.create({ collection: "contact-messages" as never, data: { ...input, handled: false, receivedAt: new Date().toISOString() } as never, overrideAccess: true, depth: 0 })) as Doc;
}

