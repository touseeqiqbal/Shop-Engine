# Payload CMS migration – runbook

Branch: `payload`. `master` (the live store) is untouched until cutover.

## Phase 1 – what is in place

| Area | Implementation |
|---|---|
| Payload 3.90 inside the existing Next.js 16 app | `src/payload.config.ts`, route group `src/app/(payload)` (admin at **`/cms`**, API at **`/cms-api`** while the old `/admin` is still in use; moves to `/admin` when the old admin is retired) |
| Two root layouts | storefront in `src/app/(frontend)`, Payload in `src/app/(payload)`, unmatched URLs → `src/app/global-not-found.tsx` |
| Database isolation | every Payload table lives in Postgres schema **`payload`** and is prefixed **`cms_`** – the Prisma tables in `public` are never touched (proved by `scripts/migrate/fingerprint-legacy.mjs`) |
| Migrations | `src/migrations/*` (committed). `push: false` everywhere. Production applies pending migrations on boot (`prodMigrations`), triggered by the Railway health check (`/api/health`); a failed migration fails the health check → Railway keeps the previous deployment |
| Roles | `owner`, `manager`, `staff`, `customer` (`src/payload/access.ts`). Cost price: owner only (read + write). Roles: owner only. Customers: own profile + own orders, no admin access |
| Collections | Users (staff + customers), Media, Products, Categories, Brands, Laptop models, Reviews, Blog posts (drafts + scheduled publish + versions), Orders, Wholesale inquiries, Contact messages, Redirects (plugin), SEO fields (plugin) |
| Media | Payload Media library → S3 bucket prefix `media/` (local: `.data/uploads/media`), WebP + thumbnail/card/full sizes, focal point, alt text required, folders. Public URL is always **`/media/media/<file>`** served by our route with `Cache-Control: public, max-age=31536000, immutable` (Cloudflare-cacheable) + a sandbox CSP. Old image URLs (`/media/products/...`, `/images/...`) keep working |
| Customer passwords | bcrypt hash copied to `legacyPasswordHash`; first login verifies it and re-saves a native Payload password (`src/payload/collections/Users.ts`). No reset emails needed |
| Staging guard | `STAGING=true` → Basic Auth on every page/API except `/api/health`, `X-Robots-Tag: noindex` on everything, `robots.txt: Disallow: /`, all email/WhatsApp/SMS notifications suppressed (`src/lib/staging.ts`) |

The storefront still reads the legacy Prisma tables in phase 1 (switching it to Payload happens in phases 2–6), so the live site behaves exactly as before.

## Tools

| Command | Purpose |
|---|---|
| `npm run migrate:backup` | `pg_dump` of the whole database (all schemas) → `backups/pre-payload-*.dump` (+ optional bucket upload). **Run before every migration step.** Needs PostgreSQL client tools 17+ |
| `npm run migrate:fingerprint > before.json` | row count + md5 of every legacy table; `node scripts/migrate/fingerprint-legacy.mjs --compare before.json after.json` proves they're unchanged |
| `npm run migrate:data` | idempotent Prisma → Payload copy (re-runnable). Add `-- --since=<ISO>` (or `MIGRATE_SINCE=<ISO>`) for the cutover delta |
| `npm run migrate:report` | re-verify counts / totals / slugs without copying; writes `migration-report.md`, exit 1 on mismatch |
| `npm run test:smoke -- <url>` | 32 storefront + CMS checks (status, one H1, canonical, JSON-LD, media headers, 404s, SEO files, API access) |
| `node scripts/migrate/url-check.mjs snapshot <url> > baseline.json` / `npm run test:urls -- <url> baseline.json` | URL preservation check (`docs/payload-migration/url-baseline.json` = master) |

## Running the tools in the Railway console

The image built from the `payload` branch contains self-contained tool bundles in `/app` (built by
`scripts/build-console-tools.mjs`), so everything runs with plain `node` – no npm, prisma, tsx or payload CLI needed:

| Command (Railway → service → Console) | Purpose |
|---|---|
| `node seed.mjs` | sample catalog / first admin (`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` variables) |
| `node migrate-data.mjs` | applies pending Payload migrations, copies legacy data → Payload, prints the report |
| `node migrate-data.mjs --since=2026-10-10T21:00:00Z` | cutover delta sync |
| `node migrate-data.mjs --report-only` | verify only |
| `node fingerprint-legacy.mjs > /tmp/before.json` … `node fingerprint-legacy.mjs --compare /tmp/before.json /tmp/after.json` | prove legacy tables untouched |
| `node smoke-test.mjs http://localhost:$PORT` | 32 checks (uses `STAGING_USER/PASSWORD` automatically on staging) |

