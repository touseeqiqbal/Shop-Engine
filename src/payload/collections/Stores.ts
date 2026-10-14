import crypto from "node:crypto";
import type { CollectionConfig, FieldAccess, Where } from "payload";
import { dbName } from "../fields";
import { userError } from "../errors";
import { forgetDefaultStore, getTenant, hasStoreRole, platformAdminField, platformAdmins, storeIdOf } from "../tenancy";
import { clearRedirectCache, revalidate } from "../revalidate";

/** Sub-domains and store addresses the platform keeps for itself. */
export const RESERVED_STORE_NAMES = new Set([
  "admin", "api", "app", "assets", "auth", "billing", "blog", "cdn", "cms", "cms-api", "dashboard", "docs", "help", "mail", "media",
  "platform", "shop", "shopengine", "smtp", "static", "status", "store", "stores", "support", "www", "ftp", "test", "staging", "dev",
]);

export const normalizeHandle = (v: unknown) =>
  String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

/** host names like shop.example.com (no scheme, port or path) */
export const normalizeDomain = (v: unknown) =>
  String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");

const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** A store's owner (in the store they work in) may edit its profile; everything else stays with platform admins. */
const storeOwnerField: FieldAccess = async ({ req, id }) => {
  const t = await getTenant(req);
  return t.platformAdmin || (id != null && Number(id) === t.activeStoreId && hasStoreRole(t, t.activeStoreId, "store_owner"));
};

