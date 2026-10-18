import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, CollectionConfig, PayloadRequest } from "payload";
import { assignStore, createFor, publicOrStore, readFor, storeField, writeFor } from "../tenancy";
import { dbName, legacyIdField, perStoreUnique, slugField } from "../fields";
import { PAGE_BLOCKS } from "../blocks";
import { PAGES_TAG, revalidate } from "../revalidate";
import { slugRedirect } from "../slug-redirects";

/**
 * Pages built from blocks (like Shopify → Online store → Pages + theme sections).
 * The page with slug `home` is the home page (/); every other page lives at /pages/<slug>.
 * Drafts autosave and show in the live preview; only published versions reach shoppers.
 */

export const pagePath = (slug?: string | null) => (!slug || slug === "home" ? "/" : `/pages/${slug}`);

/** Absolute URL of the site the editor is on (works locally, on staging and in production). */
function origin(req: PayloadRequest) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? (host?.startsWith("localhost") || host?.startsWith("127.") ? "http" : "https");
  return host ? `${proto}://${host}` : process.env.NEXT_PUBLIC_SITE_URL ?? "";
}

const previewUrl = ({ data, req }: { data: Record<string, unknown>; req: PayloadRequest }) =>
  `${origin(req)}/api/preview?path=${encodeURIComponent(pagePath(data?.slug as string | undefined))}`;

const afterChange: CollectionAfterChangeHook = ({ doc, previousDoc }) => {
  // Drafts (autosave) don't touch the live site; publishing / unpublishing does.
  if (doc._status === "published" || previousDoc?._status === "published") {
    revalidate([PAGES_TAG], [pagePath(doc.slug), ...(previousDoc?.slug && previousDoc.slug !== doc.slug ? [pagePath(previousDoc.slug)] : []), "/sitemap.xml"]);
  }
  return doc;
};
const afterDelete: CollectionAfterDeleteHook = ({ doc }) => {
  revalidate([PAGES_TAG], [pagePath(doc.slug), "/sitemap.xml"]);
  return doc;
};

export const Pages: CollectionConfig = {
  slug: "pages",
  dbName: dbName("pages"),
  admin: {
    useAsTitle: "title",
    group: "Online store",
    defaultColumns: ["title", "slug", "_status", "updatedAt"],
    description: "The page with URL handle “home” is your home page. Other pages are shown at /pages/<handle>.",
    livePreview: {
      url: previewUrl,
      breakpoints: [
        { label: "Mobile", name: "mobile", width: 390, height: 844 },
        { label: "Tablet", name: "tablet", width: 820, height: 1180 },
        { label: "Desktop", name: "desktop", width: 1440, height: 900 },
      ],
    },
    preview: (data, { req }) => previewUrl({ data: data as Record<string, unknown>, req }),
  },
  access: {
    read: publicOrStore("store_staff", { _status: { equals: "published" } }),
    // versions keep the fields under "version." – a plain "store" filter can't be queried there (blank edit page)
    readVersions: readFor("store_staff", { field: "version.store" }),
    create: createFor("store_staff"),
    update: writeFor("store_staff"),
    delete: writeFor("store_manager"),
  },
  indexes: perStoreUnique("slug"),
  versions: { drafts: { autosave: { interval: 800 }, schedulePublish: true }, maxPerDoc: 50 },
  hooks: { beforeValidate: [assignStore()], afterChange: [afterChange, slugRedirect("pages")], afterDelete: [afterDelete] },
  fields: [
    storeField(),
    { name: "title", type: "text", required: true },
    {
      type: "tabs",
      tabs: [
        {
          label: "Content",
          fields: [
            {
              type: "row",
              fields: [
                { name: "h1Highlight", type: "text", label: "Heading – highlighted part", admin: { width: "40%", description: "Shown in brand colours. Optional." } },
                { name: "h1Text", type: "text", label: "Heading (H1)", admin: { width: "60%", description: "Main page heading for Google. Empty = page title." } },
              ],
            },
            {
              name: "layout",
              type: "blocks",
              label: "Sections",
              labels: { singular: "Section", plural: "Sections" },
              blocks: PAGE_BLOCKS,
              admin: { initCollapsed: true },
            },
          ],
        },
      ],
    },
    slugField("title", { admin: { position: "sidebar", description: "URL handle (lowercase, dashes). “home” = the home page; others open at /pages/<handle>." } }),
    legacyIdField,
  ],
};
