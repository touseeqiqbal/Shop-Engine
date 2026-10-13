import type { Field, GlobalConfig } from "payload";
import { anyone, managers, staff } from "../access";
import { dbName } from "../fields";
import { revalidate } from "../revalidate";
import { SOCIAL_NETWORKS, WEEK_DAYS } from "../../lib/site-info";
import { PAGE_DEFS } from "../../lib/content/registry";

/*
 * Content that used to live in the old /admin (Store info, SEO, page texts, testimonials, FAQs).
 * Until a global is saved for the first time the storefront keeps the old values (migrate-data copies them in).
 * Same cache tags as src/lib/repo/site-content.ts so saving refreshes the live site immediately.
 */

const refresh = (tags: string[]) => [({ doc }: { doc: unknown }) => (revalidate(tags, ["/", "/sitemap.xml", "/llms.txt"]), doc)];
const pageOptions = (onlyContent = false) =>
  PAGE_DEFS.filter((p) => !onlyContent || (p.content?.length ?? 0) > 0).map((p) => ({ label: `${p.label} (${p.key})`, value: p.key }));
const half = (f: Field): Field => ({ ...f, admin: { ...(f as { admin?: object }).admin, width: "50%" } }) as Field;

export const StoreInfo: GlobalConfig = {
  slug: "store-info",
  dbName: dbName("store_info"),
  label: "Store info",
  admin: { group: "Settings", description: "Business name, address, phones, opening hours and social links – used across the site, in Google data and in emails." },
  access: { read: anyone, update: managers },
  hooks: { afterChange: refresh(["site-business", "settings"]) },
  fields: [
    { type: "row", fields: [half({ name: "name", type: "text", required: true }), half({ name: "shortName", type: "text" })] },
    { name: "tagline", type: "text" },
    { name: "description", type: "textarea" },
    { name: "email", type: "email" },
    {
      name: "phones",
      type: "array",
      admin: { description: "First number = main number (calls, WhatsApp button)." },
      fields: [{ type: "row", fields: [
        { name: "label", type: "text", admin: { width: "25%" } },
        { name: "display", type: "text", required: true, admin: { width: "25%", description: "+92 342 6693115" } },
        { name: "tel", type: "text", admin: { width: "25%", description: "+923426693115" } },
        { name: "wa", type: "text", label: "WhatsApp", admin: { width: "25%", description: "923426693115" } },
      ] }],
    },
    {
      name: "address",
      type: "group",
      fields: [
        { type: "row", fields: [half({ name: "street", type: "text" }), half({ name: "area", type: "text" })] },
        { type: "row", fields: [
          { name: "city", type: "text", admin: { width: "34%" } },
          { name: "region", type: "text", admin: { width: "33%" } },
          { name: "postalCode", type: "text", admin: { width: "33%" } },
        ] },
        { type: "row", fields: [half({ name: "country", type: "text" }), half({ name: "countryCode", type: "text" })] },
        { name: "full", type: "text", label: "Full address (one line)" },
      ],
    },
    { name: "geo", type: "group", label: "Map position", fields: [{ type: "row", fields: [half({ name: "lat", type: "number" }), half({ name: "lng", type: "number" })] }] },
    { type: "row", fields: [half({ name: "mapLink", type: "text", label: "Google Maps link" }), half({ name: "mapEmbed", type: "text", label: "Google Maps embed URL" })] },
    {
      name: "hours",
      type: "array",
      label: "Opening hours",
      fields: [{ type: "row", fields: [
        { name: "days", type: "select", hasMany: true, options: [...WEEK_DAYS], admin: { width: "50%" } },
        { name: "opens", type: "text", admin: { width: "25%", description: "11:00" } },
        { name: "closes", type: "text", admin: { width: "25%", description: "21:00" } },
      ] }],
    },
    { name: "hoursDisplay", type: "text", label: "Opening hours (as shown)" },
    { name: "whatsappNote", type: "text", label: "WhatsApp popup note" },
    { name: "social", type: "group", label: "Social links", fields: SOCIAL_NETWORKS.map((n) => ({ name: n.key, type: "text", label: n.label, admin: { placeholder: n.placeholder } }) as Field) },
    { name: "couriers", type: "text", hasMany: true, admin: { description: "Courier partners shown in the footer and delivery info." } },
  ],
};

