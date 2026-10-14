import { randomInt } from "node:crypto";
import type { CollectionBeforeChangeHook, CollectionConfig, Field, GlobalConfig } from "payload";
import { nobody, platformAdmins } from "../access";
import { assignStore, sameStore, storeAccess, storeField, storeIdOf } from "../tenancy";
import { dbName } from "../fields";
import { revalidate } from "../revalidate";
import { userError } from "../errors";
import { log } from "../../lib/log";

/**
 * Returns & warranty.
 * - Return requests: Requested → Approved / Rejected → Received → Inspected → Refunded / Replaced / Repaired.
 *   Refunding records method + amount, issues a credit note, and (optionally) puts the items back in stock.
 * - Warranty claims: tied to the serial number and the original order / shop sale; the warranty period is
 *   checked automatically from the sale date.
 * - Returns & warranty rules (editable) – used by the customer form and shown on /warranty-returns.
 */

const PKT = 5 * 3600e3;
const ymd = () => new Date(Date.now() + PKT).toISOString().slice(2, 10).replace(/-/g, "");
const ref = (prefix: string) => `${prefix}-${ymd()}-${randomInt(100000, 1000000)}`;
const relId = (v: unknown) => (v && typeof v === "object" ? (v as { id: number }).id : (v as number | null | undefined));

const photoField: Field = {
  name: "photoKeys",
  type: "json",
  label: "Customer photos",
  admin: { components: { Field: "/payload/admin/aftersales/Photos#Photos" } },
};

const historyField = (options: { label: string; value: string }[]): Field => ({
  name: "history",
  type: "array",
  label: "Timeline",
  admin: { readOnly: true, initCollapsed: true },
  fields: [
    { type: "row", fields: [
      { name: "status", type: "select", options, admin: { width: "30%" } },
      { name: "at", type: "date", admin: { width: "30%", date: { pickerAppearance: "dayAndTime" } } },
      { name: "note", type: "text", admin: { width: "40%" } },
    ] },
  ],
});

/** Status change → timeline entry (unless the caller already added one) */
const statusHistory: CollectionBeforeChangeHook = ({ data, originalDoc, operation }) => {
  if (operation === "create") return { ...data, history: data.history?.length ? data.history : [{ status: data.status, at: new Date().toISOString() }] };
  if (!data.status || data.status === originalDoc?.status) return data;
  const before = (originalDoc?.history as unknown[] | undefined) ?? [];
  const incoming = (data.history as unknown[] | undefined) ?? before;
  if (incoming.length === before.length) data.history = [...before, { status: data.status, at: new Date().toISOString() }];
  return data;
};

/* ───────────── settings ───────────── */

