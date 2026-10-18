import { randomBytes } from "node:crypto";
import type { CollectionBeforeChangeHook, CollectionConfig } from "payload";
import { dbName } from "../fields";
import { userError } from "../errors";
import { assignStore, readFor, storeField, storeRoleField, writeFor, createFor } from "../tenancy";

/**
 * Webhooks a store sends to its own systems (ERP, accounting, a Zapier hook…) when orders change.
 * Deliveries go through the outbox (src/lib/webhooks.ts): signed with the endpoint's secret, retried with growing waits,
 * never to private / internal network addresses.
 */

export const WEBHOOK_EVENTS = [
  { label: "Order placed", value: "order.created" },
  { label: "Order status changed", value: "order.updated" },
  { label: "Order paid (card)", value: "order.paid" },
  { label: "Refund made (card)", value: "refund.created" },
] as const;

/** https only (http for localhost while developing); no credentials in the address; not an internal address. */
const checkUrl: CollectionBeforeChangeHook = async ({ data, operation, originalDoc }) => {
  const raw = String(data.url ?? originalDoc?.url ?? "").trim();
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw userError("Enter the full address, e.g. https://example.com/hooks/shopengine", 400);
  }
  const local = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(u.hostname);
  if (u.protocol !== "https:" && !(local && u.protocol === "http:")) throw userError("Webhook addresses must start with https://", 400);
  if (u.username || u.password) throw userError("Don't put a password in the address – use the signing secret to check deliveries.", 400);
  // early feedback only – every delivery checks the address it connects to again (lib/net/public-request)
  const { resolvePublicHost } = await import("../../lib/net/public-request");
  await resolvePublicHost(u.hostname).catch((e: Error) => {
    if (e.name === "PrivateAddressError") throw userError("That address points to a private network – webhooks can only go to public addresses.", 400);
    // a name that doesn't resolve yet is allowed (DNS may be set up later); deliveries are checked anyway
  });
  data.url = u.toString();
  // a new endpoint gets its signing secret (shown to the store's managers)
  if (operation === "create" || !originalDoc?.secret) data.secret = `whsec_${randomBytes(24).toString("hex")}`;
  return data;
};

export const WebhookEndpoints: CollectionConfig = {
  slug: "webhook-endpoints",
  dbName: dbName("webhook_endpoints"),
  labels: { singular: "Webhook", plural: "Webhooks" },
  admin: {
    group: "Settings",
    useAsTitle: "url",
    defaultColumns: ["url", "events", "active", "lastStatus", "lastDeliveryAt"],
    description: "Tell your other systems about orders. Each delivery is a POST with JSON and a ShopEngine-Signature header (HMAC-SHA256 of “timestamp.body” with the secret).",
  },
  access: { read: readFor("store_manager"), create: createFor("store_manager"), update: writeFor("store_manager"), delete: writeFor("store_manager") },
  hooks: { beforeValidate: [assignStore()], beforeChange: [checkUrl] },
  timestamps: true,
  fields: [
    storeField(),
    { name: "url", type: "text", required: true, label: "Address (URL)" },
    { name: "events", type: "select", hasMany: true, required: true, options: WEBHOOK_EVENTS.map((e) => ({ ...e })), defaultValue: ["order.created", "order.updated"] },
    { name: "active", type: "checkbox", defaultValue: true },
    {
      name: "secret",
      type: "text",
      label: "Signing secret",
      access: { read: storeRoleField("store_manager"), create: () => false, update: () => false },
      admin: { readOnly: true, description: "Use it to check that a delivery really came from ShopEngine. Made for you." },
    },
    { type: "row", fields: [
      { name: "lastStatus", type: "text", label: "Last answer", admin: { width: "34%", readOnly: true } },
      { name: "lastDeliveryAt", type: "date", label: "Last delivery", admin: { width: "33%", readOnly: true } },
      { name: "failures", type: "number", defaultValue: 0, admin: { width: "33%", readOnly: true, description: "In a row." } },
    ] },
  ],
};
