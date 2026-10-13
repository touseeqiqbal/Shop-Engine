import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { s3Storage } from "@payloadcms/storage-s3";
import { seoPlugin } from "@payloadcms/plugin-seo";
import { redirectsPlugin } from "@payloadcms/plugin-redirects";
import sharp from "sharp";
import { Users } from "./payload/collections/Users";
import { Media } from "./payload/collections/Media";
import { Brands, Categories, LaptopModels, Products, Reviews } from "./payload/collections/catalog";
import { ContactMessages, Orders, Posts, WholesaleInquiries } from "./payload/collections/content";
import { Menus } from "./payload/collections/Menus";
import { Pages } from "./payload/collections/Pages";
import { ProductCollections } from "./payload/collections/ProductCollections";
import { Stores } from "./payload/collections/Stores";
import { StoreMemberships } from "./payload/collections/StoreMemberships";
import { importExportPlugin } from "@payloadcms/plugin-import-export";
import { PaymentSettings, ShippingSettings } from "./payload/globals/commerce";
import { NotificationSettings } from "./payload/globals/notifications";
import { FaqsGlobal, PageTexts, SeoSettingsGlobal, StoreInfo, TestimonialsGlobal } from "./payload/globals/site";
import { Discounts, FlashSales } from "./payload/collections/sales";
import { AnnouncementBar, FooterSettings, HeaderSettings, ThemeSettings, WhatsAppSettings } from "./payload/globals/online-store";
import { isStaffUser, managers, staff } from "./payload/access";
import { dbName, legacyIdField } from "./payload/fields";
import { migrations } from "./migrations";
import { mailerAdapter } from "./payload/email";
import { reportsEndpoint } from "./payload/endpoints/reports";
import { salesReportEndpoint } from "./payload/endpoints/sales-report";
import { clearRedirectCache } from "./payload/revalidate";
import { configExportEndpoint, configImportEndpoint } from "./payload/endpoints/config-transfer";
import { posEndpoints } from "./payload/endpoints/pos";
import { orderToolEndpoints } from "./payload/endpoints/orders";
import { twoFactorEndpoints } from "./payload/endpoints/two-factor";
import { privacyEndpoints } from "./payload/endpoints/privacy";
import { CashUps, PosSales, Units } from "./payload/collections/shop";
import { BlockedPhones, OrderProtection } from "./payload/globals/protection";
import { ReturnRequests, ReturnsPolicy, WarrantyClaims } from "./payload/collections/aftersales";
import { CookieNotice } from "./payload/globals/cookie-notice";
import { SalesChannels } from "./payload/globals/sales-channels";
import { AbandonedCarts, ConversionSettings, ProductQuestions, StockAlerts, TradeIns } from "./payload/collections/engagement";
import { Purchases, StockCounts, Suppliers } from "./payload/collections/inventory";
import { ActivityLog, LOGGED_COLLECTIONS, StockMovements, withActivityLog, withGlobalActivityLog } from "./payload/collections/history";
import { StaffGuide } from "./payload/globals/staff-guide";
import { inventoryEndpoints } from "./payload/endpoints/inventory";
import { StoreInvoices, StoreSubscriptions, SubscriptionPlans } from "./payload/collections/billing";

import { dbPoolMax } from "./lib/db/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const s3Configured = Boolean(process.env.S3_ENDPOINT && process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);

/** Public URL for a media file – always our own cached `/media/...` route (the bucket is private). */
const mediaFileURL = ({ filename, prefix }: { filename: string; prefix?: string }) =>
  `/media/${[prefix || "media", filename].map((p) => p.split("/").map(encodeURIComponent).join("/")).join("/")}`;

const serverURL = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");

/**
 * Origins allowed to authenticate with the admin cookie. Payload drops the cookie on any request whose
 * `Origin` isn't listed, so admin server functions (form state, slugify…) 401 even while logged in when
 * the admin is opened from www/non-www or the Railway domain instead of the exact serverURL.
 */
const csrf = (() => {
  const origins = new Set<string>();
  const add = (url?: string) => {
    if (!url) return;
    try {
      const u = new URL(url.includes("://") ? url : `https://${url}`);
      origins.add(u.origin);
      const alt = u.hostname.startsWith("www.") ? u.hostname.slice(4) : `www.${u.hostname}`;
      origins.add(`${u.protocol}//${alt}${u.port ? `:${u.port}` : ""}`);
    } catch {
      /* ignore malformed values */
    }
  };
  add(serverURL);
  add(process.env.RAILWAY_PUBLIC_DOMAIN);
  for (const o of (process.env.PAYLOAD_CSRF_ORIGINS || "").split(",")) add(o.trim());
  return [...origins];
})();

/** Import / export option: run inside the request instead of the background job queue. */
const NOW = { disableJobsQueue: true } as const;