export const ReturnsPolicy: GlobalConfig = {
  slug: "returns-policy",
  dbName: dbName("returns-policy"),
  label: "Returns & warranty rules",
  admin: { group: "Settings", description: "Used by the return / warranty form on the website and shown on the Warranty & Returns page." },
  access: { read: () => true, update: platformAdmins },
  hooks: { afterChange: [({ doc }) => (revalidate(["settings"], ["/warranty-returns", "/returns"]), doc)] },
  fields: [
    {
      type: "collapsible",
      label: "Returns",
      fields: [
        { type: "row", fields: [
          { name: "returnDays", type: "number", min: 0, defaultValue: 3, label: "Days to ask for a return after delivery", admin: { width: "50%" } },
          { name: "restockingFeePercent", type: "number", min: 0, max: 50, defaultValue: 0, label: "Restocking fee for change of mind (%)", admin: { width: "50%" } },
        ] },
        { name: "requirePhotos", type: "checkbox", defaultValue: true, label: "Customers must add at least one photo" },
        {
          name: "reasons",
          type: "array",
          label: "Return reasons customers can pick",
          labels: { singular: "Reason", plural: "Reasons" },
          defaultValue: [
            { label: "Faulty / not working", changeOfMind: false },
            { label: "Damaged in delivery", changeOfMind: false },
            { label: "Wrong item sent", changeOfMind: false },
            { label: "Not as described", changeOfMind: false },
            { label: "Changed my mind", changeOfMind: true },
          ],
          fields: [{ type: "row", fields: [
            { name: "label", type: "text", required: true, admin: { width: "70%" } },
            { name: "changeOfMind", type: "checkbox", label: "Restocking fee applies", admin: { width: "30%", style: { alignSelf: "center" } } },
          ] }],
        },
        { name: "returnRules", type: "textarea", label: "Return rules (shown on the policy page, one per line)", defaultValue: "Items must be in the original box with all accessories.\nWrong, damaged or faulty items are replaced free of charge.\nRefunds are sent within 3–5 working days after we inspect the item." },
      ],
    },
    {
      type: "collapsible",
      label: "Warranty",
      fields: [
        { name: "warrantyRules", type: "textarea", label: "Warranty rules (shown on the policy page, one per line)", defaultValue: "Warranty covers hardware faults, not physical or liquid damage.\nKeep your receipt or order number.\nMost claims are resolved in 3–7 working days." },
        {
          name: "warrantyByCondition",
          type: "array",
          label: "Warranty by product type (table on the policy page; months are used when a product has none set)",
          labels: { singular: "Row", plural: "Rows" },
          defaultValue: [
            { type: "New (box packed)", condition: "new", months: 12, text: "Official brand / distributor warranty (usually 1 year)", where: "Brand service centre or via our store" },
            { type: "Open Box", condition: "open-box", months: 6, text: "Brand or shop warranty as stated on the product page", where: "Our Saddar shop" },
            { type: "Refurbished", condition: "refurbished", months: 6, text: "Up to 6 months shop warranty", where: "Our Saddar shop" },
            { type: "Used A+ / Used A", condition: "used-a-plus", months: 3, text: "1–3 months checking warranty", where: "Our Saddar shop" },
            { type: "Chargers, batteries, RAM, SSD", condition: "", months: 6, text: "1–12 months depending on product (shown on product page)", where: "Our Saddar shop" },
          ],
          fields: [
            { type: "row", fields: [
              { name: "type", type: "text", required: true, label: "Condition / product", admin: { width: "40%" } },
              { name: "condition", type: "select", options: [
                { label: "New", value: "new" },
                { label: "Used A+", value: "used-a-plus" },
                { label: "Used A", value: "used-a" },
                { label: "Refurbished", value: "refurbished" },
                { label: "Open Box", value: "open-box" },
              ], label: "Applies to condition", admin: { width: "35%" } },
              { name: "months", type: "number", min: 0, label: "Months", admin: { width: "25%" } },
            ] },
            { type: "row", fields: [
              { name: "text", type: "text", label: "Warranty (shown)", admin: { width: "60%" } },
              { name: "where", type: "text", label: "Claimed at", admin: { width: "40%" } },
            ] },
          ],
        },
      ],
    },
  ],
};

/* ───────────── return requests ───────────── */

export const RETURN_STATUSES = [
  { label: "Requested", value: "requested" },
  { label: "Approved – waiting for the item", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "Received", value: "received" },
  { label: "Inspected", value: "inspected" },
  { label: "Refunded", value: "refunded" },
  { label: "Replaced", value: "replaced" },
  { label: "Repaired", value: "repaired" },
];
const RETURN_DONE = new Set(["refunded", "replaced", "repaired"]);

type ReturnItem = { product?: unknown; qty?: number; serial?: string; unitPrice?: number };
type OrderDoc = { id: number; status?: string; stockHeld?: boolean; total?: number; paymentStatus?: string; items?: { product?: unknown; qty?: number }[] };

/**
 * Finishing a return: credit note number, stock back (if ticked), order marked Returned.
 * Stock is never put back twice: not when the order itself already gave it back (set to Returned / Cancelled),
 * and never more than the order had, across all returns for that order. Only a FULL return marks the order Returned.
 */
