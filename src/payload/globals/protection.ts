import type { CollectionConfig, GlobalConfig } from "payload";
import { platformAdmins } from "../access";
import { assignStore, storeAccess, storeField } from "../tenancy";
import { dbName, perStoreUnique, uniqueInStore } from "../fields";
import { revalidate } from "../revalidate";
const SETTINGS_TAG = "settings";

/**
 * Fake-order protection: which cash-on-delivery orders the customer must confirm (link / code by WhatsApp,
 * SMS or email) before they are packed, how long they have, how risky a phone number is, and when to ask
 * for advance payment instead of plain COD. Everything here is read by checkout on every order.
 */
export const OrderProtection: GlobalConfig = {
  slug: "order-protection",
  dbName: dbName("order-protection"),
  label: "Fake order protection",
  admin: { group: "Settings", description: "Stop fake and prank cash-on-delivery orders before you pay for delivery." },
  access: { read: platformAdmins, update: platformAdmins },
  hooks: { afterChange: [({ doc }) => (revalidate([SETTINGS_TAG]), doc)] },
  fields: [
    {
      type: "collapsible",
      label: "Ask customers to confirm COD orders",
      fields: [
        { name: "confirmEnabled", type: "checkbox", defaultValue: true, label: "Customers must confirm cash-on-delivery orders before we ship" },
        { type: "row", fields: [
          { name: "confirmAbove", type: "number", min: 0, defaultValue: 0, label: "Only orders of at least (Rs)", admin: { width: "50%", description: "0 = every COD order." } },
          { name: "autoCancelHours", type: "number", min: 1, max: 168, defaultValue: 24, label: "Cancel if not confirmed within (hours)", admin: { width: "50%", description: "Stock is put back automatically." } },
        ] },
        { name: "confirmZones", type: "text", hasMany: true, label: "Only for these delivery zones", admin: { description: "Type zone names exactly as in Delivery charges (e.g. “Rest of Pakistan”). Leave empty for all zones." } },
        { name: "skipWithAdvance", type: "checkbox", defaultValue: true, label: "Approving an advance payment confirms the order", admin: { description: "An uploaded advance screenshot never skips the confirmation by itself – when you approve the payment, the order moves to “To confirm” without waiting for the customer." } },
      ],
    },
    {
      type: "collapsible",
      label: "Risk score",
      admin: { description: "Each phone number gets a score from 0 (safe) to 100 from its past orders. Shown on every order." },
      fields: [
        { type: "row", fields: [
          { name: "pointsCancelled", type: "number", min: 0, defaultValue: 15, label: "Points per cancelled order", admin: { width: "33%" } },
          { name: "pointsRefused", type: "number", min: 0, defaultValue: 35, label: "Points per refused parcel (RTO)", admin: { width: "33%" } },
          { name: "pointsDelivered", type: "number", min: 0, defaultValue: 10, label: "Points removed per delivered order", admin: { width: "34%" } },
        ] },
        { type: "row", fields: [
          { name: "mediumAt", type: "number", min: 1, max: 100, defaultValue: 30, label: "“Some risk” from score", admin: { width: "50%" } },
          { name: "highAt", type: "number", min: 1, max: 100, defaultValue: 60, label: "“High risk” from score", admin: { width: "50%" } },
        ] },
      ],
    },
    {
      type: "collapsible",
      label: "Ask for advance payment",
      admin: { description: "These customers can still choose cash on delivery, but must upload proof of an advance payment first (amount set in Payment methods)." },
      fields: [
        { name: "advanceForHighRisk", type: "checkbox", defaultValue: true, label: "High-risk customers must pay an advance" },
        { name: "advanceForMediumRisk", type: "checkbox", defaultValue: false, label: "“Some risk” customers must pay an advance" },
        { name: "advanceCities", type: "text", hasMany: true, label: "Cities that must pay an advance", admin: { description: "e.g. cities with many refused parcels. Exact city names." } },
      ],
    },
  ],
};

/** Phone numbers you never want online orders from (or only with advance payment). */
export const BlockedPhones: CollectionConfig = {
  slug: "blocked-phones",
  dbName: dbName("blocked-phones"),
  labels: { singular: "Blocked number", plural: "Blocked numbers" },
  admin: { useAsTitle: "phone", group: "Settings", defaultColumns: ["phone", "action", "reason", "updatedAt"], description: "Checked at checkout. Add a number from an order page with “Block this number”." },
  access: storeAccess("store_staff"),
  indexes: perStoreUnique("phone"),
  hooks: {
    beforeValidate: [assignStore(), ({ data }) => (data?.phone ? { ...data, phone: String(data.phone).replace(/\D/g, "").replace(/^92/, "0") } : data)],
  },
  fields: [
    storeField(),
    { type: "row", fields: [
      { name: "phone", type: "text", required: true, index: true, validate: uniqueInStore("phone", "This number is already on the list."), admin: { width: "50%", description: "e.g. 03001234567" } },
      { name: "action", type: "select", required: true, defaultValue: "block", options: [
        { label: "Block online orders", value: "block" },
        { label: "Allow only with advance payment", value: "advance" },
      ], admin: { width: "50%" } },
    ] },
    { name: "reason", type: "text" },
    { name: "name", type: "text", label: "Customer name (for reference)" },
  ],
};
