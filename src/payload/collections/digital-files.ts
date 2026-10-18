import path from "node:path";
import type { CollectionConfig } from "payload";
import { assignStore, storeAccess, storeField } from "../tenancy";
import { dbName } from "../fields";

/**
 * Files customers download after buying a digital product (Catalog → Digital files): e-books, software, courses,
 * templates … PRIVATE – never public URLs: the team sees them in /cms, and a customer only through the signed,
 * counted links of a PAID order (src/lib/downloads.ts, /download/<token>).
 */
export const DigitalFiles: CollectionConfig = {
  slug: "digital-files",
  dbName: dbName("digital_files"),
  labels: { singular: "Digital file", plural: "Digital files" },
  admin: {
    useAsTitle: "title",
    group: "Catalog",
    defaultColumns: ["title", "filename", "filesize", "updatedAt"],
    description: "Files sold as downloads. Attach them to a product (Product → Downloads). Customers get their links once the order is paid.",
  },
  access: storeAccess("store_staff", "store_manager", "store_manager", "store_manager"),
  upload: {
    // with the S3 bucket these live under downloads/ – a prefix the public /media route never serves
    staticDir: path.resolve(process.cwd(), ".data/uploads/downloads"),
    mimeTypes: ["application/pdf", "application/zip", "application/x-zip-compressed", "application/epub+zip", "audio/mpeg", "video/mp4", "image/jpeg", "image/png", "text/plain", "application/octet-stream"],
    disableLocalStorage: false,
  },
  hooks: { beforeValidate: [assignStore()] },
  fields: [
    storeField(),
    { name: "title", type: "text", required: true, admin: { description: "What the customer sees, e.g. “Photography course – part 1 (PDF)”." } },
  ],
};
