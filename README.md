# ShopEngine: The engine that powers shops

ShopEngine is a multi-tenant commerce platform foundation for digital storefronts, storefront admin operations, and merchant-managed shop experiences. It keeps the current storefront patterns intact while adding the platform-level structures required for multiple stores, store memberships, and tenant-aware access.

Built with **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS v4** and **Payload CMS 3** on **PostgreSQL** (the admin lives at `/cms`), with **Auth.js** for customer accounts and an **S3-compatible bucket** for photos. It is hosted on **Railway** behind **Cloudflare**. Run `npm run dev` without a database and the store works in **demo mode** on a built-in seed catalog.

**Guides for the owner and staff** are in [`docs/`](docs): [SETUP](docs/SETUP.md), [DEPLOYMENT](docs/DEPLOYMENT.md), [BACKUP-RESTORE](docs/BACKUP-RESTORE.md), [PRODUCTS](docs/PRODUCTS.md), [ORDERS](docs/ORDERS.md), [DELIVERY-PAYMENTS](docs/DELIVERY-PAYMENTS.md), [STORE-EDITOR](docs/STORE-EDITOR.md), [SECURITY](docs/SECURITY.md), [MAINTENANCE](docs/MAINTENANCE.md). Developers: read [CONVENTIONS](docs/CONVENTIONS.md) first.

