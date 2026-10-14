import type { CollectionConfig } from "payload";
import { dbName, slugField } from "../fields";
import { getTenant, platformAdmins, readFor } from "../tenancy";

/**
 * ShopEngine's own billing (merchant → platform). Kept apart from customer payments (customer → merchant).
 * Only platform admins and the billing code write these; a store owner reads their store's subscription and invoices.
 */

export const SubscriptionPlans: CollectionConfig = {
  slug: "subscription-plans",
  dbName: dbName("subscription_plans"),
  labels: { singular: "Plan", plural: "Plans" },
  admin: {
    useAsTitle: "name",
    group: "Platform",
    defaultColumns: ["name", "priceMonthly", "priceAnnual", "trialDays", "maxProducts", "status"],
    description: "ShopEngine plans merchants choose from. Limits are enforced by the server.",
  },
  access: {
    // the public pricing list: active plans; platform admins see archived ones too
    read: async ({ req }) => ((await getTenant(req)).platformAdmin ? true : { status: { equals: "active" } }),
    create: platformAdmins,
    update: platformAdmins,
    delete: platformAdmins,
  },
  fields: [
    { name: "name", type: "text", required: true },
    slugField("name", { scope: "global" }),
    { name: "description", type: "textarea" },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "active",
      options: [
        { label: "Active", value: "active" },
        { label: "Archived (no new sign-ups)", value: "archived" },
      ],
    },
    { type: "row", fields: [
      { name: "priceMonthly", type: "number", required: true, min: 0, defaultValue: 0, admin: { width: "25%" } },
      { name: "priceAnnual", type: "number", required: true, min: 0, defaultValue: 0, admin: { width: "25%" } },
      { name: "currency", type: "text", defaultValue: "PKR", admin: { width: "25%" } },
      { name: "trialDays", type: "number", min: 0, defaultValue: 14, admin: { width: "25%" } },
    ] },
    { type: "row", fields: [
      { name: "maxProducts", type: "number", min: 0, defaultValue: 200, admin: { width: "33%", description: "0 = unlimited" } },
      { name: "maxStaffMembers", type: "number", min: 0, defaultValue: 5, admin: { width: "33%", description: "0 = unlimited" } },
      { name: "maxStorageGb", type: "number", min: 0, defaultValue: 10, admin: { width: "34%", description: "0 = unlimited" } },
    ] },
    {
      name: "features",
      type: "select",
      hasMany: true,
      options: [
        { label: "Custom domain", value: "custom_domain" },
        { label: "Online card payments", value: "online_payments" },
        { label: "Shop counter (POS)", value: "pos" },
        { label: "Advanced reports", value: "reports" },
        { label: "Discount codes", value: "discounts" },
        { label: "Abandoned cart recovery", value: "abandoned_carts" },
      ],
      admin: { description: "What stores on this plan can use (checked by the server)." },
    },
    { name: "highlight", type: "text", admin: { description: "Short selling line on the plan picker." } },
    { name: "providerPriceIdMonthly", type: "text", admin: { description: "Payment provider price id for monthly billing (e.g. Stripe price_…)." } },
    { name: "providerPriceIdAnnual", type: "text" },
    { name: "sortOrder", type: "number", defaultValue: 0 },
  ],
  timestamps: true,
};

const SUBSCRIPTION_STATUSES = [
  { label: "Trialing", value: "trialing" },
  { label: "Active", value: "active" },
  { label: "Past due", value: "past_due" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Expired", value: "expired" },
  { label: "Suspended", value: "suspended" },
];

export const StoreSubscriptions: CollectionConfig = {
  slug: "store-subscriptions",
  dbName: dbName("store_subscriptions"),
  labels: { singular: "Store subscription", plural: "Store subscriptions" },
  admin: {
    useAsTitle: "status",
    group: "Platform",
    defaultColumns: ["store", "plan", "status", "currentPeriodEnd", "billingCycle"],
    description: "Each store's ShopEngine plan (one per store).",
  },
  access: { read: readFor("store_owner"), create: platformAdmins, update: platformAdmins, delete: platformAdmins },
  fields: [
    { name: "store", type: "relationship", relationTo: "stores", required: true, unique: true, index: true },
    { name: "plan", type: "relationship", relationTo: "subscription-plans", required: true },
    { name: "status", type: "select", required: true, defaultValue: "trialing", index: true, options: SUBSCRIPTION_STATUSES },
    {
      name: "billingCycle",
      type: "select",
      defaultValue: "monthly",
      options: [
        { label: "Monthly", value: "monthly" },
        { label: "Annual", value: "annual" },
      ],
    },
    { type: "row", fields: [
      { name: "trialEndsAt", type: "date", admin: { width: "33%" } },
      { name: "currentPeriodStart", type: "date", admin: { width: "33%" } },
      { name: "currentPeriodEnd", type: "date", admin: { width: "34%" } },
    ] },
    { name: "cancelAtPeriodEnd", type: "checkbox", defaultValue: false },
    { name: "graceEndsAt", type: "date", admin: { description: "Past due: the shop stays open until this date, then the plan expires." } },
    { type: "row", fields: [
      { name: "amount", type: "number", min: 0, defaultValue: 0, admin: { width: "50%" } },
      { name: "currency", type: "text", defaultValue: "PKR", admin: { width: "50%" } },
    ] },
    { name: "billingEmail", type: "email" },
    { name: "paymentProvider", type: "text", admin: { description: "stripe, manual …" } },
    { name: "externalCustomerId", type: "text", index: true },
    { name: "externalSubscriptionId", type: "text", index: true, admin: { description: "Provider-side subscription id." } },
    { name: "lastInvoiceAt", type: "date" },
    { name: "lastPaymentAt", type: "date" },
    { name: "failedPayments", type: "number", defaultValue: 0 },
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
    defaultColumns: ["store", "invoiceNumber", "status", "amount", "currency", "issuedAt"],
    description: "ShopEngine invoices to merchants.",
  },
  access: { read: readFor("store_owner"), create: platformAdmins, update: platformAdmins, delete: platformAdmins },
  fields: [
    { name: "store", type: "relationship", relationTo: "stores", required: true, index: true },
    { name: "subscription", type: "relationship", relationTo: "store-subscriptions" },
    { name: "invoiceNumber", type: "text", required: true, unique: true },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "open",
      index: true,
      options: [
        { label: "Draft", value: "draft" },
        { label: "Open", value: "open" },
        { label: "Paid", value: "paid" },
        { label: "Failed", value: "failed" },
        { label: "Refunded", value: "refunded" },
        { label: "Voided", value: "voided" },
      ],
    },
    { type: "row", fields: [
      { name: "amount", type: "number", required: true, min: 0, defaultValue: 0, admin: { width: "50%" } },
      { name: "currency", type: "text", defaultValue: "PKR", admin: { width: "50%" } },
    ] },
    { type: "row", fields: [
      { name: "issuedAt", type: "date", admin: { width: "33%" } },
      { name: "dueAt", type: "date", admin: { width: "33%" } },
      { name: "paidAt", type: "date", admin: { width: "34%" } },
    ] },
    { type: "row", fields: [
      { name: "periodStart", type: "date", admin: { width: "50%" } },
      { name: "periodEnd", type: "date", admin: { width: "50%" } },
    ] },
    { name: "providerInvoiceId", type: "text", unique: true, admin: { description: "Provider-side invoice id (one record per provider invoice)." } },
    { name: "hostedInvoiceUrl", type: "text" },
    { name: "lines", type: "json", defaultValue: [] },
    { name: "notes", type: "textarea" },
  ],
  timestamps: true,
};
