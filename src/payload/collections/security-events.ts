import type { CollectionConfig } from "payload";
import { nobody } from "../access";
import { dbName } from "../fields";
import { platformAdmins } from "../tenancy";

/**
 * Security events across ShopEngine (Platform → Security events): sign-ins to /cms and to the shops, wrong passwords
 * and codes, 2-step verification switched on / off / reset, password resets. Written by the server only
 * (lib/security-events.ts), read by platform admins, kept 180 days (housekeeping). The network address is shortened
 * (last part hidden) – enough to spot a pattern, not to identify a household.
 */
export const SECURITY_EVENT_KINDS = [
  { label: "Signed in", value: "sign-in" },
  { label: "Wrong password", value: "sign-in-failed" },
  { label: "Wrong 2-step code", value: "two-factor-failed" },
  { label: "2-step paused (too many wrong codes)", value: "two-factor-locked" },
  { label: "2-step switched on", value: "two-factor-on" },
  { label: "2-step switched off", value: "two-factor-off" },
  { label: "2-step reset by a platform admin", value: "two-factor-reset" },
  { label: "New backup codes", value: "backup-codes" },
  { label: "Password reset asked for", value: "password-reset-requested" },
  { label: "Password changed", value: "password-changed" },
  { label: "Too many attempts", value: "rate-limited" },
  { label: "Support: viewing a store as a role", value: "support-view" },
] as const;
export type SecurityEventKind = (typeof SECURITY_EVENT_KINDS)[number]["value"];

export const SecurityEvents: CollectionConfig = {
  slug: "security-events",
  dbName: dbName("security_events"),
  labels: { singular: "Security event", plural: "Security events" },
  admin: {
    group: "Platform",
    useAsTitle: "kind",
    defaultColumns: ["createdAt", "kind", "email", "area", "ip", "detail"],
    description: "Sign-ins, wrong passwords and codes, 2-step verification changes and password resets – everywhere on ShopEngine. Kept 180 days.",
  },
  access: { read: platformAdmins, create: nobody, update: nobody, delete: nobody },
  defaultSort: "-createdAt",
  timestamps: true,
  fields: [
    { name: "kind", type: "select", required: true, index: true, options: SECURITY_EVENT_KINDS.map((k) => ({ ...k })) },
    { name: "area", type: "select", required: true, defaultValue: "admin", index: true, options: [{ label: "/cms (admin)", value: "admin" }, { label: "Shop (customer account)", value: "shop" }] },
    { name: "email", type: "text", index: true },
    // the account's id as a plain number: no link to the users table, so writing an event during a sign-in never waits
    // on that sign-in's own lock on the account
    { name: "userId", type: "number", index: true, label: "Account id" },
    { name: "ip", type: "text", label: "Network (shortened)" },
    { name: "detail", type: "text" },
  ],
};
