# Code review – Urko Tech Store (7 October 2026)

**Scope:** every collection, global, hook, access rule, endpoint, route handler, server action and the full checkout → order → delivery and product → storefront code, read line by line. Plus: build, type-check, all test suites, a stock race test, a load test, real concurrent checkouts, API attacks as public / customer / staff on a local production build, Lighthouse, `npm audit`, and read-only checks of the live site.
**No code was changed during the review.** (The fixes came afterwards – see *Fix status* below.) Test data created locally for the experiments was deleted afterwards (stock and counts restored).

Line numbers refer to commit `85acf92` (what is live now).

---

## Fix status – 7 October 2026 (after the fixes)

**Verdict now: ✅ ready for a soft launch once you have done the Railway steps below** (real site address, email, `PAYLOAD_SECRET` for the build, a backup before deploying). The code issues that lose money, break security or break operations are fixed and tested; what remains is listed under *Still open*.

Fixed in four commits on `master`: `e73062e` (money and stock), `3be8f8c` (security), plus the operations/quality commits after them. Three new database migrations, all additive: `20261006_213603_order_safety`, `20261006_220216_security_hardening`, `20261006_230758_session_revocation`.

| Group | Status |
|---|---|
| 🔴 Critical CR1–CR6, CR8, CR9 | ✅ Fixed. CR9: stars, "sold" numbers and Google ratings now come only from real approved reviews and orders; the **stored** demo numbers are corrected by `npm run stats:recompute -- --apply` (your decision – see MAINTENANCE.md). |
| 🔴 CR7 (site address) | ⚠️ **You:** set `NEXT_PUBLIC_SITE_URL` in Railway and redeploy. The site now warns about it in `/api/health` and on the `/cms` Home screen. |
| 🟠 High H1–H18 | ✅ Fixed. H18: `nodemailer` 10, `undici` 7.30, `next` 16.4.0 – see *Still open* for the remaining advisories. |
| 🟡 Medium M1–M30, M32–M40 | ✅ Fixed. M40 needs your Sentry DSN (now a build argument). |
| 🟡 M31 (legacy Prisma code) | Partly: the Docker start no longer runs Prisma migrations. The demo-mode / data-migration code stays until after launch (deferred by you – it touches the old tables). |
| 🟢 Low 1–23, 25, 26 | ✅ Fixed (12: password resets and sign-ins are rate-limited; see *Still open*). |

### Re-run of the checks (local production build, 7 Oct 2026)

| Check | Result |
|---|---|
| `tsc --noEmit` / `npm run lint` (ESLint, 0 warnings) / production build | ✅ clean – no build warnings |
| Unit tests (`npm test`, new) | ✅ 23/23 – money to collect, payment gate, delivery fees, free delivery, COD fee, payment methods, coupons, redirects, HTML cleaning, order cookie, email link, visitor IP, Turnstile, roles and 2-step |
| Smoke / security sweep / crawl | ✅ 38/38 / passed / 155 pages, 0 broken |
| Old-URL check (`npm run test:urls`, fixed) | ✅ 168/168 identical |
| Stock race | ✅ 10 buyers, 2 in stock → exactly 2 sold |
| Checkout in a browser: normal order / **double submit** / blocked customer | ✅ order placed / **one** order for two identical requests / refused with a message |
| Admin API tests (18) | ✅ payment gate, advance approve/reject, stock on create/edit/cancel/re-open/delete, stale screen refused (409), timeline merge, stale stock edit refused, was-price check, POS price approval, 6-digit receipts, double void restocks once |
| Security API tests (20) | ✅ staff/manager can't touch the Owner, role rules, owner without 2-step sees nothing, 2-step lockout after 5 codes (423), drafts/folders/locks/exports refused, public API hides stock, sign-in rate limit, CSP present |
| New routes | ✅ `/products/<slug>` → 301 to the product; unknown category/brand → 404; feed photos served as JPEG; city pages show zone fees |

### Still open (and why)