const returnResolution: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req }) => {
  // also when a return is entered already finished (e.g. created in /cms as Refunded)
  if (!data.status || !RETURN_DONE.has(String(data.status))) return data;
  if (operation === "update" && data.status === originalDoc?.status) return data;
  const notThis = originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : [];
  const requestNumber = String(data.requestNumber ?? originalDoc?.requestNumber ?? "");
  const items = ((data.items ?? originalDoc?.items) as ReturnItem[] | undefined) ?? [];
  const storeId = storeIdOf(data.store ?? originalDoc?.store);
  const inStore = storeId == null ? [] : [{ store: { equals: storeId } }];

  const orderId = relId(data.order ?? originalDoc?.order);
  const order = orderId ? ((await req.payload.findByID({ collection: "orders", id: orderId, depth: 0, overrideAccess: true, req }).catch(() => null)) as OrderDoc | null) : null;

  // refund can't be more than what was paid for the returned items – nor, with the order's earlier refunds, its total
  const refund = Number(data.refundAmount ?? originalDoc?.refundAmount) || 0;
  const paidForItems = items.reduce((s, i) => s + (Number(i.unitPrice) || 0) * (Number(i.qty) || 1), 0);
  if (data.status === "refunded" && paidForItems > 0 && refund > paidForItems)
    throw userError(`The refund (Rs ${refund.toLocaleString("en-PK")}) is more than was paid for these items (Rs ${paidForItems.toLocaleString("en-PK")}).`, 400);
  let refundedBefore = 0;
  if (data.status === "refunded" && order) {
    const earlierRefunds = await req.payload.find({ collection: "return-requests", where: { and: [{ order: { equals: order.id } }, { status: { equals: "refunded" } }, ...notThis] }, limit: 100, depth: 0, overrideAccess: true, req });
    refundedBefore = (earlierRefunds.docs as { refundAmount?: number }[]).reduce((s, r) => s + (Number(r.refundAmount) || 0), 0);
    const total = Number(order.total) || 0;
    if (refundedBefore + refund > total)
      throw userError(`Refunds for this order would come to Rs ${(refundedBefore + refund).toLocaleString("en-PK")} – more than its total (Rs ${total.toLocaleString("en-PK")}). Already refunded: Rs ${refundedBefore.toLocaleString("en-PK")}.`, 400);
  }

  if (data.status === "refunded" && !(originalDoc?.creditNoteNumber || data.creditNoteNumber)) {
    data.creditNoteNumber = ref("CN");
    data.creditNoteDate = new Date().toISOString();
  }
  const orderGaveStockBack = Boolean(order && (order.stockHeld === false || ["cancelled", "refused", "returned"].includes(String(order.status))));

  // a shop-counter return: the sale its receipt number belongs to (to check serial numbers against)
  let saleIdCache: number | null | undefined;
  const posSaleId = async () => {
    if (saleIdCache !== undefined) return saleIdCache;
    const receipt = String(data.orderNumber ?? originalDoc?.orderNumber ?? "");
    saleIdCache = !order && receipt.startsWith("POS-") ? (((await req.payload.find({ collection: "pos-sales", where: { and: [{ receiptNumber: { equals: receipt } }, ...inStore] }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0] as { id?: number } | undefined)?.id ?? null) : null;
    return saleIdCache;
  };
  type Unit = { id: number; status?: string; order?: unknown; sale?: unknown };
  const unitOf = async (serial: string) => (await req.payload.find({ collection: "units", where: { and: [{ serial: { equals: serial } }, ...inStore] }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0] as Unit | undefined;
  const belongsHere = async (unit: Unit) => {
    if (order) return relId(unit.order) === Number(order.id);
    const saleId = await posSaleId();
    return saleId != null && relId(unit.sale) === saleId;
  };

  const restock = data.restock ?? originalDoc?.restock;
  if (restock && !originalDoc?.restocked) {
    if (orderGaveStockBack) {
      data.restocked = true; // the order already put these items back
    } else {
      const { putBackStock, setStockLog } = await import("../stock");
      setStockLog(req, { reason: "return", ref: requestNumber });
      // how many of each product earlier returns of this order already put back
      const earlier = new Map<number, number>();
      // a shop-counter return is checked against its receipt the same way an order return is checked against the order
      const saleId = order ? null : await posSaleId();
      const sale = saleId ? ((await req.payload.findByID({ collection: "pos-sales", id: saleId, depth: 0, overrideAccess: true, req }).catch(() => null)) as { items?: { product?: unknown; qty?: number }[] } | null) : null;
      const sameSource = orderId ? [{ order: { equals: orderId } }] : sale ? [{ orderNumber: { equals: String(data.orderNumber ?? originalDoc?.orderNumber ?? "") } }, ...inStore] : null;
      if (sameSource) {
        const others = await req.payload.find({ collection: "return-requests", where: { and: [...sameSource, { restocked: { equals: true } }, ...notThis] }, limit: 50, depth: 0, overrideAccess: true, req });
        for (const r of others.docs as unknown as { items?: ReturnItem[] }[]) for (const i of r.items ?? []) {
          const pid = relId(i.product);
          if (pid) earlier.set(pid, (earlier.get(pid) ?? 0) + (Number(i.qty) || 1));
        }
      }
      const ordered = new Map<number, number>();
      for (const l of order?.items ?? sale?.items ?? []) {
        const pid = relId(l.product);
        if (pid) ordered.set(pid, (ordered.get(pid) ?? 0) + (Number(l.qty) || 0));
      }
      for (const i of items) {
        const productId = relId(i.product);
        if (i.serial) {
          // the unit goes back on the shelf (only if it really left it, and only if it is THIS order's / sale's laptop);
          // its product's stock is recounted
          const unit = await unitOf(i.serial);
          const belongs = unit && (await belongsHere(unit));
          if (unit && unit.status !== "in-stock" && belongs) await req.payload.update({ collection: "units", id: unit.id, data: { status: "in-stock", order: null, sale: null, soldAt: null } as never, overrideAccess: true, req });
          else if (unit && unit.status !== "in-stock") log.warn("returns.serial_not_restocked", { serial: i.serial, return: requestNumber });
        } else if (productId) {
          let qty = Number(i.qty) || 1;
          if (order || sale) qty = Math.min(qty, Math.max(0, (ordered.get(productId) ?? 0) - (earlier.get(productId) ?? 0)));
          if (qty > 0) await putBackStock(req.payload, productId, qty, req);
          earlier.set(productId, (earlier.get(productId) ?? 0) + qty);
        }
      }
      data.restocked = true;
      revalidate(["catalog"]);
    }
  } else if (!restock && (data.status === "refunded" || data.status === "replaced")) {
    // came back but not for sale (e.g. faulty): the laptop is with us again – "Returned", no longer "Sold"
    for (const i of items) {
      if (!i.serial) continue;
      const unit = await unitOf(i.serial);
      if (unit && (unit.status === "sold" || unit.status === "reserved") && (await belongsHere(unit)))
        await req.payload.update({ collection: "units", id: unit.id, data: { status: "returned" } as never, overrideAccess: true, req });
    }
  }

  // keep the order in step (without putting stock back a second time): Returned only when everything came back
  if (order && data.status !== "repaired" && order.status === "delivered") {
    const back = new Map<number, number>();
    const all = await req.payload.find({ collection: "return-requests", where: { and: [{ order: { equals: order.id } }, { status: { in: ["refunded", "replaced"] } }, ...notThis] }, limit: 50, depth: 0, overrideAccess: true, req });
    for (const r of [...(all.docs as unknown as { items?: ReturnItem[] }[]), { items }]) for (const i of r.items ?? []) {
      const pid = relId(i.product);
      if (pid) back.set(pid, (back.get(pid) ?? 0) + (Number(i.qty) || 1));
    }
    const full = (order.items ?? []).every((l) => {
      const pid = relId(l.product);
      return !pid || (back.get(pid) ?? 0) >= (Number(l.qty) || 0);
    });
    const note = `${full ? "Returned" : "Partly returned"} – return ${requestNumber}`.trim();
    // everything paid has been refunded → the order's payment says so too
    const fullyRefunded = data.status === "refunded" && refundedBefore + refund >= (Number(order.total) || 0) && ["paid", "partial"].includes(String(order.paymentStatus));
    await req.payload.update({
      collection: "orders",
      id: order.id,
      data: {
        ...(full ? { status: "returned", stockHeld: false, history: [{ status: "returned", at: new Date().toISOString(), note }] } : { history: [{ status: "delivered", at: new Date().toISOString(), note }] }),
        ...(fullyRefunded ? { paymentStatus: "refunded" } : {}),
      } as never,
      overrideAccess: true,
      req,
      context: { skipStock: true, skipNotify: true, system: true },
    });
  } else if (order && data.status === "refunded" && refundedBefore + refund >= (Number(order.total) || 0) && ["paid", "partial"].includes(String(order.paymentStatus))) {
    await req.payload.update({ collection: "orders", id: order.id, data: { paymentStatus: "refunded" } as never, overrideAccess: true, req, context: { skipStock: true, skipNotify: true, system: true } });
  }
  return data;
};

const itemsField: Field = {
  name: "items",
  type: "array",
  fields: [
    { type: "row", fields: [
      { name: "product", type: "relationship", relationTo: "products", filterOptions: sameStore, admin: { width: "40%" } },
      { name: "title", type: "text", required: true, admin: { width: "60%" } },
    ] },
    { type: "row", fields: [
      { name: "qty", type: "number", defaultValue: 1, min: 1, admin: { width: "30%" } },
      { name: "unitPrice", type: "number", min: 0, label: "Price paid (Rs)", admin: { width: "35%" } },
      { name: "serial", type: "text", label: "Serial number", admin: { width: "35%" } },
    ] },
  ],
};

const customerFields: Field[] = [
  { type: "row", fields: [
    { name: "customerName", type: "text", required: true, label: "Customer", admin: { width: "50%" } },
    { name: "customerPhone", type: "text", required: true, index: true, label: "Phone", admin: { width: "50%" } },
  ] },
];

export const ReturnRequests: CollectionConfig = {
  slug: "return-requests",
  dbName: dbName("return-requests"),
  labels: { singular: "Return", plural: "Returns" },
  admin: {
    useAsTitle: "requestNumber",
    group: "Sales",
    defaultColumns: ["requestNumber", "customerName", "status", "reason", "createdAt"],
    listSearchableFields: ["requestNumber", "customerName", "customerPhone", "orderNumber"],
    components: {
      beforeListTable: [
        {
          path: "/payload/admin/ui/ListTabs#ListTabs",
          clientProps: {
            label: "Return views",
            tabs: [
              { label: "All", where: "" },
              { label: "New", where: "where[status][equals]=requested" },
              { label: "Waiting for item", where: "where[status][equals]=approved" },
              { label: "To inspect", where: "where[status][equals]=received" },
              { label: "To finish", where: "where[status][equals]=inspected" },
              { label: "Done", where: "where[status][in][0]=refunded&where[status][in][1]=replaced&where[status][in][2]=repaired" },
              { label: "Rejected", where: "where[status][equals]=rejected" },
            ],
          },
        },
      ],
    },
  },
  access: { ...storeAccess("store_staff"), delete: nobody },
  hooks: {
    beforeValidate: [assignStore()],
    beforeChange: [({ data, operation }) => (operation === "create" && !data.requestNumber ? { ...data, requestNumber: ref("RET") } : data), statusHistory, returnResolution],
  },
  fields: [
    storeField(),
    { name: "panel", type: "ui", admin: { components: { Field: { path: "/payload/admin/aftersales/AfterSalesPanel#AfterSalesPanel", clientProps: { kind: "return" } } } } },
    { type: "row", fields: [
      { name: "requestNumber", type: "text", unique: true, index: true, label: "Return number", admin: { width: "34%", readOnly: true } },
      { name: "status", type: "select", required: true, defaultValue: "requested", index: true, options: RETURN_STATUSES, admin: { width: "33%" } },
      { name: "orderNumber", type: "text", index: true, admin: { width: "33%" } },
    ] },
    { name: "order", type: "relationship", relationTo: "orders", filterOptions: sameStore },
    ...customerFields,
    itemsField,
    { type: "row", fields: [
      { name: "reason", type: "text", required: true, admin: { width: "50%" } },
      { name: "changeOfMind", type: "checkbox", label: "Change of mind (restocking fee)", admin: { width: "50%", style: { alignSelf: "center" } } },
    ] },
    { name: "details", type: "textarea", label: "What the customer said" },
    photoField,
    { name: "rejectionReason", type: "text", label: "Why rejected (the customer is told)", admin: { condition: (d) => d?.status === "rejected" } },
    { name: "inspectionNotes", type: "textarea", label: "Inspection notes" },
    {
      type: "collapsible",
      label: "Refund / credit note",
      fields: [
        { type: "row", fields: [
          { name: "refundMethod", type: "select", label: "Refund method", options: [
            { label: "Cash", value: "cash" },
            { label: "Bank transfer", value: "bank" },
            { label: "JazzCash", value: "jazzcash" },
            { label: "EasyPaisa", value: "easypaisa" },
            { label: "Store credit", value: "credit" },
          ], admin: { width: "50%" } },
          { name: "refundAmount", type: "number", min: 0, label: "Refund amount (Rs)", admin: { width: "50%" } },
        ] },
        { type: "row", fields: [
          { name: "restock", type: "checkbox", label: "Put the items back in stock", admin: { width: "50%", style: { alignSelf: "center" } } },
          { name: "restocked", type: "checkbox", label: "Back in stock", admin: { width: "50%", readOnly: true, style: { alignSelf: "center" } } },
        ] },
        { type: "row", fields: [
          { name: "creditNoteNumber", type: "text", label: "Credit note", admin: { width: "50%", readOnly: true } },
          { name: "creditNoteDate", type: "date", label: "Credit note date", admin: { width: "50%", readOnly: true } },
        ] },
      ],
    },
    { name: "notes", type: "textarea", label: "Team notes", admin: { position: "sidebar" } },
    historyField(RETURN_STATUSES),
  ],
};

/* ───────────── warranty claims ───────────── */

export const WARRANTY_STATUSES = [
  { label: "Open", value: "open" },
  { label: "Item received", value: "received" },
  { label: "In repair", value: "in-repair" },
  { label: "Repaired", value: "repaired" },
  { label: "Replaced", value: "replaced" },
  { label: "Rejected (not covered)", value: "rejected" },
  { label: "Returned to customer", value: "returned" },
];

/** Fill in sale date, warranty months and end date from the serial / order, and say if it's still covered. */
const checkWarranty: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req }) => {
  if (operation === "create" && !data.claimNumber) data.claimNumber = ref("WAR");
  const serial = String(data.serial ?? originalDoc?.serial ?? "").trim();
  const recalc = operation === "create" || (serial && serial !== originalDoc?.serial) || data.recheck;
  if (!recalc) return data;
  data.recheck = false;
  const { warrantyFor } = await import("../warranty");
  const w = await warrantyFor(req.payload, { storeId: storeIdOf(data.store ?? originalDoc?.store), serial, orderNumber: String(data.orderNumber ?? originalDoc?.orderNumber ?? ""), productId: relId(data.product ?? originalDoc?.product) ?? null }, req);
  Object.assign(data, w.fields);
  return data;
};

/** Units being repaired show "In repair" in stock lists */
const unitRepairStatus: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req }) => {
  if (operation !== "update" || data.status === originalDoc?.status) return data;
  const unitId = relId(data.unit ?? originalDoc?.unit);
  if (!unitId) return data;
  const unit = (await req.payload.findByID({ collection: "units", id: unitId, depth: 0, overrideAccess: true, req }).catch(() => null)) as { status?: string } | null;
  if (!unit) return data;
  if (data.status === "in-repair" && unit.status === "sold") await req.payload.update({ collection: "units", id: unitId, data: { status: "in-repair" } as never, overrideAccess: true, req });
  if (["repaired", "returned", "rejected"].includes(String(data.status)) && unit.status === "in-repair")
    await req.payload.update({ collection: "units", id: unitId, data: { status: "sold" } as never, overrideAccess: true, req });
  return data;
};

