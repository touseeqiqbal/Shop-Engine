import type { CollectionConfig } from "payload";
import { nobody } from "../access";
import { dbName } from "../fields";
import { platformAdmins, readFor, sameStore, storeField } from "../tenancy";

/**
 * Money that moved through a payment provider (customer → merchant), written ONLY by the server:
 *  - Payments: one row per charge or refund, with the provider's own id (never two rows for one provider payment).
 *  - Payment events: every webhook received, stored once per provider event id (a replayed or repeated webhook is
 *    recognised and ignored), with what was done with it.
 * An order is marked paid only from a verified provider event – never from the browser.
 * (ShopEngine's own billing of merchants is separate: store-subscriptions / store-invoices.)
 */

export const Payments: CollectionConfig = {
  slug: "payment-transactions",
  dbName: dbName("payment_transactions"),
  labels: { singular: "Payment", plural: "Payments" },
  admin: {
    group: "Sales",
    useAsTitle: "providerRef",
    defaultColumns: ["createdAt", "order", "kind", "status", "amount", "currency", "provider"],
    description: "Online payments and refunds, as reported by the payment provider. Read-only.",
  },
  defaultSort: "-createdAt",
  access: { read: readFor("store_manager"), create: nobody, update: nobody, delete: nobody },
  indexes: [{ fields: ["provider", "providerRef"], unique: true }],
  timestamps: true,
  fields: [
    storeField(),
    { type: "row", fields: [
      { name: "order", type: "relationship", relationTo: "orders", index: true, filterOptions: sameStore, admin: { width: "40%" } },
      { name: "kind", type: "select", required: true, defaultValue: "charge", options: [{ label: "Charge", value: "charge" }, { label: "Refund", value: "refund" }], admin: { width: "30%" } },
      {
        name: "status",
        type: "select",
        required: true,
        defaultValue: "pending",
        index: true,
        options: [
          { label: "Pending", value: "pending" },
          { label: "Succeeded", value: "succeeded" },
          { label: "Failed", value: "failed" },
          { label: "Cancelled / expired", value: "cancelled" },
          { label: "Refunded", value: "refunded" },
          { label: "Partly refunded", value: "partially_refunded" },
        ],
        admin: { width: "30%" },
      },
    ] },
    { type: "row", fields: [
      // a payment provider plugin's id ("stripe" …, lib/payments/catalog.ts) or "manual"
      { name: "provider", type: "text", required: true, index: true, admin: { width: "25%" } },
      { name: "providerRef", type: "text", required: true, index: true, label: "Provider id", admin: { width: "45%", description: "e.g. the checkout session / payment / refund id." } },
      { name: "amount", type: "number", required: true, min: 0, admin: { width: "15%" } },
      { name: "currency", type: "text", required: true, admin: { width: "15%" } },
    ] },
    { type: "row", fields: [
      { name: "refundedAmount", type: "number", defaultValue: 0, min: 0, admin: { width: "33%" } },
      { name: "paymentIntent", type: "text", index: true, admin: { width: "33%" } },
      { name: "idempotencyKey", type: "text", unique: true, admin: { width: "34%", description: "Sent with the provider call, so a retry never charges or refunds twice." } },
    ] },
    { name: "failureReason", type: "text" },
    { name: "checkoutUrl", type: "text", admin: { hidden: true } },
    { name: "expiresAt", type: "date", index: true, admin: { readOnly: true } },
  ],
};

export const PaymentEvents: CollectionConfig = {
  slug: "payment-events",
  dbName: dbName("payment_events"),
  labels: { singular: "Payment event", plural: "Payment events" },
  admin: {
    group: "Platform",
    useAsTitle: "eventId",
    defaultColumns: ["receivedAt", "provider", "type", "status", "store"],
    description: "Every webhook from a payment provider – each stored once (replays are ignored).",
  },
  defaultSort: "-receivedAt",
  access: { read: platformAdmins, create: nobody, update: nobody, delete: nobody },
  indexes: [{ fields: ["provider", "eventId"], unique: true }],
  timestamps: true,
  fields: [
    storeField(),
    { type: "row", fields: [
      { name: "provider", type: "text", required: true, admin: { width: "25%" } },
      { name: "eventId", type: "text", required: true, index: true, admin: { width: "40%" } },
      { name: "type", type: "text", index: true, admin: { width: "35%" } },
    ] },
    { type: "row", fields: [
      {
        name: "status",
        type: "select",
        required: true,
        defaultValue: "received",
        index: true,
        options: [
          { label: "Received", value: "received" },
          { label: "Processed", value: "processed" },
          { label: "Ignored", value: "ignored" },
          { label: "Failed", value: "failed" },
        ],
        admin: { width: "33%" },
      },
      { name: "receivedAt", type: "date", index: true, admin: { width: "33%" } },
      { name: "processedAt", type: "date", admin: { width: "34%" } },
    ] },
    { name: "error", type: "textarea" },
    { name: "summary", type: "json", admin: { description: "The ids and amounts that mattered (the full payload isn't kept)." } },
  ],
};