---

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Quick start (demo mode)](#quick-start-demo-mode)
- [Local development with PostgreSQL](#local-development-with-postgresql)
- [Deploying to Railway](#deploying-to-railway)
- [Cloudflare](#cloudflare)
- [Backups & restore](#backups--restore)
- [Search Console & Google Business Profile](#search-console--google-business-profile)
- [Project structure](#project-structure)
- [Managing the catalog](#managing-the-catalog)
- [CSV product import / export](#csv-product-import--export)
- [Notifications](#notifications)
- [SEO checklist](#seo-checklist)
- [Scripts](#scripts)
- [Replacing placeholder images](#replacing-placeholder-images)
- [Environment variables](#environment-variables)

---

## Current implementation status

ShopEngine is now a working multi-tenant platform foundation rather than a single-store demo. The project includes tenant-aware user and store models, merchant onboarding primitives, and basic SaaS billing collections, while keeping the existing storefront and admin experience intact.

This is a strong foundation for a Shopify-like product, but it is not yet a final production-grade commerce SaaS. The remaining work is concentrated in the transaction-critical path: checkout safety, inventory reservation behavior, payment-provider verification, refund handling, and consistent tenant isolation across every commerce collection.

**Verified progress**
- Multi-store user and store membership primitives are in place in [`src/payload/collections/Users.ts`](src/payload/collections/Users.ts) and [`src/payload/collections/Stores.ts`](src/payload/collections/Stores.ts)
- Tenant-scoped access is hardened in [`src/payload/access.ts`](src/payload/access.ts)
- Merchant onboarding and plan selection are implemented in [`src/lib/store-tenant.ts`](src/lib/store-tenant.ts) and [`src/app/(frontend)/(store)/account/stores/actions.ts`](src/app/(frontend)/(store)/account/stores/actions.ts)
- SaaS billing foundations exist in [`src/payload/collections/billing.ts`](src/payload/collections/billing.ts)
- Server-side cart pricing is enforced in [`src/lib/cart-pricing.ts`](src/lib/cart-pricing.ts)
- Focused access regression tests were added in [`tests/unit/access.test.ts`](tests/unit/access.test.ts)

**Still required before production use**
- Payment provider integration and webhook verification
- Inventory reservation release on failed or timed-out checkout
- Payment/refund lifecycle separation and idempotent order finalization
- Broader tenant-isolation verification across all commerce collections
- Platform-admin billing enforcement and limit checks

---

## Features

**Storefront**
- Category tree with sub-categories (`/category`, `/category/[slug]`). Filters come from each category's attributes (processor, RAM, DPI, wattage and so on), plus brand, price, condition and stock filters.
- SEO-friendly product URLs: `/{top-category}/{product-slug}`, for example `/laptops/hp-elitebook-840-g8-…`.
- Product pages have a gallery, specs, condition grading (New / Used A+ / Used A / Refurbished / Open box), condition notes and warranty. They also offer RAM/SSD upgrade options, a "frequently bought together" bundle, reviews and related products.
- **Find parts for your laptop** (`/find-parts`): pick a brand and model to see compatible chargers, batteries, keyboards and RAM.
- Instant search, wishlist, compare, recently viewed, and a cart drawer with a free-delivery progress bar.
- Checkout supports Cash on Delivery, JazzCash, EasyPaisa and bank transfer, with a payment-screenshot upload. It also handles per-city delivery charges, an advance payment for high-value COD orders and coupon codes.
- Order tracking by order number and phone (`/track-order`), plus customer accounts with order history, saved addresses and a wishlist.
- WhatsApp ordering and a floating WhatsApp button. Weekly hot deals and a flash-sale countdown.
- Blog, city landing pages (`/laptops-in-lahore` and others), FAQ, About, Contact, and policy pages.
- Dark theme by default, a light mode, mobile bottom navigation and an Urdu category name field.

**Admin** (`/cms`, Payload CMS – step-by-step guides inside at `/cms/help`)
- Home dashboard: to-do list, today vs yesterday, sales chart, top products and cities, setup checklist.
- Orders: tabs (to confirm, payment to check, to ship, on the way…), one-click next step, payment approval, printable invoice and packing slip, cash-on-delivery confirmation by link / code, risk score, blocked numbers, refused-parcel (RTO) report.
- Shop counter (POS) with barcode scanning, split payments, receipts and daily cash-up; laptops tracked by serial number; one stock shared by the website and the shop.
- Products with photos, quick price / stock editing, readiness checklist, questions & answers, reviews with photos, barcode labels, stock counts, suppliers and purchases, CSV import / export.
- Returns, warranty claims and credit notes; trade-in requests; abandoned carts and stock / price alerts.
- Online store editor (pages, theme, menus, header, footer, blog…), delivery zones and fees, payment methods, notifications, fake-order protection, returns & warranty rules, cookie notice, product feeds, staff with 2-step verification, customer data export / delete.

**SEO**
- Unique title, description and canonical URL on every page, plus Open Graph and Twitter cards.
- JSON-LD for Product, BreadcrumbList, FAQPage, Article, ItemList and LocalBusiness.
- Sitemap, robots, managed 301/302 redirects and long-form category SEO copy.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16.4 (App Router, Turbopack, Server Actions, `proxy.ts`, `output: "standalone"`), React 19, TypeScript (strict) |
| Admin & data | Payload CMS 3 (`src/payload/`) on PostgreSQL via `@payloadcms/db-postgres`. Payload owns the `payload` schema (tables prefixed `cms_`); schema changes are committed migrations in `src/migrations/` |
| Customer accounts | Auth.js (NextAuth v5) credentials sign-in; the accounts themselves are Payload `users` (role `customer`). Staff sign in to `/cms` with Payload's own auth and 2-step verification |
| Photos | Payload **Media** collection: uploaded in `/cms`, converted to WebP sizes on the server, stored in a private S3-compatible bucket and served by the app at `/media/*` (cached by Cloudflare) |
| Styling / UI | Tailwind CSS v4 (CSS-first config in `src/app/globals.css`), Framer Motion, lucide-react |
| State | Zustand (cart, wishlist, compare, UI) |
| Validation / content | Zod; Markdown (`marked`) cleaned with `sanitize-html` |
| Quality | ESLint 9 (`eslint.config.mjs`), Vitest unit tests (`tests/unit/`), end-to-end scripts (`scripts/tests/`, `scripts/smoke-test.mjs`) |
| Hosting | Railway (Docker, Singapore), Cloudflare DNS / proxy / CDN, nightly `pg_dump` backups (`scripts/backup/`), optional uptime monitor (`scripts/uptime/`) |

**Legacy:** the shop used Prisma before moving to Payload. The old Prisma tables (`public` schema) are left untouched – never modify them. `prisma/` and `src/lib/repo/db.ts` remain only for demo mode and the one-off data migration (`npm run migrate:data`).

---

## Quick start (demo mode)

Requirements: **Node.js 22+** and npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no `DATABASE_URL` the app runs in **demo mode**: the catalog, banners, FAQs and settings load from `src/lib/data/seed/*`, orders are kept in memory, and uploads go to `.data/uploads/`. The admin (`/cms`) and customer accounts need a database – see the next section.

Before committing: `npm run typecheck`, `npm run lint` and `npm test` must all pass.

---

## Local development with PostgreSQL

1. Start a local Postgres (no Docker needed – it runs an embedded server on port 54329 and adds `DATABASE_URL` to `.env`):
   ```bash
   npm run db:local        # keep this terminal open
   ```
   (Or `docker compose up -d` and set `DATABASE_URL=postgresql://urko:urko@localhost:5432/urko_tech_store` yourself.)
2. Copy `.env.example` to `.env` and fill in at least `PAYLOAD_SECRET` and `AUTH_SECRET` (`openssl rand -base64 48`).
3. Create the tables and start the site:
   ```bash
   npm run cms:migrate     # applies the committed migrations in src/migrations/
   npm run dev
   ```
4. Open http://localhost:3000/cms. On an empty database the first account you create becomes the **Owner**. Owners and managers must turn on 2-step verification before they get any admin rights.

Without `S3_*` variables, uploads are written to `.data/uploads/`.

**Changing the database.** Edit the collection or global in `src/payload/`, then:
```bash
npm run cms:migrate:create -- <short_name>   # writes src/migrations/<date>_<short_name>.ts
npm run cms:migrate                          # apply it locally
npm run cms:types                            # refresh src/payload-types.ts and the admin import map
```
Read the generated SQL before committing: migrations should only **add** things (columns, tables, enum values) so the live site keeps working while a new version is built. Commit the `.ts` and `.json` files together. Production applies them during the Docker build (and any still pending at start-up) – take a backup first ([BACKUP-RESTORE.md](docs/BACKUP-RESTORE.md)).

---

## Deploying to Railway

The app ships as a Docker image (`Dockerfile`, multi-stage, Node 22, Next.js standalone output). `railway.json` tells Railway to build it and health-check `/api/health`. The build applies Payload migrations (`payload migrate`) and pre-renders pages when `DATABASE_BUILD_URL` and `PAYLOAD_SECRET` are available; the container then just runs `node server.js`.

1. **Create a project** at https://railway.com → **New Project → Deploy from GitHub repo** → this repository. This is the **web** service. Choose **Settings → Deploy → Region: Southeast Asia (Singapore)** for every service.
2. **Add PostgreSQL** (**+ New → Database → PostgreSQL**) and a private **Bucket** (**+ New → Bucket**); note the bucket's endpoint, name and keys.
3. **Set the web service variables** (full list with explanations: [DEPLOYMENT.md §2](docs/DEPLOYMENT.md)):
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   DATABASE_BUILD_URL=${{Postgres.DATABASE_PUBLIC_URL}}
   NEXT_PUBLIC_SITE_URL=https://urkotechstore.com
   PAYLOAD_SECRET=<openssl rand -base64 48>   # never change after launch
   AUTH_SECRET=<openssl rand -base64 32>
   AUTH_TRUST_HOST=true
   AUTH_URL=https://urkotechstore.com
   S3_ENDPOINT=…  S3_BUCKET=…  S3_ACCESS_KEY_ID=…  S3_SECRET_ACCESS_KEY=…  S3_REGION=auto
   SMTP_HOST=… (or RESEND_API_KEY=…)  EMAIL_FROM="Urko Tech Store <info@urkotechstore.com>"
   ```
   `NEXT_PUBLIC_*` values are built into the pages: after changing one, **redeploy**. Railway passes service variables to the Docker build automatically.
4. **Deploy.** The build migrates the database, then Railway waits for `/api/health` to return `{"ok":true,…}` before switching traffic. Without `PAYLOAD_SECRET` or `AUTH_SECRET` the server refuses to start, so the previous version keeps serving. Check the `warnings` list in `/api/health` (also shown on the `/cms` Home screen).
5. **First sign-in.** Open `/cms`, create the Owner account and set up 2-step verification. Add staff under **Settings → Staff**.
6. **Custom domain:** **Settings → Networking → Custom Domain** for `urkotechstore.com` and `www`, then the DNS records in Cloudflare (below).
7. **Backup cron service:** **+ New → GitHub Repo** (same repo), config file `scripts/backup/railway.json` (daily at 02:00 PKT). Variables: [BACKUP-RESTORE.md](docs/BACKUP-RESTORE.md) / [DEPLOYMENT.md §2](docs/DEPLOYMENT.md).
8. **Uptime monitor (optional):** another service from the same repo with `scripts/uptime/railway.json`.

---

## Cloudflare

1. Add `urkotechstore.com` to Cloudflare and switch the nameservers at your registrar.
2. **DNS:** create the records Railway shows for the custom domain. Usually that's `CNAME @ → <xyz>.up.railway.app` (Cloudflare flattens CNAMEs at the apex) and `CNAME www → <xyz>.up.railway.app`. Turn on the **orange cloud (proxied)**. If Railway asks for a TXT verification record, add it too.
3. **SSL/TLS → Overview:** set the mode to **Full (strict)**. Railway serves a valid certificate, so never use "Flexible", which causes redirect loops.
4. **SSL/TLS → Edge Certificates:** turn on **Always Use HTTPS** and **Automatic HTTPS Rewrites**. The app already sends HSTS.
5. **Caching → Cache Rules.** Create one rule:
   - **If** URI Path starts with `/media/` **OR** URI Path starts with `/_next/static/`
   - **Then:** Eligible for cache. Edge TTL: *Use cache-control header if present, otherwise 1 month*. Browser TTL: *Respect origin*.

   These paths are immutable or content-addressed. Don't cache HTML, `/api/*`, `/cms/*` or `/cms-api/*`: Cloudflare doesn't cache HTML by default, so leave it that way.
6. Optional: under **Speed → Optimization**, enable Brotli and Early Hints. Leave **Rocket Loader** off, because it breaks React hydration.
7. Redirect `www` to the apex (or the other way round) with a **Redirect Rule**, and make `NEXT_PUBLIC_SITE_URL` / `AUTH_URL` match the primary host.

---

## Backups & restore

The **backup** cron service (`scripts/backup/backup.sh`) dumps the database every night at 02:00 PKT to `backups/YYYY-MM-DD.sql.gz` (kept 30 days), copies the photos weekly to `backups-media/`, and alerts by email / webhook when it fails. Use a **separate backup bucket** (`BACKUP_S3_*`). How to check, restore and practise: [docs/BACKUP-RESTORE.md](docs/BACKUP-RESTORE.md).

---

## Search Console & Google Business Profile

**Google Search Console**
1. Add a **Domain** property for `urkotechstore.com` and verify it with the DNS TXT record in Cloudflare. Alternatively, use the *URL prefix* property with the **HTML tag** method: paste only the `content` value into `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` and redeploy.
2. Under **Sitemaps**, submit `https://urkotechstore.com/sitemap.xml`.
3. Use **URL Inspection → Request indexing** for the home page and main categories. Check **Pages** and **Enhancements** (Products, Breadcrumbs, FAQ) after the first crawl.

**Google Business Profile (NAP consistency).** Keep the **Name, Address and Phone** identical everywhere. The single source of truth is **/cms → Settings → Store details** (name, address, phone numbers, opening hours, map location, social links; defaults in `src/lib/site.ts`). It feeds the footer, contact page and LocalBusiness JSON-LD.
- Make the profile match those details letter for letter: "Urko Tech Store, Regal Trade Square, Regal Chowk, Saddar, Karachi" with +92 342 6693115 and +92 343 5867409.
- Set the profile's website to `https://urkotechstore.com` and use the same opening hours.
- Use the same NAP on Facebook, Instagram, OLX and directory listings.

---

## Project structure

```
├── docs/                          # Owner/staff guides, CONVENTIONS.md, code review and launch report
├── src/
│   ├── app/
│   │   ├── (frontend)/(store)/    # Storefront: home, [category] (+ city pages), [category]/[product], category/,
│   │   │                          #   brands/, cart, checkout, account, blog, deals, find-parts, policies…
│   │   ├── (payload)/             # Admin at /cms, its API at /cms-api, print pages (/cms-print)
│   │   ├── api/                   # Route handlers: health, cron, search, auth, exports…
│   │   ├── media/[...key]/        # Serves photos from the private bucket (or .data/uploads)
│   │   ├── feed-image/[...key]/   # JPEG copies of photos for Meta / TikTok feeds
│   │   ├── feeds/                 # Google / Meta / TikTok product feeds
│   │   └── products/[slug]/       # Old /products/<slug> links → 301 to the product
│   ├── payload/                   # Admin: collections, globals, hooks, endpoints, access rules, admin screens
│   │   ├── access.ts              # Roles and who may read / change what (2-step enforced here)
│   │   └── stock.ts               # Atomic SQL for stock, coupons and serial-numbered units
│   ├── payload.config.ts          # Payload config (database, plugins, jobs, email)
│   ├── migrations/                # Committed Payload migrations
│   ├── components/                # ui/, layout/, product/, product-detail/, checkout/, home/, …
│   ├── lib/
│   │   ├── cms/                   # Reads/writes the shop's data in Payload (catalog, orders, settings…)
│   │   ├── repo/                  # What pages call: cached catalog, orders, content (demo-mode fallback)
│   │   ├── order-money.ts         # What the rider collects / when an order may ship
│   │   ├── cities.ts              # Cities, delivery zones, fees, payment-method rules
│   │   ├── seo.ts, site.ts        # Metadata, JSON-LD, business details
│   │   └── data/seed/             # Demo catalog
│   ├── store/                     # Zustand stores (cart, lists, ui)
│   ├── proxy.ts                   # Next 16 proxy: redirects, rate limits, staging password
│   └── instrumentation.ts         # Start-up checks, Sentry, background-job timer
├── tests/unit/                    # Vitest unit tests (npm test)
├── scripts/
│   ├── backup/, uptime/           # Railway cron services
│   ├── tests/                     # Security sweep, crawl, stock race
│   ├── maintenance/               # One-off fixes (e.g. recompute product ratings and sold counts)
│   └── migrate/                   # Prisma → Payload data migration and URL checks
├── prisma/                        # Legacy schema + seed (demo mode / migration only)
└── Dockerfile, railway.json, docker-compose.yml
```

**Data flow.** Pages read through `src/lib/repo/*` (cached with `unstable_cache` and tags, refreshed by Payload hooks in `src/payload/revalidate.ts`). With a database those call `src/lib/cms/*` (Payload's local API); without one they use the seed catalog.

---

## Managing the catalog

You don't need to change code to add categories, sub-categories or filters.

**Add a category or sub-category.** Go to **/cms → Products → Categories** and click **Create new**. Set:
- Name, slug and an optional Urdu name.
- Parent: leave it empty for a top-level category, or pick a parent to make a sub-category.
- A lucide icon name (for example `Laptop`, `Mouse` or `HardDrive`).
- Short description, image, SEO title and description, and long SEO copy in Markdown.
- Sort order, and the "featured" and "compatibility finder" toggles.

**Add filter attributes.** On a category, add an attribute with:
- **key**: the machine name, for example `wattage` or `screenSize`.
- **label**: the name shown to shoppers.
- **kind**: one of
  - `select`: a checkbox list. You can give fixed `options`, or leave them empty and the values are collected from products.
  - `boolean`: a yes/no toggle, for example "RGB Lighting".
  - `range`: a numeric min–max slider, for example "Max DPI", with an optional `unit`.

Sub-categories **inherit** their parent's attributes, and a child definition with the same key overrides the parent's. Brand, price, condition and in-stock filters are built in for every category.

**Fill attribute values.** On the product page in **/cms → Products**, the attribute fields for the product's category appear automatically. You can also fill them in bulk through the import (below).

**Brands and laptop models.** Manage these in **/cms → Products → Brands / Laptop models**. Laptop models (brand → series → model) power the "Find parts for your laptop" tool. Link parts to models through each product's `compatibility` list.

---

## CSV product import / export

In **/cms → Products → Import** upload a CSV (or JSON) file; **Export** downloads the current products (or any list you filtered) the same way – the easiest template is an export. Columns are the product field names (`title`, `sku`, `price`, `compareAtPrice`, `stock`, `status`, `brand`, `category`…). Rows with an existing id are updated, the rest are created. Cost prices are only imported / exported for owners. Orders, customers, wholesale enquiries and messages can be exported but not imported.

---

## Notifications

Order notifications live in `src/lib/notify.ts`. Each channel stays switched off until its environment variables are set.

**Email (SMTP or Resend)**

All email goes out one way: order emails, contact-form alerts, customer password resets and "confirm your email" links, and /cms password resets. Until one of the two is set up, nothing is sent.

- **SMTP** (any mailbox – Google Workspace / Gmail, Zoho, Hostinger, Brevo…): set `SMTP_HOST`, `SMTP_PORT` (587, or 465 for SSL), `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM` (an address that mailbox may send as, e.g. `Urko Tech Store <info@urkotechstore.com>`). For Gmail / Google Workspace use an **App Password**, not your normal password. SMTP wins when both are set.
- **Resend**: create an account at https://resend.com, verify your domain (add its DNS records in Cloudflare as **DNS only**), then set `RESEND_API_KEY` and `EMAIL_FROM`.

Then set `ADMIN_ALERT_EMAIL` (or the staff emails in **/cms → Settings → Notifications**) for new-order and contact-form alerts. Customers who enter an email at checkout get an order confirmation. To avoid the spam folder, add the SPF / DKIM records your provider gives you.

**WhatsApp Cloud API**
1. At https://developers.facebook.com, create an app (type *Business*) and add the **WhatsApp** product.
2. Add and verify your business phone number. Copy its **Phone number ID** into `WHATSAPP_PHONE_NUMBER_ID`.
3. Create a **System User** in Meta Business Settings, give it the WhatsApp permissions, and generate a **permanent token** for `WHATSAPP_TOKEN`.
4. Create message templates and get them approved. Business-initiated messages must use approved templates.
   - `WHATSAPP_TEMPLATE_ORDER`: the order confirmation, with variables for the customer name, order number and total.
   - `WHATSAPP_TEMPLATE_STATUS`: order status updates (confirmed, dispatched, out for delivery, delivered).
   - `WHATSAPP_TEMPLATE_CONFIRM`: cash-on-delivery confirmation (name, order number, link).
   - Optional: `WHATSAPP_TEMPLATE_ORDER_LOOKUP` ("find my orders" sends the order numbers to the customer's WhatsApp; variables: order numbers, track link. They are also emailed to the address used on those orders. Order numbers are never shown on screen), `WHATSAPP_TEMPLATE_CART`, `WHATSAPP_TEMPLATE_BACK_IN_STOCK`, `WHATSAPP_TEMPLATE_PRICE_DROP` for reminders and alerts (otherwise those go by email only).
   - Set `WHATSAPP_TEMPLATE_LANG` to the templates' language code (for example `en` or `ur`).

**SMS fallback.** `SMS_WEBHOOK_URL` is an HTTPS endpoint, for example an SMS gateway or a Zapier, Make or n8n webhook. It receives a JSON POST with the phone number and message.

---

## SEO checklist

- [ ] `NEXT_PUBLIC_SITE_URL` (and `AUTH_URL`) is set to the final primary domain, so canonicals, the sitemap and OG URLs are correct.
- [ ] Search Console is verified and `sitemap.xml` is submitted. No coverage errors after the first crawl.
- [ ] Google Business Profile NAP matches **/cms → Settings → Store details** exactly (name, address, both phone numbers, hours).
- [ ] Every product has a unique name, a 150–160 character `seoDescription` (or a good short description), real photos with alt text, and specs filled in.
- [ ] Every top-level category has its `seoTitle`, `seoDescription` and long `seoContent` (Markdown).
- [ ] Old URLs from any previous site are mapped under **/cms → Settings → Redirects** (301).
- [ ] At least a few blog posts are published, linking to categories and products.
- [ ] Reviews are moderated and approved, which adds AggregateRating to Product JSON-LD.
- [ ] Rich results for a product URL and the home page pass https://search.google.com/test/rich-results.
- [ ] PageSpeed Insights on mobile is green, and the Cloudflare cache rule for `/media/*` and `/_next/static/*` is active.
- [ ] GA4 and Meta Pixel are configured if you run ads.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` / `npm run lint` / `npm test` | TypeScript, ESLint (no warnings allowed), Vitest unit tests |
| `npm run db:local` | Start a local embedded Postgres (port 54329) |
| `npm run cms:migrate` | Apply pending Payload migrations |
| `npm run cms:migrate:create -- <name>` | Create a migration from your collection changes |
| `npm run cms:types` | Regenerate Payload types and the admin import map |
| `npm run test:smoke -- <url>` | ~38 storefront + admin checks against a running site |
| `npm run test:security -- <url>` / `npm run test:crawl -- <url>` | Anonymous security sweep / broken-link crawl |
| `npm run test:urls` | Compare old URLs against the saved baseline (site on :3000) |
| `npm run test:stock` / `npm run test:load` | Stock race test / load test |
| `npm run stats:recompute` | Report product ratings, review counts and sold counts that don't match real reviews and orders; add `-- --apply` to fix them (back up first) |
| `npm run customers:link` | Report which older orders have no customer in /cms; add `-- --apply` to attach them (creating "no account yet" records; never to unconfirmed accounts) – back up first |
| `npm run migrate:data` / `migrate:report` / `migrate:backup` | One-off Prisma → Payload data migration tools |
| `npm run db:seed` | Legacy: seed the old Prisma tables (demo / migration only) |

---

## Replacing placeholder images

The demo catalog uses SVG placeholders in `public/images/`. Real photos are added in **/cms → Products → (product) → Photos** (drag to reorder – the first is the main photo; alt text is required). They are converted to WebP sizes and stored in the private bucket; banners, categories, brands and blog covers work the same way. Photos still used by a product, category, brand or post can't be deleted.

Tips: square 1200×1200 shots on a clean background, main photo first, descriptive alt text ("HP EliteBook 840 G8 front view").

---

## Environment variables

`.env.example` documents every variable; [DEPLOYMENT.md §2](docs/DEPLOYMENT.md) explains each one for Railway. The essentials:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Production | PostgreSQL; without it the app runs in demo mode |
| `DATABASE_BUILD_URL` | Railway build | Public database URL so the build can migrate and pre-render |
| `PAYLOAD_SECRET`, `AUTH_SECRET` | Production | Admin sessions and 2-step secrets / customer sessions and order cookie. The server won't start without them |
| `NEXT_PUBLIC_SITE_URL`, `AUTH_URL`, `AUTH_TRUST_HOST` | Production | Real web address (build-time) and Auth.js behind the proxy |
| `S3_*` | Production | Private photo bucket |
| `SMTP_*` or `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_ALERT_EMAIL` | Production | Email |
| `WHATSAPP_*`, `SMS_WEBHOOK_URL` | Optional | WhatsApp templates / SMS gateway |
| `CLIENT_IP_HEADER` | Behind Cloudflare proxy | `cf-connecting-ip`, so rate limits see real visitors |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` | Optional | Bot check on forms (set both, redeploy) |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Optional | Error monitoring |
| `STAGING`, `STAGING_USER`, `STAGING_PASSWORD` | Staging only | Password-protected, hidden test copy |
| `BACKUP_S3_*`, `ALERT_*`, `PG_MAJOR` | Backup service | Separate backup bucket, failure alerts, `pg_dump` version |

---

© Urko Tech Store, Regal Trade Square, Regal Chowk, Saddar, Karachi · +92 342 6693115 · +92 343 5867409
