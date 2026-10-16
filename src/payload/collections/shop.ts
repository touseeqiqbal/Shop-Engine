import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, CollectionConfig } from "payload";
import { nobody } from "../access";
import { assignStore, readFor, sameStore, storeAccess, storeField, storeRoleField, writeFor } from "../tenancy";
import { dbName, perStoreUnique, uniqueInStore } from "../fields";

/**
 * Shop counter (POS) and individual laptop units.
 * - Units: one row per serial number. For products with "Track each unit" on, the product's stock is
 *   the number of its units that are In stock – the website and the shop counter read the same number.
 * - Shop sales: created only by the POS screen (/cms/pos) through /cms-api/pos/sale, which takes stock
 *   atomically. They can't be deleted – a mistake is voided, which puts the stock back.
 * - Cash-ups: end-of-day count of the drawer against what the POS says should be there.
 */

export const UNIT_STATUSES = [
  { label: "In stock", value: "in-stock" },
  { label: "Reserved (online order)", value: "reserved" },
  { label: "Sold", value: "sold" },
  { label: "In repair", value: "in-repair" },
  { label: "Returned", value: "returned" },
];

export const PAY_METHODS = [
  { label: "Cash", value: "cash" },
  { label: "Card", value: "card" },
  { label: "Bank transfer", value: "bank" },
  { label: "JazzCash", value: "jazzcash" },
  { label: "EasyPaisa", value: "easypaisa" },
  // any other wallet or bank app (stores outside Pakistan: UPI, M-Pesa, PIX …)
  { label: "Wallet / other", value: "other" },
];

const relId = (v: unknown) => (v && typeof v === "object" ? (v as { id: number }).id : (v as number | null | undefined));

/** Product stock = its units that are In stock (only for products that track units). */
async function syncUnitStock(req: Parameters<CollectionAfterChangeHook>[0]["req"], productId: number | null | undefined) {
  if (!productId) return;
  const product = (await req.payload.findByID({ collection: "products", id: productId, depth: 0, overrideAccess: true, req }).catch(() => null)) as { trackUnits?: boolean } | null;
  if (!product?.trackUnits) return;
  const { totalDocs } = await req.payload.count({ collection: "units", where: { and: [{ product: { equals: productId } }, { status: { equals: "in-stock" } }] }, overrideAccess: true, req });
  const { setStock } = await import("../stock");
  await setStock(req.payload, productId, totalDocs, req);
  const { revalidate, CATALOG_TAG } = await import("../revalidate");
  revalidate([CATALOG_TAG]);
}

const unitAfterChange: CollectionAfterChangeHook = async ({ doc, previousDoc, req, context }) => {
  if (context?.skipUnitSync) return doc;
  await syncUnitStock(req, relId(doc.product));
  const before = relId(previousDoc?.product);
  if (before && before !== relId(doc.product)) await syncUnitStock(req, before);
  return doc;
};
const unitAfterDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  await syncUnitStock(req, relId(doc.product));
  return doc;
};

