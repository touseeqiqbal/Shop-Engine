import type { CollectionConfig } from "payload";
import { assignStore, publicOrStore, sameStore, storeField, createFor, writeFor } from "../tenancy";
import { dbName, legacyIdField, perStoreUnique, uniqueInStore } from "../fields";
import { linkFields } from "../link";
import { revalidateChrome } from "../revalidate";

/**
 * Navigation menus (like Shopify → Navigation). Items can be nested two levels deep; top-level items can be
 * shown as a mega menu (sub-items grouped in columns, with an optional featured image).
 * Which menu appears where is chosen in the Header / Footer globals.
 */
export const Menus: CollectionConfig = {
  slug: "menus",
  dbName: dbName("menus"),
  admin: { useAsTitle: "name", group: "Online store", defaultColumns: ["name", "handle", "updatedAt"], description: "Drag items to reorder; add sub-items under an item for dropdowns / mega menus." },
  access: { read: publicOrStore("store_staff"), create: createFor("store_staff"), update: writeFor("store_staff"), delete: writeFor("store_manager") },
  indexes: perStoreUnique("handle"),
  hooks: { beforeValidate: [assignStore()], afterChange: [revalidateChrome], afterDelete: [revalidateChrome] },
  fields: [
    storeField(),
    { name: "name", type: "text", required: true },
    { name: "handle", type: "text", required: true, index: true, validate: uniqueInStore("handle", "Another menu in this store uses this handle."), admin: { description: "Stable id, e.g. main-menu, footer-shop." } },
    {
      name: "items",
      type: "array",
      labels: { singular: "Menu item", plural: "Menu items" },
      admin: { initCollapsed: true, components: { RowLabel: "/payload/admin/RowLabel#MenuRowLabel" } },
      fields: [
        ...linkFields(),
        { name: "megaMenu", type: "checkbox", label: "Show as mega menu (desktop)" },
        { name: "icon", type: "text", admin: { description: "Optional icon name (lucide), e.g. Laptop." } },
        { name: "featuredImage", type: "upload", relationTo: "media", filterOptions: sameStore, admin: { condition: (_, s) => Boolean(s?.megaMenu) } },
        {
          name: "children",
          type: "array",
          labels: { singular: "Sub-item", plural: "Sub-items" },
          admin: { initCollapsed: true, components: { RowLabel: "/payload/admin/RowLabel#MenuRowLabel" } },
          fields: [
            ...linkFields(),
            {
              name: "links",
              type: "array",
              labels: { singular: "Link", plural: "Links" },
              admin: { initCollapsed: true, components: { RowLabel: "/payload/admin/RowLabel#MenuRowLabel" } },
              fields: linkFields(),
            },
          ],
        },
      ],
    },
    legacyIdField,
  ],
};
