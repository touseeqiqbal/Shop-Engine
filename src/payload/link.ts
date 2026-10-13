import type { Field } from "payload";

/**
 * Reusable "link" fields: point at a category, product, blog post or any custom URL.
 * Resolved to an href on the storefront by `resolveLink()` in src/lib/cms/chrome.ts.
 */
export const linkFields = (opts: { label?: boolean } = { label: true }): Field[] => [
  {
    type: "row",
    fields: [
      {
        name: "type",
        type: "select",
        defaultValue: "custom",
        required: true,
        options: [
          { label: "Category", value: "category" },
          { label: "Product", value: "product" },
          { label: "Blog post", value: "post" },
          { label: "Custom URL / page", value: "custom" },
        ],
        admin: { width: "30%" },
      },
      ...(opts.label ? [{ name: "label", type: "text", admin: { width: "40%", description: "Leave empty to use the linked item's name." } } as Field] : []),
      { name: "newTab", type: "checkbox", label: "Open in new tab", admin: { width: "30%" } },
    ],
  },
  { name: "category", type: "relationship", relationTo: "categories", admin: { condition: (_, s) => s?.type === "category" } },
  { name: "product", type: "relationship", relationTo: "products", admin: { condition: (_, s) => s?.type === "product" } },
  { name: "post", type: "relationship", relationTo: "posts", admin: { condition: (_, s) => s?.type === "post" } },
  {
    name: "url",
    type: "text",
    admin: { condition: (_, s) => s?.type === "custom", description: "e.g. /deals, /wholesale, /blog or https://…" },
  },
];
