import type { CollectionAfterChangeHook, CollectionBeforeChangeHook, CollectionBeforeDeleteHook, CollectionConfig } from "payload";
import { PROCEED_STATUSES, paidUpfront, paymentBlocksShipping } from "../../lib/order-money";
import { roundMoney } from "../../lib/money";
import { BUILT_IN_METHODS, paymentLabel } from "../../lib/payments/methods";
import { storeLocaleOf } from "../store-locale";
import { assignStore, createFor, getTenant, hasStoreRole, publicOrStore, readFor, sameStore, storeAccess, storeField, storeIdOf, storeRoleField, writeFor } from "../tenancy";
import { dbName, legacyIdField, perStoreUnique, slugField } from "../fields";
import { revalidate } from "../revalidate";
import { slugRedirect } from "../slug-redirects";
import { log } from "../../lib/log";
import { getStoreSettings } from "../store-settings";
import { userError } from "../errors";

export const Posts: CollectionConfig = {
  slug: "posts",
  dbName: dbName("posts"),
  labels: { singular: "Blog post", plural: "Blog posts" },
  admin: { useAsTitle: "title", group: "Content", defaultColumns: ["title", "category", "publishedAt", "_status"] },
  access: {
    read: publicOrStore("store_staff", { _status: { equals: "published" } }),
    readVersions: readFor("store_staff"),
    create: createFor("store_staff"),
    update: writeFor("store_staff"),
    delete: writeFor("store_manager"),
  },
  indexes: perStoreUnique("slug"),
  versions: { drafts: { schedulePublish: true }, maxPerDoc: 50 },
  hooks: {
    beforeValidate: [assignStore()],
    // "Last edited" moves only when an editor saves the post in /cms (not on imports)
    beforeChange: [({ data, context, operation }) => (context?.migrating || operation === "create" ? data : { ...data, lastEdited: new Date().toISOString(), editedInCms: true })],
    afterChange: [slugRedirect("posts"), ({ doc, previousDoc }) => (revalidate(["content"], ["/blog", "/sitemap.xml", "/llms.txt", `/blog/${doc.slug}`, ...(previousDoc?.slug && previousDoc.slug !== doc.slug ? [`/blog/${previousDoc.slug}`] : [])]), doc)],
    afterDelete: [({ doc }) => (revalidate(["content"], ["/blog", "/sitemap.xml", `/blog/${doc.slug}`]), doc)],
  },
  fields: [
    storeField(),
    { name: "title", type: "text", required: true },
    { name: "excerpt", type: "textarea" },
    { name: "cover", type: "upload", relationTo: "media", filterOptions: sameStore },
    { name: "content", type: "richText" },
    { name: "relatedProducts", type: "relationship", relationTo: "products", hasMany: true, filterOptions: sameStore },
    { name: "relatedCategories", type: "relationship", relationTo: "categories", hasMany: true, filterOptions: sameStore },
    slugField("title"),
    { name: "category", type: "text", admin: { position: "sidebar" } },
    { name: "tags", type: "text", hasMany: true, admin: { position: "sidebar" } },
    { name: "author", type: "text", admin: { position: "sidebar", description: "Empty = the store's name." } },
    { name: "publishedAt", type: "date", admin: { position: "sidebar", date: { pickerAppearance: "dayAndTime" } } },
    { name: "lastEdited", type: "date", admin: { position: "sidebar", readOnly: true, description: "Shown as “Updated” on the post.", date: { pickerAppearance: "dayAndTime" } } },
    { name: "editedInCms", type: "checkbox", admin: { hidden: true } },
    legacyIdField,
  ],
};

