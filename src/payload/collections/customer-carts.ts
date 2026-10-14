import type { CollectionConfig } from "payload";
import { nobody } from "../access";
import { dbName } from "../fields";
import { platformAdmins, storeField } from "../tenancy";

/**
 * A signed-in shopper's cart, saved on the server per store – so it follows them to another phone or computer.
 * Only product ids, quantities and chosen upgrades are kept; prices always come from the catalogue when it's loaded.
 * Written by the storefront's own code (src/app/(frontend)/(store)/cart/saved-cart.ts); nobody edits it in /cms.
 */
export const CustomerCarts: CollectionConfig = {
  slug: "customer-carts",
  dbName: dbName("customer_carts"),
  labels: { singular: "Saved cart", plural: "Saved carts" },
  admin: { group: "Platform", hidden: true },
  access: { read: platformAdmins, create: nobody, update: nobody, delete: platformAdmins },
  indexes: [{ fields: ["user", "store"], unique: true }],
  timestamps: true,
  fields: [
    storeField(),
    { name: "user", type: "relationship", relationTo: "users", required: true, index: true },
    { name: "lines", type: "json", required: true, defaultValue: [] },
  ],
};
