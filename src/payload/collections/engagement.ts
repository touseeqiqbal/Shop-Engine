import type { CollectionAfterChangeHook, CollectionConfig, GlobalConfig } from "payload";
import { anyone, platformAdmins } from "../access";
import { assignStore, publicOrStore, sameStore, storeAccess, storeField, storeIdOf, storeRoleField } from "../tenancy";
import { dbName, perStoreUnique } from "../fields";
import { optOutKey } from "../optout-key";
import { revalidate } from "../revalidate";
import { log } from "../../lib/log";

/**
 * Customer engagement:
 * - Trade-ins: "Sell / trade in your laptop" requests (inbox in /cms).
 * - Product questions: shoppers ask, staff answer; published answers show on the product page.
 * - Stock / price alerts: "tell me when it's back" and "tell me if the price drops".
 * - Abandoned carts: checkout started with a phone / email but not finished – reminder sent later.
 * - Installments & EMI block and abandoned-cart reminder settings (one settings page).
 */

const tabs = (label: string, list: { label: string; where: string }[]) => ({
  beforeListTable: [{ path: "/payload/admin/ui/ListTabs#ListTabs", clientProps: { label, tabs: list } }],
});

/* ───────────── trade-ins ───────────── */

export const TradeIns: CollectionConfig = {
  slug: "trade-ins",
  dbName: dbName("trade-ins"),
  labels: { singular: "Trade-in", plural: "Trade-ins" },
  admin: {
    useAsTitle: "summary",
    group: "Customers & staff",
    defaultColumns: ["summary", "name", "phone", "expectedPrice", "status", "createdAt"],
    listSearchableFields: ["summary", "name", "phone", "model"],
    components: tabs("Trade-in views", [
      { label: "All", where: "" },
      { label: "New", where: "where[status][equals]=new" },
      { label: "Contacted", where: "where[status][equals]=contacted" },
      { label: "Offer made", where: "where[status][equals]=offered" },
      { label: "Bought", where: "where[status][equals]=bought" },
      { label: "Not bought", where: "where[status][equals]=declined" },
    ]),
  },
  access: storeAccess("store_staff"),
  hooks: {
    beforeValidate: [assignStore()],
    beforeChange: [({ data }) => ({ ...data, summary: [data.brand, data.model].filter(Boolean).join(" ") || data.summary || "Laptop" })],
  },
  fields: [
    storeField(),
    { type: "row", fields: [
      { name: "status", type: "select", required: true, defaultValue: "new", index: true, options: [
        { label: "New", value: "new" },
        { label: "Contacted", value: "contacted" },
        { label: "Offer made", value: "offered" },
        { label: "Bought", value: "bought" },
        { label: "Not bought", value: "declined" },
      ], admin: { width: "34%" } },
      { name: "offerPrice", type: "number", min: 0, label: "Our offer", admin: { width: "33%" } },
      { name: "expectedPrice", type: "number", min: 0, label: "Customer expects", admin: { width: "33%" } },
    ] },
    { name: "summary", type: "text", admin: { readOnly: true } },
    { type: "row", fields: [
      { name: "brand", type: "text", required: true, admin: { width: "34%" } },
      { name: "model", type: "text", required: true, admin: { width: "33%" } },
      { name: "condition", type: "select", options: [
        { label: "Like new", value: "like-new" },
        { label: "Good – small marks", value: "good" },
        { label: "Fair – visible wear", value: "fair" },
        { label: "Has a fault", value: "faulty" },
      ], admin: { width: "33%" } },
    ] },
    { type: "row", fields: [
      { name: "processor", type: "text", admin: { width: "34%" } },
      { name: "ram", type: "text", label: "RAM", admin: { width: "33%" } },
      { name: "storage", type: "text", admin: { width: "33%" } },
    ] },
    { type: "row", fields: [
      { name: "batteryHealth", type: "text", admin: { width: "34%" } },
      { name: "accessories", type: "text", label: "Comes with", admin: { width: "66%" } },
    ] },
    { name: "faults", type: "textarea", label: "Faults / notes from the customer" },
    { name: "wantsTradeIn", type: "checkbox", label: "Wants to trade in for another laptop" },
    { name: "photoKeys", type: "json", label: "Photos", admin: { components: { Field: "/payload/admin/aftersales/Photos#Photos" } } },
    { type: "row", fields: [
      { name: "name", type: "text", required: true, admin: { width: "34%" } },
      { name: "phone", type: "text", required: true, index: true, admin: { width: "33%" } },
      { name: "city", type: "text", admin: { width: "33%" } },
    ] },
    { name: "notes", type: "textarea", label: "Team notes", admin: { position: "sidebar" } },
  ],
};