const ORDER_STATUSES = [
  { label: "Waiting for online payment", value: "awaiting-payment" },
  { label: "Waiting for customer to confirm", value: "awaiting-confirmation" },
  { label: "To confirm", value: "pending" },
  { label: "To ship (confirmed)", value: "confirmed" },
  { label: "Shipped", value: "dispatched" },
  { label: "Out for delivery", value: "out-for-delivery" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Refused by customer (RTO)", value: "refused" },
  { label: "Returned", value: "returned" },
];
/** Orders in these states don't hold stock */
const RELEASED = new Set(["cancelled", "refused", "returned"]);

/**
 * The moves staff may make with an order (forward through the normal flow, or cancel before it ships).
 * Anything else – taking a delivered order back, re-opening a cancelled one, skipping steps – needs a manager.
 */
export const STAFF_MOVES: Record<string, string[]> = {
  // a card order moves on by itself when the payment provider confirms it; staff may only cancel it
  "awaiting-payment": ["cancelled"],
  "awaiting-confirmation": ["pending", "confirmed", "cancelled"],
  pending: ["awaiting-confirmation", "confirmed", "cancelled"],
  confirmed: ["pending", "dispatched", "cancelled"],
  dispatched: ["out-for-delivery", "delivered", "refused"],
  "out-for-delivery": ["dispatched", "delivered", "refused"],
  delivered: ["returned"],
  cancelled: [],
  refused: ["returned"],
  returned: [],
};

/** Shipping progress, kept apart from the order and payment status (worked out from the order status). */
const FULFILLMENT_BY_STATUS: Record<string, string> = {
  "awaiting-payment": "unfulfilled",
  "awaiting-confirmation": "unfulfilled",
  pending: "unfulfilled",
  confirmed: "unfulfilled",
  dispatched: "in_transit",
  "out-for-delivery": "in_transit",
  delivered: "delivered",
  cancelled: "cancelled",
  refused: "returned",
  returned: "returned",
};

type OrderLine = { product?: number | { id: number } | null; qty?: number; title?: string };
const orderLines = (items: unknown) =>
  ((Array.isArray(items) ? items : []) as OrderLine[])
    .map((i) => ({ productId: Number(i.product && typeof i.product === "object" ? i.product.id : i.product), qty: Number(i.qty) || 0, title: i.title }))
    .filter((l) => Number.isFinite(l.productId) && l.productId > 0 && l.qty > 0);

type Line = { productId: number; qty: number; title?: string };
type Owed = { kind: "backorder" | "preorder"; qty: number };
/**
 * Marks the order's lines that sold beyond the stock (backorder) or before the product's release (pre-order), so the
 * team knows what can't ship yet. `add`: an edit added more of a product (owed on top of what was owed already).
 */
const markOwed = (items: unknown, owed: Map<number, Owed>, add = false) => {
  if (!owed.size || !Array.isArray(items)) return undefined;
  const left = new Map(owed);
  return (items as (OrderLine & { owedQty?: number | null })[]).map((i) => {
    const id = Number(i.product && typeof i.product === "object" ? i.product.id : i.product);
    const o = left.get(id);
    if (!o) return i;
    left.delete(id);
    return { ...i, availability: o.kind, owedQty: (add ? Number(i.owedQty) || 0 : 0) + o.qty };
  });
};
const qtyByProduct = (lines: Line[]) => {
  const m = new Map<number, number>();
  for (const l of lines) m.set(l.productId, (m.get(l.productId) ?? 0) + l.qty);
  return m;
};

/**
 * Safety rules for every order change (admin, customer link, background jobs):
 * - `expectStatus` (context, or ?expectStatus= from the order panel): refuse if someone else changed the order meanwhile.
 * - Online payments (JazzCash / EasyPaisa / bank) can't be confirmed or shipped before the payment is "Paid".
 * - A rejected payment clears the claimed advance; an approved advance counts as the customer's confirmation.
 */
const orderGuards: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, context, req }) => {
  if (context?.migrating) return data;
  const prevStatus = originalDoc?.status as string | undefined;
  const expect = (context?.expectStatus as string | undefined) ?? req.searchParams?.get("expectStatus") ?? undefined;
  const changingStatus = operation === "update" && data.status !== undefined && data.status !== prevStatus;
  if (operation === "update" && originalDoc?.id && (expect || changingStatus)) {
    // lock the row: a second change arriving at the same moment waits here, then sees the new status
    // (always for a status change – two cancels at once must not put the stock back twice)
    const { lockOrderStatus } = await import("../stock");
    const current = req.transactionID ? await lockOrderStatus(req.payload, Number(originalDoc.id), req) : prevStatus;
    const wanted = expect ?? prevStatus;
    if (current !== wanted) throw userError(`This order was changed meanwhile – it is now “${current}”. Reload the page and check it again.`, 409);
  }

  if (operation === "update" && data.paymentStatus === "unpaid" && originalDoc?.paymentStatus === "awaiting-verification") data.advancePaid = null;
  const approvingAdvance = operation === "update" && data.paymentStatus === "partial" && originalDoc?.paymentStatus !== "partial" && prevStatus === "awaiting-confirmation" && (!data.status || data.status === prevStatus);
  type Protection = { skipWithAdvance?: boolean };
  const protection: Protection = approvingAdvance ? await getStoreSettings<Protection>(req.payload, "order-protection", storeIdOf(data.store ?? originalDoc?.store), { req }).catch((): Protection => ({})) : {};
  const advanceConfirms = approvingAdvance && protection.skipWithAdvance !== false;
  if (advanceConfirms) {
    data.status = "pending";
    data.confirmation = { ...(originalDoc?.confirmation ?? {}), ...(data.confirmation ?? {}), confirmedAt: new Date().toISOString(), via: "advance payment verified" };
  }

  const status = String(data.status ?? prevStatus ?? "pending");
  // a person (in /cms or the API) – background jobs, webhooks and the checkout have no user and follow their own rules
  const t = req.user && !context?.system ? await getTenant(req) : null;
  const manager = !t || hasStoreRole(t, storeIdOf(data.store ?? originalDoc?.store), "store_manager");
  if (operation === "update" && status !== prevStatus && !manager && !(STAFF_MOVES[String(prevStatus)] ?? []).includes(status))
    throw userError(
      prevStatus === "delivered"
        ? "Only an owner or manager can move a delivered order back. If the customer sent something back, record it in Orders → Returns."
        : prevStatus === "returned" || RELEASED.has(String(prevStatus))
          ? "Only an owner or manager can re-open this order."
          : `Staff can't move an order from “${prevStatus}” to “${status}” – ask a manager.`,
      403,
    );
  const money = { paymentMethod: data.paymentMethod ?? originalDoc?.paymentMethod, paymentDue: data.paymentDue ?? originalDoc?.paymentDue, paymentStatus: data.paymentStatus ?? originalDoc?.paymentStatus };
  if ((operation === "create" || status !== prevStatus) && PROCEED_STATUSES.has(status) && paymentBlocksShipping(money))
    throw userError("Check the online payment first: approve it (payment “Paid”) – or change the payment method to cash on delivery – before confirming or shipping this order.", 400);
  if (operation === "update" && !manager) {
    // money decisions are a manager's: approving an online payment, or changing payment after the order shipped
    const approvesOnline = data.paymentStatus === "paid" && originalDoc?.paymentStatus !== "paid" && paidUpfront(money);
    const shipped = !["awaiting-confirmation", "pending", "confirmed"].includes(String(prevStatus));
    const paymentEdited = (data.paymentStatus !== undefined && data.paymentStatus !== originalDoc?.paymentStatus) || (data.paymentMethod !== undefined && data.paymentMethod !== originalDoc?.paymentMethod);
    if (approvesOnline) throw userError("Only an owner or manager can approve an online payment.", 403);
    if (shipped && paymentEdited && !(data.paymentStatus === "paid" && !paidUpfront(money))) throw userError("This order has shipped – only an owner or manager can change its payment.", 403);
  }
  data.fulfillmentStatus = FULFILLMENT_BY_STATUS[status] ?? "unfulfilled";
  // some items shipped (Ship part of the order), others not yet
  if (data.fulfillmentStatus === "unfulfilled" || data.fulfillmentStatus === "in_transit") {
    const items = (data.items ?? originalDoc?.items ?? []) as { qty?: number }[];
    const shipments = (data.shipments ?? originalDoc?.shipments ?? []) as ShipmentRow[];
    const shipped = shippedPerLine(shipments);
    const any = [...shipped.values()].some((q) => q > 0);
    const all = items.length > 0 && items.every((it, i) => (shipped.get(i) ?? 0) >= Number(it.qty ?? 0));
    if (any && !all) data.fulfillmentStatus = "partially_fulfilled";
  }
  return data;
};

/** A shipment of (part of) an order – see /cms-api/order-tools/ship. */
export type ShipmentRow = {
  id?: string;
  items?: { line?: number; qty?: number; title?: string }[];
  courier?: string | null;
  trackingNumber?: string | null;
  status?: string;
  shippedAt?: string;
  deliveredAt?: string | null;
  provider?: string | null;
  courierStatus?: string | null;
  lastTrackedAt?: string | null;
  labelUrl?: string | null;
  courierRef?: string | null;
  codAmount?: number | null;
  codStatus?: string | null;
  codRemittedAt?: string | null;
  codRemittanceRef?: string | null;
};

/** How many of each order line (by index) are on their way or delivered. */
export function shippedPerLine(shipments: ShipmentRow[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const s of shipments) {
    if (s.status === "cancelled") continue;
    for (const it of s.items ?? []) m.set(Number(it.line), (m.get(Number(it.line)) ?? 0) + (Number(it.qty) || 0));
  }
  return m;
}

/** Read-only, calculated totals: a new order typed in /cms has none yet – orderTotals fills them in (no DB default needed). */
const calculatedLater = ({ value }: { value?: unknown }) => value ?? 0;

