import type { CollectionConfig, Where } from "payload";
import { isPlatformAdmin, storeScopedAccess } from "../access";
import { dbName, slugField } from "../fields";

export const Stores: CollectionConfig = {
  slug: "stores",
  dbName: dbName("stores"),
  labels: { singular: "Store", plural: "Stores" },
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "slug", "status", "currency", "country"],
    group: "Platform",
  },
  access: {
    read: ({ req }) => {
      const user = req.user as { id?: string | number; role?: string; platformRole?: string; stores?: Array<string | number | { id?: string | number }> | null } | null | undefined;
      if (!user?.id) return false;
      if (isPlatformAdmin(user as never)) return true;
      const storeIds = (user.stores ?? [])
        .map((store) => (typeof store === "object" && store && "id" in store ? store.id : store))
        .filter((id): id is string | number => typeof id === "string" || typeof id === "number");
      const ownerWhere: Where = { owner: { equals: user.id } };
      if (storeIds.length === 0) return ownerWhere;
      return { or: [ownerWhere, { id: { in: storeIds } }] } satisfies Where;
    },
    create: ({ req }) => isPlatformAdmin(req.user as never),
    update: ({ req }) => isPlatformAdmin(req.user as never),
    delete: ({ req }) => isPlatformAdmin(req.user as never),
  },
  fields: [
    { name: "name", type: "text", required: true },
    slugField("name"),
    { name: "businessName", type: "text", admin: { description: "Legal or business-facing storefront name." } },
    { name: "status", type: "select", required: true, defaultValue: "active", options: [
      { label: "Active", value: "active" },
      { label: "Suspended", value: "suspended" },
      { label: "Closed", value: "closed" },
      { label: "Draft", value: "draft" },
    ] },
    { name: "subdomain", type: "text", unique: true, admin: { description: "Store subdomain, such as myshop.shopengine.dev." } },
    { name: "customDomain", type: "text", admin: { description: "Custom domain for the storefront." } },
    { name: "country", type: "text", defaultValue: "Pakistan" },
    { name: "currency", type: "text", defaultValue: "PKR" },
    { name: "timezone", type: "text", defaultValue: "Asia/Karachi" },
    { name: "defaultLanguage", type: "text", defaultValue: "en" },
    { name: "owner", type: "relationship", relationTo: "users", admin: { description: "Primary merchant owner for this store." } },
    { name: "logo", type: "upload", relationTo: "media" },
    { name: "brandColor", type: "text", admin: { placeholder: "#0F172A" } },
    { name: "supportEmail", type: "email" },
    { name: "supportPhone", type: "text" },
    { name: "settings", type: "json", defaultValue: {}, admin: { description: "store default configuration and per-store preferences." } },
    { name: "plan", type: "relationship", relationTo: "subscription-plans" as never, admin: { description: "Current ShopEngine SaaS plan for this store." } },
    {
      name: "subscriptionStatus",
      type: "select",
      defaultValue: "trialing",
      options: [
        { label: "Trialing", value: "trialing" },
        { label: "Active", value: "active" },
        { label: "Past due", value: "past_due" },
        { label: "Cancelled", value: "cancelled" },
        { label: "Expired", value: "expired" },
        { label: "Suspended", value: "suspended" },
      ],
      admin: { description: "Current subscription lifecycle state for the merchant account." },
    },
    { name: "trialEndsAt", type: "date" },
    { name: "billingEmail", type: "email" },
    { name: "members", type: "relationship", relationTo: "users", hasMany: true, admin: { description: "Members with access to this store." } },
    { name: "internalNotes", type: "textarea", admin: { description: "Platform-admin-only internal notes." } },
  ],
  timestamps: true,
};

export const storeScopedDocsAccess = storeScopedAccess("store");
