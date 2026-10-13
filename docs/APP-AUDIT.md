# Full app audit – Urko Tech Store (10 October 2026)

**What was checked:**
- The whole codebase, read-only: storefront, `/cms` admin, checkout, orders, stock, POS, returns, accounts, customers, reports, jobs, Docker/Railway, backups, monitoring, tests and dependencies.
- The live site, also read-only: Lighthouse, performance traces, SEO markup, headers and the search API.
- A comparison with what leading stores offer in 2026: Daraz.pk, PriceOye.pk, Shopify (Dawn and the admin), WooCommerce and Amazon.

Earlier review: [CODE-REVIEW.md](CODE-REVIEW.md). Its fixes are in place. This report covers what is **still** wrong, what is **new**, and what is **missing**.

> **Fixed during this audit:** the new "every order has a customer" code (`ff2aaa2`, already pushed) could attach a guest's order to a stranger's account. Anyone can sign up with someone else's email and is signed in before confirming it, so they would then see that person's name, phone and address. Fixed in `48eccb6`: orders now attach only to a **confirmed** account or an automatic guest record, and never by phone. **Push `48eccb6` soon.**

---

## Verdict

**Code: good, and close to a modern Pakistani store.** Prices, stock, checkout, roles, 2-step login, returns, POS and SEO markup are all solid and tested. The live site is held back mainly by **settings that haven't been done yet** (address, email, build database). Beyond that there are a handful of real bugs and the "next level" features the big stores have, mainly courier integration, phone verification, better search and automatic payments.

| Area | Grade | One line |
|---|---|---|
| Storefront features | **A−** | Matches Daraz/PriceOye on product pages, filters, compare, parts finder, trade-in and reviews. Behind on search, OTP, automatic payments and variants. |
| Admin (/cms) | **B+** | Orders, POS, returns, serials, purchases, roles and 2-step are strong. Missing courier API, COD reconciliation, real reports, stock history and activity log. |
| Correctness & security | **B+** | Core flows hold under tests. 1 privacy bug (fixed above), plus a few medium stock, coupon and access gaps (below). |
| Speed (mobile) | **C+** | LCP 3.8–6.5 s. Fixable: about 1 s from a header problem, plus animation library weight. |
| SEO | **A** in code / **F** live | All markup is right, but every live link uses the placeholder domain. |
| Operations | **C** | No CI, migrations run on the live database at build time, single instance only, gaps in backups and alerts. |
| Tests | **C+** | 23 unit tests plus manual end-to-end scripts. No automated checkout/admin tests and no CI. |

---

## Fix status – 11 October 2026

**Fixed and tested** (local production build: API tests, browser checks, lint, types, unit, smoke and stock-race tests):

- **High:** H1 privacy, H2 reports (sales & profit report), H3 no demo mode in production, H4 no demo pre-render.
- **Medium:** M1 2-step on print/file routes · M2 no double restock after a partial return · M3 coupon used again on re-open · M4 refused → delivered marks laptops sold · M5 one return line per serial · M6 CSV import never changes stock of existing products · M7 prices manager-only, order totals always calculated · M8 delivery box and cart drawer follow zones / COD / free delivery · M9 search relevance, typos, synonyms, Urdu · M10 background jobs take a database lock.
- **Low:** focus traps and share label · POS void refused after a return or cash-up, cash refunds in the cash-up · returned serials checked against the order / receipt · first Owner only from /cms · JPEG share images, shorter titles, generated "Home |" title ignored · trust / warranty text and Karachi pickup text from settings · analytics events · PWA icons · stock history and activity log.
- **Speed:** Critical-CH only on /cms, lazy-loaded animations, logo not high priority, no prefetch of /cart and /account, checkout skeleton without layout shift (CLS 0).
- **Operations:** GitHub Actions CI with a migration check · backups of private uploads, encryption, heartbeat · uptime alerts for health warnings · Node 22 pinned · `.env.example` complete · CODE-REVIEW.md updated.

**Fixed 12 October:** returned laptops that aren't put back in stock become "Returned" (no longer "Sold") · the home banner starts rotating only after the page has loaded and pauses in a background tab · failures in checkout, the shop counter, notifications and accounts now reach Sentry (were only printed) · weekly dependency updates (Dependabot, checked by CI) · admin: clearer order page, customer and discount lists, dashboard labels, plain wording in lists, owners/managers only for moving finished orders back.

**Feature check against a Shopify-level store – 12 October** (verified in the code and by tests):