/** Items picked in /cms: the product's web address, slug and first photo are filled in (the customer's account page uses them). */
const orderItemDetails: CollectionBeforeChangeHook = async ({ data, context, req }) => {
  if (context?.migrating || context?.fromStorefront || !Array.isArray(data.items)) return data;
  for (const item of data.items as { product?: unknown; slug?: string | null; url?: string | null; image?: string | null; sku?: string | null }[]) {
    const id = item.product && typeof item.product === "object" ? (item.product as { id?: number }).id : item.product;
    if (!id || (item.url && item.slug && item.image && item.sku)) continue;
    const p = (await req.payload.findByID({ collection: "products", id: Number(id), depth: 1, overrideAccess: true, req }).catch(() => null)) as { slug?: string; sku?: string; optionValues?: unknown; category?: unknown; images?: { url?: string }[] } | null;
    if (!p?.slug) continue;
    // top-level category (product pages live at /<top category>/<product>)
    let cat = p.category && typeof p.category === "object" ? (p.category as { slug?: string; parent?: unknown }) : null;
    for (let hops = 0; hops < 20 && cat?.parent; hops++) {
      const parentId = typeof cat.parent === "object" ? (cat.parent as { id?: number }).id : cat.parent;
      const parent = parentId ? ((await req.payload.findByID({ collection: "categories", id: Number(parentId), depth: 0, overrideAccess: true, req }).catch(() => null)) as { slug?: string; parent?: unknown } | null) : null;
      if (!parent) break;
      cat = parent;
    }
    item.slug ||= p.slug;
    item.url ||= `/${cat?.slug ?? "products"}/${p.slug}`;
    item.image ||= p.images?.[0]?.url ?? null;
    const snap = item as { sku?: string | null; options?: unknown };
    snap.sku ||= (p as { sku?: string }).sku ?? null;
    snap.options ??= (p as { optionValues?: unknown }).optionValues ?? null;
  }
  return data;
};

/**
 * An order keeps the currency it was placed in (the store's at that moment), and the name of its payment method –
 * a store's own method may be renamed or removed later. Orders made in /cms get both here.
 */
const orderCurrencyAndMethod: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, context, req }) => {
  if (context?.migrating) return data;
  const storeId = storeIdOf(data.store ?? originalDoc?.store);
  if (operation === "create" && !data.currency) data.currency = (await storeLocaleOf(req.payload, storeId, req)).currency;
  const method = data.paymentMethod;
  const changed = method !== undefined && method !== originalDoc?.paymentMethod;
  if (method && (operation === "create" ? !data.paymentMethodLabel || !data.paymentDue : changed)) {
    const info = await paymentMethodInfo(req, storeId, String(method));
    if (operation === "create") {
      data.paymentMethodLabel ||= info.label;
      data.paymentDue ||= info.due;
    } else {
      // a changed method (e.g. staff switching an order to cash on delivery) gets its own name and due time
      if (data.paymentMethodLabel === undefined || data.paymentMethodLabel === originalDoc?.paymentMethodLabel) data.paymentMethodLabel = info.label;
      if (data.paymentDue === undefined || data.paymentDue === originalDoc?.paymentDue) data.paymentDue = info.due;
    }
  }
  return data;
};

/** A method's name and when it is paid: a built-in one, else the store's own (Settings → Payments). */
async function paymentMethodInfo(req: Parameters<CollectionBeforeChangeHook>[0]["req"], storeId: number | null, method: string): Promise<{ label: string; due: "upfront" | "on-delivery" }> {
  const builtIn = BUILT_IN_METHODS[method];
  if (builtIn) return { label: builtIn.label, due: builtIn.due };
  type Own = { methodId?: string; name?: string; due?: string };
  const pay = await getStoreSettings<{ manualMethods?: Own[] }>(req.payload, "payments", storeId, { req }).catch((): { manualMethods?: Own[] } => ({}));
  const own = (pay.manualMethods ?? []).find((m) => m.methodId === method);
  return { label: own?.name || paymentLabel(method), due: own?.due === "on-delivery" ? "on-delivery" : "upfront" };
}

/** Totals always match the lines: recalculated whenever items, discount or delivery change (and for orders made in /cms). */
const orderTotals: CollectionBeforeChangeHook = ({ data, originalDoc, operation, context }) => {
  if (context?.migrating || context?.fromStorefront) return data;
  const sig = (items: unknown, discount: unknown, delivery: unknown) =>
    JSON.stringify([((Array.isArray(items) ? items : []) as { unitPrice?: number; qty?: number }[]).map((i) => [Number(i.unitPrice) || 0, Number(i.qty) || 0]), Number(discount) || 0, Number(delivery) || 0]);
  const items = data.items ?? originalDoc?.items;
  const discount = data.discount ?? originalDoc?.discount;
  const delivery = data.deliveryCharge ?? originalDoc?.deliveryCharge;
  if (operation === "update" && sig(items, discount, delivery) === sig(originalDoc?.items, originalDoc?.discount, originalDoc?.deliveryCharge)) {
    // nothing that makes up the total changed – so the total can't either (a typed Total is ignored; the saved
    // values are kept – they are required fields, so they can't simply be left out)
    data.subtotal = originalDoc?.subtotal;
    data.total = originalDoc?.total;
    return data;
  }
  const subtotal = ((Array.isArray(items) ? items : []) as { unitPrice?: number; qty?: number }[]).reduce((s, i) => s + Math.max(0, Number(i.unitPrice) || 0) * Math.max(0, Number(i.qty) || 0), 0);
  // whole rupees, cents … – the order's own currency
  const currency = String(data.currency ?? originalDoc?.currency ?? "PKR");
  data.subtotal = roundMoney(subtotal, currency);
  data.total = Math.max(0, roundMoney(subtotal - Math.max(0, Number(discount) || 0) + Math.max(0, Number(delivery) || 0), currency));
  return data;
};

/**
 * Stock follows the order: an order made in /cms takes stock when created; cancelling puts it back;
 * re-opening a cancelled order takes it again (and refuses if it is no longer in stock); changing the items of an
 * open order takes / returns the difference. Checkout takes stock itself (same transaction), so storefront orders
 * arrive with stockHeld already true. Orders from before this existed have no value and count as holding stock.
 */
