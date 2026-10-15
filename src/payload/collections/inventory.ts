import type { CollectionBeforeChangeHook, CollectionConfig } from "payload";
import { assignStore, getTenant, hasStoreRole, readFor, sameStore, storeAccess, storeField, storeIdOf, storeRoleField } from "../tenancy";
import { dbName } from "../fields";
import { revalidate } from "../revalidate";
import { userError } from "../errors";

/**
 * Inventory:
 * - Suppliers.
 * - Purchases (incoming stock): when marked Received, plain products get the quantity added to stock and
 *   serial-tracked laptops get one unit per serial number (In stock, with cost and supplier); optionally the
 *   product's cost price is updated.
 * - Stock counts: done from Products → Stock count (/cms/stock-count); the variance report lives here.
 */

const relId = (v: unknown) => (v && typeof v === "object" ? (v as { id: number }).id : (v as number | null | undefined));

export const Suppliers: CollectionConfig = {
  slug: "suppliers",
  dbName: dbName("suppliers"),
  admin: { useAsTitle: "name", group: "Catalog", defaultColumns: ["name", "phone", "city", "updatedAt"] },
  access: storeAccess("store_staff"),
  hooks: { beforeValidate: [assignStore()] },
  fields: [
    storeField(),
    { name: "name", type: "text", required: true },
    { type: "row", fields: [
      { name: "contactPerson", type: "text", admin: { width: "34%" } },
      { name: "phone", type: "text", admin: { width: "33%" } },
      { name: "email", type: "text", admin: { width: "33%" } },
    ] },
    { type: "row", fields: [
      { name: "city", type: "text", admin: { width: "34%" } },
      { name: "address", type: "text", admin: { width: "66%" } },
    ] },
    { name: "notes", type: "textarea" },
  ],
};

type Line = { product?: unknown; qty?: number; unitCost?: number; serials?: string };
const serialList = (s?: string) =>
  [...new Set((s ?? "").split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean))];

/** Totals, and on Received: stock in (plain products) / units created (serial-tracked). Received purchases are locked. */
const receivePurchase: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req }) => {
  const lines = ((data.lines ?? originalDoc?.lines) as Line[] | undefined) ?? [];
  data.total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitCost) || 0), 0);
  if (operation === "update" && originalDoc?.status === "received") {
    if (data.status && data.status !== "received") throw userError("A received purchase can't be changed back – make a new purchase or a stock count instead.", 400);
    if (data.lines && JSON.stringify(data.lines.map((l: Line) => [relId(l.product), l.qty, l.serials])) !== JSON.stringify(lines.map((l) => [relId(l.product), l.qty, l.serials])))
      throw userError("Lines of a received purchase can't be changed.", 400);
    return data;
  }
  if (data.status !== "received") return data;
  // receiving twice at the same moment (two tabs, a double click) must not add the stock twice
  if (operation === "update" && originalDoc?.id && req.transactionID) {
    const { lockRowStatus } = await import("../stock");
    if ((await lockRowStatus(req.payload, "cms_purchases", Number(originalDoc.id), req)) === "received") throw userError("This purchase was just received by someone else – reload the page.", 409);
  }
  const storeId = storeIdOf(data.store ?? originalDoc?.store);

  const { addStock, recountUnits, trackedProducts, setStockLog } = await import("../stock");
  setStockLog(req, { reason: "purchase", ref: String(data.invoiceNumber ?? originalDoc?.invoiceNumber ?? "") });
  const ids = lines.map((l) => Number(relId(l.product))).filter(Boolean);
  const tracked = await trackedProducts(req.payload, ids, req);
  // check everything first, then change stock
  for (const l of lines) {
    const pid = Number(relId(l.product));
    if (!pid || !(Number(l.qty) > 0)) throw userError("Every line needs a product and a quantity.", 400);
    if (tracked.has(pid)) {
      const serials = serialList(l.serials);
      if (serials.length !== Number(l.qty)) throw userError(`Enter ${l.qty} serial number(s) for each laptop line (one per line).`, 400);
      const taken = await req.payload.find({ collection: "units", where: { and: [{ serial: { in: serials } }, { store: { equals: storeId } }] }, limit: 1, depth: 0, overrideAccess: true, req });
      if (taken.docs.length) throw userError(`Serial ${(taken.docs[0] as { serial: string }).serial} is already in stock records.`, 400);
    }
  }
  const now = new Date().toISOString();
  for (const l of lines) {
    const pid = Number(relId(l.product));
    if (tracked.has(pid)) {
      for (const serial of serialList(l.serials))
        await req.payload.create({ collection: "units", data: { store: storeId, serial, product: pid, status: "in-stock", costPrice: Number(l.unitCost) || null, receivedAt: now, notes: originalDoc?.invoiceNumber ? `Purchase ${originalDoc.invoiceNumber}` : null } as never, overrideAccess: true, req, context: { skipUnitSync: true } });
      await recountUnits(req.payload, pid, req);
    } else await addStock(req.payload, pid, Number(l.qty), req);
    // straight to the live product: an update through Payload would publish an editor's unfinished draft
    if (data.updateCostPrice ?? originalDoc?.updateCostPrice) {
      const { setProductCost } = await import("../stock");
      await setProductCost(req.payload, pid, Number(l.unitCost) || null, req);
    }
  }
  data.receivedAt = now;
  data.receivedBy = (req.user as { id?: number } | null)?.id ?? null;
  revalidate(["catalog"]);
  return data;
};