export const Units: CollectionConfig = {
  slug: "units",
  dbName: dbName("units"),
  labels: { singular: "Laptop unit", plural: "Laptop units" },
  admin: {
    useAsTitle: "serial",
    group: "Catalog",
    defaultColumns: ["serial", "product", "status", "order", "updatedAt"],
    listSearchableFields: ["serial", "notes"],
    description: "One row per serial number. Turn on “Track each unit” on a product and its stock becomes the number of its units that are In stock.",
    components: {
      beforeListTable: [
        {
          path: "/payload/admin/ui/ListTabs#ListTabs",
          clientProps: {
            label: "Unit views",
            tabs: [
              { label: "All", where: "" },
              { label: "In stock", where: "where[status][equals]=in-stock" },
              { label: "Reserved", where: "where[status][equals]=reserved" },
              { label: "Sold", where: "where[status][equals]=sold" },
              { label: "In repair", where: "where[status][equals]=in-repair" },
              { label: "Returned", where: "where[status][equals]=returned" },
            ],
          },
        },
        { path: "/payload/admin/inventory/PrintLabelsButton#PrintLabelsButton", clientProps: { type: "units" } },
      ],
    },
  },
  access: storeAccess("store_staff"),
  indexes: perStoreUnique("serial"),
  hooks: { beforeValidate: [assignStore()], afterChange: [unitAfterChange], afterDelete: [unitAfterDelete] },
  fields: [
    storeField(),
    { type: "row", fields: [
      { name: "serial", type: "text", required: true, index: true, validate: uniqueInStore("serial", "A unit with this serial number is already in this store."), label: "Serial number", admin: { width: "50%", description: "Scan the barcode on the laptop or type it." } },
      { name: "product", type: "relationship", relationTo: "products", required: true, index: true, filterOptions: sameStore, admin: { width: "50%" } },
    ] },
    { type: "row", fields: [
      { name: "status", type: "select", required: true, defaultValue: "in-stock", index: true, options: UNIT_STATUSES, admin: { width: "50%" } },
      { name: "warrantyMonths", type: "number", min: 0, label: "Warranty (months)", admin: { width: "50%", description: "Empty = the product's normal warranty." } },
    ] },
    { name: "conditionNotes", type: "textarea", label: "Condition of this unit", admin: { description: "e.g. Battery 91%, small scratch on lid." } },
    { type: "row", fields: [
      { name: "costPrice", type: "number", min: 0, label: "Your cost", access: { read: storeRoleField("store_owner"), create: storeRoleField("store_owner"), update: storeRoleField("store_owner") }, admin: { width: "50%", description: "Only owners see this." } },
      { name: "receivedAt", type: "date", label: "Received", admin: { width: "50%", date: { pickerAppearance: "dayOnly" } } },
    ] },
    { name: "order", type: "relationship", relationTo: "orders", filterOptions: sameStore, label: "Online order", admin: { readOnly: true, position: "sidebar" } },
    { name: "sale", type: "relationship", relationTo: "pos-sales", filterOptions: sameStore, label: "Shop sale", admin: { readOnly: true, position: "sidebar" } },
    { name: "soldAt", type: "date", admin: { readOnly: true, position: "sidebar", date: { pickerAppearance: "dayAndTime" } } },
    { name: "notes", type: "textarea", admin: { position: "sidebar" } },
  ],
};