| Area | In place | Added 12 Oct | Not built (priority) |
|---|---|---|---|
| Products | tabs editor, ready-to-sell score, profit, specs, compatibility, upgrades, serial units, CSV, bulk edit, barcode labels | drafts + autosave + preview + scheduled publish + version restore; variants (options with own SKU / price / stock / photo); safe Duplicate; SKU fills itself in | separate barcode field (optional), weight-based delivery prices (optional) |
| Theme & pages | logo, colours, fonts, buttons, corners, dark / light, header, footer, menus, announcement, 10-block page builder with live preview and drafts, settings backup file | version history + restore for theme, header, footer, announcement, WhatsApp button | text colour / container width / card style controls (optional) |
| SEO | site defaults, verification codes, built-in page overrides, sitemap, robots, 301 redirects, structured data (Product, Breadcrumb, Organization, LocalBusiness, Article, WebSite), alt text required | noindex + canonical on every product, category, collection, post and page; collection SEO fields now used; variant offers in structured data | editable robots.txt rules (optional) |
| Orders & payments | statuses with guards, timeline, PDF invoice, returns + credit notes, RTO, tracking, COD confirmation, JazzCash / EasyPaisa / bank proof check | — | card payment gateway (when you have a PayFast / Safepay account), partial shipments (optional) |
| Customers | accounts + guest records, addresses, order history, tags, notes, blocking, data export / delete | — | customer groups with prices (optional) |
| Marketing | discount codes, flash sales, abandoned carts, stock / price alerts, reviews + Q&A, feeds | — | automatic cart discounts (recommended later), gift cards, loyalty / referral, newsletter (optional) |
| Tax | prices include tax | — | tax rules (not needed for Pakistan retail) |

**Still open:**
- **404 pages are drawn in the browser.** Next.js 16 sends an empty page shell with status 404 for every `notFound()` in this app – checked with a bare layout and a one-line page, so it comes from the framework (two root layouts: store and admin), not the store code. Shoppers and Google (which runs JavaScript) see the normal 404 page; only visitors without JavaScript see a blank one. Revisit after a Next.js update.
- Checkout's form is drawn in the browser – the cart lives there; the skeleton has the right size (no layout shift).
- Your steps: an **external** uptime monitor (UptimeRobot / Better Stack), Sentry set-up (`SENTRY_DSN`), a data-retention decision, removing legacy Prisma after launch, and making CI a required check (GitHub → Settings → Branches) with Railway "wait for CI".
- Product variants (one product with size/colour options) – a new feature with new database tables; not needed for laptops (separate products + upgrade options).

---

## 1. Fix now – live site (your settings in Railway)

These are not code problems, but they are the biggest issues on the live site today.

1. **The site address is still the placeholder.** robots.txt, all 151 sitemap URLs, canonical, og:url, JSON-LD, `llms.txt` and the WhatsApp share text all point to `YOUR-APP.up.railway.app`. That host returns 404, and someone else could claim it and receive your links.
   - Set `NEXT_PUBLIC_SITE_URL` and **redeploy**.
2. **No email provider.** No order emails, no password resets, no email confirmation and no alerts go out. The new "email required at checkout" rule stays switched off until this is set.
   - Set `SMTP_*` or `RESEND_API_KEY` and `EMAIL_FROM`.
3. **Visitors and Google are served old demo content.** Some pages come back `STALE` with the seed photos, descriptions and social links, because the build ran without the database.
   - Set `DATABASE_BUILD_URL=${{Postgres.DATABASE_PUBLIC_URL}}` (and `PAYLOAD_SECRET`) on the web service and redeploy.
   - Code fix (below) so this can't happen silently.
4. **Fake reviews are still live as "Verified buyer".** They come from the old seed (for example "Sana Malik", "Bilal Khan" on the HP EliteBook) and include Google rating markup (4.7 from 3).
   - Delete them in **/cms → Reviews**.
   - Then run `npm run stats:recompute -- --apply` after a backup. That command works properly as of `ff2aaa2`.
5. **Check the social links.** Live JSON-LD lists facebook `hunzomemes` and instagram `urkoo_laptops`. Make sure these are really the store's (**Settings → Store details**).
6. **Announcement bar says "Free delivery above Rs 10,000"** while the setting is Rs 15,000. Edit the text in **Online store → Announcement**.
7. **Do NOT set `CLIENT_IP_HEADER=cf-connecting-ip` yet.** The live site isn't behind Cloudflare: it answers directly from Railway. With that header trusted, anyone could fake their IP and get past rate limits. Set it only once Cloudflare's proxy is in front and the public `*.up.railway.app` domain is removed.

---

## 2. Bugs and risks in the code

These were checked in the code. "Plausible" means the code path looks wrong but it wasn't reproduced.

