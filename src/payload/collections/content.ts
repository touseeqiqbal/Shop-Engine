import type { CollectionAfterChangeHook, CollectionBeforeChangeHook, CollectionBeforeDeleteHook, CollectionConfig } from "payload";
import { after } from "next/server";
import { PROCEED_STATUSES, paymentBlocksShipping } from "../../lib/order-money";
import { isStaffUser, managers, ownerField, staff, staffField, staffOrOwnDocs } from "../access";
import { dbName, legacyIdField, slugField } from "../fields";
import { revalidate } from "../revalidate";
import { slugRedirect } from "../slug-redirects";
import { log } from "../../lib/log";
import { userError } from "../errors";

export const Posts: CollectionConfig = {
  slug: "posts",
  dbName: dbName("posts"),
  labels: { singular: "Blog post", plural: "Blog posts" },
  admin: { useAsTitle: "title", group: "Content", defaultColumns: ["title", "category", "publishedAt", "_status"] },
  access: {
    read: ({ req }) => (isStaffUser(req.user as never) ? true : { _status: { equals: "published" } }),
    readVersions: staff,
    create: staff,
    update: staff,
    delete: managers,
  },
  versions: { drafts: { schedulePublish: true }, maxPerDoc: 50 },
  hooks: {
    // "Last edited" moves only when an editor saves the post in /cms (not on imports)
    beforeChange: [({ data, context, operation }) => (context?.migrating || operation === "create" ? data : { ...data, lastEdited: new Date().toISOString(), editedInCms: true })],
    afterChange: [slugRedirect("posts"), ({ doc, previousDoc }) => (revalidate(["content"], ["/blog", "/sitemap.xml", "/llms.txt", `/blog/${doc.slug}`, ...(previousDoc?.slug && previousDoc.slug !== doc.slug ? [`/blog/${previousDoc.slug}`] : [])]), doc)],
    afterDelete: [({ doc }) => (revalidate(["content"], ["/blog", "/sitemap.xml", `/blog/${doc.slug}`]), doc)],
  },
  fields: [
    { name: "title", type: "text", required: true },
    { name: "excerpt", type: "textarea" },
    { name: "cover", type: "upload", relationTo: "media" },
    { name: "content", type: "richText" },
    { name: "relatedProducts", type: "relationship", relationTo: "products", hasMany: true },
    { name: "relatedCategories", type: "relationship", relationTo: "categories", hasMany: true },
    slugField("title"),
    { name: "category", type: "text", admin: { position: "sidebar" } },
    { name: "tags", type: "text", hasMany: true, admin: { position: "sidebar" } },
    { name: "author", type: "text", defaultValue: "Urko Tech Team", admin: { position: "sidebar" } },
    { name: "publishedAt", type: "date", admin: { position: "sidebar", date: { pickerAppearance: "dayAndTime" } } },
    { name: "lastEdited", type: "date", admin: { position: "sidebar", readOnly: true, description: "Shown as “Updated” on the post.", date: { pickerAppearance: "dayAndTime" } } },
    { name: "editedInCms", type: "checkbox", admin: { hidden: true } },
    legacyIdField,
  ],
};

const ORDER_STATUSES = [
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

type OrderLine = { product?: number | { id: number } | null; qty?: number; title?: string };
const orderLines = (items: unknown) =>
  ((Array.isArray(items) ? items : []) as OrderLine[])
    .map((i) => ({ productId: Number(i.product && typeof i.product === "object" ? i.product.id : i.product), qty: Number(i.qty) || 0, title: i.title }))
    .filter((l) => Number.isFinite(l.productId) && l.productId > 0 && l.qty > 0);

type Line = { productId: number; qty: number; title?: string };
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
  if (operation === "update" && expect && originalDoc?.id) {
    // lock the row: a second change arriving at the same moment waits here, then sees the new status
    const { lockOrderStatus } = await import("../stock");
    const current = req.transactionID ? await lockOrderStatus(req.payload, Number(originalDoc.id), req) : prevStatus;
    if (current !== expect) throw userError(`This order was changed meanwhile – it is now “${current}”. Reload the page and check it again.`, 409);
  }

  if (operation === "update" && data.paymentStatus === "unpaid" && originalDoc?.paymentStatus === "awaiting-verification") data.advancePaid = null;
  const approvingAdvance = operation === "update" && data.paymentStatus === "partial" && originalDoc?.paymentStatus !== "partial" && prevStatus === "awaiting-confirmation" && (!data.status || data.status === prevStatus);
  const advanceConfirms = approvingAdvance
    ? ((await req.payload.findGlobal({ slug: "order-protection" as never, depth: 0, overrideAccess: true, req }).catch(() => ({}))) as { skipWithAdvance?: boolean }).skipWithAdvance !== false
    : false;
  if (advanceConfirms) {
    data.status = "pending";
    data.confirmation = { ...(originalDoc?.confirmation ?? {}), ...(data.confirmation ?? {}), confirmedAt: new Date().toISOString(), via: "advance payment verified" };
  }

  const status = String(data.status ?? prevStatus ?? "pending");
  // taking a finished order back (Delivered → anything but Returned, or out of Returned) undoes stock and sales –
  // owners and managers only, so it can't happen by a slip of the status menu
  const role = (req.user as { role?: string } | null)?.role;
  const undoesFinished = operation === "update" && status !== prevStatus && ((prevStatus === "delivered" && status !== "returned") || prevStatus === "returned");
  if (undoesFinished && role && !["owner", "manager"].includes(role))
    throw userError(
      prevStatus === "delivered"
        ? "Only an owner or manager can move a delivered order back. If the customer sent something back, record it in Orders → Returns."
        : "Only an owner or manager can re-open a returned order.",
      403,
    );
  const money = { paymentMethod: data.paymentMethod ?? originalDoc?.paymentMethod, paymentStatus: data.paymentStatus ?? originalDoc?.paymentStatus };
  if ((operation === "create" || status !== prevStatus) && PROCEED_STATUSES.has(status) && paymentBlocksShipping(money))
    throw userError("Check the online payment first: approve it (payment “Paid”) – or change the payment method to cash on delivery – before confirming or shipping this order.", 400);
  return data;
};