export const SeoSettingsGlobal: GlobalConfig = {
  slug: "seo-settings",
  dbName: dbName("seo_settings"),
  label: "SEO",
  admin: { group: "Settings", description: "Site-wide SEO defaults, verification codes, analytics IDs and per-page titles/descriptions for built-in pages." },
  access: { read: anyone, update: managers },
  hooks: { afterChange: refresh(["site-seo", "site-page-seo"]) },
  fields: [
    {
      type: "tabs",
      tabs: [
        {
          label: "Defaults",
          fields: [
            { name: "titleTemplate", type: "text", defaultValue: "%s | Urko Tech Store", admin: { description: "%s = page title." } },
            { name: "defaultTitle", type: "text" },
            { name: "defaultDescription", type: "textarea" },
            { name: "defaultOgImage", type: "text", label: "Default social share image (URL)" },
            { name: "keywords", type: "text", hasMany: true },
            { name: "discourageIndexing", type: "checkbox", label: "Hide the whole site from search engines (noindex)", admin: { description: "Only for emergencies – staging is always hidden automatically." } },
          ],
        },
        {
          label: "Verification & analytics",
          fields: [
            { type: "row", fields: [half({ name: "googleVerification", type: "text" }), half({ name: "bingVerification", type: "text" })] },
            { name: "facebookVerification", type: "text" },
            { type: "row", fields: [half({ name: "ga4Id", type: "text", label: "Google Analytics 4 ID" }), half({ name: "metaPixelId", type: "text", label: "Meta Pixel ID" })] },
          ],
        },
        {
          label: "Built-in pages",
          fields: [
            {
              name: "pages",
              type: "array",
              labels: { singular: "Page", plural: "Pages" },
              admin: { description: "Override the title / description of built-in pages (shop, deals, policies…). Use {city} etc. in template pages." },
              fields: [
                { name: "page", type: "select", required: true, options: pageOptions() },
                { name: "title", type: "text" },
                { name: "description", type: "textarea" },
                { type: "row", fields: [
                  half({ name: "ogImage", type: "text", label: "Share image (URL)" }),
                  half({ name: "indexing", type: "select", defaultValue: "default", options: [{ label: "Page default", value: "default" }, { label: "Index", value: "index" }, { label: "Noindex", value: "noindex" }] }),
                ] },
              ],
            },
          ],
        },
      ],
    },
  ],
};

export const PageTexts: GlobalConfig = {
  slug: "page-texts",
  dbName: dbName("page_texts"),
  label: "Page texts",
  admin: { group: "Online store", description: "Texts of built-in pages (About, policies, deals intro…). Markdown works in intro, body and SEO copy." },
  access: { read: anyone, update: staff },
  hooks: { afterChange: refresh(["site-pages"]) },
  fields: [
    {
      name: "pages",
      type: "array",
      labels: { singular: "Page", plural: "Pages" },
      fields: [
        { name: "page", type: "select", required: true, options: pageOptions(true) },
        { type: "row", fields: [half({ name: "eyebrow", type: "text", label: "Small heading" }), half({ name: "title", type: "text", admin: { description: "Wrap words in *asterisks* for the brand gradient." } })] },
        { name: "description", type: "textarea" },
        { name: "intro", type: "textarea" },
        { name: "body", type: "textarea", admin: { description: "Markdown." } },
        { name: "seoCopy", type: "textarea", label: "SEO copy (bottom of page)" },
        { name: "updated", type: "date", label: "Last updated" },
      ],
    },
  ],
};

export const TestimonialsGlobal: GlobalConfig = {
  slug: "testimonials",
  dbName: dbName("testimonials"),
  label: "Testimonials",
  admin: { group: "Online store", description: "Customer quotes for the home page “Testimonials” section." },
  access: { read: anyone, update: staff },
  hooks: { afterChange: refresh(["settings"]) },
  fields: [
    {
      name: "items",
      type: "array",
      fields: [
        { type: "row", fields: [
          { name: "name", type: "text", required: true, admin: { width: "35%" } },
          { name: "city", type: "text", admin: { width: "35%" } },
          { name: "rating", type: "number", min: 1, max: 5, defaultValue: 5, admin: { width: "30%" } },
        ] },
        { name: "text", type: "textarea", required: true },
        { name: "product", type: "text", admin: { description: "Optional – what they bought." } },
      ],
    },
  ],
};

export const FaqsGlobal: GlobalConfig = {
  slug: "faqs",
  dbName: dbName("faqs"),
  label: "FAQs",
  admin: { group: "Online store", description: "Questions on /faqs (grouped), also published as FAQ structured data." },
  access: { read: anyone, update: staff },
  hooks: { afterChange: refresh(["settings"]) },
  fields: [
    {
      name: "items",
      type: "array",
      fields: [
        { type: "row", fields: [
          { name: "q", type: "text", label: "Question", required: true, admin: { width: "70%" } },
          { name: "group", type: "text", admin: { width: "30%" } },
        ] },
        { name: "a", type: "textarea", label: "Answer", required: true },
      ],
    },
  ],
};