const orderStock: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, context, req }) => {
  // skipStock: a finished return already put the items back (see Returns)
  if (context?.migrating || context?.skipStock) return data;
  const status = String(data.status ?? originalDoc?.status ?? "pending");
  const { putBackStock, takeStockForLines, trackedProducts, moveOrderUnits, releaseCoupon, lowerSoldCount, setStockLog } = await import("../stock");
  let changed = false;
  const ref = String(data.orderNumber ?? originalDoc?.orderNumber ?? "");
  if (operation === "create") {
    if (context?.fromStorefront) return data;
    const lines = orderLines(data.items);
    if (RELEASED.has(status) || !lines.length) return { ...data, stockHeld: false };
    setStockLog(req, { reason: "order", ref, note: "Order created in /cms" });
    const owed = new Map<number, Owed>();
    const short = await takeStockForLines(req.payload, lines, req, { backorders: true, owed });
    if (short.length) throw userError(`Not enough stock for: ${short.join(", ")}`, 409);
    const marked = markOwed(data.items, owed);
    if (marked) data.items = marked;
    data.stockHeld = true;
    changed = true;
  } else {
    const oldLines = orderLines(originalDoc?.items);
    const newLines = data.items !== undefined ? orderLines(data.items) : oldLines;
    const held = originalDoc?.stockHeld !== false;
    const orderId = Number(originalDoc?.id);
    const statusChanged = status !== originalDoc?.status;
    const tracked = await trackedProducts(req.payload, [...new Set([...oldLines, ...newLines].map((l) => l.productId))], req);
    if (statusChanged && RELEASED.has(status) && held) {
      setStockLog(req, { reason: "order-cancelled", ref, note: `Order ${status}` });
      // what is held is what the order had BEFORE this save – minus what this order's returns already put back
      const restocked = await restockedByReturns(req, orderId);
      for (const l of oldLines) {
        if (tracked.has(l.productId)) continue;
        const already = Math.min(l.qty, restocked.get(l.productId) ?? 0);
        restocked.set(l.productId, (restocked.get(l.productId) ?? 0) - already);
        if (l.qty - already > 0) await putBackStock(req.payload, l.productId, l.qty - already, req);
      }
      // a refused parcel comes back unopened, so its units go straight back on the shelf
      if (tracked.size) {
        await moveOrderUnits(req.payload, orderId, status === "returned" ? "returned" : "in-stock", req);
        for (const l of oldLines) if (tracked.has(l.productId)) await lowerSoldCount(req.payload, l.productId, l.qty, req);
      }
      // a cancelled / refused order gives its coupon use back – only if it really used one (orders typed in /cms don't)
      if (status !== "returned" && originalDoc?.couponCode && originalDoc?.couponConsumed) {
        await releaseCoupon(req.payload, String(originalDoc.couponCode), storeIdOf(originalDoc.store), req);
        data.couponConsumed = false;
        data.couponReturned = true;
      }
      // … and the money it paid with a gift card goes back onto the card
      if (status !== "returned" && originalDoc?.giftCardCode && originalDoc?.giftCardCharged && Number(originalDoc.giftCardAmount) > 0) {
        const { giveBackToGiftCard } = await import("../gift-cards");
        await giveBackToGiftCard(req.payload, { code: String(originalDoc.giftCardCode), storeId: storeIdOf(originalDoc.store), amount: Number(originalDoc.giftCardAmount), orderNumber: ref, note: `Order ${status}` }, req);
        data.giftCardCharged = false;
      }
      data.stockHeld = false;
      changed = true;
    } else if (statusChanged && !RELEASED.has(status) && !held) {
      setStockLog(req, { reason: "order-reopened", ref });
      const owed = new Map<number, Owed>();
      const short = await takeStockForLines(req.payload, newLines, req, { backorders: true, owed });
      if (short.length) throw userError(`Cannot re-open – not enough stock for: ${short.join(", ")}`, 409);
      const marked = markOwed(data.items ?? originalDoc?.items, owed);
      if (marked) data.items = marked;
      const coupon = originalDoc?.couponCode ? String(originalDoc.couponCode) : "";
      // re-opening takes the coupon use again – if the order had given one back
      if (coupon && originalDoc?.status !== "returned" && originalDoc?.couponReturned) {
        const { consumeCoupon } = await import("../stock");
        if (!(await consumeCoupon(req.payload, coupon, storeIdOf(originalDoc?.store), req)))
          throw userError(`Cannot re-open – the coupon ${coupon} has no uses left (or has expired). Remove the coupon and its discount from the order first.`, 409);
        data.couponConsumed = true;
        data.couponReturned = false;
      }
      // re-opening pays with the gift card again (if it still has the money)
      if (originalDoc?.giftCardCode && Number(originalDoc.giftCardAmount) > 0 && !originalDoc.giftCardCharged && originalDoc?.status !== "returned") {
        const { takeFromGiftCard } = await import("../gift-cards");
        if (!(await takeFromGiftCard(req.payload, { code: String(originalDoc.giftCardCode), storeId: storeIdOf(originalDoc.store), amount: Number(originalDoc.giftCardAmount), orderNumber: ref }, req)))
          throw userError("Cannot re-open – the gift card it was paid with no longer has that balance (or is switched off).", 409);
        data.giftCardCharged = true;
      }
      data.stockHeld = true;
      context.assignUnits = true;
      changed = true;
    } else if (held && !RELEASED.has(status)) {
      const before = qtyByProduct(oldLines);
      const after = qtyByProduct(newLines);
      const more: Line[] = [];
      const less: Line[] = [];
      for (const id of new Set([...before.keys(), ...after.keys()])) {
        const d = (after.get(id) ?? 0) - (before.get(id) ?? 0);
        if (!d) continue;
        if (tracked.has(id)) throw userError("Laptops tracked by serial number can't be added to or removed from an existing order – cancel it and create a new one.", 400);
        (d > 0 ? more : less).push({ productId: id, qty: Math.abs(d), title: newLines.find((l) => l.productId === id)?.title });
      }
      setStockLog(req, { reason: "order-edited", ref });
      if (more.length) {
        const owed = new Map<number, Owed>();
        const short = await takeStockForLines(req.payload, more, req, { backorders: true, owed });
        if (short.length) throw userError(`Not enough stock for: ${short.join(", ")}`, 409);
        const marked = markOwed(data.items, owed, true);
        if (marked) data.items = marked;
      }
      for (const l of less) await putBackStock(req.payload, l.productId, l.qty, req);
      changed = more.length > 0 || less.length > 0;
      if (statusChanged && status === "delivered" && tracked.size) await moveOrderUnits(req.payload, orderId, "sold", req);
    }
  }
  if (changed) {
    const { revalidate, CATALOG_TAG } = await import("../revalidate");
    revalidate([CATALOG_TAG]);
  }
  return data;
};

/** Per product: how many of this order's items its returns already put back in stock. */
async function restockedByReturns(req: Parameters<CollectionBeforeChangeHook>[0]["req"], orderId: number): Promise<Map<number, number>> {
  const m = new Map<number, number>();
  if (!orderId) return m;
  const res = await req.payload.find({ collection: "return-requests", where: { and: [{ order: { equals: orderId } }, { restocked: { equals: true } }] }, limit: 100, depth: 0, overrideAccess: true, req });
  for (const r of res.docs as unknown as { items?: { product?: unknown; qty?: number; serial?: string | null }[] }[])
    for (const i of r.items ?? []) {
      if (i.serial) continue; // serial-numbered units are moved one by one, not counted here
      const pid = i.product && typeof i.product === "object" ? Number((i.product as { id: number }).id) : Number(i.product);
      if (pid) m.set(pid, (m.get(pid) ?? 0) + (Number(i.qty) || 1));
    }
  return m;
}