Legacy (Prisma) migrations and Payload migrations also run automatically on every deploy, so no migrate
command is needed in the console. The production image built from `master` does not have these tools yet.

## Railway – environment variables (new)

| Variable | Service | Value |
|---|---|---|
| `PAYLOAD_SECRET` | web (prod + staging) | long random string (`openssl rand -base64 48`), **different per environment**, never changes afterwards |
| `STAGING` | staging only | `true` (must also be present at build time – the Dockerfile declares it as a build arg) |
| `STAGING_USER` / `STAGING_PASSWORD` | staging only | Basic-Auth credentials |
| everything else | | unchanged (`DATABASE_URL`, `DATABASE_BUILD_URL`, `S3_*`, `AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL`, …) |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | web | Sentry project DSN (server / browser, usually the same). Off when empty. Alerts: Sentry → Alerts → “email on new issue”. `NEXT_PUBLIC_*` must be set at build time |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | web | Cloudflare Turnstile keys (Cloudflare → Turnstile → add site). Off when empty. Site key needed at build time |
| `CRON_SECRET` | web | optional – enables `POST /api/cron` (Bearer) for an external scheduler; the server already runs housekeeping every 5 min |
| `HOUSEKEEPING` | optional | jobs take a database lock, so replicas never run them twice; `off` disables them on an instance |
| `TWO_FACTOR_REQUIRED` | web | leave unset. `false` only in an emergency (owners/managers then aren't forced to use 2-step verification) |
| `WHATSAPP_TEMPLATE_CONFIRM` | web | optional approved WhatsApp template for COD confirmation (params: name, order number, link) |

**Uptime monitor** – a separate always-on Railway service from this repo with config path `scripts/uptime/railway.json`.
Variables: `SITE_URL=https://www.urkotechstore.com`, `ALERT_EMAILS`, `RESEND_API_KEY`, `ALERT_FROM`, `ALERT_PHONES`, `SMS_WEBHOOK_URL`
(see the top of `scripts/uptime/monitor.mjs`). Test with `node scripts/uptime/monitor.mjs --once`.

**Sale-day checks (staging)** – `npm run test:load -- https://<staging> --users 100 --seconds 120` and
`BUYERS=200 STOCK=20 npm run test:stock` (staging `DATABASE_URL`). Never against production.

## Staging setup (Railway)

1. Project → **Environments → New environment “staging”** (duplicates services). Give it its **own Postgres** and **own bucket** (never share production's bucket: staging deletes would delete live photos).
2. Restore production data into the staging Postgres: `pg_restore --no-owner --no-privileges -d "$STAGING_DATABASE_PUBLIC_URL" backups/pre-payload-….dump`. Copy media: `aws s3 sync s3://<prod-bucket> s3://<staging-bucket> --endpoint-url …` (or start with the placeholders).
3. Web service variables: `STAGING=true`, `STAGING_USER`, `STAGING_PASSWORD`, `PAYLOAD_SECRET`, staging `NEXT_PUBLIC_SITE_URL`. Point the service at the **`payload`** branch.
4. Deploy → the health check applies the Payload migrations. Then run the data copy from your computer against staging's public URL: `DATABASE_URL=<staging public url> S3_…=<staging bucket> npm run migrate:data` and keep `migration-report.md`.
5. Check: `STAGING_USER=… STAGING_PASSWORD=… npm run test:smoke -- https://<staging-domain>`, `npm run test:urls -- https://<staging-domain> docs/payload-migration/url-baseline.json`, sign in at `/cms`.

## Cutover plan (low-traffic window, ~20 minutes – suggested 3–4 am PKT)

**Before the window**
- Staging signed off; smoke + URL checks green; migration report green.
- Announce a short maintenance note on the announcement bar if desired.
- Confirm a recent daily backup exists.

**Window**
1. `T0` – note the time. Optional: switch on the announcement “Orders placed in the next 15 minutes are confirmed on WhatsApp”.
2. **Backup**: `DATABASE_URL=<prod public url> npm run migrate:backup` (verify it reports > 1 KB and lists tables). Fingerprint: `npm run migrate:fingerprint > before.json`.
3. **Deploy** the `payload` branch to production (merge `payload` → `master`, or point the service at `payload`). The health check applies the Payload migrations (new `payload` schema only).
4. **Full copy**: `DATABASE_URL=<prod public url> npm run migrate:data` → must end with “All checks passed”.
5. **Delta sync** for anything placed during steps 3–4: `npm run migrate:data -- --since=<T0>` → green report. (Legacy tables keep receiving orders until the storefront switches to Payload in a later phase, so this delta step is repeated at that later cutover too.)
6. **Verify**: fingerprint `after.json` → `--compare` must say identical; `npm run test:smoke -- https://urkotechstore.com`; `npm run test:urls -- https://urkotechstore.com docs/payload-migration/url-baseline.json`; sign in to `/cms`; place one test COD order and cancel it.
7. Purge Cloudflare cache for HTML only (media URLs are content-addressed).

**Rollback (tested path)**
- The legacy Prisma tables are never modified, so rollback = redeploy the previous `master` deployment in Railway (**Deployments → previous → Redeploy**, ~2 min). The `payload` schema is ignored by the old code.
- Optional clean-up after a rollback: `DROP SCHEMA payload CASCADE;` (only Payload data; nothing else lives there).
- Worst case (data corruption): restore the step-2 dump into a fresh database (`pg_restore`) and point `DATABASE_URL` at it.

Rehearsed locally on PostgreSQL 18 (see `migration-report-rehearsal.md` and `url-check-phase1.txt`).

## Phase 4 – catalog lives in /cms

Since Phase 4 the catalog (products, categories, brands, laptop models, reviews, collections) is edited **only** in
`/cms`. The storefront, checkout (stock + sold count), review submissions and the old admin's product pickers all read
and write Payload. The old `/admin` catalog screens show a "moved to /cms" panel and their actions refuse to write.

- Storefront ids stay the legacy ids for migrated records (carts, wishlists, orders, flash sales keep working);
  products created in `/cms` use their Payload id.
- `migrate-data.mjs` is now **create-only** for catalog collections: re-running it (e.g. for the order delta sync)
  never overwrites edits made in `/cms`. Catalog rows in the report are informational (ℹ️).
- New in `/cms`: Collections (`/collections/<handle>`), stock status filter (in / low / out), selling unit,
  spec-template form for filter attributes, bulk edit (tick rows → Edit), CSV/JSON import & export (list ⋯ menu).
- Deploying: take a `pg_dump`, deploy (migration `catalog_tools` runs on start), then check one product edit is live.

## Phases 5–6 and the retired old admin

- **Settings → Shipping & delivery / Payments** (Phase 5): zones with a live fee tester, payment methods, COD
  fee / limit / advance rules. Seeded from the old Store settings; until first saved the old values apply.
- **Sales → Orders, Discounts, Flash sales, Wholesale inquiries, Contact messages** (Phase 6): checkout writes
  orders to /cms; status changes there notify the customer. **Users & customers**: sign-in/sign-up use Payload
  users (old passwords keep working and are upgraded on first sign-in). **Settings → Notifications**.
- **Old admin retired**: `/admin/**` redirects to `/cms`. Its remaining sections moved to **Settings → Store info,
  SEO, Redirects** and **Online store → Page texts, Testimonials, FAQs**; hero banners became the Home page hero
  slides; the blog is written in **Content → Blog posts**. CSV exports: list view ⋯ menu → Export.
- `migrate-data.mjs` copies every remaining old-admin setting into /cms once (only into globals never saved
  there) and is create-only for everything editors manage in /cms. Run it right after deploying this release.

## Phases 7–8

- **Dashboard** (/cms home): revenue / orders / average order for today, 7, 30 days and any date range, daily
  chart, to-do tiles (orders to confirm, payments to verify, low / out of stock, enquiries, messages), top products,
  sales by city, payment mix, recent orders. Data: `GET /cms-api/reports` (staff only).
- **SEO**: changing the URL handle of a live product, category, post, page or collection creates a 301 redirect
  automatically (Settings → Redirects); redirects apply immediately.
- **Security**: GraphQL disabled; staff passwords ≥ 10 characters; admin cookie only accepted from the store's own
  domains; login lock after 10 failed attempts (15 min).
- **Settings backup** (owner only, dashboard card): download all settings, theme, menus, pages, collections and
  redirects as JSON; restore shows a preview first. Orders/customers/products are in the database backup.
- **Database backups**: enable scheduled backups on the Railway Postgres service (Railway → Postgres → Backups),
  and always take a `pg_dump` before deploying a release with new migrations.

## Deploying phases 5–8 (in order)

1. `pg_dump` the production database.
2. Push / deploy. On start the server runs the new migrations (shipping_payments, sales, site_content,
   post_edit_dates) – all in the `payload` schema.
3. Railway console: `node migrate-data.mjs` – copies the old admin's remaining data into /cms once
   (store info, SEO, page texts, testimonials, FAQs, hero banners, discount codes, flash sales) and syncs any
   orders / customers / enquiries placed before the deploy. Check "All checks passed".
4. Open /cms: dashboard loads; Settings → Shipping fee tester; place a test COD order; mark it Confirmed.
