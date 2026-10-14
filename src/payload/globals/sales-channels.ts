import type { GlobalConfig } from "payload";
import { platformAdmins } from "../access";
import { sameStore } from "../tenancy";
import { dbName } from "../fields";
import { revalidate } from "../revalidate";

/** Product feeds for Google Merchant Center, Meta (Facebook / Instagram shops) and TikTok Shop / catalog ads. */
export const SalesChannels: GlobalConfig = {
  slug: "sales-channels",
  dbName: dbName("sales-channels"),
  label: "Sales channels (product feeds)",
  admin: { group: "Settings", description: "Paste a feed address into Google Merchant Center, Meta Commerce Manager or TikTok Catalog Manager as a scheduled feed (daily). The feeds update by themselves when you change products." },
  access: { read: platformAdmins, update: platformAdmins },
  hooks: { afterChange: [({ doc }) => (revalidate(["settings", "catalog"], ["/feeds/google.xml", "/feeds/meta.xml", "/feeds/tiktok.csv"]), doc)] },
  fields: [
    { name: "feedUrls", type: "ui", admin: { components: { Field: "/payload/admin/FeedUrls#FeedUrls" } } },
    { type: "row", fields: [
      { name: "google", type: "checkbox", defaultValue: true, label: "Google Merchant Center feed", admin: { width: "33%" } },
      { name: "meta", type: "checkbox", defaultValue: true, label: "Meta (Facebook / Instagram) feed", admin: { width: "33%" } },
      { name: "tiktok", type: "checkbox", defaultValue: true, label: "TikTok feed", admin: { width: "34%" } },
    ] },
    { name: "includeOutOfStock", type: "checkbox", defaultValue: true, label: "Include out-of-stock products (shown as “out of stock”)" },
    { name: "excludeCategories", type: "relationship", relationTo: "categories", hasMany: true, filterOptions: sameStore, label: "Leave out these categories" },
    { name: "excludeProducts", type: "relationship", relationTo: "products", hasMany: true, filterOptions: sameStore, label: "Leave out these products" },
    { name: "shippingPrice", type: "number", min: 0, label: "Delivery price shown in feeds (Rs)", admin: { description: "Empty = the “charge when no zone matches” from Delivery charges. Free above the free-delivery amount." } },
  ],
};