/** Read-only, calculated totals: a new order typed in /cms has none yet – orderTotals fills them in (no DB default needed). */
const calculatedLater = ({ value }: { value?: unknown }) => value ?? 0;

/** Items picked in /cms: the product's web address, slug and first photo are filled in (the customer's account page uses them). */
const orderItemDetails: CollectionBeforeChangeHook = async ({ data, context, req }) => {
  if (context?.migrating || context?.fromStorefront || !Array.isArray(data.items)) return data;
  for (const item of data.items as { product?: unknown; slug?: string | null; url?: string | null; image?: string | null }[]) {
    const id = item.product && typeof item.product === "object" ? (item.product as { id?: number }).id : item.product;
    if (!id || (item.url && item.slug && item.image)) continue;
    const p = (await req.payload.findByID({ collection: "products", id: Number(id), depth: 1, overrideAccess: true, req }).catch(() => null)) as { slug?: string; category?: unknown; images?: { url?: string }[] } | null;
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
  }
  return data;
};

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
  data.subtotal = Math.round(subtotal);
  data.total = Math.max(0, Math.round(subtotal - Math.max(0, Number(discount) || 0) + Math.max(0, Number(delivery) || 0)));
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
    const short = await takeStockForLines(req.payload, lines, req);
    if (short.length) throw userError(`Not enough stock for: ${short.join(", ")}`, 409);
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
      // a cancelled / refused order gives its coupon use back
      if (status !== "returned" && originalDoc?.couponCode) await releaseCoupon(req.payload, String(originalDoc.couponCode), req);
      data.stockHeld = false;
      changed = true;
    } else if (statusChanged && !RELEASED.has(status) && !held) {
      setStockLog(req, { reason: "order-reopened", ref });
      const short = await takeStockForLines(req.payload, newLines, req);
      if (short.length) throw userError(`Cannot re-open – not enough stock for: ${short.join(", ")}`, 409);
      const coupon = originalDoc?.couponCode ? String(originalDoc.couponCode) : "";
      if (coupon && originalDoc?.status !== "returned") {
        const { consumeCoupon } = await import("../stock");
        if (!(await consumeCoupon(req.payload, coupon, req)))
          throw userError(`Cannot re-open – the coupon ${coupon} has no uses left (or has expired). Remove the coupon and its discount from the order first.`, 409);
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
        const short = await takeStockForLines(req.payload, more, req);
        if (short.length) throw userError(`Not enough stock for: ${short.join(", ")}`, 409);
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

/** Status change made in /cms → email / WhatsApp / SMS to the customer – sent after the change is saved. */
const orderStatusNotify: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, context }) => {
  if (operation !== "update" || context?.migrating || context?.skipNotify || doc.status === previousDoc?.status) return doc;
  const send = async () => {
    try {
      const [{ notifyOrderStatusChange }, { toOrder }] = await Promise.all([import("../../lib/notify"), import("../../lib/cms/sales")]);
      await notifyOrderStatusChange(toOrder(doc));
    } catch (e) {
      log.error("orders.status_notification_failed", e);
    }
  };
  try {
    after(send); // after the response = after the database commit
  } catch {
    void send(); // outside a Next.js request (scripts, jobs)
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
  access: { read: staffOrOwnDocs("user"), create: staff, update: staff, delete: managers },
  hooks: {
    beforeChange: [orderGuards, orderItemDetails, orderTotals, orderStatusHistory, orderStock],
    afterChange: [orderUnits, orderCosts, orderAudit, orderStatusNotify],
    beforeDelete: [orderDeleteStock],
  },
  fields: [
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
      ],
    },
    {
      name: "items",
      type: "array",
      fields: [
        { type: "row", fields: [
          { name: "product", type: "relationship", relationTo: "products", admin: { width: "40%" } },
          { name: "title", type: "text", required: true, admin: { width: "60%" } },
        ] },
        { name: "productLegacyId", type: "text", admin: { hidden: true } },
        { type: "row", fields: [
          { name: "unitPrice", type: "number", required: true, label: "Price each (Rs)", admin: { width: "50%" } },
          { name: "qty", type: "number", required: true, label: "Quantity", admin: { width: "50%" } },
        ] },
        // filled in from the product (orderItemDetails) – nothing to type
        { name: "slug", type: "text", admin: { hidden: true } },
        { name: "url", type: "text", admin: { hidden: true } },
        { name: "image", type: "text", admin: { hidden: true } },
        { name: "upgrades", type: "json", admin: { components: { Field: "/payload/admin/orders/UpgradesField#UpgradesField" } } },
        { name: "unitCost", type: "number", label: "Cost each (Rs)", access: { read: ownerField, create: () => false, update: () => false }, admin: { readOnly: true, description: "Your cost when it was sold (owners only) – used by the profit report." } },
      ],
    },
    { type: "row", fields: [
      { name: "subtotal", type: "number", required: true, label: "Items (Rs)", hooks: { beforeValidate: [calculatedLater] }, admin: { width: "20%", readOnly: true, description: "Calculated" } },
      { name: "discount", type: "number", defaultValue: 0, label: "Discount (Rs)", admin: { width: "20%" } },
      { name: "deliveryCharge", type: "number", defaultValue: 0, label: "Delivery (Rs)", admin: { width: "20%" } },
      { name: "total", type: "number", required: true, label: "Total (Rs)", hooks: { beforeValidate: [calculatedLater] }, admin: { width: "20%", readOnly: true, description: "Calculated", components: { Cell: "/payload/admin/orders/Cells#OrderTotalCell" } } },
      { name: "advancePaid", type: "number", label: "Advance paid (Rs)", admin: { width: "20%" } },
    ] },
    { name: "couponCode", type: "text", label: "Coupon code" },
    { type: "row", fields: [
      { name: "paymentMethod", type: "select", required: true, label: "Payment method", options: [
        { label: "Cash on delivery", value: "cod" },
        { label: "JazzCash", value: "jazzcash" },
        { label: "EasyPaisa", value: "easypaisa" },
        { label: "Bank transfer", value: "bank" },
        { label: "Card", value: "card" },
      ], admin: { width: "50%" } },
      { name: "paymentStatus", type: "select", required: true, label: "Payment", options: [
        { label: "Not paid", value: "unpaid" },
        { label: "Payment to check", value: "awaiting-verification" },
        { label: "Paid", value: "paid" },
        { label: "Refunded", value: "refunded" },
        { label: "Advance paid", value: "partial" },
      ], admin: { width: "50%", components: { Cell: "/payload/admin/orders/Cells#OrderPaymentCell" } } },
    ] },
    // shown with "See screenshot" at the top of the order
    { name: "paymentScreenshotKey", type: "text", access: { read: staffField }, admin: { hidden: true } },
    { type: "row", fields: [
      { name: "courier", type: "text", admin: { width: "50%" } },
      { name: "trackingNumber", type: "text", admin: { width: "50%" } },
    ] },
    { name: "notes", type: "textarea", access: { read: staffField }, admin: { description: "Internal notes." } },
    // shown as the Timeline at the top of the order (add notes there)
    { name: "history", type: "array", access: { read: staffField }, admin: { hidden: true }, fields: [{ type: "row", fields: [
      { name: "status", type: "select", options: ORDER_STATUSES, required: true, admin: { width: "30%" } },
      { name: "at", type: "date", required: true, admin: { width: "35%", date: { pickerAppearance: "dayAndTime" } } },
      { name: "note", type: "text", admin: { width: "35%" } },
    ] }] },
    {
      name: "confirmation",
      type: "group",
      label: "Customer confirmation",
      // the code/link let a customer confirm a COD order – never readable through the customer's own API access
      access: { read: staffField },
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
      access: { read: staffField },
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
    { name: "stockHeld", type: "checkbox", access: { read: staffField }, admin: { hidden: true } },
    // one id per checkout attempt: a repeated submit (double click, retry) returns the same order instead of a second one
    { name: "attemptId", type: "text", unique: true, index: true, access: { read: staffField }, admin: { hidden: true } },
    legacyIdField,
  ],
};

export const WholesaleInquiries: CollectionConfig = {
  slug: "wholesale-inquiries",
  dbName: dbName("wholesale-inquiries"),
  labels: { singular: "Wholesale inquiry", plural: "Wholesale inquiries" },
  admin: { useAsTitle: "name", group: "Sales", defaultColumns: ["name", "businessName", "city", "status", "receivedAt"] },
  access: { read: staff, create: staff, update: staff, delete: managers },
  fields: [
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
  access: { read: staff, create: staff, update: staff, delete: managers },
  fields: [
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

