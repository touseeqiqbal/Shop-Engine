import type { CollectionConfig } from "payload";
import { nobody } from "../access";
import { dbName } from "../fields";
import { platformAdmins, readFor, storeField } from "../tenancy";

/**
 * Transactional outbox: messages (email, WhatsApp, SMS) and other side effects are written HERE in the same database
 * transaction as the change that causes them, then delivered by the background worker (src/lib/outbox.ts) with retries.
 * A crash or redeploy can no longer lose them, and a retry never sends the same message twice (dedupeKey).
 */
export const OutboxEvents: CollectionConfig = {
  slug: "outbox-events",
  dbName: dbName("outbox_events"),
  labels: { singular: "Background delivery", plural: "Background deliveries" },
  admin: {
    group: "Platform",
    useAsTitle: "type",
    defaultColumns: ["type", "status", "attempts", "nextAttemptAt", "lastError", "createdAt"],
    description: "Messages and tasks waiting to be sent, retried or given up on (Dead). Platform admins can retry a dead one by setting it back to Pending.",
  },
  defaultSort: "-createdAt",
  access: { read: readFor("store_manager"), create: nobody, update: platformAdmins, delete: platformAdmins },
  timestamps: true,
  fields: [
    storeField(),
    { type: "row", fields: [
      { name: "type", type: "text", required: true, index: true, admin: { width: "40%", readOnly: true } },
      {
        name: "status",
        type: "select",
        required: true,
        defaultValue: "pending",
        index: true,
        options: [
          { label: "Pending", value: "pending" },
          { label: "Sending", value: "processing" },
          { label: "Sent", value: "sent" },
          { label: "Dead (gave up)", value: "dead" },
        ],
        admin: { width: "30%" },
      },
      { name: "attempts", type: "number", defaultValue: 0, admin: { width: "30%", readOnly: true } },
    ] },
    { name: "data", type: "json", admin: { readOnly: true } },
    { name: "dedupeKey", type: "text", unique: true, index: true, admin: { readOnly: true, description: "One delivery per key – a repeated event never sends twice." } },
    { type: "row", fields: [
      { name: "nextAttemptAt", type: "date", index: true, admin: { width: "33%", date: { pickerAppearance: "dayAndTime" } } },
      { name: "lockedAt", type: "date", admin: { width: "33%", readOnly: true, date: { pickerAppearance: "dayAndTime" } } },
      { name: "sentAt", type: "date", admin: { width: "34%", readOnly: true, date: { pickerAppearance: "dayAndTime" } } },
    ] },
    { name: "lastError", type: "textarea", admin: { readOnly: true } },
  ],
};
