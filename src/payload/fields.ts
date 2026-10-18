import type { CollectionSlug, Field, TextField, Validate } from "payload";
import { slugify } from "@/lib/utils";
import { storeIdOf } from "./tenancy";

/** A short random tag so a second copy of the same item still gets a unique web address / code. */
export const copyTag = () => Math.random().toString(36).slice(2, 6);

/** Field value a duplicated document starts with (Payload's "Duplicate"). */
export const onCopy = (value: unknown) => ({ hooks: { beforeDuplicate: [() => value] } });

/**
 * Unique within one store (two stores may both have /laptops or SKU-001). The database enforces it with a
 * (store, field) unique index (`perStoreUnique`); this check just gives a readable message first.
 */
export const uniqueInStore =
  (field: string, message = "This is already used in this store – choose another."): Validate =>
  async (value, { req, data, id, collectionSlug }) => {
    if (value == null || value === "" || !req?.payload || !collectionSlug) return true;
    const store = storeIdOf((data as Record<string, unknown> | undefined)?.store);
    const where = { and: [{ [field]: { equals: value } }, store == null ? { store: { exists: false } } : { store: { equals: store } }, ...(id != null ? [{ id: { not_equals: id } }] : [])] };
    const found = await req.payload.count({ collection: collectionSlug as CollectionSlug, where: where as never, overrideAccess: true, req }).catch(() => ({ totalDocs: 0 }));
    return found.totalDocs ? message : true;
  };

/** Compound unique indexes (store, field) for a store-owned collection. */
export const perStoreUnique = (...fields: string[]) => fields.map((f) => ({ fields: ["store", f], unique: true }));

/** URL slug: auto-filled from `from` when left empty, always normalised, unique (per store unless `scope: "global"`). */
export const slugField = (from = "title", overrides: { admin?: TextField["admin"]; scope?: "store" | "global" } = {}): TextField => ({
  name: "slug",
  type: "text",
  required: true,
  unique: overrides.scope === "global",
  index: true,
  ...(overrides.scope === "global" ? {} : { validate: uniqueInStore("slug", "Another item in this store already uses this web address – change it.") }),
  label: "Web address",
  admin: {
    position: "sidebar",
    description: "Made from the name automatically (lowercase letters, numbers and dashes). If you change it later, the old address forwards to the new one.",
  },
  hooks: {
    beforeValidate: [
      ({ value, data }) => {
        const source = (typeof value === "string" && value.trim()) || (data?.[from] as string | undefined) || "";
        return slugify(source);
      },
    ],
    // a copy gets its own address (the original keeps its one)
    beforeDuplicate: [({ value }) => (value ? `${String(value)}-copy-${copyTag()}` : value)],
  },
  ...(overrides.admin ? { admin: overrides.admin } : {}),
});

/** Id of the row this document was migrated from (Prisma era). Used for idempotent re-runs and delta syncs. */
export const legacyIdField: Field = {
  name: "legacyId",
  type: "text",
  unique: true,
  index: true,
  // written only by the import scripts (with full access) – never through /cms or the API: the storefront finds
  // old records by it, so it must not be settable on an account or product
  access: { create: () => false, update: () => false },
  admin: { position: "sidebar", readOnly: true, description: "Imported from the previous system.", condition: (d) => Boolean(d?.legacyId) },
  hooks: { beforeDuplicate: [() => null] },
};

/** Table name prefix keeps Payload tables clearly apart from the legacy Prisma tables. */
export const dbName = (slug: string) => `cms_${slug.replace(/-/g, "_")}`;