1. **`npm audit --omit=dev`: 20 advisories (13 high, 7 moderate), down from 33.** All are inside Payload's and Prisma's own dependencies (`braces`/`micromatch` via Payload's storage plugin and `sass`; `csv-parse` in the import plugin – staff-only; `deepmerge-ts` in Prisma's CLI config; `esbuild` in the Payload dev tooling). npm's only offer is a *downgrade* (e.g. `@payloadcms/richtext-lexical@0.11.4`). Update Payload when it ships patched versions.
2. **Wrong passwords lock an account for 15 minutes after 10 tries** (Payload's own lockout). Someone who knows the Owner's email can keep them locked out; sign-in is rate-limited per IP and a password reset by email unlocks it straight away. Trade-off kept on purpose.
3. **Sign-up reveals whether an email already has an account** ("An account with this email already exists."). Common for shops; changing it means email-first sign-up.
4. **Type casts** (`as never` / `as unknown as`, Low 24) remain – switching to Payload's generated types everywhere is a larger refactor with no user-visible change.
5. **Lighthouse performance** (mobile 60–79) was not part of this fix round.
6. **Not provable from here:** that the Railway backup service runs (check it – BACKUP-RESTORE.md §1) and that Sentry receives errors (needs your DSN).
7. **Missing / half-built features** listed below are unchanged (reports, courier API, tax, trash/restore, automatic discounts, stock history…). Installments: the page now switches its wording when plans are on.

### What you must do (Railway)

1. Web service variables: `NEXT_PUBLIC_SITE_URL` (real address), email (`SMTP_*` or `RESEND_API_KEY`, `EMAIL_FROM`), check `PAYLOAD_SECRET`, `AUTH_SECRET`, `DATABASE_BUILD_URL=${{Postgres.DATABASE_PUBLIC_URL}}`. If Cloudflare's orange cloud is on: `CLIENT_IP_HEADER=cf-connecting-ip`.
2. **Before deploying: take a backup** – this release contains 3 new migrations (applied automatically during the build).
3. Backup service: `PG_MAJOR` (your Postgres version), ideally a separate bucket (`BACKUP_S3_*`), and `ALERT_EMAILS` or `ALERT_WEBHOOK_URL`.
4. WhatsApp: get the **confirm** template approved (`WHATSAPP_TEMPLATE_CONFIRM`) if customers must confirm COD orders.
5. After the deploy: `/api/health` shows no `warnings`; then decide on `npm run stats:recompute -- --apply` (MAINTENANCE.md).

---

## Verdict at the time of the review: ❌ NOT READY for production

The foundations are good: prices are always re-calculated on the server, stock can't go negative even with 200 buyers at once, old URLs all work, the admin covers almost everything planned. But there are problems that **lose money** (fake payment screenshots reduce what the rider collects; unpaid online orders can be shipped; double-clicks create duplicate orders; the same laptop can be sold twice), **break security** (a staff account can take over the owner's account – proven), and **break basic operations** (the live site's address is still a placeholder; CSV import and scheduled publishing never run; COD confirmations may never reach customers). These need fixing first – see the fix plan at the end.

### Issues by priority

| Priority | Count |
|---|---|
| 🔴 Critical | 9 |
| 🟠 High | 18 |
| 🟡 Medium | 40 |
| 🟢 Low | 26 |

---

## What was run (proof)

| Check | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | ✅ 0 errors |
| Production build | ✅ passes. Only warning: `metadataBase` not set for some OG images (uses localhost:3000 at build). No lint config exists. |
| Smoke test (38 checks) | ✅ 38/38 |
| Security sweep (anonymous) | ✅ passed |
| Crawl (165 pages, 186 links, 88 images) | ✅ no broken pages/links/images |
| Old-URL check (168 URLs) | ✅ 168/168 identical – but `npm run test:urls` is broken (missing baseline argument in `package.json`) |
| Stock race: 200 buyers, 20 in stock | ✅ exactly 20 sold, stock 0, in 288 ms |
| **Real concurrent checkouts:** 12 customers, 1 unit left | ✅ exactly 1 order, 11 told "sold out" |
| **Double-clicked checkout** (same request twice) | ❌ **2 orders created** (UTS-261007-363610 and -395479) |
| **Rate limit** (5 orders / 10 min per IP) | ❌ bypassed – 12+ orders from one machine by changing the `X-Forwarded-For` header |
| Load test: 50 shoppers, 60 s | ✅ 3,132 requests, 0 errors, 51 req/s, worst p95 1.07 s (category) |
| Lighthouse mobile – Home | Perf 66 · A11y 100 · Best 100 · SEO 100 · LCP 4.4 s · TBT 690 ms |
| Lighthouse mobile – Category | Perf 64 · 100 · 100 · 100 · LCP 5.5 s · TBT 560 ms |
| Lighthouse mobile – Product | Perf 60 · 100 · 100 · 100 · LCP 5.0 s · TBT 800 ms |
| Lighthouse mobile – Checkout | Perf 79 · 100 · 100 · SEO 66 (noindex – expected) · LCP 4.4 s |
| Storefront JavaScript per page | 245–283 KiB (17–21 files), ~50–63 KiB unused |
| Payload migrations | ✅ 22/22 listed in order; `push: false`; `prodMigrations` on; no schema drift |
| `npm audit --omit=dev` | ❌ 33 (16 high, 15 moderate, 2 low) |
| Secrets in code / Git history (56 commits) | ✅ none (only the local test DB on 127.0.0.1) |
| Live `/api/health` | ✅ `{"ok":true,"db":"up","cms":"up"}` |
| Live security headers | ✅ HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy · ❌ no CSP |
| Live GraphQL | ✅ 404 (disabled) |
| Live browser bundle | ✅ no secrets · ❌ no Sentry (browser error monitoring not active) |
| Live site address | ❌ robots.txt / sitemap / canonicals still `YOUR-APP.up.railway.app` |
| Backups actually running | ⚠️ **cannot be proven from here** – no access to Railway or the bucket. You must check (see BACKUP-RESTORE.md §1). |
| Server error monitoring (Sentry) | ⚠️ cannot be proven; not in the browser bundle (`NEXT_PUBLIC_SENTRY_DSN` isn't a Docker build argument). |
| Unit tests for money / access | ❌ none – only end-to-end scripts (smoke, sweep, stock race). |

---

## 🔴 Critical

### CR1. A staff account can take over the Owner's account — **proven**
- **Where:** `src/payload/collections/Users.ts:40` (`update: staffOrSelf` – email and password have no field rules); `src/payload/endpoints/two-factor.ts:46-49` and `src/payload/admin/AdminProviders.tsx:25-41` (2-step for Owner/Manager is only a pop-up).
- **What's wrong / how:** A staff member sends `PATCH /cms-api/users/<ownerId>` with a new email or password. Test: the owner's email changed (HTTP 200). If the Owner hasn't turned on 2-step, the staff member then logs in as Owner via `/cms-api/users/login` (the pop-up is skipped). Even with 2-step, they lock the Owner out. Managers can do the same.
- **Fix:** Replace `update: staffOrSelf` with an access function returning a `Where`: owner → `true`; manager → `{or:[{id:{equals:me}},{role:{in:["staff","customer"]}}]}`; staff → `{or:[{id:{equals:me}},{role:{equals:"customer"}}]}`; customer → self. In `requireTwoFactor`, throw for owner/manager when `!twoFactor.enabled` (keep the storefront exception) so the server enforces it. Require current password or a 2-step code to change your own email/password. Also `delete`: only Owner may delete an Owner.

### CR2. Fake or rejected advance payment still reduces what the rider collects — verified
- **Where:** `src/payload/admin/orders/OrderPanel.tsx:95` and `:333` (Reject only sets `paymentStatus:"unpaid"`); `src/app/(payload)/cms-print/[id]/route.ts:41,60`; customer copy `src/lib/notify.ts:136,234`; order-confirmation page.
- **How:** COD order Rs 150,000, customer uploads any picture as a Rs 5,000 advance → `advancePaid` is saved immediately (`checkout/actions.ts:209`) and confirmation is skipped (`protection.ts:137`). Staff reject it – the slip still says "Collect Rs 145,000" and the customer was told the same.
- **Fix:** One helper used everywhere: `credited = paymentStatus === "partial" ? advancePaid : 0; toCollect = method === "cod" && paymentStatus !== "paid" ? max(0, total - credited) : 0`. Reject also sends `advancePaid: null`. Don't skip confirmation for an *unverified* advance.

### CR3. Online-payment orders can be shipped unpaid; slip says "collect nothing" — verified
- **Where:** `src/payload/admin/orders/status.ts:34-40`, `OrderPanel.tsx:137-143,311`, `cms-print/[id]/route.ts:41,82`.
- **How:** Customer chooses JazzCash, uploads any image. Staff click "Confirm order" → "Mark as shipped". The packing slip prints "Paid – collect nothing"; the rider collects Rs 0.
- **Fix:** In a `beforeChange` on Orders: refuse `confirmed/dispatched/out-for-delivery/delivered` for JazzCash/EasyPaisa/bank unless `paymentStatus === "paid"` (manager override flag allowed). Disable the panel buttons in that state. Print "PAYMENT NOT VERIFIED – DO NOT SHIP" otherwise.

### CR4. Double-click / retry creates duplicate orders — **proven**
- **Where:** `src/app/(frontend)/(store)/checkout/actions.ts:96-348` (no idempotency); `src/components/checkout/checkout-form.tsx:211-229`.
- **How:** Two identical submissions → two orders, stock taken twice (test above). Happens on a slow mobile network when the customer taps again, or when the response is lost.
- **Fix:** Client: `attemptId = useRef(crypto.randomUUID())`, sent with the form; guard with a `submitting` ref. Server: new Orders field `attemptId` (`unique: true, index: true`) – needs a migration; at the start of `placeOrder`, return the existing order if one has that `attemptId`; treat a unique-violation on insert as "already placed" (release stock, return the existing order).

### CR5. The same serial-tracked laptop can be sold twice (website + shop counter) — verified in code
- **Where:** checkout only decrements `products.stock` (`src/lib/cms/catalog-source.ts:195-207`, `src/payload/stock.ts:22-30`); units are reserved later in the order's `afterChange` (`src/payload/collections/content.ts:123-134`); POS `sellUnit` only checks the unit (`stock.ts:113-121`); a shortfall is only logged (`content.ts:131`).
- **How:** One unit left. Website checkout takes stock (0). Before the order hook runs, the shop counter scans that serial and sells it. The online order is saved with **no unit** and is later shipped "with" a laptop that's gone.
- **Fix:** For tracked products reserve **units** at checkout (`UPDATE units SET status='reserved' … FOR UPDATE SKIP LOCKED RETURNING`, require `rows = qty`) inside the same transaction as the order (see H1); make `orderUnits` throw (409) instead of logging.

### CR6. A category set as its own parent (or A→B→A) freezes the whole server — verified in code
- **Where:** `src/payload/collections/catalog.ts:90` (no validation on `parent`); endless loops in `src/lib/repo/catalog.ts:51` (`while (top?.parentId …)`) and `:123` (`getCategoryLineage` – also grows an array forever).
- **How:** A manager picks the category itself as its parent and saves. Every storefront request runs the loop → Node's event loop blocks → shop **and** /cms stop responding; you can't even undo it from the admin.
- **Fix:** `validate` on `parent` walking ancestors (reject own id / any cycle, max depth 10) + `filterOptions` excluding itself; add a hop limit (`i < 20`) to both loops.

### CR7. The live site's address is still the placeholder — verified on live
- **Where:** Railway variable `NEXT_PUBLIC_SITE_URL` (baked into the build). Live `/robots.txt`: `Host: https://YOUR-APP.up.railway.app`; sitemap and canonicals the same.
- **How:** Google indexes the wrong domain; every link in emails / WhatsApp (order confirm, password reset, email confirmation, tracking) points to a non-existent site.
- **Fix:** Set `NEXT_PUBLIC_SITE_URL` to the real address in Railway and redeploy. Add a startup check that refuses to boot in production when it contains `YOUR-APP`.

### CR8. COD confirmation request may never reach the customer → real orders auto-cancelled — verified in code
- **Where:** `src/lib/notify.ts:245-266`; defaults `src/lib/protection.ts:31-35` (every COD order must be confirmed, cancel after 24 h).
- **How:** (a) With `WHATSAPP_TEMPLATE_ORDER` set, the template parameters are `[name, number, total]` – the link/code is dropped. (b) Without a template, a free-text WhatsApp to a new customer is rejected by Meta. (c) If order-received messages are on but WhatsApp/SMS are off and no email, nothing asks them to confirm. After 24 h the order is cancelled and stock returned.
- **Fix:** For orders awaiting confirmation, always send `WHATSAPP_TEMPLATE_CONFIRM` (name, number, link) and SMS/email; if no channel can reach the customer, don't require confirmation for that order (and show a warning in /cms). *Until fixed: turn off "Customers must confirm…" in Settings → Fake order protection.*

### CR9. Made-up reviews, ratings, "sold" numbers and testimonials on the live site — verified on live (still present)
- **Where:** `src/lib/repo/catalog.ts:393-414` (falls back to demo testimonials/FAQs), `src/lib/data/seed/*` (ratings 4.7, soldCount 142/560…, migrated into products), `src/components/product/product-card.tsx:130` (stars with 0 reviews), `src/lib/seo.ts:202-208` (AggregateRating for Google), `about/page.tsx:36`, `src/lib/content/home.ts:109` ("4.8★").
- **Why:** misleading customers (consumer-law risk) and Google can penalise fake review markup.
- **Fix:** never fall back to demo content in production; show stars / AggregateRating only from approved reviews; reset `rating`, `reviewCount`, `soldCount` from real data (one-off script – touches data, needs your OK); remove the "4.8★" text; replace testimonials in **Online store → Testimonials**.

---

## 🟠 High

| # | What's wrong | Where (file:line) | How it happens | Exact fix |
|---|---|---|---|---|
| H1 | Taking stock and saving the order are **not one transaction** | `checkout/actions.ts:251-274`; `catalog-source.ts:195-207`; `stock.ts:13-17` | A crash/redeploy between taking stock and saving the order (or a failed `release()`, only logged) leaks stock permanently | Create a local req, `initTransaction(req)`, run `takeStockForLines(…, req)` + `payload.create({…, req})`, then `commitTransaction`/`killTransaction`; drop the separate release |
| H2 | **Saving a product in /cms can write back old stock** → overselling | `collections/catalog.ts:185` (stock editable), `:10-17` | Staff open a product (stock 3); 1 sells (2); staff fix a typo and save → stock 3 again. Re-importing an old CSV does the same | Make `stock` read-only on update for untracked products; add an "Adjust stock (+/−)" field applied as `stock = stock + delta` in SQL; purchases & stock counts remain the other ways in |
| H3 | **CSV import and scheduled publishing never run** | `payload.config.ts:129-144` (plugin queues jobs; no `disableJobsQueue`), `Pages.ts:62`, `content.ts:19` (schedulePublish); no `jobs.autoRun` anywhere | Imports stay "pending"; scheduled pages/posts never publish | `importExportPlugin({ import:{ disableJobsQueue:true }, export:{ disableJobsQueue:true } })`; add `jobs: { autoRun: [{ cron: "* * * * *", queue: "default" }] }` or call `payload.jobs.run()` from `/api/cron` |
| H4 | **Build pre-renders pages from the old Prisma tables or demo data** | `src/lib/db/config.ts:5`; `Dockerfile:44-56` (no `PAYLOAD_SECRET` at build; runs `prisma migrate deploy`) | After every deploy, product/category/home pages, sitemap and feeds show old prices or demo data until revalidated (5–60 min) | Pass `PAYLOAD_SECRET` as build arg (or make `generateStaticParams` return `[]` and render feeds/sitemap on demand); remove Prisma migrate from the build; in production throw if `DATABASE_URL` is set but `PAYLOAD_SECRET` isn't (today orders would silently go to legacy tables – `repo/orders.ts:43`) |
| H5 | **Stored XSS** – staff-written text runs as script on the site (same origin as /cms) — **proven** (`marked` passes `<img onerror>` and `javascript:` links) | `components/ui/markdown.tsx:8`, `lib/blog.ts:31`, `components/blocks/rich-text-sections.tsx:19`; no CSP (`next.config.ts:74-80`) | A staff (or hacked) account puts a script in a product description / page text; when the Owner views the page it calls `/cms-api` as the Owner (e.g. makes the staff user Owner) | Sanitize after `marked` (DOMPurify / sanitize-html, allow-list tags, strip `on*` and `javascript:`); add a CSP with nonces |
| H6 | **2-step code brute force; all rate limits bypassable** — **proven** for checkout | `endpoints/two-factor.ts:59-69,158`; `lib/rate-limit.ts:12` (first `X-Forwarded-For`, in-memory) | Attacker with a stolen password tries codes from "many IPs"; bots bypass checkout/login/coupon/track limits | Use `cf-connecting-ip` (Cloudflare) or the right-most proxy hop; count wrong 2-step codes per user in the DB (lock 15 min after 5); limits per subject (phone, order, email) |
| H7 | **Customers can read their own order's confirmation code, internal notes, risk reasons** — **proven** | `collections/content.ts:187` (read own), fields `:256-294` | Faker signs in, places COD order with any phone, reads `confirmation.code` via `/cms-api/orders`, confirms it himself → fake-order protection bypassed | Orders `read: staff` (storefront uses `overrideAccess`) or `access.read: staffField` on `confirmation`, `risk`, `notes`, `history`, `paymentScreenshotKey`, `stockHeld` |
| H8 | Returns can put stock back **twice** | `collections/aftersales.ts:151-163` vs `content.ts:87-92` | Staff set the order to Returned (stock back) and later finish the return with "put back in stock" ticked | In `returnResolution` skip restock when `order.stockHeld === false`; set `restocked = true` |
| H9 | **Deleting an order leaks stock and reserved units** | `content.ts:187-188` (no delete hook) | Manager deletes an open order → its stock never comes back; units stay "reserved" forever | `beforeDelete` releasing stock/units, or `delete: () => false` (use Cancel) |
| H10 | **Editing order items doesn't change stock or totals** | `content.ts:83`, totals free numbers `:233-237` | Qty 2→1 on an open order: stock not returned, total unchanged; cancel+edit in one save returns the wrong qty | Diff `originalDoc.items` vs new and take/return the difference; release using `originalDoc.items`; recompute subtotal/total server-side, or lock items after creation |
| H11 | Confirm vs auto-cancel race; stale admin panel re-opens cancelled orders | `lib/cms/confirm.ts:29-46` vs `:72-90`; `OrderPanel.tsx:142,147`; `content.ts:93-97` | Customer confirms as the cron cancels → cancelled + "cancelled" message; staff on a stale screen click Confirm on a cancelled order → silently re-opened and stock re-taken | Pass `context.expectStatus` and refuse (409) if the stored status differs; never send `history` from callers (append server-side) |
| H12 | Track-order shows **internal staff notes** | `track-order/actions.ts:71`; `components/checkout/track-order-form.tsx:190` | Anyone with order number + phone sees "Payment rejected: fake screenshot", team notes | Return only `{status, at}` per history entry |
| H13 | "Find my orders" loads the **entire orders table** | `lib/repo/orders.ts:124-133` (`limit: 0`, `depth: 1`) | Slow and memory-heavy once there are thousands of orders; called by anyone | Query `customer.phone` directly (indexed) with `depth: 0`, `limit` and `select` |
| H14 | Demo content shown until each setting is saved (testimonials, FAQs "card coming soon", old announcement, bank `0000…`) | `lib/repo/catalog.ts:393-414`; `globals/commerce.ts:96-104` (bank on by default, no required details) | Customers see fake text or empty account numbers | Empty fallbacks in production; require details when a method is enabled; hide methods with empty details |
| H15 | Turning on Turnstile **breaks checkout and every form** | `Dockerfile:31-41` (no `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_SENTRY_DSN` build args); `components/ui/turnstile.tsx:22`; `lib/turnstile.ts:11` | Server demands the check; browser never shows it | Add the build args; server skips the check when the site key is missing |
| H16 | Delivery prices on city pages / shipping text use old fixed prices | `[category]/page.tsx:78`, `lib/content/page-defaults.ts:32,46-48`, `lib/city-content.ts:59` | Page says Lahore Rs 300, checkout charges the zone fee | Use `deliveryCharge` / `shippingZoneFor` with live settings everywhere |
| H17 | Coupon silently dropped; price changes silently accepted | `checkout/actions.ts:139-145`; `checkout-form.tsx:225` | Coupon expires between cart and click → order placed at a higher total without telling the customer | If a sent coupon is invalid, return an error; send `expectedTotal` and stop when it differs |
| H18 | Dependencies with known vulnerabilities | `package.json` – `nodemailer` 8 (fixed ≥10.0.6), `undici` <7.29.1 inside Payload, `next` 16.3.8 (16.4.0 out) | Email address parsing DoS / recipient bypass; HTTP client issues | npm `overrides`: `"nodemailer": "^10.0.6"` (next-auth's peer limit), `"undici": "^7.29.1"`; update `next` to 16.4.0 and Payload when patched; re-run `npm audit` |

## 🟡 Medium

| # | What's wrong | Where | Fix |
|---|---|---|---|
| M1 | Coupon usage limit can be exceeded (race); usage not given back on cancel; % not capped at 100 | `lib/coupons.ts:26-27`, `lib/cms/sales.ts:286-290` | Atomic `UPDATE … SET used = used+1 WHERE … used < usage_limit RETURNING` inside the order transaction; decrement on cancel; `max: 100` |
| M2 | Free delivery: threshold 0 = free for everyone when no zones; cart bar ignores zones | `lib/cities.ts:98`; `cart-view.tsx:57,88,204`; `free-delivery-bar.tsx:7-18` | `threshold > 0 && subtotal >= threshold`; bar uses `freeDeliveryAbove(city)` |
| M3 | Customer not told on cancel although the panel says so | `notify.ts:227-236,279`; `OrderPanel.tsx:146` | Add `cancelled`/`refused` messages or fix the panel text |
| M4 | "Advance-only" numbers / risky customers place normal COD when Advance amount = 0 | `checkout/actions.ts:165` | Evaluate `advanceReason` always; if needed and amount 0, require an online method |
| M5 | Checkout rate limit counts failed attempts, per IP (shared mobile IPs) | `checkout/actions.ts:128` | Count successful orders; key by phone too |
| M6 | Cache refresh fires **before** the DB commit → stale stock cached up to 5 min | `content.ts:103-104`; `shop.ts:40-41`; `inventory.ts:80`; `revalidate.ts:22-29` | Revalidate in `afterOperation` / after the update returns |
| M7 | POS: any staff can sell at any price (Rs 0); double void restocks twice; no transaction | `endpoints/pos.ts:80-98,110-200` | Manager approval below list price / over X% discount; void via `UPDATE … WHERE status='completed' RETURNING`; wrap in a transaction |
| M8 | Panel notes / Approve / Reject overwrite history with a stale copy | `OrderPanel.tsx:152,333`; `confirm.ts:44,63,89` | Server-side "append note" endpoint |
| M9 | Quantity rules differ: cart allows 99, checkout max 20 → raw "Too big" error | `store/cart.ts:77`; `cart/actions.ts:12`; `checkout/actions.ts:59,121` | One shared `MAX_QTY`, clamp in cart, friendly message |
| M10 | Partial return marks the whole order Returned (revenue dropped from reports) | `aftersales.ts:166-171` | Only when all lines/qty returned |
| M11 | Whole catalogue cached as one entry; > 2 MB is silently not cached (a few hundred products) | `lib/repo/catalog.ts:77-85` | Slim list cache + per-product cache; `select` fields |
| M12 | Every product page cache-miss loads **all** approved reviews (depth 1) | `catalog-source.ts:158-174` | Query by product, `depth: 0`, `limit: 50` |
| M13 | Deleting a category/brand orphans its products (URLs break, saves fail) | FK `ON DELETE set null` (initial migration) | `beforeDelete` refusing while products reference it |
| M14 | Changing/deleting a photo doesn't refresh the site; photos in use can be deleted | `collections/Media.ts:23-40` | Revalidate on media change; block delete when in use |
| M15 | Top-level category slugs can clash with routes (`media`, `cms`, `api`, `feeds`, `account`…) | `payload/fields.ts:162` | Reserved-slug validation |
| M16 | Header/menus not refreshed after product/category rename | `lib/cms/chrome.ts:42-56,165-177` | Also revalidate the chrome tag on catalog changes |
| M17 | Feed settings fall back to defaults on any error → disabled feeds re-enabled for 10 min | `lib/feeds.ts:37-39` | Re-throw so the last good value is used |
| M18 | Receiving a purchase lowers "sold" count; stock-count apply overwrites sales in between; parallel scans overwrite each other | `collections/inventory.ts:75`; `endpoints/inventory.ts:69-113,147-155` | `addStock` that doesn't touch sold count; apply as `stock = stock + delta`; row lock for scans |
| M19 | An order line can be saved without its product link → cancelling never restocks it | `lib/cms/sales.ts:83` | Throw instead of `.catch(() => null)` |
| M20 | Back-in-stock / cart reminder jobs can starve (same records fill the batch forever) | `lib/engagement-jobs.ts:17,46-52` | Filter by `remindersSent < 2`, sort, paginate; `depth: 1` |
| M21 | Email sending and S3 copies happen **inside** DB transactions (locks held during network calls) | `collections/engagement.ts:95`; `catalog.ts:39-56` | Move to `afterChange` without await / `after()` |
| M22 | Signed-in customers can read **all versions (drafts)** of products, pages, posts — **proven** (682) | `catalog.ts:152-154`, `content.ts:13-19`, `Pages.ts:56-62` | `access.readVersions: staff` |
| M23 | Payload system collections open to any logged-in user (media folders, edit locks, job runner) — **proven** (customer created a folder) | Payload defaults (`payload-folders`, `payload-locked-documents`, `payload-jobs/run`) | Override folder collection access; `jobs.access.run` staff-only; block customers from these |
| M24 | Staff see cost prices through stock counts; staff can download exports made by the Owner (may include cost) | `endpoints/inventory.ts:40,109,128`; `collections/inventory.ts:152`; `payload.config.ts:142` | Strip `unitCost` unless Owner; exports readable only by their creator / managers |
| M25 | COD confirmation code has no per-order attempt limit | `confirm-order/actions.ts:114`; `confirm.ts:32` | Lock after 5 wrong codes per order |
| M26 | Abandoned-cart form trusts browser names/prices and contacts → can send spam from your WhatsApp/email | `checkout/draft-actions.ts:9-25,119-135`; `engagement-jobs.ts:224-233` | Rebuild items from product ids; Turnstile; only remind people who opted in |
| M27 | No Content-Security-Policy | `next.config.ts:74-80` | Add CSP (nonces, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'self'`) |
| M28 | **Open redirect** `/account/login?next=/%5Cevil.com` — **proven** (signed-in user sent to evil.example) | `account/actions.ts:26-29`; `account/login/page.tsx:18,22`; `register/page.tsx:18`; possibly `api/preview/route.ts:13` | Reject `\` and control chars; require `new URL(next, base).origin === base` |
| M29 | Backups: same bucket and keys as photos; photos not backed up; no alert on failure; `pg_dump` pinned to 17 | `scripts/backup/*` | Separate bucket / write-only key; sync media; alert on non-zero exit; match Postgres version |
| M30 | Staging: background jobs blocked by the staging password; feeds/sitemap/media reachable without it | `src/proxy.ts:27,68-69` | Let `/api/cron` with a valid key through; protect feeds on staging |
| M31 | Legacy Prisma code still runs (entrypoint migrate, fallbacks); wholesale admin helpers read Prisma while new enquiries go to Payload | `scripts/docker-entrypoint.sh`; `lib/repo/*`; `lib/auth.ts`; `repo/wholesale.ts` | Remove after launch (needs your OK – touches old tables) |
| M32 | iPhone: sticky Buy bar, WhatsApp button and cookie notice overlap the bottom menu | `bottom-nav.tsx:27`; `buy-box.tsx:364`; `whatsapp-float.tsx:28`; `cookie-notice.tsx:29` | Shared offset `calc(4rem + env(safe-area-inset-bottom))` |
| M33 | Installments page says "launching soon" even when plans are on; FAQ not editable | `installments/page.tsx:48-103` | Switch text on `emiEnabled`; move FAQ to CMS |
| M34 | Product validation gaps: Was-price not checked, price 0 allowed, negative stock, no photo required, upgrade price can be negative | `catalog.ts:179-229` | `validate` functions / `beforeValidate` |
| M35 | Old `/products/<slug>` links redirect temporarily to a search page (blocked in robots) | `next.config.ts:41-45`; `robots.ts:33` | 301 to the real product URL |
| M36 | Feeds send WebP images (Meta/TikTok reject) and strip hyphens from model names | `lib/feeds.ts:68,96-97` | JPEG route for feeds; keep hyphens |
| M37 | Missing index on `orders.customer.email`; account order lists unbounded with depth 1 | `lib/repo/orders.ts:139,148`; `lib/cms/sales.ts:118-129` | `index: true` (migration); `depth: 0` + limit |
| M38 | Uptime monitor can only email via Resend (no SMTP) | `scripts/uptime/monitor.mjs:61-72` | Add SMTP; warn when no channel |
| M39 | No unit tests for money/stock/access; no lint config; `npm run test:urls` broken | `package.json` | Add Vitest tests for `priceCart`, `couponDiscount`, `deliveryCharge`, `codFee`, `toCollect`, access functions; add ESLint; fix the script argument |
| M40 | Error monitoring not proven active (browser Sentry not in bundle) | `Dockerfile` build args; Railway vars | Add `NEXT_PUBLIC_SENTRY_DSN` build arg; set `SENTRY_DSN`; trigger a test error |

## 🟢 Low

1. Customer "blocked" tick doesn't stop guest checkout (`Users.ts:151`, `auth.ts:50`) – use Blocked numbers.
2. Payment screenshots of failed orders stay in the bucket (`checkout/actions.ts:200-207`).
3. Order-number collision gives a generic error (no retry on unique violation) (`checkout/actions.ts:197`).
4. Missing `AUTH_SECRET` throws *after* the order is saved (`order-cookie.ts`) – check at startup.
5. Customer messages and confirmation page ignore zone delivery times (`notify.ts:183`).
6. Status messages are sent before the DB commit (`content.ts:150`).
7. Free delivery / coupon minimum judged before the discount (policy – document it).
8. Invoices never show serial numbers (items have no `serials` field) (`cms-print/[id]/route.ts:47`).
9. Upgrades: several options per group allowed; prices not validated (`cart-pricing.ts:59`).
10. Return / credit-note numbers use `Math.random` 4 digits → collision throws (`aftersales.ts:17`); POS receipts 4 digits (`pos.ts:137`).
11. Fraud check fails open on DB error (`checkout/actions.ts:159-168`).
12. Owner can be locked out by 10 wrong passwords (anyone); `/cms-api/users/forgot-password` and Auth.js callback skip rate limits.
13. Sessions last 30 days; storefront (Auth.js) sessions not revoked after password reset (`auth.ts:23`).
14. Staff can create redirects to external sites (`proxy.ts:48`).
15. Public API shows stock / sold counts (`catalog.ts`).
16. Media uploads have no size limit (staff-only) (`Media.ts:41`).
17. Customers can store unlimited addresses/wishlist JSON via API.
18. `infra/bucket-cors.json` has localhost + placeholder domain.
19. Each customer review submission updates the product (new version + full cache refresh) even when unapproved.
20. Sold count not lowered when a cancelled order had serial units.
21. Brand / laptop-model slug changes don't create redirects; deleted products 404; redirect chains aren't collapsed.
22. Sitemap uses `createdAt`, includes noindex pages and empty categories.
23. `revalidate()` swallows all errors (`revalidate.ts:14,33`); 5 other silent catches hide real failures (`account/actions.ts:212`, `sitemap.ts:37`…).
24. 104 `as never` + 78 `as unknown as` casts switch off Payload's generated types; 1 `any` (`repo/db.ts:88`); 17 `eslint-disable` (no ESLint config to enforce them anyway).
25. Dead exports (~25) in `repo/*`, `lib/auth.ts`, `lib/media.ts`, `lib/wholesale.ts`; leftover scripts `generate-placeholders.mjs`, `generate-blog-covers.mjs`.
26. Build warning: `metadataBase` not set for some OG image routes.

(Code quality otherwise clean: **0** `@ts-ignore`, **0** TODO/FIXME, **0** `console.log` in `src`.)

---

# SECURITY FINDINGS (separately)

Tested as **public**, **customer** (logged into `/cms-api` with a store password) and **staff**, on a local production build.

| Area | Check | Status | Notes |
|---|---|---|---|
| Accounts | Staff change Owner's email/password | 🔴 **Risk – proven** | CR1 |
| | Managers delete Owner | 🟠 Risk | Low 14 / CR1 fix |
| | 2-step enforced for Owner/Manager on the server | 🔴 Risk | Pop-up only (CR1) |
| | 2-step brute force | 🟠 Risk | H6 |
| | 2-step secrets / backup codes | ✅ Safe | encrypted / hashed, never readable |
| | Customer password reset (1 h single-use, same answer for unknown emails) | ✅ Safe | |
| | Email confirmation token (signed, 7 days) | ✅ Safe | |
| | Order cookie (HMAC, timing-safe) | ✅ Safe | |
| | Lockout abuse / forgot-password flooding | 🟢 Risk (Low) | Low 12 |
| | Session cookies (Secure, SameSite Lax), CSRF origin list | ✅ Safe | |
| | Long sessions, storefront sessions not revoked | 🟢 Risk (Low) | Low 13 |
| Data access | Public → users, orders, units, purchases, carts, discounts, protection settings | ✅ Safe – all 403 (tested) | |
| | Customer → other customers' orders / users | ✅ Safe – 0 results (tested) | |
| | Customer → own order's confirmation code, notes, risk | 🟠 **Risk – proven** | H7 |
| | Customer → product/page/post drafts (versions) | 🟡 **Risk – proven** | M22 |
| | Customer → media folders, edit locks, job runner | 🟡 **Risk – proven** | M23 |
| | Staff → product cost price | ✅ Safe – hidden (tested) | |
| | Staff → cost via stock counts / exports | 🟡 Risk | M24 |
| | Serial numbers | ✅ Safe | staff-only |
| | Payment screenshots | ✅ Safe | private folder, staff-only viewer |
| | Track-order internal notes | 🟠 Risk | H12 |
| | Payments global (account numbers) public | ✅ By design | shown at checkout |
| Prices | Change price/total/discount/fee/advance from the browser | ✅ Safe | server re-prices from the database; client only sends ids & qty |
| Injection | SQL (raw stock SQL parameterised; where-queries) | ✅ Safe | |
| | Stored XSS via Markdown / rich text | 🟠 **Risk – proven** | H5 |
| | Reviews, questions, names, emails, print pages | ✅ Safe | escaped |
| | JSON-LD `</script>` escaping | ✅ Safe | |
| Uploads | Customer photos / payment proofs (content-checked, 2–5 MB, private) | ✅ Safe | |
| | SVG | ✅ Safe | served with sandbox CSP |
| | Admin media size limit | 🟢 Risk (Low) | Low 16 |
| Redirects | `/account/login?next=/\evil` | 🟡 **Risk – proven** | M28 |
| | Staff-made redirects to external sites | 🟢 Risk (Low) | Low 14 |
| Abuse | Rate limits | 🟠 **Risk – proven bypass** | H6 |
| | Confirm-code brute force | 🟡 Risk | M25 |
| | Abandoned-cart spam | 🟡 Risk | M26 |
| | Turnstile active | ⚠️ Not active; enabling breaks forms | H15 |
| Headers | HSTS, XFO, nosniff, Referrer, Permissions | ✅ Safe (live) | |
| | CSP | 🟡 Risk | M27 |
| | Error pages / API errors leak details | ✅ Safe | reference number only |
| | GraphQL / playground | ✅ Safe – 404 (live) | |
| | CORS on bucket | 🟢 Risk (Low) | placeholder origins (Low 18); bucket is private anyway |
| Secrets | In code / Git history (56 commits) | ✅ Safe | |
| | In the client bundle (live) | ✅ Safe | only public IDs |
| | Weak/fallback `PAYLOAD_SECRET` in production | ✅ Safe | dev fallbacks only outside production; health check fails without it |
| Dependencies | `npm audit` | 🟠 Risk | H18 |

---

# MISSING AND HALF-BUILT FEATURES

Compared with your feature requests (build spec, Payload "Shopify-like" spec, admin redesign, 8-section spec).

**Fully done:** admin home dashboard, sidebar/search/"+ Add"/bell/mobile bar, roles, help guide, product editor & list (quick edit, readiness score, profit), order list/detail panel, page builder (16 blocks), theme, menus (mega), header/footer, announcement bar, WhatsApp button, live preview, policy pages, product core fields/specs/compatibility/upgrades, serial units, suppliers & purchases, stock counts, barcode labels, collections, fee tester, COD fee/max/advance, JazzCash/EasyPaisa/bank, order tabs & statuses & print, COD confirmation by link/code, payment verification, RTO report, blocked numbers, risk score, manual orders, customers, discount codes, flash sales, POS (sell, split pay, receipt, void, cash-up), fake-order protection, returns/warranty/credit notes, trade-ins, wholesale quotes, reviews & Q&A, abandoned carts & stock/price alerts, recently viewed, SEO (metadata, sitemap, schema, redirects, llms.txt, city pages), product feeds, staging, uptime monitor, customer data export/delete, email (SMTP/Resend), customer accounts (sign-up, forgot password, email confirmation), WhatsApp/SMS (ready, needs keys), analytics + cookie consent, media library.

**Half-built:**
| Feature | What's missing |
|---|---|
| ~~CSV import~~ | ✅ Works (H3 fixed). Imports never change the stock of existing products (Oct 11). |
| ~~Scheduled publishing~~ | ✅ Works (H3 fixed) |
| ~~Reports~~ | ✅ Sales & profit report with refunds, by category / brand / product, CSV download (Oct 10) |
| Delivery zones | No per-zone COD rules, class/weight rates, store pickup, express/same-day, zone disable/holidays, custom areas |
| Fee breakdown on order | COD fee merged into delivery charge |
| Product shipping class / weight / "in the box" | Saved but unused |
| Installments / EMI | Page contradicts itself (M33) |
| Backups | Database only; photos not backed up; no failure alert (M29) |
| Activity log | Server logs only, no in-admin history |
| Email templates | Hard-coded; only on/off switches |
| Admin "Delivery & payments" screen | Plain lists, not the redesigned cards; no city warnings |
| Store editor per-block settings | No background/spacing/mobile visibility/schedule per block; hero has no mobile image |
| Error monitoring | Not active in the browser; server unproven (M40) |
| Tests | No unit tests for money/access (M39) |

**Missing:**
- Stock change history (movement log)
- Bulk price update by % / Rs with preview
- Automatic discounts (free delivery, buy X get Y, product/collection scope)
- Courier booking API / airway bills (manual only – needed your approval)
- Trash / restore, tax settings, dashboard visitors (needed your approval)
- Camera barcode scanning in the admin (USB scanners work)
- Order-number format setting
- Video and newsletter/WhatsApp-signup page blocks
- Card payment gateway (placeholder by design)

**Deferred by you:** GTIN/MPN in feeds; GitHub backups (Railway backup kept); design mock-ups; card gateway; removing the legacy Prisma layer (after launch).

---

# FIX PLAN (in order)

**Step 0 – you, in Railway (10 minutes)**
1. Set `NEXT_PUBLIC_SITE_URL` to the real address, redeploy, check `/robots.txt` (CR7).
2. Set email (`SMTP_*` or `RESEND_API_KEY`, `EMAIL_FROM`).
3. In **Settings → Fake order protection** turn off "Customers must confirm…" until CR8 is fixed.
4. Check the backup service ran last night (BACKUP-RESTORE.md §1) – it couldn't be verified from here.
5. Turn on 2-step for every Owner/Manager now.

**Step 1 – money and stock (1–2 days)**
6. CR2 + CR3 – correct "to collect", block shipping unpaid online orders, print warning.
7. CR4 – checkout idempotency (`attemptId`, one DB migration).
8. H1 + CR5 – one transaction for stock + order; reserve serial units at checkout; fail on unit shortfall.
9. H2 – stock not overwritten by product saves.
10. H8, H9, H10, M19 – returns/delete/edit stock correctness.
11. H17 + M1 – coupon errors instead of silent drop; atomic coupon usage.

**Step 2 – security (1 day)**
12. CR1 – user update rules by role + server-side 2-step for Owner/Manager.
13. H5 + M27 – sanitize Markdown; add CSP.
14. H7, H12, M22, M23, M24 – hide confirmation code/notes/risk, drafts, system collections, cost in counts/exports.
15. H6 + M25 – trusted client IP, per-account 2-step lockout, per-order code limit.
16. M28 – open redirect.
17. H18 – dependency overrides/updates.

**Step 3 – operations (1 day)**
18. CR6 – category cycle validation + loop limits.
19. H3 – import without queue; jobs runner for scheduled publish.
20. CR8 – COD confirmation via the confirm template / fallback.
21. H4 – build with Payload (or no build-time pre-render); fail fast without `PAYLOAD_SECRET`.
22. H15 + M40 – build args for Turnstile and Sentry.
23. H13 + M37 – bounded order queries, email index.

**Step 4 – trust and content (½ day)**
24. CR9 + H14 – remove demo fallbacks; real ratings only (data reset needs your OK).
25. H16, M2, M33 – delivery prices from zones everywhere; free-delivery fixes; installments page.

**Step 5 – quality (ongoing, first 2 weeks after launch)**
26. M39 – unit tests for prices, coupons, delivery, COD, to-collect, access rules; ESLint; fix `test:urls`.
27. Remaining Medium items (caching, media/category deletes, POS approvals, jobs, iPhone overlap, feeds), then Low.
28. Re-run this review's checks: smoke, security sweep, crawl, URL check, stock race, concurrent checkout, load test, Lighthouse.

After Steps 0–3 (and 24), the shop is ready for a soft launch with the test plan in [REPORT.md](REPORT.md) Part 4.
