import type { CollectionConfig } from "payload";
import { assignStore, publicOrStore, sameStore, storeAccess, storeField, createFor, writeFor } from "../tenancy";
import { dbName, legacyIdField, perStoreUnique } from "../fields";
import { requireFeature } from "../entitlements";
import { CATALOG_TAG, revalidate } from "../revalidate";

/** Sales → Discounts (codes and automatic discounts) and Flash sales. Everything is per store. */

export const Discounts: CollectionConfig = {
  slug: "discounts",
  dbName: dbName("discounts"),
  labels: { singular: "Discount", plural: "Discounts" },
  admin: {
    useAsTitle: "code",
    group: "Sales",
    defaultColumns: ["code", "kind", "value", "minOrder", "used", "active"],
    description: "Codes shoppers type at checkout, or automatic discounts applied by themselves. Checked and calculated by the server.",
  },
  access: storeAccess("store_staff", "store_staff", "store_staff", "store_manager"),
  indexes: perStoreUnique("code"),
  hooks: {
    beforeValidate: [assignStore(), ({ data }) => (data?.code ? { ...data, code: String(data.code).trim().toUpperCase().replace(/\s+/g, "") } : data)],
    beforeChange: [requireFeature("discounts")],
  },
  fields: [
    storeField(),
    { type: "row", fields: [
      { name: "code", type: "text", required: true, index: true, admin: { width: "40%", description: "e.g. WELCOME5 (saved in capitals). For an automatic discount this is just its name." } },
      {
        name: "kind",
        type: "select",
        required: true,
        defaultValue: "percent",
        options: [
          { label: "% off", value: "percent" },
          { label: "Amount off", value: "fixed" },
          { label: "Free delivery", value: "free_shipping" },
        ],
        admin: { width: "30%" },
      },
      {
        name: "value",
        type: "number",
        required: true,
        min: 0,
        defaultValue: 0,
        validate: (v: unknown, { siblingData }: { siblingData?: { kind?: string } }) =>
          siblingData?.kind === "free_shipping" ? true : typeof v !== "number" || v < 0 ? "Enter 0 or more." : siblingData?.kind === "percent" && v > 100 ? "A percent discount can be at most 100%." : true,
        admin: { width: "30%", description: "Percent or amount (ignored for free delivery).", components: { Cell: "/payload/admin/marketing/DiscountCells#DiscountValueCell" } },
      },
    ] },
    { name: "automatic", type: "checkbox", defaultValue: false, label: "Automatic (no code needed)", admin: { description: "Applied by itself to every cart that qualifies. At most one automatic discount per order (the best one)." } },
    { type: "row", fields: [
      { name: "minOrder", type: "number", min: 0, defaultValue: 0, label: "Minimum order", admin: { width: "25%", components: { Cell: "/payload/admin/marketing/DiscountCells#MinOrderCell" } } },
      { name: "usageLimit", type: "number", min: 0, label: "Usage limit", admin: { width: "25%", description: "Empty = unlimited." } },
      { name: "perCustomerLimit", type: "number", min: 0, label: "Per customer", admin: { width: "25%", description: "Uses per customer (by email / phone). Empty = unlimited." } },
      { name: "used", type: "number", min: 0, defaultValue: 0, label: "Times used", access: { create: () => false, update: () => false }, admin: { width: "25%", readOnly: true, components: { Cell: "/payload/admin/marketing/DiscountCells#UsageCell" } } },
    ] },
    { type: "row", fields: [
      { name: "startsAt", type: "date", admin: { width: "33%", date: { pickerAppearance: "dayAndTime" }, description: "Empty = from now." } },
      { name: "expiresAt", type: "date", admin: { width: "33%", date: { pickerAppearance: "dayAndTime" }, description: "Empty = never expires." } },
      { name: "active", type: "checkbox", defaultValue: true, label: "Active", admin: { width: "34%", style: { alignSelf: "center" }, components: { Cell: "/payload/admin/marketing/DiscountCells#DiscountStatusCell" } } },
    ] },
    {
      name: "appliesTo",
      type: "select",
      defaultValue: "all",
      label: "Applies to",
      options: [
        { label: "The whole order", value: "all" },
        { label: "Chosen products", value: "products" },
        { label: "Chosen categories", value: "categories" },
        { label: "Chosen collections", value: "collections" },
      ],
      admin: { description: "A product/category/collection discount counts only the matching items (and their minimum order)." },
    },
    { name: "products", type: "relationship", relationTo: "products", hasMany: true, filterOptions: sameStore, admin: { condition: (_, s) => s?.appliesTo === "products" } },
    { name: "categories", type: "relationship", relationTo: "categories", hasMany: true, filterOptions: sameStore, admin: { condition: (_, s) => s?.appliesTo === "categories", description: "Sub-categories are included." } },
    { name: "collections", type: "relationship", relationTo: "product-collections", hasMany: true, filterOptions: sameStore, admin: { condition: (_, s) => s?.appliesTo === "collections" } },
    { name: "combinable", type: "checkbox", defaultValue: false, label: "Combines with other discounts", admin: { description: "A code and an automatic discount add up only when BOTH allow it; otherwise the bigger one is used." } },
    legacyIdField,
  ],
};

export const FlashSales: CollectionConfig = {
  slug: "flash-sales",
  dbName: dbName("flash-sales"),
  labels: { singular: "Flash sale", plural: "Flash sales" },
  admin: { useAsTitle: "title", group: "Sales", defaultColumns: ["title", "endsAt", "active"], description: "Countdown deal shown on the home page and /deals. The active sale ending soonest is shown." },
  access: { read: publicOrStore("store_staff"), create: createFor("store_staff"), update: writeFor("store_staff"), delete: writeFor("store_manager") },
  hooks: {
    beforeValidate: [assignStore()],
    afterChange: [({ doc }) => (revalidate([CATALOG_TAG, "content"], ["/", "/deals"]), doc)],
    afterDelete: [({ doc }) => (revalidate([CATALOG_TAG, "content"], ["/", "/deals"]), doc)],
  },
  fields: [
    storeField(),
    { name: "title", type: "text", required: true, defaultValue: "Weekly Hot Deals" },
    { type: "row", fields: [
      { name: "startsAt", type: "date", label: "Starts", admin: { width: "34%", date: { pickerAppearance: "dayAndTime" }, description: "Empty = now." } },
      { name: "endsAt", type: "date", required: true, label: "Ends", admin: { width: "33%", date: { pickerAppearance: "dayAndTime" } } },
      { name: "active", type: "checkbox", defaultValue: true, admin: { width: "33%", style: { alignSelf: "center" } } },
    ] },
    { name: "discountPercent", type: "number", min: 1, max: 90, label: "% off while it runs", admin: { description: "Optional. The products below cost this much less from the start to the end – shop, cart and checkout alike – then go back to their own price by themselves. Empty = a countdown only (set the prices yourself)." } },
    { name: "products", type: "relationship", relationTo: "products", hasMany: true, required: true, filterOptions: sameStore },
    legacyIdField,
  ],
};