export const Purchases: CollectionConfig = {
  slug: "purchases",
  dbName: dbName("purchases"),
  labels: { singular: "Purchase (stock in)", plural: "Purchases (stock in)" },
  admin: {
    useAsTitle: "invoiceNumber",
    group: "Catalog",
    defaultColumns: ["invoiceNumber", "supplier", "date", "total", "status"],
    description: "Stock you buy. Add the lines, then set Status to “Received” and save – stock goes up (laptops: one unit per serial number).",
  },
  access: storeAccess("store_staff"),
  hooks: { beforeValidate: [assignStore()], beforeChange: [receivePurchase] },
  fields: [
    storeField(),
    { type: "row", fields: [
      { name: "supplier", type: "relationship", relationTo: "suppliers", required: true, filterOptions: sameStore, admin: { width: "40%" } },
      { name: "invoiceNumber", type: "text", label: "Supplier invoice / bill no.", admin: { width: "30%" } },
      { name: "date", type: "date", required: true, defaultValue: () => new Date().toISOString(), admin: { width: "30%", date: { pickerAppearance: "dayOnly" } } },
    ] },
    {
      name: "lines",
      type: "array",
      required: true,
      minRows: 1,
      fields: [
        { type: "row", fields: [
          { name: "product", type: "relationship", relationTo: "products", required: true, filterOptions: sameStore, admin: { width: "50%" } },
          { name: "qty", type: "number", required: true, min: 1, defaultValue: 1, label: "Quantity", admin: { width: "20%" } },
          { name: "unitCost", type: "number", min: 0, label: "Cost each", access: { read: storeRoleField("store_owner"), update: storeRoleField("store_owner"), create: storeRoleField("store_owner") }, admin: { width: "30%" } },
        ] },
        { name: "serials", type: "textarea", label: "Serial numbers (laptops tracked by serial – one per line)" },
      ],
    },
    { type: "row", fields: [
      { name: "status", type: "select", required: true, defaultValue: "draft", options: [
        { label: "Draft (not in stock yet)", value: "draft" },
        { label: "Received (adds to stock)", value: "received" },
      ], admin: { width: "34%" } },
      { name: "total", type: "number", label: "Total", access: { read: storeRoleField("store_owner") }, admin: { width: "33%", readOnly: true } },
      { name: "updateCostPrice", type: "checkbox", label: "Update products' cost price", access: { read: storeRoleField("store_owner"), update: storeRoleField("store_owner"), create: storeRoleField("store_owner") }, admin: { width: "33%", style: { alignSelf: "center" } } },
    ] },
    { name: "notes", type: "textarea" },
    { name: "receivedAt", type: "date", admin: { position: "sidebar", readOnly: true, date: { pickerAppearance: "dayAndTime" } } },
    { name: "receivedBy", type: "relationship", relationTo: "users", admin: { position: "sidebar", readOnly: true } },
  ],
};

export const StockCounts: CollectionConfig = {
  slug: "stock-counts",
  dbName: dbName("stock-counts"),
  labels: { singular: "Stock count", plural: "Stock counts" },
  admin: {
    useAsTitle: "name",
    group: "Catalog",
    defaultColumns: ["name", "status", "itemsCounted", "variance", "updatedAt"],
    description: "Count the shelves from Products → Stock count. Finished counts keep their variance report here.",
  },
  // counts are made through Products → Stock count (endpoints); here they are read, renamed or deleted
  access: { ...storeAccess("store_staff", "store_manager", "store_staff", "store_manager"), read: readFor("store_staff") },
  hooks: {
    beforeValidate: [assignStore()],
    // cost prices are the owner's business: hidden from everyone else (the count endpoints read with keepCost)
    afterRead: [
      async ({ doc, req, context }) => {
        if (context?.keepCost || !Array.isArray(doc?.lines)) return doc;
        if (req.user && hasStoreRole(await getTenant(req), storeIdOf(doc.store), "store_owner")) return doc;
        return { ...doc, lines: (doc.lines as Record<string, unknown>[]).map((l) => ({ ...l, unitCost: 0 })) };
      },
    ],
  },
  fields: [
    storeField(),
    { name: "report", type: "ui", admin: { components: { Field: "/payload/admin/inventory/CountReport#CountReport" } } },
    { type: "row", fields: [
      { name: "name", type: "text", required: true, admin: { width: "40%" } },
      { name: "status", type: "select", required: true, defaultValue: "open", options: [
        { label: "Counting", value: "open" },
        { label: "Finished (report only)", value: "finished" },
        { label: "Finished – stock corrected", value: "applied" },
      ], admin: { width: "30%" } },
      { name: "category", type: "relationship", relationTo: "categories", filterOptions: sameStore, label: "Only this category", admin: { width: "30%" } },
    ] },
    { name: "lines", type: "json", admin: { hidden: true } },
    { type: "row", fields: [
      { name: "itemsCounted", type: "number", admin: { width: "50%", readOnly: true } },
      { name: "variance", type: "number", label: "Units over (+) / short (−)", admin: { width: "50%", readOnly: true } },
    ] },
    { name: "startedBy", type: "relationship", relationTo: "users", admin: { position: "sidebar", readOnly: true } },
    { name: "finishedAt", type: "date", admin: { position: "sidebar", readOnly: true, date: { pickerAppearance: "dayAndTime" } } },
    { name: "notes", type: "textarea" },
  ],
};
