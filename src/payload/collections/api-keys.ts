import type { CollectionConfig } from "payload";
import { nobody, noField } from "../access";
import { dbName } from "../fields";
import { readFor, storeField, writeFor } from "../tenancy";

/**
 * Store API keys (/cms → Integrations → Store API): the store's own systems (ERP, stock sync, Zapier / Make / n8n) read
 * products and orders and update stock, prices and order status through /api/v1 (src/lib/store-api.ts).
 * A key is shown ONCE when it is made; only its SHA-256 hash is kept. Each key has its own permissions.
 */
export const API_SCOPES = [
  { label: "Read products", value: "products:read" },
  { label: "Update stock & prices", value: "products:write" },
  { label: "Read orders", value: "orders:read" },
  { label: "Update order status & tracking", value: "orders:write" },
] as const;

export const ApiKeys: CollectionConfig = {
  slug: "api-keys",
  dbName: dbName("api_keys"),
  labels: { singular: "API key", plural: "API keys" },
  admin: { hidden: true, useAsTitle: "name" },
  // made only by /cms-api/integration-tools/api-keys (the key is returned once); the team removes them there too
  access: { read: readFor("store_manager"), create: nobody, update: nobody, delete: writeFor("store_manager") },
  timestamps: true,
  fields: [
    storeField(),
    { name: "name", type: "text", required: true },
    // "se_live_abcd…" – enough to recognise a key
    { name: "prefix", type: "text", required: true },
    { name: "hash", type: "text", required: true, unique: true, index: true, hidden: true, access: { read: noField, create: noField, update: noField } },
    { name: "scopes", type: "select", hasMany: true, options: API_SCOPES.map((s) => ({ ...s })) },
    { name: "createdBy", type: "text" },
    { name: "lastUsedAt", type: "date" },
  ],
};
