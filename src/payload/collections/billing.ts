import type { CollectionConfig } from "payload";
import { isPlatformAdmin, storeScopedAccess } from "../access";
import { dbName, slugField } from "../fields";

export const SubscriptionPlans: CollectionConfig = {
  slug: "subscription-plans",
  dbName: dbName("subscription_plans"),
  labels: { singular: "Subscription plan", plural: "Subscription plans" },
  admin: {
    useAsTitle: "name",
    group: "Platform",
    defaultColumns: ["name", "priceMonthly", "priceAnnual", "trialDays", "status"],
    description: "ShopEngine SaaS plans for merchant stores.",
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => isPlatformAdmin(req.user as never),
    update: ({ req }) => isPlatformAdmin(req.user as never),
    delete: ({ req }) => isPlatformAdmin(req.user as never),
  },
  fields: [
    { name: "name", type: "text", required: true },
    slugField("name"),
    { name: "description", type: "textarea" },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "active",
      options: [
        { label: "Active", value: "active" },
        { label: "Archived", value: "archived" },
      ],
    },
    { name: "priceMonthly", type: "number", required: true, min: 0, defaultValue: 0 },
    { name: "priceAnnual", type: "number", required: true, min: 0, defaultValue: 0 },
    { name: "trialDays", type: "number", min: 0, defaultValue: 14 },
    { name: "maxProducts", type: "number", min: 0, defaultValue: 200 },
    { name: "maxStaffMembers", type: "number", min: 0, defaultValue: 5 },
    { name: "maxStorageGb", type: "number", min: 0, defaultValue: 10 },
    { name: "features", type: "json", defaultValue: [], admin: { description: "Included perk list, for example: product catalog, orders, payments." } },
    { name: "highlight", type: "text", admin: { description: "Short selling line used in merchant plan selection screens." } },
  ],
  timestamps: true,
};

export const StoreSubscriptions: CollectionConfig = {
  slug: "store-subscriptions",
  dbName: dbName("store_subscriptions"),
  labels: { singular: "Store subscription", plural: "Store subscriptions" },
  admin: {
    useAsTitle: "status",
    group: "Platform",
    defaultColumns: ["storeId", "plan", "status", "currentPeriodEnd", "billingCycle"],
    description: "Merchant SaaS billing state for each store.",
  },
  access: {
    read: ({ req }) => {
      if (!req.user) return false;
      if (isPlatformAdmin(req.user as never)) return true;
      return storeScopedAccess("storeId")({ req });
    },
    create: ({ req }) => isPlatformAdmin(req.user as never),
    update: ({ req }) => isPlatformAdmin(req.user as never),
    delete: ({ req }) => isPlatformAdmin(req.user as never),
  },
  fields: [
    { name: "storeId", type: "relationship", relationTo: "stores", required: true },
    { name: "plan", type: "relationship", relationTo: "subscription-plans" as never, required: true },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "trialing",
      options: [
        { label: "Trialing", value: "trialing" },
        { label: "Active", value: "active" },
        { label: "Past due", value: "past_due" },
        { label: "Cancelled", value: "cancelled" },
        { label: "Expired", value: "expired" },
        { label: "Suspended", value: "suspended" },
      ],
    },
    {
      name: "billingCycle",
      type: "select",
      defaultValue: "monthly",
      options: [
        { label: "Monthly", value: "monthly" },
        { label: "Annual", value: "annual" },
      ],
    },
    { name: "trialEndsAt", type: "date" },
    { name: "currentPeriodStart", type: "date" },
    { name: "currentPeriodEnd", type: "date" },
    { name: "cancelAtPeriodEnd", type: "checkbox", defaultValue: false },
    { name: "amount", type: "number", min: 0, defaultValue: 0 },
    { name: "currency", type: "text", defaultValue: "PKR" },
    { name: "billingEmail", type: "email" },
    { name: "paymentProvider", type: "text", admin: { description: "Example: stripe, razorpay, manual" } },
    { name: "externalSubscriptionId", type: "text", admin: { description: "Provider-side subscription identifier." } },
    { name: "lastInvoiceAt", type: "date" },
    { name: "lastPaymentAt", type: "date" },
    { name: "notes", type: "textarea" },
  ],
  timestamps: true,
};

export const StoreInvoices: CollectionConfig = {
  slug: "store-invoices",
  dbName: dbName("store_invoices"),
  labels: { singular: "Store invoice", plural: "Store invoices" },
  admin: {
    useAsTitle: "invoiceNumber",
    group: "Platform",
    defaultColumns: ["storeId", "subscription", "invoiceNumber", "status", "amount", "currency"],
    description: "SaaS billing and invoice records for merchant subscriptions.",
  },
  access: {
    read: ({ req }) => {
      if (!req.user) return false;
      if (isPlatformAdmin(req.user as never)) return true;
      return storeScopedAccess("storeId")({ req });
    },
    create: ({ req }) => isPlatformAdmin(req.user as never),
    update: ({ req }) => isPlatformAdmin(req.user as never),
    delete: ({ req }) => isPlatformAdmin(req.user as never),
  },
  fields: [
    { name: "storeId", type: "relationship", relationTo: "stores", required: true },
    { name: "subscription", type: "relationship", relationTo: "store-subscriptions" as never },
    { name: "invoiceNumber", type: "text", required: true, unique: true },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Open", value: "open" },
        { label: "Paid", value: "paid" },
        { label: "Failed", value: "failed" },
        { label: "Refunded", value: "refunded" },
        { label: "Voided", value: "voided" },
      ],
    },
    { name: "amount", type: "number", required: true, min: 0, defaultValue: 0 },
    { name: "currency", type: "text", defaultValue: "PKR" },
    { name: "issuedAt", type: "date" },
    { name: "dueAt", type: "date" },
    { name: "paidAt", type: "date" },
    { name: "providerInvoiceId", type: "text", admin: { description: "Provider-side invoice identifier." } },
    { name: "providerCheckoutUrl", type: "text" },
    { name: "lines", type: "json", defaultValue: [], admin: { description: "Line items for the subscription invoice." } },
    { name: "notes", type: "textarea" },
  ],
  timestamps: true,
};
