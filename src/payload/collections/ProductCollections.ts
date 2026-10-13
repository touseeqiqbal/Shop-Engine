import type { CollectionConfig } from "payload";
import { isStaffUser, managers, staff } from "../access";
import { dbName, legacyIdField, slugField } from "../fields";
import { revalidateCatalog } from "../revalidate";
import { slugRedirect } from "../slug-redirects";

/**
 * Product collections (like Shopify → Products → Collections): a hand-picked list or automatic rules.
 * Each published collection has a page at /collections/<handle> and can feed a page-builder carousel.
 */
export const ProductCollections: CollectionConfig = {
  slug: "product-collections",
  dbName: dbName("collections"),
  labels: { singular: "Collection", plural: "Collections" },
  admin: {
    useAsTitle: "title",
    group: "Catalog",
    defaultColumns: ["title", "slug", "type", "published"],
    description: "Groups of products, e.g. “Laptops under Rs 60,000” or “Back to school”. Shown at /collections/<handle>.",
  },
  access: { read: ({ req }) => (isStaffUser(req.user as never) ? true : { published: { equals: true } }), create: staff, update: staff, delete: managers },
  hooks: { afterChange: [revalidateCatalog, slugRedirect("product-collections")], afterDelete: [revalidateCatalog] },
  fields: [
    { name: "title", type: "text", required: true },
    { name: "description", type: "textarea", admin: { description: "Shown under the heading. Plain text; **bold** works." } },
    { name: "image", type: "upload", relationTo: "media" },
    {
      name: "type",
      type: "radio",
      defaultValue: "manual",
      options: [
        { label: "Hand-picked products", value: "manual" },
        { label: "Automatic (rules)", value: "automatic" },
      ],
    },
    { name: "products", type: "relationship", relationTo: "products", hasMany: true, admin: { condition: (_, s) => s?.type !== "automatic", description: "Drag to set the order." } },
    {
      name: "match",
      type: "select",
      defaultValue: "all",
      options: [
        { label: "Products must match all conditions", value: "all" },
        { label: "Products can match any condition", value: "any" },
      ],
      admin: { condition: (_, s) => s?.type === "automatic" },
    },
    {
      name: "rules",
      type: "array",
      labels: { singular: "Condition", plural: "Conditions" },
      admin: { condition: (_, s) => s?.type === "automatic" },
      fields: [
        { type: "row", fields: [
          { name: "field", type: "select", required: true, admin: { width: "40%" }, options: [
            { label: "Category (incl. sub-categories)", value: "category" },
            { label: "Brand", value: "brand" },
            { label: "Condition", value: "condition" },
            { label: "Tag", value: "tag" },
            { label: "Price at most (Rs)", value: "priceMax" },
            { label: "Price at least (Rs)", value: "priceMin" },
            { label: "On sale", value: "onSale" },
            { label: "Hot deal", value: "hotDeal" },
            { label: "Best seller", value: "bestSeller" },
            { label: "Featured", value: "featured" },
            { label: "In stock", value: "inStock" },
          ] },
          { name: "category", type: "relationship", relationTo: "categories", admin: { width: "60%", condition: (_, s) => s?.field === "category" } },
          { name: "brand", type: "relationship", relationTo: "brands", admin: { width: "60%", condition: (_, s) => s?.field === "brand" } },
          { name: "value", type: "text", admin: { width: "60%", condition: (_, s) => ["condition", "tag", "priceMax", "priceMin"].includes(s?.field), description: "Tag text, price in Rs, or condition: new, used-a-plus, used-a, refurbished, open-box" } },
        ] },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "sort", type: "select", defaultValue: "manual", admin: { width: "50%" }, options: [
          { label: "As picked / best match", value: "manual" },
          { label: "Best selling", value: "popular" },
          { label: "Newest", value: "newest" },
          { label: "Price, low to high", value: "price-asc" },
          { label: "Price, high to low", value: "price-desc" },
        ] },
        { name: "limit", type: "number", min: 1, max: 200, admin: { width: "50%", description: "Max products (empty = all)." } },
      ],
    },
    { name: "published", type: "checkbox", defaultValue: true, label: "Published (page visible at /collections/<handle>)", admin: { position: "sidebar" } },
    slugField("title"),
    legacyIdField,
  ],
};