export const WarrantyClaims: CollectionConfig = {
  slug: "warranty-claims",
  dbName: dbName("warranty-claims"),
  labels: { singular: "Warranty claim", plural: "Warranty claims" },
  admin: {
    useAsTitle: "claimNumber",
    group: "Sales",
    defaultColumns: ["claimNumber", "customerName", "serial", "inWarranty", "status", "createdAt"],
    listSearchableFields: ["claimNumber", "customerName", "customerPhone", "serial", "orderNumber"],
    components: {
      beforeListTable: [
        {
          path: "/payload/admin/ui/ListTabs#ListTabs",
          clientProps: {
            label: "Claim views",
            tabs: [
              { label: "All", where: "" },
              { label: "Open", where: "where[status][equals]=open" },
              { label: "Received", where: "where[status][equals]=received" },
              { label: "In repair", where: "where[status][equals]=in-repair" },
              { label: "Done", where: "where[status][in][0]=repaired&where[status][in][1]=replaced&where[status][in][2]=returned" },
              { label: "Not covered", where: "where[status][equals]=rejected" },
            ],
          },
        },
      ],
    },
  },
  access: storeAccess("store_staff"),
  hooks: { beforeValidate: [assignStore()], beforeChange: [checkWarranty, statusHistory, unitRepairStatus] },
  fields: [
    storeField(),
    { name: "panel", type: "ui", admin: { components: { Field: { path: "/payload/admin/aftersales/AfterSalesPanel#AfterSalesPanel", clientProps: { kind: "warranty" } } } } },
    { type: "row", fields: [
      { name: "claimNumber", type: "text", unique: true, index: true, label: "Claim number", admin: { width: "34%", readOnly: true } },
      { name: "status", type: "select", required: true, defaultValue: "open", index: true, options: WARRANTY_STATUSES, admin: { width: "33%" } },
      { name: "serial", type: "text", index: true, label: "Serial number", admin: { width: "33%" } },
    ] },
    { type: "row", fields: [
      { name: "orderNumber", type: "text", index: true, label: "Order / receipt number", admin: { width: "50%" } },
      { name: "product", type: "relationship", relationTo: "products", filterOptions: sameStore, admin: { width: "50%" } },
    ] },
    ...customerFields,
    { name: "issue", type: "textarea", required: true, label: "Problem" },
    photoField,
    {
      type: "collapsible",
      label: "Warranty check (automatic)",
      fields: [
        { type: "row", fields: [
          { name: "inWarranty", type: "select", label: "Covered?", options: [
            { label: "Yes – in warranty", value: "yes" },
            { label: "No – warranty ended", value: "no" },
            { label: "Couldn't check", value: "unknown" },
          ], admin: { width: "34%", readOnly: true } },
          { name: "purchasedAt", type: "date", label: "Bought on", admin: { width: "33%", readOnly: true } },
          { name: "warrantyEndsAt", type: "date", label: "Warranty ends", admin: { width: "33%", readOnly: true } },
        ] },
        { type: "row", fields: [
          { name: "warrantyMonths", type: "number", label: "Warranty (months)", admin: { width: "34%", readOnly: true } },
          { name: "checkNote", type: "text", label: "How we checked", admin: { width: "66%", readOnly: true } },
        ] },
        { name: "recheck", type: "checkbox", label: "Check again when I save" },
      ],
    },
    { name: "unit", type: "relationship", relationTo: "units", filterOptions: sameStore, admin: { position: "sidebar", readOnly: true } },
    { name: "order", type: "relationship", relationTo: "orders", filterOptions: sameStore, admin: { position: "sidebar", readOnly: true } },
    { name: "sale", type: "relationship", relationTo: "pos-sales", filterOptions: sameStore, label: "Shop sale", admin: { position: "sidebar", readOnly: true } },
    { name: "resolution", type: "textarea", label: "What we did" },
    { name: "notes", type: "textarea", label: "Team notes", admin: { position: "sidebar" } },
    historyField(WARRANTY_STATUSES),
  ],
};