### High
| # | Problem | Where | Fix |
|---|---|---|---|
| H1 | ~~Guest orders attached to an unconfirmed account, or matched by phone (privacy)~~ | `lib/cms/sales.ts` | ✅ **Fixed** in `48eccb6` |
| H2 | **Sales dashboard overstates revenue.** Refused parcels (RTO), unconfirmed and pending orders count as sales, and **POS sales are left out**. With 10–30% RTO the numbers are badly wrong. | `payload/endpoints/reports.ts:16` | Count only confirmed→delivered (and paid) orders, add POS sales, and show refused orders separately. |
| H3 | **The app runs in "demo mode" if `DATABASE_URL` is missing.** Health says `ok`, checkout keeps orders **in memory** and loses them on restart, and the uptime monitor sees nothing wrong. The same is true without `S3_*`: photos and payment screenshots go to the container disk and vanish on redeploy. | `lib/startup-checks.ts:9`, `app/api/health/route.ts:14`, `lib/storage.ts:44` | In production, refuse to start without `DATABASE_URL`/`S3_*` (unless `DEMO=true`), and have health return 503. |
| H4 | **The build silently pre-renders demo data** when the database isn't reachable, and that data is cached for a long time. | `[category]/[product]/page.tsx:45` and other `generateStaticParams`, `lib/repo/db.ts:137` | Return `[]` from `generateStaticParams` when the database is unavailable during the build. |

### Medium
| # | Problem | Where | Fix |
|---|---|---|---|
| M1 | **Owners/managers without 2-step can still open invoices, payment screenshots and private files** through the print, file and proof routes. Those routes only check "not a customer", so a stolen password alone is enough. | `cms-print/[id]`, `cms-print/labels`, `cms-print/credit-note/[id]`, `cms-file`, `cms-proof/[id]`; `collections/engagement.ts:127,136` | Use `isStaffUser(user)`. |
| M2 | **Partial return followed by "Returned"/"Cancelled" puts stock back twice.** Example: 2 mice, 1 returned → +1, then the order is set to Returned → +2. | `aftersales.ts:171-207` with `content.ts:151-153` | Subtract quantities already restocked by returns. |
| M3 | **Coupon limits can be beaten:** re-opening a cancelled order doesn't use the coupon again. | `content.ts` re-open branch | Call `consumeCoupon` on re-open (409 if none left). |
| M4 | **Refused → Delivered leaves the laptop's serial "reserved"**, so it never counts as sold (plausible). | `content.ts` re-open vs held branch | Move the units to sold when the status is delivered. |
| M5 | **Serial-tracked return with qty > 1 restocks only the first serial** (plausible). | `returns/actions.ts:68`, `aftersales.ts:194` | One return line per serial. |
| M6 | **Re-importing an old CSV resets stock** to the exported numbers, undoing sales made since. | `catalog.ts:14-29` (`guardStock` has no `stockSeen` on import) | Ignore `stock` on import updates, or apply it as a difference. |
| M7 | **Staff can change a product's price, then sell it at the counter at the new "full" price**, getting around the manager approval. Staff can also type any order total. | `catalog.ts:244` (price update = staff), `content.ts:117` | Price changes manager-only (or logged), and always recompute order totals. |
| M8 | **Product page delivery box is wrong in places:** the ETA ignores your zone times, "Cash on Delivery available" shows even above the COD limit, and the free-delivery line ignores zones (with a threshold of 0 it says "free"). The cart drawer bar has the same threshold-0 problem. | `product-detail/buy-box.tsx:58,293,297`, `cart/cart-drawer.tsx:15` | Use `deliveryEstimate(city, settings)`, `freeDeliveryAbove`, `paymentEnabled`/COD max. |
| M9 | **Search ignores relevance.** Searching "laptop" shows a charger and RAM first. There's no typo tolerance ("elitbook", "macbok" → 0 results), no synonyms ("notebook", "8gb ram"), and no Urdu. | `lib/repo/catalog.ts:232-299` | Relevance sort first; then Postgres `pg_trgm` or Meilisearch. |
| M10 | **Background jobs would run twice with 2 instances** (or during deploy overlap): duplicate WhatsApp/email reminders. Rate limits and caches are per process. Not a problem while there's one instance. | `instrumentation.ts`, `lib/housekeeping.ts`, `lib/engagement-jobs.ts` | Postgres advisory lock around housekeeping; claim rows before sending. |

### Low
- **Accessibility:** the cart drawer, search dialog and mobile menu don't move or trap focus. The "Share on WhatsApp" label doesn't match its visible text.
- **Shop counter (POS):**
  - Voiding a counter sale that already had a return restocks twice.
  - Cash refunds from returns aren't in the cash-up.
  - A void after cash-up changes a closed day.