/** Deleting an order that still holds stock gives the stock and its laptops back (managers only). */
const orderDeleteStock: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const doc = (await req.payload.findByID({ collection: "orders", id, depth: 0, overrideAccess: true, req }).catch(() => null)) as Record<string, unknown> | null;
  if (!doc || doc.stockHeld === false || RELEASED.has(String(doc.status))) return;
  const { putBackStock, trackedProducts, moveOrderUnits, setStockLog } = await import("../stock");
  setStockLog(req, { reason: "order-deleted", ref: String(doc.orderNumber ?? "") });
  const lines = orderLines(doc.items);
  const tracked = await trackedProducts(req.payload, lines.map((l) => l.productId), req);
  for (const l of lines) if (!tracked.has(l.productId)) await putBackStock(req.payload, l.productId, l.qty, req);
  if (tracked.size) await moveOrderUnits(req.payload, Number(id), "in-stock", req);
  const { revalidate, CATALOG_TAG } = await import("../revalidate");
  revalidate([CATALOG_TAG]);
};

/** Audit trail in the logs: status, payment and courier changes (who, what, when). */
const orderAudit: CollectionAfterChangeHook = ({ doc, previousDoc, operation, req, context }) => {
  if (context?.migrating) return doc;
  const by = (req.user as { id?: number; role?: string } | null)?.id ?? "system";
  if (operation === "create") log.info("order.created", { order: doc.orderNumber, status: doc.status, total: doc.total, payment: doc.paymentMethod, by });
  else {
    if (doc.status !== previousDoc?.status) log.info("order.status", { order: doc.orderNumber, from: previousDoc?.status, to: doc.status, by });
    if (doc.paymentStatus !== previousDoc?.paymentStatus) log.info("payment.status", { order: doc.orderNumber, method: doc.paymentMethod, from: previousDoc?.paymentStatus, to: doc.paymentStatus, by });
    if (doc.trackingNumber && (doc.trackingNumber !== previousDoc?.trackingNumber || doc.courier !== previousDoc?.courier))
      log.info("courier.assigned", { order: doc.orderNumber, courier: doc.courier, tracking: doc.trackingNumber, by });
  }
  return doc;
};

/**
 * Serial-tracked products: once the order exists, reserve the actual units (oldest first) for it – in the same
 * transaction. If a laptop was sold at the shop counter in the meantime, the whole order is undone ("sold out").
 */
const orderUnits: CollectionAfterChangeHook = async ({ doc, operation, context, req }) => {
  if (context?.migrating || !doc.stockHeld || (operation !== "create" && !context?.assignUnits)) return doc;
  const lines = orderLines(doc.items);
  const { trackedProducts, reserveUnits } = await import("../stock");
  const tracked = await trackedProducts(req.payload, lines.map((l) => l.productId), req);
  for (const l of lines) {
    if (!tracked.has(l.productId)) continue;
    const serials = await reserveUnits(req.payload, Number(doc.id), l.productId, l.qty, req);
    if (serials.length < l.qty) throw userError(`UNITS_SHORT: ${l.title ?? `product ${l.productId}`} – only ${serials.length} of ${l.qty} in stock`, 409);
  }
  if (operation !== "create" && doc.status === "delivered" && tracked.size) {
    const { moveOrderUnits } = await import("../stock");
    await moveOrderUnits(req.payload, Number(doc.id), "sold", req);
  }
  return doc;
};

const historyKey = (h: unknown) => {
  const e = (h ?? {}) as { at?: string; status?: string; note?: string | null };
  const t = e.at ? Date.parse(e.at) : NaN;
  return `${Number.isFinite(t) ? t : ""}|${e.status ?? ""}|${e.note ?? ""}`;
};

/**
 * The timeline only grows: entries sent from a screen opened earlier are merged with what's stored (nothing a
 * colleague, the customer or a background job added in between is lost); a status change adds its own entry.
 */
const orderStatusHistory: CollectionBeforeChangeHook = ({ data, originalDoc, operation, context }) => {
  if (operation !== "update" || context?.migrating) return data;
  const before = (originalDoc?.history as unknown[] | undefined) ?? [];
  if (Array.isArray(data.history)) {
    const seen = new Set(before.map(historyKey));
    data.history = [...before, ...(data.history as unknown[]).filter((h) => !seen.has(historyKey(h)))];
  }
  if (data.status && data.status !== originalDoc?.status) {
    const list = ((data.history as unknown[] | undefined) ?? before) as { status?: string }[];
    const added = list.length > before.length && list[list.length - 1]?.status === data.status;
    if (!added) data.history = [...list, { status: data.status, at: new Date().toISOString() }];
  }
  return data;
};

/** Cost at the time of sale on each line (for the profit report) – filled once, never changed afterwards. */
const orderCosts: CollectionAfterChangeHook = async ({ doc, operation, previousDoc, req, context }) => {
  if (context?.migrating) return doc;
  if (operation === "create" || JSON.stringify(doc.items ?? []) !== JSON.stringify(previousDoc?.items ?? [])) {
    const { snapshotCosts } = await import("../stock");
    await snapshotCosts(req.payload, "orders", Number(doc.id), req);
  }
  return doc;
};

/** The order as the store's own systems receive it (webhooks). */
export const orderEventData = (doc: Record<string, unknown>) => {
  const c = (doc.customer ?? {}) as Record<string, unknown>;
  return {
    id: doc.id,
    orderNumber: doc.orderNumber,
    status: doc.status,
    paymentStatus: doc.paymentStatus,
    paymentMethod: doc.paymentMethod,
    fulfillmentStatus: doc.fulfillmentStatus,
    subtotal: doc.subtotal,
    discount: doc.discount,
    deliveryCharge: doc.deliveryCharge,
    taxTotal: doc.taxTotal,
    total: doc.total,
    couponCode: doc.couponCode ?? null,
    placedAt: doc.placedAt,
    customer: { name: c.name, phone: c.phone, email: c.email ?? null, city: c.city, address: c.address },
    items: ((doc.items as Record<string, unknown>[] | undefined) ?? []).map((i) => ({ sku: i.sku ?? null, title: i.title, options: i.options ?? null, qty: i.qty, unitPrice: i.unitPrice })),
  };
};

/** New orders and status changes go to the store's webhooks (queued in the same transaction). */
const orderWebhooks: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, context, req }) => {
  if (context?.migrating) return doc;
  const created = operation === "create";
  if (!created && doc.status === previousDoc?.status) return doc;
  try {
    const { emitStoreEvent } = await import("../../lib/webhooks");
    await emitStoreEvent(req.payload, storeIdOf(doc.store), created ? "order.created" : "order.updated", { ...orderEventData(doc), ...(created ? {} : { previousStatus: previousDoc?.status }) }, req);
  } catch (e) {
    log.error("orders.webhook_queue_failed", e);
  }
  return doc;
};

