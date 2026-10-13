import type { CollectionConfig } from "payload";
import { managers, staff } from "../access";
import { dbName, legacyIdField } from "../fields";
import { CATALOG_TAG, revalidate } from "../revalidate";

/** Sales → Discounts (coupon codes) and Flash sales. */

export const Discounts: CollectionConfig = {
  slug: "discounts",
  dbName: dbName("discounts"),
  labels: { singular: "Discount code", plural: "Discounts" },
  admin: { useAsTitle: "code", group: "Sales", defaultColumns: ["code", "value", "minOrder", "used", "active"], description: "Coupon codes shoppers enter at checkout." },
  access: { read: staff, create: staff, update: staff, delete: managers },
  hooks: {
    beforeValidate: [({ data }) => (data?.code ? { ...data, code: String(data.code).trim().toUpperCase().replace(/\s+/g, "") } : data)],
  },
  fields: [
    { type: "row", fields: [
      { name: "code", type: "text", required: true, unique: true, index: true, admin: { width: "40%", description: "e.g. WELCOME5 (saved in capitals)." } },
      { name: "kind", type: "select", required: true, defaultValue: "percent", options: [{ label: "% off", value: "percent" }, { label: "Rs off", value: "fixed" }], admin: { width: "30%" } },
      {
        name: "value",
        type: "number",
        required: true,
        min: 0,
        validate: (v: unknown, { siblingData }: { siblingData?: { kind?: string } }) =>
          typeof v !== "number" || v < 0 ? "Enter 0 or more." : siblingData?.kind === "percent" && v > 100 ? "A percent discount can be at most 100%." : true,
        admin: { width: "30%", description: "Percent or rupees.", components: { Cell: "/payload/admin/marketing/DiscountCells#DiscountValueCell" } },
      },
    ] },
    { type: "row", fields: [
      { name: "minOrder", type: "number", min: 0, defaultValue: 0, label: "Minimum order (Rs)", admin: { width: "34%", components: { Cell: "/payload/admin/marketing/DiscountCells#MinOrderCell" } } },
      { name: "usageLimit", type: "number", min: 0, label: "Usage limit", admin: { width: "33%", description: "Empty = unlimited." } },
      { name: "used", type: "number", min: 0, defaultValue: 0, label: "Times used", admin: { width: "33%", readOnly: true, components: { Cell: "/payload/admin/marketing/DiscountCells#UsageCell" } } },
    ] },
    { type: "row", fields: [
      { name: "expiresAt", type: "date", admin: { width: "50%", date: { pickerAppearance: "dayAndTime" }, description: "Empty = never expires." } },
      { name: "active", type: "checkbox", defaultValue: true, label: "Active", admin: { width: "50%", style: { alignSelf: "center" }, components: { Cell: "/payload/admin/marketing/DiscountCells#DiscountStatusCell" } } },
    ] },
    legacyIdField,
  ],
};

export const FlashSales: CollectionConfig = {
  slug: "flash-sales",
  dbName: dbName("flash-sales"),
  labels: { singular: "Flash sale", plural: "Flash sales" },
  admin: { useAsTitle: "title", group: "Sales", defaultColumns: ["title", "endsAt", "active"], description: "Countdown deal shown on the home page and /deals. The active sale ending soonest is shown." },
  access: { read: () => true, create: staff, update: staff, delete: managers },
  hooks: { afterChange: [({ doc }) => (revalidate([CATALOG_TAG, "content"], ["/", "/deals"]), doc)], afterDelete: [({ doc }) => (revalidate([CATALOG_TAG, "content"], ["/", "/deals"]), doc)] },
  fields: [
    { name: "title", type: "text", required: true, defaultValue: "Weekly Hot Deals" },
    { type: "row", fields: [
      { name: "endsAt", type: "date", required: true, admin: { width: "50%", date: { pickerAppearance: "dayAndTime" } } },
      { name: "active", type: "checkbox", defaultValue: true, admin: { width: "50%", style: { alignSelf: "center" } } },
    ] },
    { name: "products", type: "relationship", relationTo: "products", hasMany: true, required: true },
    legacyIdField,
  ],
};