- **Returned serials** go straight back to "in stock" without checking they belong to that order. A faulty laptop should go to "returned"/"repair".
- **Accounts:**
  - Staff can change a customer's email and then trigger a password reset. There is no activity log to catch it.
  - The first account ever created becomes Owner even when it comes from the storefront sign-up.
  - Sign-up reveals that an email has ordered before ("You've ordered with us before"). That's an accepted trade-off.
- **SEO and sharing:**
  - Product share images (`og:image`) are SVG, which WhatsApp and Facebook don't show.
  - Product titles are about 100 characters (Google shows ~60).
  - The home title starts with "Home |".
  - The 404 page is an empty shell until JavaScript loads.
- **Hard-coded text:**
  - Product-page trust and warranty text ("3-day replacement", couriers, payment names) doesn't follow your settings.
  - The Karachi page promises store pickup, which checkout doesn't offer.
- **Analytics:** no `search`, `view_item_list` or wishlist events; quick-add doesn't send `add_to_cart`.
- **PWA:** the 192/512 PNG icons aren't in the manifest and there is no service worker (the app isn't installable offline).
- **Email at checkout:** now required for every order (your choice). Many COD buyers in Pakistan have no email in mind, so watch checkout drop-off once email is switched on.

---

## 3. Speed (mobile, measured live)

| Page | LCP | Main-thread blocking | JS | Prior review |
|---|---|---|---|---|
| Home | 3.8 s | ~3 s | 235 KiB | LCP 4.4 s |
| Category | 4.7 s | ~1.8 s | 270 KiB | 5.5 s |
| Product | 4.8 s | ~2.6 s | 258 KiB | 5.0 s |
| Checkout | 6.5 s | ~1.3 s | 251 KiB | 4.4 s |

Accessibility, Best Practices and SEO scores are 100 on every page. The biggest wins:
1. **About 1 s on every first visit:** Payload adds `Critical-CH` client-hint headers to *every* page, so Chrome requests each page twice. Limit Payload's header rule to `/cms` and `/cms-api` in `next.config.ts`.
2. **The animation library (framer-motion, 44 KB) loads on every page** and blocks the main thread. Switch to `LazyMotion`/CSS in the navbar, cart drawer, toaster, WhatsApp button, hero slider and gallery, and pause hero autoplay until the page is idle.
3. **The main image loads at low priority:** move `fetchPriority="high"` from the logo (which is also lazy-loaded) to the first hero and gallery image.
4. **Checkout appears only after JavaScript runs:** render the static parts on the server, and give the skeleton the right height (CLS 0.041).
5. Turn off prefetch for the `/cart` and `/account` links (13–21 background requests per page).

---

## 4. Operations