export const PosSales: CollectionConfig = {
  slug: "pos-sales",
  dbName: dbName("pos-sales"),
  labels: { singular: "Shop sale", plural: "Shop sales" },
  admin: {
    useAsTitle: "receiptNumber",
    group: "Sales",
    defaultColumns: ["receiptNumber", "total", "status", "cashier", "createdAt"],
    listSearchableFields: ["receiptNumber", "customerName", "customerPhone"],
    description: "Sales made at the shop counter. Make new sales from Shop counter → Sell.",
  },
  // made and voided only through Shop counter (the endpoints keep stock, units and cash-ups right) – never edited directly
  access: { read: readFor("store_staff"), create: nobody, update: nobody, delete: nobody },
  hooks: {
    beforeValidate: [assignStore()],
    // cost at the time of sale (the laptop's own cost for serial numbers) – for the profit report
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation !== "create") return doc;
        const { snapshotCosts } = await import("../stock");
        await snapshotCosts(req.payload, "pos-sales", Number(doc.id), req);
        return doc;
      },
    ],
  },
  fields: [
    storeField(),
    // one id per "Complete sale" press: a double click or a retry returns the first sale instead of selling twice
    { name: "clientSaleId", type: "text", unique: true, index: true, admin: { hidden: true } },
    { type: "row", fields: [
      { name: "receiptNumber", type: "text", required: true, unique: true, index: true, admin: { width: "50%", readOnly: true } },
      { name: "status", type: "select", required: true, defaultValue: "completed", index: true, options: [
        { label: "Completed", value: "completed" },
        { label: "Voided", value: "voided" },
      ], admin: { width: "50%", readOnly: true } },
    ] },
    {
      name: "items",
      type: "array",
      admin: { readOnly: true },
      fields: [
        { type: "row", fields: [
          { name: "product", type: "relationship", relationTo: "products", filterOptions: sameStore, admin: { width: "40%" } },
          { name: "title", type: "text", required: true, admin: { width: "60%" } },
        ] },
        { type: "row", fields: [
          { name: "unit", type: "relationship", relationTo: "units", filterOptions: sameStore, admin: { width: "25%" } },
          { name: "serial", type: "text", admin: { width: "25%" } },
          { name: "qty", type: "number", required: true, admin: { width: "25%" } },
          { name: "unitPrice", type: "number", required: true, label: "Price", admin: { width: "25%" } },
        ] },
        { name: "unitCost", type: "number", label: "Cost each", access: { read: storeRoleField("store_owner"), create: () => false, update: () => false }, admin: { readOnly: true, description: "Your cost when it was sold (owners only) – used by the profit report." } },
      ],
    },
    { type: "row", fields: [
      { name: "subtotal", type: "number", required: true, label: "Items", admin: { width: "33%", readOnly: true } },
      { name: "discount", type: "number", defaultValue: 0, label: "Discount", admin: { width: "33%", readOnly: true } },
      { name: "total", type: "number", required: true, label: "Total", admin: { width: "34%", readOnly: true } },
    ] },
    // the store's currency when the sale was made (a later change of currency doesn't relabel old receipts)
    { name: "currency", type: "text", admin: { readOnly: true, position: "sidebar" } },
    {
      name: "payments",
      type: "array",
      admin: { readOnly: true },
      fields: [{ type: "row", fields: [
        { name: "method", type: "select", required: true, options: PAY_METHODS, admin: { width: "50%" } },
        { name: "amount", type: "number", required: true, label: "Amount", admin: { width: "50%" } },
      ] }],
    },
    { type: "row", fields: [
      { name: "cashReceived", type: "number", label: "Cash handed over", admin: { width: "50%", readOnly: true } },
      { name: "change", type: "number", label: "Change given", admin: { width: "50%", readOnly: true } },
    ] },
    { type: "row", fields: [
      { name: "customerName", type: "text", admin: { width: "50%" } },
      { name: "customerPhone", type: "text", index: true, admin: { width: "50%" } },
    ] },
    { name: "cashier", type: "relationship", relationTo: "users", admin: { position: "sidebar", readOnly: true } },
    { name: "voidReason", type: "text", admin: { position: "sidebar", readOnly: true, condition: (d) => d?.status === "voided" } },
    { name: "notes", type: "textarea", admin: { position: "sidebar" } },
  ],
};

export const CashUps: CollectionConfig = {
  slug: "cash-ups",
  dbName: dbName("cash-ups"),
  labels: { singular: "Cash-up", plural: "Cash-ups" },
  admin: {
    useAsTitle: "day",
    group: "Sales",
    defaultColumns: ["day", "expectedCash", "countedCash", "difference", "closedBy"],
    description: "End-of-day drawer count. Do it from Shop counter → Cash-up.",
  },
  access: { ...storeAccess("store_staff", "store_staff", "store_manager"), update: writeFor("store_manager") },
  hooks: { beforeValidate: [assignStore()] },
  fields: [
    storeField(),
    { type: "row", fields: [
      { name: "day", type: "text", required: true, index: true, label: "Day (YYYY-MM-DD)", admin: { width: "50%" } },
      { name: "openingFloat", type: "number", defaultValue: 0, label: "Cash in drawer at opening", admin: { width: "50%" } },
    ] },
    { type: "row", fields: [
      { name: "expectedCash", type: "number", label: "Cash expected", admin: { width: "33%", readOnly: true } },
      { name: "countedCash", type: "number", required: true, label: "Cash counted", admin: { width: "33%" } },
      { name: "difference", type: "number", label: "Over / short", admin: { width: "34%", readOnly: true } },
    ] },
    { name: "byMethod", type: "json", label: "Sales by payment method", admin: { readOnly: true } },
    { name: "salesCount", type: "number", admin: { readOnly: true } },
    { name: "notes", type: "textarea" },
    { name: "closedBy", type: "relationship", relationTo: "users", admin: { position: "sidebar", readOnly: true } },
  ],
};
