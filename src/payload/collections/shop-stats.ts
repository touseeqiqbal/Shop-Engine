import type { CollectionConfig } from "payload";
import { storeAccess, storeField } from "../tenancy";
import { dbName } from "../fields";

/**
 * Daily counts behind Reports → Shop funnel (src/payload/shop-stats.ts): product views, add-to-carts and checkouts per
 * store, day and product. No person is in here. Written only by the server; managers read it through the report.
 */
export const ShopStats: CollectionConfig = {
  slug: "shop-stats",
  dbName: dbName("shop_stats"),
  labels: { singular: "Shop statistic", plural: "Shop statistics" },
  admin: { hidden: true },
  access: { ...storeAccess("store_manager"), create: () => false, update: () => false, delete: () => false },
  indexes: [{ fields: ["store", "day", "kind", "ref"], unique: true }],
  fields: [
    storeField(),
    { name: "day", type: "text", required: true, index: true },
    { name: "kind", type: "select", required: true, options: ["view", "cart", "checkout"].map((v) => ({ label: v, value: v })) },
    // the product's storefront id ('' for checkouts)
    { name: "ref", type: "text", defaultValue: "" },
    { name: "count", type: "number", defaultValue: 0 },
  ],
};