- **No CI.** Every push to `master` deploys and runs database migrations on the **live** database during the build, with no lint/type/test gate and no automatic backup first. Add GitHub Actions (lint, typecheck, unit tests, build, a migration check that refuses DROP/RENAME), make it required, and turn on Railway "wait for CI".
- **Backups:**
  - Only `media/` photos are copied; payment screenshots, return/warranty/trade-in photos (`payments/`, `returns/`, `warranty/`, `tradein/`, `reviews/`) are not.
  - Dumps aren't encrypted.
  - Alerts come only on failure, not when the backup job stops running.
  - The photo copy uses container disk, which will fail as the bucket grows.
  - Fix: sync bucket-to-bucket, include all prefixes, encrypt, and add a success heartbeat (dead-man's switch).
- **Monitoring:** the uptime monitor runs on Railway itself (a Railway outage means no alert) and ignores health warnings. Sentry isn't verified, has no source maps and some errors only go to `console.error`. Add an external monitor (UptimeRobot/Better Stack, free) and set up Sentry properly.
- **Data retention:** orders, messages and enquiries are kept forever, and the old Prisma tables are never cleaned, nor covered by the privacy erase. Decide a retention policy.
- **Legacy Prisma** can no longer run in production but still ships in the image: 3 of the audit "highs", openssl, and the `db:migrate`/`db:deploy` scripts, which are dangerous against production. Plan its removal after launch (archive the old tables first – your decision).
- **Dependencies:** next, payload, react and prisma are on their latest versions. 20 audit advisories remain, all inside Payload/Prisma tooling. **Don't run `npm audit fix --force`**: it would downgrade Payload. Pin Node (`engines` / `.nvmrc`: production uses 22, this PC has 25) and pin the uptime image's nodemailer version. Add Renovate/Dependabot.
- **Not documented in `.env.example`:** `DB_POOL_MAX`, `PAYLOAD_CSRF_ORIGINS`, `NEXT_PUBLIC_BING_SITE_VERIFICATION`, and the uptime variables (`SITE_URL`, `ALERT_PHONES`, `CHECK_SECONDS`, …).
- **Out of date in CODE-REVIEW.md:** "CSV import" and "Scheduled publishing" are listed as half-built, but both now work (H3 fixed).

---

## 5. Compared with the big stores – what you have and what's missing

**Already as good as or better than Daraz/PriceOye for a laptop shop:**
- Spec filters with counts
- Parts compatibility finder
- Condition grades with battery notes
- RAM/SSD upgrade configurator
- Compare
- Trade-in
- Reviews with photos, Q&A
- Stock and price-drop alerts
- Bought-together bundles
- Flash deals
- Wholesale quotes
- City landing pages
- Serial-number tracking
- POS with cash-up
- Returns/warranty with credit notes
- Fake-order protection (risk score, blocked numbers, advance for risky COD)
- Product feeds for Google/Meta/TikTok
- 2-step admin login

**Missing, ranked by value for your business** (effort S = days, M = 1–2 weeks, L = more):

| # | Feature | Why it matters | Effort |
|---|---|---|---|
| 1 | **Courier integration** (PostEx/Leopards/TCS): book from the order, print airway bills, auto-sync tracking to the order status and the customer's WhatsApp | The biggest daily time-saver; customers stop asking "where is my order" | L |
| 2 | **COD reconciliation:** import the courier payment sheet, match it to delivered orders, flag missing money | COD money leaks are common; nothing checks this today | M |
| 3 | **Phone OTP / WhatsApp verification** for COD orders (and phone login) | Cuts fake orders and refused parcels (RTO) – the main COD cost in Pakistan | M |
| 4 | **Real reports:** profit, sales by product/category/brand/city, POS included, CSV export (and fix H2) | You can't currently trust the dashboard numbers | M |
| 5 | **Better search:** relevance, typo tolerance, synonyms, logging of searches with no results | Search is where laptop buyers start | M |
| 6 | **Stock movement history + staff activity log** (who changed price/stock/order and when) | Control over staff and stock mistakes; needed for audits | M |
| 7 | **Automatic online payments:** JazzCash/EasyPaisa merchant APIs, card gateway | Ends screenshot checking; more prepaid orders, so less RTO | L |
| 8 | **Customer order page:** order details, invoice/warranty-card PDF, "buy again" (no phone re-entry when signed in) | Expected by customers; fewer support messages | S–M |
| 9 | **Proper manual/WhatsApp order form** (product picker, auto order number) and **bulk order actions** (print many slips, mark many shipped) | Faster daily order handling | S–M |
| 10 | **Live EMI / BNPL** ("Rs X/month" on product cards); the EMI block already exists but is off | Big conversion driver for laptops | M |
| 11 | **Variants:** the same model with different RAM/SSD/grade on one page | Cleaner catalogue, better SEO | M |
| 12 | **"Help me choose a laptop" finder** (budget, use, weight) | Converts undecided students and office buyers | S |
| 13 | **Marketing:** newsletter/WhatsApp opt-in, exit-intent coupon, automatic discounts (free delivery, BOGO, product/category scope), referral and loyalty/store credit (trade-in credit at checkout) | Repeat sales | M |
| 14 | **POS returns/exchanges** linked to the sale, with cash refunds in the cash-up | Counter accuracy | M |
| 15 | **Customer value and segments** (orders, spend, refused rate) plus broadcast to a segment | Retention marketing | M |

Not needed for you: multi-currency or multi-store. Tax/FBR integration only if the shop becomes a Tier-1 retailer (check with your accountant).

---

## 6. Suggested order of work

1. **Today (you, ~30 min):** push `48eccb6`, then section 1 (site address, email, `DATABASE_BUILD_URL`, delete the seed reviews, social links, announcement text). Back up before deploying: `ff2aaa2` (already on GitHub) adds the `guest_customers` migration (one new column).
2. **Week 1 (code, small):**
   - Fix H2 (reports), H3/H4 (fail-safe without database/S3, no demo pre-render) and M1 (2-step on print routes).
   - Fix M2–M3 (stock/coupon), M6 (CSV stock) and M8 (product delivery box).
   - The ~1 s speed fix and image priority.
   - Add CI.
3. **Week 2:** search relevance, backups of all private files plus a heartbeat, an external uptime monitor and Sentry, focus traps, OG images.
4. **Next features:** courier integration → COD reconciliation → phone OTP → reports → stock/activity log → automatic payments.