/* ───────────── product questions ───────────── */

const questionAnswered: CollectionAfterChangeHook = async ({ doc, previousDoc, context, req }) => {
  if (context?.migrating) return doc;
  if (doc.published || previousDoc?.published) revalidate(["catalog"]);
  if (doc.answer && doc.published && !previousDoc?.published && doc.email) {
    // queued with the save (sent by the outbox once it is committed; never twice)
    try {
      const { queueNotification } = await import("../../lib/notify");
      await queueNotification(
        req.payload,
        "question-answered",
        storeIdOf(doc.store),
        { email: String(doc.email), name: String(doc.name ?? ""), question: String(doc.question), answer: String(doc.answer), productId: typeof doc.product === "object" ? doc.product?.id : doc.product },
        { req, dedupeKey: `question-answered:${String(doc.id)}` },
      );
    } catch (e) {
      log.error("questions.notify_failed", e);
    }
  }
  return doc;
};

export const ProductQuestions: CollectionConfig = {
  slug: "product-questions",
  dbName: dbName("product-questions"),
  labels: { singular: "Product question", plural: "Product questions" },
  admin: {
    useAsTitle: "question",
    group: "Catalog",
    defaultColumns: ["question", "product", "answer", "published", "createdAt"],
    description: "Shoppers' questions from product pages. Write the answer and tick “Show on product page”.",
    components: tabs("Question views", [
      { label: "All", where: "" },
      { label: "To answer", where: "where[published][not_equals]=true" },
      { label: "On product pages", where: "where[published][equals]=true" },
    ]),
  },
  access: { ...storeAccess("store_staff"), read: publicOrStore("store_staff", { published: { equals: true } }) },
  hooks: { beforeValidate: [assignStore()], afterChange: [questionAnswered] },
  fields: [
    storeField(),
    { name: "product", type: "relationship", relationTo: "products", required: true, index: true, filterOptions: sameStore },
    { name: "question", type: "textarea", required: true },
    { name: "answer", type: "textarea" },
    { name: "published", type: "checkbox", label: "Show on product page", index: true },
    { type: "row", fields: [
      { name: "name", type: "text", admin: { width: "50%" } },
      { name: "email", type: "text", label: "Email (we tell them when it's answered)", access: { read: storeRoleField("store_staff") }, admin: { width: "50%" } },
    ] },
  ],
};

/* ───────────── stock & price alerts ───────────── */