export const Stores: CollectionConfig = {
  slug: "stores",
  dbName: dbName("stores"),
  labels: { singular: "Store", plural: "Stores" },
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "slug", "status", "subscriptionStatus", "plan", "createdAt"],
    group: "Platform",
    listSearchableFields: ["name", "slug", "subdomain", "customDomain"],
  },
  access: {
    // platform admins: every store; a store's team: the stores they work in
    read: async ({ req }) => {
      const t = await getTenant(req);
      if (t.platformAdmin) return true;
      const ids = [...t.roles.keys()];
      return ids.length ? ({ id: { in: ids } } satisfies Where) : false;
    },
    create: platformAdmins, // merchants open stores through Account → Stores (server checks, plan, trial)
    update: async ({ req }) => {
      const t = await getTenant(req);
      if (t.platformAdmin) return true;
      return t.activeStoreId != null && hasStoreRole(t, t.activeStoreId, "store_owner") ? ({ id: { equals: t.activeStoreId } } satisfies Where) : false;
    },
    delete: platformAdmins,
  },
  hooks: {
    beforeValidate: [
      ({ data, originalDoc }) => {
        if (!data) return data;
        if (data.subdomain !== undefined) data.subdomain = normalizeHandle(data.subdomain) || null;
        if (data.customDomain !== undefined) data.customDomain = normalizeDomain(data.customDomain) || null;
        if (data.orderPrefix !== undefined) data.orderPrefix = String(data.orderPrefix ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || null;
        const sub = data.subdomain ?? originalDoc?.subdomain;
        if (sub && RESERVED_STORE_NAMES.has(String(sub))) throw userError(`“${sub}” is reserved – choose another store address.`, 400);
        if (data.customDomain && !DOMAIN_RE.test(String(data.customDomain))) throw userError("Enter a domain like shop.example.com (no https://).", 400);
        return data;
      },
    ],
    beforeChange: [
      ({ data, originalDoc }) => {
        // a new custom domain must be proved again (DNS TXT record) before the store answers on it
        const domain = data.customDomain !== undefined ? data.customDomain : originalDoc?.customDomain;
        if (domain && (domain !== originalDoc?.customDomain || !originalDoc?.domainVerificationToken)) {
          data.domainVerificationToken = `shopengine-verify=${crypto.randomBytes(16).toString("hex")}`;
          data.domainVerifiedAt = null;
        }
        if (!domain) {
          data.domainVerificationToken = null;
          data.domainVerifiedAt = null;
        }
        return data;
      },
    ],
    afterChange: [
      async ({ doc, req, previousDoc }) => {
        // only one default store
        if (doc.isDefault && !previousDoc?.isDefault)
          await req.payload.update({ collection: "stores", where: { and: [{ isDefault: { equals: true } }, { id: { not_equals: doc.id } }] }, data: { isDefault: false } as never, overrideAccess: true, req });
        forgetDefaultStore();
        revalidate(["stores"]);
        clearRedirectCache();
        return doc;
      },
    ],
    afterDelete: [({ doc }) => (forgetDefaultStore(), revalidate(["stores"]), clearRedirectCache(), doc)],
    beforeDelete: [
      async ({ id, req }) => {
        const store = (await req.payload.findByID({ collection: "stores", id, depth: 0, overrideAccess: true, req }).catch(() => null)) as { isDefault?: boolean } | null;
        if (store?.isDefault) throw userError("The default store can't be deleted.", 409);
        const orders = await req.payload.count({ collection: "orders", where: { store: { equals: id } }, overrideAccess: true, req });
        if (orders.totalDocs) throw userError(`This store has ${orders.totalDocs} order(s). Close it (Status → Closed) instead of deleting – its records are kept for the books.`, 409);
      },
    ],
  },
  fields: [
    { name: "name", type: "text", required: true, access: { update: storeOwnerField } },
    { name: "slug", type: "text", required: true, unique: true, index: true, access: { update: platformAdminField }, admin: { position: "sidebar", description: "Store handle (unique on ShopEngine)." } },
    { name: "businessName", type: "text", access: { update: storeOwnerField }, admin: { description: "Legal / business name shown on invoices." } },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "draft",
      index: true,
      access: { update: platformAdminField },
      options: [
        { label: "Draft – being set up", value: "draft" },
        { label: "Active", value: "active" },
        { label: "Suspended (by ShopEngine)", value: "suspended" },
        { label: "Closed", value: "closed" },
      ],
      admin: { position: "sidebar", description: "Draft: only the team sees it. Suspended / Closed: the store is offline and its admin is read-only." },
    },
    { name: "isDefault", type: "checkbox", defaultValue: false, access: { create: platformAdminField, update: platformAdminField }, admin: { position: "sidebar", description: "The original shop: answers on the main site address and owns the global settings." } },
    {
      type: "collapsible",
      label: "Web addresses",
      fields: [
        { name: "subdomain", type: "text", unique: true, index: true, access: { update: platformAdminField }, admin: { description: "Store address on the platform, e.g. myshop → myshop.<platform domain>." } },
        { name: "customDomain", type: "text", unique: true, index: true, access: { update: storeOwnerField }, admin: { description: "Your own domain, e.g. shop.example.com. Point it to the platform, then add the TXT record below to verify it." } },
        { name: "domainVerificationToken", type: "text", access: { create: () => false, update: () => false }, admin: { readOnly: true, description: "Add a DNS TXT record on your domain with exactly this value, then press Verify (Account → Stores)." } },
        { name: "domainVerifiedAt", type: "date", access: { create: platformAdminField, update: platformAdminField }, admin: { readOnly: true, description: "Set when the TXT record was found. The store answers on its custom domain only after this." } },
      ],
    },
    {
      type: "collapsible",
      label: "Region",
      fields: [
        { type: "row", fields: [
          { name: "country", type: "text", defaultValue: "Pakistan", access: { update: storeOwnerField }, admin: { width: "25%" } },
          { name: "currency", type: "text", defaultValue: "PKR", access: { update: storeOwnerField }, admin: { width: "25%", description: "ISO code, e.g. PKR, USD." } },
          { name: "timezone", type: "text", defaultValue: "Asia/Karachi", access: { update: storeOwnerField }, admin: { width: "25%" } },
          { name: "defaultLanguage", type: "text", defaultValue: "en", access: { update: storeOwnerField }, admin: { width: "25%" } },
        ] },
        { name: "orderPrefix", type: "text", access: { update: storeOwnerField }, admin: { description: "Start of every order number, e.g. ABC → ABC-261014-123456 (2–6 letters/numbers)." } },
      ],
    },
    { name: "owner", type: "relationship", relationTo: "users", access: { update: platformAdminField }, admin: { position: "sidebar", description: "The merchant who opened the store." } },
    {
      type: "collapsible",
      label: "ShopEngine plan",
      admin: { initCollapsed: true },
      fields: [
        { name: "plan", type: "relationship", relationTo: "subscription-plans", access: { update: platformAdminField } },
        {
          name: "subscriptionStatus",
          type: "select",
          defaultValue: "trialing",
          index: true,
          access: { update: platformAdminField },
          options: [
            { label: "Trialing", value: "trialing" },
            { label: "Active", value: "active" },
            { label: "Past due", value: "past_due" },
            { label: "Cancelled", value: "cancelled" },
            { label: "Expired", value: "expired" },
            { label: "Suspended", value: "suspended" },
          ],
        },
        { type: "row", fields: [
          { name: "trialEndsAt", type: "date", access: { update: platformAdminField }, admin: { width: "33%" } },
          { name: "trialUsed", type: "checkbox", defaultValue: false, access: { update: platformAdminField }, admin: { width: "33%", description: "A store gets one free trial." } },
          { name: "graceEndsAt", type: "date", access: { update: platformAdminField }, admin: { width: "34%", description: "Past due / trial over: the store stays open until this date." } },
        ] },
        { name: "billingEmail", type: "email", access: { update: storeOwnerField } },
      ],
    },
    {
      type: "collapsible",
      label: "Online payments",
      admin: { initCollapsed: true },
      fields: [
        { name: "paymentsProvider", type: "select", options: [{ label: "Stripe", value: "stripe" }], access: { update: platformAdminField } },
        { name: "paymentsAccountId", type: "text", access: { read: storeOwnerField, update: platformAdminField }, admin: { readOnly: true, description: "Connected payment account (set when the owner connects payments)." } },
        { name: "paymentsChargesEnabled", type: "checkbox", defaultValue: false, access: { update: platformAdminField }, admin: { readOnly: true } },
      ],
    },
    { name: "internalNotes", type: "textarea", access: { read: platformAdminField, create: platformAdminField, update: platformAdminField }, admin: { description: "Platform admins only." } },
  ],
  timestamps: true,
};

/** Store id from a relationship value (re-exported for collections that import it from here). */
export { storeIdOf };