/**
 * Status change → email / WhatsApp / SMS to the customer. Queued in the same transaction as the change (sent only if
 * it is saved; retried by the outbox), and skipped if the order has moved on again by the time it is delivered.
 */
const orderStatusNotify: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, context, req }) => {
  if (operation !== "update" || context?.migrating || context?.skipNotify || doc.status === previousDoc?.status) return doc;
  try {
    const { queueNotification } = await import("../../lib/notify");
    await queueNotification(req.payload, "order-status", storeIdOf(doc.store), { orderId: doc.id, status: doc.status }, { req, dedupeKey: `order-status:${doc.id}:${doc.status}:${String(doc.updatedAt ?? Date.now())}` });
  } catch (e) {
    log.error("orders.status_notification_failed", e);
  }
  return doc;
};

export const Orders: CollectionConfig = {
  slug: "orders",
  dbName: dbName("orders"),
  admin: {
    useAsTitle: "orderNumber",
    group: "Sales",
    defaultColumns: ["orderNumber", "customer", "status", "paymentStatus", "total"],
    listSearchableFields: ["orderNumber", "customer.name", "customer.phone"],
    components: {
      beforeListTable: [
        {
          path: "/payload/admin/ui/ListTabs#ListTabs",
          clientProps: {
            label: "Order views",
            tabs: [
              { label: "All", where: "" },
              { label: "Waiting for customer", where: "where[status][equals]=awaiting-confirmation" },
              { label: "To confirm", where: "where[status][equals]=pending" },
              { label: "Payment to check", where: "where[paymentStatus][equals]=awaiting-verification" },
              { label: "To ship", where: "where[status][equals]=confirmed" },
              { label: "On the way", where: "where[status][in][0]=dispatched&where[status][in][1]=out-for-delivery" },
              { label: "Delivered", where: "where[status][equals]=delivered" },
              { label: "Refused (RTO)", where: "where[status][equals]=refused" },
              { label: "Cancelled & returned", where: "where[status][in][0]=cancelled&where[status][in][1]=returned" },
            ],
          },
        },
      ],
    },
  },
  // a store's team: its orders; a shopper: their own orders (any store)
  access: { read: readFor("store_staff", { self: "user" }), create: createFor("store_staff"), update: writeFor("store_staff"), delete: writeFor("store_manager") },
  indexes: perStoreUnique("paymentReference"),
  hooks: {
    beforeValidate: [assignStore()],
    beforeChange: [orderCurrencyAndMethod, orderGuards, orderItemDetails, orderTotals, orderStatusHistory, orderStock],
    afterChange: [orderUnits, orderCosts, orderAudit, orderStatusNotify, orderWebhooks],
    beforeDelete: [orderDeleteStock],
  },
  fields: [
    storeField(),
    { name: "panel", type: "ui", admin: { components: { Field: "/payload/admin/orders/OrderPanel#OrderPanel" } } },
    { type: "row", fields: [
      { name: "orderNumber", type: "text", required: true, unique: true, index: true, label: "Order number", admin: { width: "40%", components: { Cell: "/payload/admin/orders/Cells#OrderNumberCell" } } },
      { name: "status", type: "select", required: true, defaultValue: "pending", index: true, options: ORDER_STATUSES, admin: { width: "30%", description: "Usually changed with the buttons at the top.", components: { Cell: "/payload/admin/orders/Cells#OrderStatusCell" } } },
      { name: "placedAt", type: "date", required: true, index: true, label: "Placed", admin: { width: "30%", date: { pickerAppearance: "dayAndTime" } } },
    ] },
    {
      name: "customer",
      type: "group",
      admin: { components: { Cell: "/payload/admin/orders/Cells#OrderCustomerCell" } },
      fields: [
        { type: "row", fields: [
          { name: "name", type: "text", required: true, admin: { width: "34%" } },
          { name: "phone", type: "text", required: true, index: true, admin: { width: "33%" } },
          { name: "email", type: "text", index: true, admin: { width: "33%" } },
        ] },
        { type: "row", fields: [
          { name: "city", type: "text", required: true, index: true, admin: { width: "34%" } },
          { name: "address", type: "text", required: true, admin: { width: "33%" } },
          { name: "landmark", type: "text", admin: { width: "33%" } },
        ] },
        // outside Pakistan: state / province, postcode and country (ISO code)
        { type: "row", fields: [
          { name: "region", type: "text", label: "State / province", admin: { width: "34%" } },
          { name: "postalCode", type: "text", label: "Postcode", admin: { width: "33%" } },
          { name: "country", type: "text", admin: { width: "33%", description: "ISO code, e.g. PK, US." } },
        ] },
      ],
    },
    {
      name: "items",
      type: "array",
      fields: [
        { type: "row", fields: [
          { name: "product", type: "relationship", relationTo: "products", filterOptions: sameStore, admin: { width: "40%" } },
          { name: "title", type: "text", required: true, admin: { width: "60%" } },
        ] },
        { name: "productLegacyId", type: "text", admin: { hidden: true } },
        { type: "row", fields: [
          { name: "unitPrice", type: "number", required: true, min: 0, label: "Price each", admin: { width: "50%" } },
          { name: "qty", type: "number", required: true, min: 1, label: "Quantity", admin: { width: "50%" } },
        ] },
        // what was sold, as it was then (the product may be renamed or deleted later)
        { type: "row", fields: [
          { name: "sku", type: "text", label: "SKU", admin: { width: "50%", readOnly: true } },
          { name: "options", type: "json", label: "Option", admin: { width: "50%", readOnly: true } },
        ] },
        // filled in from the product (orderItemDetails) – nothing to type
        { name: "slug", type: "text", admin: { hidden: true } },
        { name: "url", type: "text", admin: { hidden: true } },
        { name: "image", type: "text", admin: { hidden: true } },
        { name: "upgrades", type: "json", admin: { components: { Field: "/payload/admin/orders/UpgradesField#UpgradesField" } } },
        { name: "unitCost", type: "number", label: "Cost each", access: { read: storeRoleField("store_owner"), create: () => false, update: () => false }, admin: { readOnly: true, description: "Your cost when it was sold (owners only) – used by the profit report." } },
        // sold beyond the stock or before the product's release – set by the server when the stock was taken
        { type: "row", fields: [
          { name: "availability", type: "select", label: "Ships later", options: [{ label: "Pre-order", value: "preorder" }, { label: "Backorder (sold out when ordered)", value: "backorder" }], admin: { width: "50%", readOnly: true, condition: (_, s) => Boolean(s?.availability) } },
          { name: "owedQty", type: "number", label: "Owed (not in stock when ordered)", admin: { width: "50%", readOnly: true, condition: (_, s) => Boolean(s?.availability) } },
        ] },
      ],
    },
    { type: "row", fields: [
      { name: "subtotal", type: "number", required: true, label: "Items", hooks: { beforeValidate: [calculatedLater] }, admin: { width: "20%", readOnly: true, description: "Calculated" } },
      { name: "discount", type: "number", defaultValue: 0, min: 0, label: "Discount", admin: { width: "20%" } },
      { name: "deliveryCharge", type: "number", defaultValue: 0, min: 0, label: "Delivery", admin: { width: "20%" } },
      { name: "total", type: "number", required: true, label: "Total", hooks: { beforeValidate: [calculatedLater] }, admin: { width: "20%", readOnly: true, description: "Calculated", components: { Cell: "/payload/admin/orders/Cells#OrderTotalCell" } } },
      { name: "advancePaid", type: "number", min: 0, label: "Advance paid", admin: { width: "20%" } },
    ] },
    { name: "shippingMethod", type: "text", label: "Delivery method", admin: { readOnly: true, description: "Chosen at checkout (stores that offer more than one, e.g. Express)." } },
    { type: "row", fields: [
      { name: "giftCardCode", type: "text", label: "Gift card", access: { update: () => false }, admin: { width: "50%", readOnly: true, description: "Paid (part of) this order." } },
      { name: "giftCardAmount", type: "number", min: 0, label: "Paid by gift card", access: { update: () => false }, admin: { width: "50%", readOnly: true } },
    ] },
    // the card's balance was really taken (given back when the order is cancelled, taken again if it is re-opened)
    { name: "giftCardCharged", type: "checkbox", defaultValue: false, access: { read: storeRoleField("store_staff"), create: () => false, update: () => false }, admin: { hidden: true } },
    { type: "row", fields: [
      { name: "couponCode", type: "text", label: "Coupon code", admin: { width: "50%" } },
      { name: "taxTotal", type: "number", defaultValue: 0, min: 0, label: "Tax included", admin: { width: "50%", readOnly: true, description: "Tax inside the total, from the store's tax rate when the order was placed." } },
    ] },
    // tax per rate (Products → Tax) – set when the order was placed
    { name: "taxBreakdown", type: "json", label: "Tax per rate", admin: { readOnly: true, condition: (d) => Array.isArray(d?.taxBreakdown) && d.taxBreakdown.length > 0 } },
    {
      name: "billing",
      type: "group",
      label: "Invoice to",
      admin: { description: "Only when the invoice is made out to someone else (a company with a VAT / tax number). Empty = the customer above." },
      fields: [
        { type: "row", fields: [
          { name: "name", type: "text", maxLength: 120, admin: { width: "34%" } },
          { name: "company", type: "text", maxLength: 120, admin: { width: "33%" } },
          { name: "taxId", type: "text", maxLength: 40, label: "VAT / tax number", admin: { width: "33%" } },
        ] },
        { name: "address", type: "text", maxLength: 300 },
        { type: "row", fields: [
          { name: "city", type: "text", maxLength: 80, admin: { width: "34%" } },
          { name: "postalCode", type: "text", maxLength: 12, admin: { width: "33%" } },
          { name: "country", type: "text", maxLength: 2, admin: { width: "33%", description: "ISO code, e.g. PK" } },
        ] },
      ],
    },
    // true once the order took one use of the coupon (checkout, re-open) – only then does cancelling give it back
    { name: "couponConsumed", type: "checkbox", defaultValue: false, access: { read: storeRoleField("store_staff"), create: () => false, update: () => false }, admin: { hidden: true } },
    { name: "couponReturned", type: "checkbox", defaultValue: false, access: { read: storeRoleField("store_staff"), create: () => false, update: () => false }, admin: { hidden: true } },
    { type: "row", fields: [
      // a built-in method ("cod", "bank", "card" …) or the store's own ("upi", "m-pesa") – lib/payments/methods.ts
      { name: "paymentMethod", type: "text", required: true, index: true, label: "Payment method", admin: { width: "50%", components: { Field: "/payload/admin/orders/PaymentMethodField#PaymentMethodField", Cell: "/payload/admin/orders/PaymentMethodField#PaymentMethodCell" } } },
      { name: "paymentStatus", type: "select", required: true, label: "Payment", options: [
        { label: "Not paid", value: "unpaid" },
        { label: "Payment to check", value: "awaiting-verification" },
        { label: "Paid", value: "paid" },
        { label: "Refunded", value: "refunded" },
        { label: "Advance paid", value: "partial" },
        { label: "Partly refunded", value: "partially-refunded" },
      ], admin: { width: "50%", components: { Cell: "/payload/admin/orders/Cells#OrderPaymentCell" } } },
    ] },
    { type: "row", fields: [
      { name: "paymentMethodLabel", type: "text", label: "Payment method name", admin: { width: "34%", readOnly: true, description: "As the customer saw it." } },
      { name: "paymentDue", type: "select", label: "Paid", options: [{ label: "Before shipping", value: "upfront" }, { label: "On delivery", value: "on-delivery" }], admin: { width: "33%", readOnly: true } },
      { name: "currency", type: "text", label: "Currency", admin: { width: "33%", readOnly: true, description: "Every amount on this order is in this currency." } },
    ] },
    // shown with "See screenshot" at the top of the order
    { name: "paymentScreenshotKey", type: "text", access: { read: storeRoleField("store_staff") }, admin: { hidden: true } },
    // the transaction id of a transfer / wallet payment, or the payment provider's id – one order per payment
    { name: "paymentReference", type: "text", index: true, label: "Payment reference", admin: { description: "Transaction id from the transfer / wallet receipt, or the online payment id." } },
    {
      name: "fulfillmentStatus",
      type: "select",
      index: true,
      label: "Shipping",
      defaultValue: "unfulfilled",
      options: [
        { label: "Not shipped", value: "unfulfilled" },
        { label: "Partly shipped", value: "partially_fulfilled" },
        { label: "On the way", value: "in_transit" },
        { label: "Delivered", value: "delivered" },
        { label: "Returned", value: "returned" },
        { label: "Cancelled", value: "cancelled" },
      ],
      access: { create: () => false, update: () => false },
      admin: { position: "sidebar", readOnly: true, description: "Follows the order status (separate from payment)." },
    },
    { type: "row", fields: [
      { name: "courier", type: "text", admin: { width: "50%" } },
      { name: "trackingNumber", type: "text", admin: { width: "50%" } },
    ] },
    {
      // made with "Ship items" on the order (part of an order can go first); read-only here
      name: "shipments",
      type: "array",
      label: "Shipments",
      access: { create: () => false, update: () => false },
      admin: { readOnly: true, initCollapsed: true, description: "Each parcel sent for this order, with its own courier and tracking number." },
      fields: [
        { name: "items", type: "json" },
        { type: "row", fields: [
          { name: "courier", type: "text", admin: { width: "34%" } },
          { name: "trackingNumber", type: "text", admin: { width: "33%" } },
          { name: "status", type: "select", defaultValue: "shipped", options: [{ label: "On the way", value: "shipped" }, { label: "Delivered", value: "delivered" }, { label: "Returned", value: "returned" }, { label: "Cancelled", value: "cancelled" }], admin: { width: "33%" } },
        ] },
        { type: "row", fields: [
          { name: "shippedAt", type: "date", admin: { width: "50%" } },
          { name: "deliveredAt", type: "date", admin: { width: "50%" } },
        ] },
        // booked through a courier integration (/cms → Integrations): its status, label and cash collected
        { type: "row", fields: [
          { name: "provider", type: "text", admin: { width: "25%", description: "Courier integration it was booked with." } },
          { name: "courierStatus", type: "text", admin: { width: "45%" } },
          { name: "lastTrackedAt", type: "date", admin: { width: "30%" } },
        ] },
        { type: "row", fields: [
          { name: "labelUrl", type: "text", admin: { width: "60%" } },
          { name: "courierRef", type: "text", admin: { width: "40%", description: "The courier's own id for this parcel." } },
        ] },
        { type: "row", fields: [
          { name: "codAmount", type: "number", min: 0, admin: { width: "25%", description: "Cash the courier collects." } },
          { name: "codStatus", type: "select", options: [{ label: "Not collected yet", value: "pending" }, { label: "Paid to you", value: "remitted" }], admin: { width: "25%" } },
          { name: "codRemittedAt", type: "date", admin: { width: "25%" } },
          { name: "codRemittanceRef", type: "text", admin: { width: "25%" } },
        ] },
      ],
    },
    { name: "customerNote", type: "textarea", label: "Note from the customer", admin: { readOnly: true } },
    { name: "marketingConsent", type: "checkbox", label: "Agreed to marketing emails", defaultValue: false, admin: { readOnly: true, description: "Ticked by the customer at checkout (for this store only)." } },
    { name: "notes", type: "textarea", access: { read: storeRoleField("store_staff") }, admin: { description: "Internal notes (never shown to the customer)." } },
    // shown as the Timeline at the top of the order (add notes there)
    { name: "history", type: "array", access: { read: storeRoleField("store_staff") }, admin: { hidden: true }, fields: [{ type: "row", fields: [
      { name: "status", type: "select", options: ORDER_STATUSES, required: true, admin: { width: "30%" } },
      { name: "at", type: "date", required: true, admin: { width: "35%", date: { pickerAppearance: "dayAndTime" } } },
      { name: "note", type: "text", admin: { width: "35%" } },
    ] }] },
    {
      name: "confirmation",
      type: "group",
      label: "Customer confirmation",
      // the code/link let a customer confirm a COD order – never readable through the customer's own API access
      access: { read: storeRoleField("store_staff") },
      admin: { position: "sidebar", condition: (d) => Boolean(d?.confirmation?.expiresAt) },
      fields: [
        { name: "token", type: "text", index: true, admin: { hidden: true } },
        { name: "code", type: "text", admin: { hidden: true } },
        { name: "expiresAt", type: "date", label: "Cancel if not confirmed by", admin: { readOnly: true, date: { pickerAppearance: "dayAndTime" } } },
        { name: "confirmedAt", type: "date", label: "Confirmed", admin: { readOnly: true, date: { pickerAppearance: "dayAndTime" } } },
        { name: "via", type: "text", label: "Confirmed by", admin: { readOnly: true } },
        { name: "failedAttempts", type: "number", defaultValue: 0, admin: { hidden: true } },
      ],
    },
    {
      name: "risk",
      access: { read: storeRoleField("store_staff") },
      type: "group",
      label: "Risk",
      admin: { position: "sidebar" },
      fields: [
        { name: "score", type: "number", admin: { readOnly: true } },
        { name: "level", type: "select", options: [
          { label: "Low", value: "low" },
          { label: "Some risk", value: "medium" },
          { label: "High risk", value: "high" },
        ], admin: { readOnly: true } },
        { name: "reasons", type: "text", admin: { readOnly: true } },
      ],
    },
    { name: "user", type: "relationship", relationTo: "users", label: "Customer account", admin: { position: "sidebar", description: "The customer record this order belongs to (set automatically from the email)." } },
    { name: "stockHeld", type: "checkbox", access: { read: storeRoleField("store_staff") }, admin: { hidden: true } },
    // one id per checkout attempt: a repeated submit (double click, retry) returns the same order instead of a second one
    { name: "attemptId", type: "text", unique: true, index: true, access: { read: storeRoleField("store_staff") }, admin: { hidden: true } },
    legacyIdField,
  ],
};