export const StockAlerts: CollectionConfig = {
  slug: "stock-alerts",
  dbName: dbName("stock-alerts"),
  labels: { singular: "Stock / price alert", plural: "Stock & price alerts" },
  admin: {
    useAsTitle: "contact",
    group: "Marketing",
    defaultColumns: ["contact", "product", "kind", "status", "createdAt"],
    description: "Shoppers waiting for a product to come back or get cheaper. Sent automatically.",
    components: tabs("Alert views", [
      { label: "Waiting", where: "where[status][equals]=waiting" },
      { label: "Sent", where: "where[status][equals]=sent" },
      { label: "All", where: "" },
    ]),
  },
  access: storeAccess("store_staff"),
  hooks: { beforeValidate: [assignStore()] },
  fields: [
    storeField(),
    { type: "row", fields: [
      { name: "product", type: "relationship", relationTo: "products", required: true, index: true, filterOptions: sameStore, admin: { width: "50%" } },
      { name: "kind", type: "select", required: true, options: [
        { label: "Back in stock", value: "stock" },
        { label: "Price drop", value: "price" },
      ], admin: { width: "25%" } },
      { name: "status", type: "select", required: true, defaultValue: "waiting", index: true, options: [
        { label: "Waiting", value: "waiting" },
        { label: "Sent", value: "sent" },
        { label: "Cancelled", value: "cancelled" },
      ], admin: { width: "25%" } },
    ] },
    { type: "row", fields: [
      { name: "contact", type: "text", required: true, label: "Email or phone", admin: { width: "50%" } },
      { name: "priceAtSignup", type: "number", label: "Price when they asked", admin: { width: "50%" } },
    ] },
    { name: "sentAt", type: "date", admin: { readOnly: true, date: { pickerAppearance: "dayAndTime" } } },
  ],
};

/* ───────────── abandoned carts ───────────── */

export const AbandonedCarts: CollectionConfig = {
  slug: "abandoned-carts",
  dbName: dbName("abandoned-carts"),
  labels: { singular: "Abandoned cart", plural: "Abandoned carts" },
  admin: {
    useAsTitle: "contact",
    group: "Marketing",
    defaultColumns: ["contact", "total", "status", "remindersSent", "updatedAt"],
    description: "Checkouts started with a phone or email but not finished. Reminders go out automatically (Settings → Installments & reminders).",
    components: tabs("Cart views", [
      { label: "Open", where: "where[status][equals]=open" },
      { label: "Reminded", where: "where[status][equals]=reminded" },
      { label: "Came back & ordered", where: "where[status][equals]=recovered" },
      { label: "All", where: "" },
    ]),
  },
  access: storeAccess("store_staff"),
  hooks: { beforeValidate: [assignStore()] },
  fields: [
    storeField(),
    { type: "row", fields: [
      { name: "status", type: "select", required: true, defaultValue: "open", index: true, options: [
        { label: "Open", value: "open" },
        { label: "Reminded", value: "reminded" },
        { label: "Came back & ordered", value: "recovered" },
        { label: "Stopped (asked not to)", value: "stopped" },
      ], admin: { width: "34%" } },
      { name: "total", type: "number", label: "Cart value", admin: { width: "33%" } },
      { name: "remindersSent", type: "number", defaultValue: 0, admin: { width: "33%", readOnly: true } },
    ] },
    { type: "row", fields: [
      { name: "contact", type: "text", required: true, index: true, admin: { width: "34%" } },
      { name: "email", type: "text", index: true, admin: { width: "33%" } },
      { name: "phone", type: "text", index: true, admin: { width: "33%" } },
    ] },
    { name: "name", type: "text" },
    { name: "items", type: "json", required: true },
    { name: "token", type: "text", unique: true, index: true, admin: { hidden: true } },
    { name: "lastActivityAt", type: "date", index: true, admin: { readOnly: true, date: { pickerAppearance: "dayAndTime" } } },
    { name: "lastReminderAt", type: "date", admin: { readOnly: true, date: { pickerAppearance: "dayAndTime" } } },
    { name: "recoveredOrder", type: "text", admin: { readOnly: true } },
  ],
};

/**
 * People who asked this store for no more cart reminders or marketing messages – the link in a reminder or their email
 * app's one-click "Unsubscribe" (src/payload/optouts.ts). Reminders and the subscribers export skip them.
 */
