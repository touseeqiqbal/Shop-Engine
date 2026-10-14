import type { GlobalConfig } from "payload";
import { platformAdmins } from "../access";
import { dbName } from "../fields";

/**
 * Settings → Notifications: who gets alerts and which customer messages are sent.
 * Channels still need their keys (SMTP_* or RESEND_API_KEY for email, WHATSAPP_TOKEN… for WhatsApp, SMS_WEBHOOK_URL for SMS).
 * Staging never sends anything.
 */
const STATUSES = [
  { label: "Confirmed", value: "confirmed" },
  { label: "Dispatched", value: "dispatched" },
  { label: "Out for delivery", value: "out-for-delivery" },
  { label: "Delivered", value: "delivered" },
];

export const NotificationSettings: GlobalConfig = {
  slug: "notifications",
  dbName: dbName("notifications"),
  label: "Notifications",
  admin: { group: "Settings", description: "Order and enquiry alerts for your team, and the messages customers receive." },
  access: { read: platformAdmins, update: platformAdmins },
  fields: [
    {
      type: "collapsible",
      label: "Team alerts",
      fields: [
        { name: "staffEmails", type: "text", hasMany: true, label: "Send alerts to", admin: { description: "Email addresses. Empty = the store email (Store info)." } },
        { type: "row", fields: [
          { name: "alertNewOrder", type: "checkbox", defaultValue: true, label: "New order", admin: { width: "33%" } },
          { name: "alertWholesale", type: "checkbox", defaultValue: true, label: "Wholesale quote request", admin: { width: "33%" } },
          { name: "alertContact", type: "checkbox", defaultValue: false, label: "Contact form message", admin: { width: "34%" } },
        ] },
      ],
    },
    {
      type: "collapsible",
      label: "Customer messages",
      fields: [
        { type: "row", fields: [
          { name: "customerEmail", type: "checkbox", defaultValue: true, label: "Email", admin: { width: "33%" } },
          { name: "customerWhatsApp", type: "checkbox", defaultValue: true, label: "WhatsApp", admin: { width: "33%" } },
          { name: "customerSms", type: "checkbox", defaultValue: true, label: "SMS", admin: { width: "34%" } },
        ] },
        { name: "orderConfirmation", type: "checkbox", defaultValue: true, label: "Send an order confirmation when an order is placed" },
        { name: "statusUpdates", type: "select", hasMany: true, defaultValue: STATUSES.map((s) => s.value), options: STATUSES, label: "Send an update when an order becomes…" },
      ],
    },
  ],
};