export const WholesaleInquiries: CollectionConfig = {
  slug: "wholesale-inquiries",
  dbName: dbName("wholesale-inquiries"),
  labels: { singular: "Wholesale inquiry", plural: "Wholesale inquiries" },
  admin: { useAsTitle: "name", group: "Sales", defaultColumns: ["name", "businessName", "city", "status", "receivedAt"] },
  access: storeAccess("store_staff"),
  hooks: { beforeValidate: [assignStore()] },
  fields: [
    storeField(),
    { type: "row", fields: [
      { name: "name", type: "text", required: true, admin: { width: "50%" } },
      { name: "businessName", type: "text", admin: { width: "50%" } },
    ] },
    { type: "row", fields: [
      { name: "phone", type: "text", required: true, admin: { width: "34%" } },
      { name: "email", type: "text", admin: { width: "33%" } },
      { name: "city", type: "text", required: true, admin: { width: "33%" } },
    ] },
    { name: "buyerType", type: "select", options: ["shop", "reseller", "corporate", "education", "individual", "other"] },
    { name: "items", type: "json" },
    { name: "message", type: "textarea" },
    { name: "budget", type: "text" },
    { name: "adminNotes", type: "textarea" },
    { name: "source", type: "text" },
    { name: "status", type: "select", defaultValue: "new", index: true, options: ["new", "contacted", "quoted", "won", "lost"], admin: { position: "sidebar" } },
    { name: "receivedAt", type: "date", index: true, admin: { position: "sidebar" } },
    legacyIdField,
  ],
};

export const ContactMessages: CollectionConfig = {
  slug: "contact-messages",
  dbName: dbName("contact-messages"),
  admin: { useAsTitle: "name", group: "Sales", defaultColumns: ["name", "subject", "handled", "receivedAt"] },
  access: storeAccess("store_staff"),
  hooks: { beforeValidate: [assignStore()] },
  fields: [
    storeField(),
    { type: "row", fields: [
      { name: "name", type: "text", required: true, admin: { width: "34%" } },
      { name: "phone", type: "text", admin: { width: "33%" } },
      { name: "email", type: "text", admin: { width: "33%" } },
    ] },
    { name: "subject", type: "text" },
    { name: "message", type: "textarea", required: true },
    { name: "handled", type: "checkbox", defaultValue: false, admin: { position: "sidebar" } },
    { name: "receivedAt", type: "date", admin: { position: "sidebar" } },
    legacyIdField,
  ],
};