export const EmailOptOuts: CollectionConfig = {
  slug: "email-optouts",
  dbName: dbName("email_optouts"),
  labels: { singular: "Unsubscribed contact", plural: "Unsubscribed" },
  admin: {
    useAsTitle: "contact",
    group: "Marketing",
    defaultColumns: ["contact", "source", "createdAt"],
    description: "Asked for no more cart reminders or marketing messages from this store – reminders and the subscribers export skip them. Remove someone only if they ask to hear from you again (ticking “send me offers” at checkout does it too).",
  },
  access: storeAccess("store_staff", "store_manager", "store_manager", "store_manager"),
  indexes: perStoreUnique("contact"),
  hooks: { beforeValidate: [assignStore(), ({ data }) => (data?.contact ? { ...data, contact: optOutKey(data.contact) } : data)] },
  fields: [
    storeField(),
    { type: "row", fields: [
      { name: "contact", type: "text", required: true, index: true, label: "Email or phone", admin: { width: "60%" } },
      { name: "source", type: "text", defaultValue: "staff", label: "How", admin: { width: "40%", readOnly: true, description: "cart-reminder = the link in a reminder · one-click = their email app · staff = added here" } },
    ] },
  ],
};

/* ───────────── settings: installments + reminders ───────────── */

export const ConversionSettings: GlobalConfig = {
  slug: "conversion",
  dbName: dbName("conversion"),
  label: "Installments & reminders",
  admin: { group: "Settings", description: "Installment (EMI) block on product pages and the Installments page, plus cart / stock / price reminder messages." },
  access: { read: anyone, update: platformAdmins },
  hooks: { afterChange: [({ doc }) => (revalidate(["settings", "catalog"], ["/installments"]), doc)] },
  fields: [
    {
      type: "collapsible",
      label: "Installments / EMI",
      fields: [
        { name: "emiEnabled", type: "checkbox", defaultValue: false, label: "Show the installments block on product pages" },
        { type: "row", fields: [
          { name: "emiMinPrice", type: "number", min: 0, defaultValue: 30000, label: "Only for products from", admin: { width: "50%" } },
          { name: "emiHeading", type: "text", defaultValue: "Pay in easy installments", label: "Heading", admin: { width: "50%" } },
        ] },
        { name: "emiNote", type: "textarea", defaultValue: "Available with credit cards of the banks below. Final amount is confirmed by your bank. WhatsApp us to apply.", label: "Small print" },
        {
          name: "emiPlans",
          type: "array",
          label: "Plans",
          labels: { singular: "Plan", plural: "Plans" },
          fields: [{ type: "row", fields: [
            { name: "bank", type: "text", required: true, admin: { width: "40%" } },
            { name: "months", type: "number", required: true, min: 1, max: 60, admin: { width: "20%" } },
            { name: "markupPercent", type: "number", min: 0, defaultValue: 0, label: "Markup % (total)", admin: { width: "20%" } },
            { name: "minAmount", type: "number", min: 0, label: "Min amount", admin: { width: "20%" } },
          ] }],
        },
      ],
    },
    {
      type: "collapsible",
      label: "Abandoned cart reminders",
      fields: [
        { name: "cartEnabled", type: "checkbox", defaultValue: true, label: "Remind shoppers who left items at checkout" },
        { type: "row", fields: [
          { name: "cartFirstHours", type: "number", min: 1, defaultValue: 3, label: "First reminder after (hours)", admin: { width: "50%" } },
          { name: "cartSecondHours", type: "number", min: 0, defaultValue: 24, label: "Second reminder after (hours, 0 = none)", admin: { width: "50%" } },
        ] },
        { name: "cartSubject", type: "text", defaultValue: "You left something in your cart", label: "Email subject" },
        { name: "cartMessage", type: "textarea", defaultValue: "Your items are still waiting – stock is limited, so complete your order before they're gone.", label: "Message" },
        { name: "cartCoupon", type: "text", label: "Coupon code to offer (optional)", admin: { description: "Create it first in Marketing → Discount codes." } },
      ],
    },
    {
      type: "collapsible",
      label: "Stock & price alerts",
      fields: [
        { name: "alertsEnabled", type: "checkbox", defaultValue: true, label: "Show “Notify me” on product pages and send the alerts" },
        { name: "priceDropPercent", type: "number", min: 1, max: 90, defaultValue: 3, label: "Send a price-drop alert when the price falls by at least (%)" },
      ],
    },
  ],
};