export default buildConfig({
  serverURL,
  csrf,
  email: mailerAdapter, // SMTP or Resend – src/lib/mailer.ts
  secret: process.env.PAYLOAD_SECRET || (process.env.NODE_ENV !== "production" ? "dev-only-payload-secret-change-me" : ""),
  // Phase 1: Payload admin lives at /cms while the previous admin at /admin is still in use.
  routes: { admin: "/cms", api: "/cms-api", graphQL: "/cms-api/graphql", graphQLPlayground: "/cms-api/graphql-playground" },
  // plain wording in every list: Yes / No instead of true / false, and "—" instead of "<No Phone>"
  i18n: { translations: { en: { general: { true: "Yes", false: "No", noLabel: "—" } } } },
  admin: {
    user: Users.slug,
    meta: { titleSuffix: " · ShopEngine", icons: [{ rel: "icon", type: "image/svg+xml", url: "/icon.svg" }] },
    components: {
      graphics: { Logo: "/payload/admin/Brand#Logo", Icon: "/payload/admin/Brand#Icon" },
      Nav: "/payload/admin/nav/UrkoNav#UrkoNav",
      actions: ["/payload/admin/nav/TopActions#TopActions"],
      beforeLogin: ["/payload/admin/LoginIntro#LoginIntro"],
      providers: ["/payload/admin/AdminProviders#AdminProviders"],
      views: {
        dashboard: { Component: "/payload/admin/Dashboard#Dashboard" },
        pos: { Component: "/payload/admin/pos/PosView#PosView", path: "/pos", exact: true, meta: { title: "Shop counter" } },
        rto: { Component: "/payload/admin/reports/RtoView#RtoView", path: "/reports/rto", exact: true, meta: { title: "Refused parcels (RTO)" } },
        sales: { Component: "/payload/admin/reports/SalesView#SalesView", path: "/reports/sales", exact: true, meta: { title: "Sales & profit" } },
        security: { Component: "/payload/admin/security/SecurityView#SecurityView", path: "/security", exact: true, meta: { title: "Security" } },
        privacy: { Component: "/payload/admin/privacy/PrivacyView#PrivacyView", path: "/privacy", exact: true, meta: { title: "Customer data requests" } },
        stockCount: { Component: "/payload/admin/inventory/StockCountView#StockCountView", path: "/stock-count", exact: true, meta: { title: "Stock count" } },
        help: { Component: "/payload/admin/help/HelpView#HelpView", path: "/help", exact: true, meta: { title: "Help" } },
      },
    },
    importMap: { baseDir: path.resolve(dirname) },
  },
  endpoints: [reportsEndpoint, salesReportEndpoint, configExportEndpoint, configImportEndpoint, ...posEndpoints, ...orderToolEndpoints, ...twoFactorEndpoints, ...privacyEndpoints, ...inventoryEndpoints],
  // Security: GraphQL isn't used by the store – switch it off (smaller attack surface).
  graphQL: { disable: true },
  // Background jobs (scheduled publishing of pages and blog posts): run every minute; only staff may queue/run them.
  jobs: {
    access: { run: ({ req }) => isStaffUser(req.user as never), queue: ({ req }) => isStaffUser(req.user as never), cancel: ({ req }) => isStaffUser(req.user as never) },
    autoRun: process.env.HOUSEKEEPING === "off" ? [] : [{ cron: "* * * * *", queue: "default", limit: 20 }],
    shouldAutoRun: () => process.env.HOUSEKEEPING !== "off" && process.env.NEXT_PHASE !== "phase-production-build",
  },
  // Photo folders: staff only (Payload's default lets any signed-in account – even a customer – create folders).
  folders: {
    collectionOverrides: [({ collection }) => ({ ...collection, access: { ...collection.access, read: staff, create: staff, update: staff, delete: managers } })],
  },
  // Payload's "someone is editing this" records: staff only (default: any signed-in account).
  onInit: async (payload) => {
    const locks = payload.collections["payload-locked-documents" as never] as unknown as { config: { access: Record<string, unknown> } } | undefined;
    if (locks) locks.config.access = { ...locks.config.access, read: staff, create: staff, update: staff, delete: staff };
  },
  // Staff changes to the business collections and every settings page go to the Activity log (collections/history.ts)
  collections: [Stores, StoreMemberships, SubscriptionPlans, StoreSubscriptions, StoreInvoices, Users, Media, Products, ProductCollections, Categories, Brands, LaptopModels, Reviews, Posts, Orders, ReturnRequests, WarrantyClaims, PosSales, CashUps, Units, Discounts, FlashSales, WholesaleInquiries, ContactMessages, Pages, Menus, BlockedPhones, TradeIns, ProductQuestions, StockAlerts, AbandonedCarts, Suppliers, Purchases, StockCounts]
    .map((c) => (LOGGED_COLLECTIONS.has(c.slug) ? withActivityLog(c) : c))
    .concat([StockMovements, ActivityLog]),
  globals: [ThemeSettings, AnnouncementBar, HeaderSettings, FooterSettings, WhatsAppSettings, ShippingSettings, PaymentSettings, NotificationSettings, StoreInfo, SeoSettingsGlobal, PageTexts, TestimonialsGlobal, FaqsGlobal, OrderProtection, ReturnsPolicy, CookieNotice, SalesChannels, ConversionSettings, StaffGuide].map(withGlobalActivityLog),
  editor: lexicalEditor(),
  // Uploads in /cms (photos, short videos): at most 20 MB each
  upload: { limits: { fileSize: 20 * 1024 * 1024 } },
  sharp,
  typescript: { outputFile: path.resolve(dirname, "payload-types.ts") },
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL || "", max: dbPoolMax },
    // Payload owns its own Postgres schema (and every table is prefixed cms_) so it can never touch the legacy Prisma tables.
    schemaName: "payload",
    // Production uses committed migrations only – never auto-push.
    push: false,
    migrationDir: path.resolve(dirname, "migrations"),
    // In production (standalone Docker image, no CLI) pending committed migrations run on server start.
    // Take a pg_dump BEFORE deploying a release that contains new migrations (see docs/payload-migration).
    prodMigrations: migrations,
  }),
  plugins: [
    // CSV / JSON import & export (list view → ⋯ menu). Owner-only fields (cost price) follow field access.
    importExportPlugin({
      // Imports and exports run straight away inside the request (no background job queue to wait for).
      collections: [
        { slug: "products", import: NOW, export: NOW },
        { slug: "categories", import: NOW, export: NOW },
        { slug: "brands", import: NOW, export: NOW },
        { slug: "laptop-models", import: NOW, export: NOW },
        { slug: "discounts", import: NOW, export: NOW },
        // Export only (replaces the old admin's CSV downloads)
        { slug: "orders", import: false, export: NOW },
        { slug: "users", import: false, export: NOW },
        { slug: "wholesale-inquiries", import: false, export: NOW },
        { slug: "contact-messages", import: false, export: NOW },
      ],
      // Export files can contain cost prices (owner) and customer lists – owners and managers only.
      overrideExportCollection: ({ collection }) => ({ ...collection, dbName: dbName("exports"), admin: { ...collection.admin, group: "Catalog" }, access: { ...collection.access, read: managers, create: managers, update: managers, delete: managers } }),
      overrideImportCollection: ({ collection }) => ({ ...collection, dbName: dbName("imports"), admin: { ...collection.admin, group: "Catalog" }, access: { ...collection.access, read: staff, create: staff, update: staff, delete: managers } }),
    }),
    s3Storage({
      enabled: s3Configured,
      alwaysInsertFields: true, // identical DB schema with or without the bucket
      collections: { media: { prefix: "media", generateFileURL: mediaFileURL } },
      bucket: process.env.S3_BUCKET || "",
      config: {
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION || "auto",
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
        credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID || "", secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "" },
      },
    }),
    seoPlugin({
      collections: ["pages", "products", "categories", "posts", "product-collections"],
      uploadsCollection: "media",
      tabbedUI: false,
      generateTitle: ({ doc }) => `${(doc as { title?: string; name?: string }).title ?? (doc as { name?: string }).name ?? ""} | ShopEngine`,
      // the address shown in the search-result preview (product links forward to /<category>/<product>)
      generateURL: ({ doc, collectionSlug }) => {
        const slug = String((doc as { slug?: string } | undefined)?.slug ?? "");
        const paths: Record<string, string> = { pages: slug === "home" ? "" : `pages/${slug}`, categories: `category/${slug}`, posts: `blog/${slug}`, "product-collections": `collections/${slug}`, products: `products/${slug}` };
        return `${serverURL}/${slug ? (paths[String(collectionSlug)] ?? slug) : ""}`;
      },
      // empty = the store fills in a title / description itself – say so, so "Missing" doesn't look like an error
      fields: ({ defaultFields }) => [
        {
          name: "seoNote",
          type: "ui",
          admin: {
            components: {
              Field: {
                path: "/payload/admin/BlockNote#BlockNote",
                clientProps: { text: "Optional. Leave Title and Description empty and the store writes them from the name and short summary – “Missing” below just means you haven’t written your own." },
              },
            },
          },
        },
        ...defaultFields,
        {
          name: "noindex",
          type: "checkbox",
          label: "Hide from search engines (noindex)",
          admin: { description: "The page stays on the store, but Google won't list it and it leaves the sitemap." },
        },
        {
          name: "canonical",
          type: "text",
          label: "Canonical URL (advanced)",
          validate: (v: unknown) =>
            v == null || v === "" || (typeof v === "string" && (/^\/[^\s]*$/.test(v) || /^https?:\/\/[^\s]+$/.test(v))) ? true : "Use a full address (https://…) or a path starting with /.",
          admin: { description: "Only when this page duplicates another one: the address Google should treat as the original. Empty = this page itself." },
        },
      ],
    }),
    redirectsPlugin({
      collections: ["products", "categories", "posts"],
      overrides: {
        dbName: dbName("redirects"),
        admin: { group: "Settings" },
        access: { read: () => true, create: staff, update: staff, delete: managers },
        fields: ({ defaultFields }) => [...defaultFields, legacyIdField],
        hooks: { afterChange: [({ doc }) => (clearRedirectCache(), doc)], afterDelete: [({ doc }) => (clearRedirectCache(), doc)] },
      },
    }),
  ],
});
