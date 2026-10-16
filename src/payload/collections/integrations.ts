import type { CollectionConfig } from "payload";
import { nobody, noField } from "../access";
import { dbName, perStoreUnique } from "../fields";
import { readFor, storeField } from "../tenancy";
import { revalidate } from "../revalidate";

// checkout reads the connected payment providers from the cached store settings (lib/repo/catalog.ts, tag "settings")
const SETTINGS_TAG = "settings";
const refreshCheckout = () => revalidate([SETTINGS_TAG], ["/checkout"]);

/**
 * A store's connections to outside services (couriers, payment providers, its own WhatsApp / SMS / email accounts,
 * ad and email-marketing tools, accounting, chat, marketplaces) – one per store and provider.
 *
 * Written only by the server (/cms → Integrations, src/payload/endpoints/integrations.ts): keys are stored encrypted in
 * `secrets` (lib/integrations/secrets.ts), which no API ever returns; the admin shows `secretHints` (last 4 characters).
 * What each provider needs is described in lib/integrations/catalog.
 */
export const Integrations: CollectionConfig = {
  slug: "integrations",
  dbName: dbName("integrations"),
  labels: { singular: "Integration", plural: "Integrations" },
  admin: { hidden: true, useAsTitle: "provider", group: "Settings" },
  access: { read: readFor("store_manager"), create: nobody, update: nobody, delete: nobody },
  indexes: perStoreUnique("provider"),
  timestamps: true,
  hooks: {
    afterChange: [({ doc }) => (refreshCheckout(), doc)],
    afterDelete: [({ doc }) => (refreshCheckout(), doc)],
  },
  fields: [
    storeField(),
    { name: "provider", type: "text", required: true, index: true },
    { name: "category", type: "text", required: true, index: true },
    { name: "enabled", type: "checkbox", defaultValue: true, index: true },
    { name: "mode", type: "select", defaultValue: "live", options: [{ label: "Live", value: "live" }, { label: "Test", value: "test" }] },
    // public settings (account ids, sender names, options) – what the provider's card in /cms shows
    { name: "config", type: "json" },
    // API keys, passwords, tokens – encrypted; never readable through any API
    { name: "secrets", type: "text", hidden: true, access: { read: noField, create: noField, update: noField } },
    { name: "secretHints", type: "json" },
    // the provider's own state (e.g. the last sync, an OAuth account name) – nothing secret
    { name: "state", type: "json" },
    {
      name: "status",
      type: "select",
      defaultValue: "connected",
      options: [
        { label: "Connected", value: "connected" },
        { label: "Needs attention", value: "error" },
      ],
    },
    { name: "lastCheckedAt", type: "date" },
    { name: "lastError", type: "text" },
    // the store's own address for this provider's updates: /api/integrations/<provider>/<webhookKey>
    { name: "webhookKey", type: "text", unique: true, index: true },
  ],
};
