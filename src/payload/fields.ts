import type { Field, TextField } from "payload";
import { slugify } from "@/lib/utils";

/** A short random tag so a second copy of the same item still gets a unique web address / code. */
export const copyTag = () => Math.random().toString(36).slice(2, 6);

/** Field value a duplicated document starts with (Payload's "Duplicate"). */
export const onCopy = (value: unknown) => ({ hooks: { beforeDuplicate: [() => value] } });

/** URL slug: auto-filled from `from` when left empty, always normalised, unique. */
export const slugField = (from = "title", overrides: { admin?: TextField["admin"] } = {}): TextField => ({
  name: "slug",
  type: "text",
  required: true,
  unique: true,
  index: true,
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
  admin: { position: "sidebar", readOnly: true, description: "Imported from the previous system.", condition: (d) => Boolean(d?.legacyId) },
  hooks: { beforeDuplicate: [() => null] },
};

/** Table name prefix keeps Payload tables clearly apart from the legacy Prisma tables. */
export const dbName = (slug: string) => `cms_${slug.replace(/-/g, "_")}`;
