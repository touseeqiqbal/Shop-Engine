import path from "node:path";
import type { CollectionConfig } from "payload";
import { assignStore, createFor, publicOrStore, storeField, writeFor } from "../tenancy";
import { dbName } from "../fields";
import { CATALOG_TAG, CHROME_TAG, PAGES_TAG, revalidate } from "../revalidate";
import { userError } from "../errors";
import { storageLimit } from "../entitlements";
import { cleanFileName } from "@/lib/media";
import { isStorageEnvSet, strictProduction } from "@/lib/db/config";

const webp = { format: "webp" as const, options: { quality: 80 } };

const mediaPath = (prefix: string | null | undefined, filename: string) =>
  `/media/${[prefix || "media", filename].map((p) => p.split("/").map(encodeURIComponent).join("/")).join("/")}`;

/**
 * Central media library. Files live in the private Railway bucket under `media/` (or `.data/uploads/media`
 * locally) and are streamed by the storefront route `/media/[...key]` with year-long immutable caching,
 * so Cloudflare caches them at the edge. Every upload is converted to WebP and resized into presets.
 */
export const Media: CollectionConfig = {
  slug: "media",
  dbName: dbName("media"),
  admin: { group: "Content", defaultColumns: ["filename", "alt", "folder", "updatedAt"] },
  // files are public (the store shows them); in /cms each store sees and manages only its own
  access: { read: publicOrStore("store_staff"), create: createFor("store_staff"), update: writeFor("store_staff"), delete: writeFor("store_manager") },
  folders: true,
  hooks: {
    beforeValidate: [assignStore()],
    beforeChange: [storageLimit],
    // Refuse to delete a photo that is still shown somewhere (it would leave broken pictures on the shop)
    beforeDelete: [
      async ({ id, req }) => {
        const uses: [string, string, string][] = [["products", "images", "product"], ["categories", "image", "category"], ["brands", "logo", "brand"], ["posts", "cover", "blog post"], ["product-collections", "image", "collection"], ["store-theme-settings", "logoDark", "theme"], ["store-theme-settings", "logoLight", "theme"], ["store-theme-settings", "favicon", "theme"]];
        const found: string[] = [];
        for (const [collection, field, label] of uses) {
          const r = await req.payload.find({ collection: collection as never, where: { [field]: { in: [id] } } as never, limit: 3, depth: 0, overrideAccess: true, req }).catch(() => null);
          for (const d of (r?.docs ?? []) as { title?: string; name?: string }[]) found.push(`${label} “${d.title ?? d.name ?? "?"}”`);
        }
        if (found.length) throw userError(`This photo is still used by ${found.slice(0, 3).join(", ")}${found.length > 3 ? "…" : ""}. Remove it there first.`, 409);
      },
    ],
    // new alt text / crop / replaced file → the shop shows it straight away
    afterChange: [({ doc, operation }) => (operation === "update" && revalidate([CATALOG_TAG, PAGES_TAG, CHROME_TAG]), doc)],
    afterDelete: [({ doc }) => (revalidate([CATALOG_TAG, PAGES_TAG, CHROME_TAG]), doc)],
    // Clean file names on upload ("WhatsApp Image … (1).jpg" → "whatsapp-image-….webp"): tidy URLs and better image SEO.
    // Production never stores uploads on the container's disk (they'd vanish on the next deploy).
    beforeOperation: [
      ({ req, operation }) => {
        if ((operation === "create" || operation === "update") && req.file && strictProduction && !isStorageEnvSet)
          throw userError("Photo storage (S3) isn't set up – uploads are switched off until it is.", 503);
        if ((operation === "create" || operation === "update") && req.file?.name) req.file.name = cleanFileName(req.file.name);
      },
    ],
    // Same public URL in every environment: our cached /media route (bucket in production, .data/uploads locally).
    afterRead: [
      ({ doc }) => {
        if (doc?.filename) doc.url = mediaPath(doc.prefix, doc.filename);
        for (const size of Object.values((doc?.sizes ?? {}) as Record<string, { filename?: string | null; url?: string | null }>)) {
          if (size?.filename) size.url = mediaPath(doc.prefix, size.filename);
        }
        return doc;
      },
    ],
  },
  upload: {
    // Used only when the S3 bucket isn't configured (local development); the S3 plugin disables local storage otherwise.
    staticDir: path.resolve(process.cwd(), ".data/uploads/media"),
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/svg+xml", "image/gif", "video/mp4"],
    focalPoint: true,
    crop: true,
    formatOptions: webp,
    resizeOptions: { width: 2000, height: 2000, fit: "inside", withoutEnlargement: true },
    imageSizes: [
      { name: "thumbnail", width: 300, height: 300, fit: "inside", withoutEnlargement: true, formatOptions: webp },
      { name: "card", width: 640, height: 640, fit: "inside", withoutEnlargement: true, formatOptions: webp },
      { name: "full", width: 1600, height: 1600, fit: "inside", withoutEnlargement: true, formatOptions: webp },
    ],
    adminThumbnail: "thumbnail",
  },
  fields: [
    storeField(),
    {
      name: "alt",
      type: "text",
      required: true,
      admin: { description: "Describe the image for Google and screen readers, e.g. “HP EliteBook 840 G8 – keyboard and screen”." },
    },
    { name: "caption", type: "text" },
    { name: "tags", type: "text", hasMany: true, admin: { description: "Optional – helps searching the library." } },
    { name: "sourceUrl", type: "text", admin: { readOnly: true, position: "sidebar", condition: (d) => Boolean(d?.sourceUrl), description: "Original URL before migration." }, index: true },
  ],
};
