# Urko Tech Store – project review (6 October 2026)

What was checked: all code in this repository (storefront, `/cms` admin, checkout, payments, delivery, stock, security, SEO, speed, backups, staging), `npm audit`, the Git history for secrets, and the **live site** at `urko-tech-store-production.up.railway.app` (read-only, no changes).

How to read this: every issue says **what's wrong → where → why it matters → how to fix**. "Verified" means it was checked in the code or on the live site, not just suspected.

The owner guides are in this folder: [DEPLOYMENT](DEPLOYMENT.md) · [SETUP](SETUP.md) · [PRODUCTS](PRODUCTS.md) · [STORE-EDITOR](STORE-EDITOR.md) · [ORDERS](ORDERS.md) · [DELIVERY-PAYMENTS](DELIVERY-PAYMENTS.md) · [BACKUP-RESTORE](BACKUP-RESTORE.md) · [SECURITY](SECURITY.md) · [MAINTENANCE](MAINTENANCE.md)

> **Update 7 October 2026:** the issues below were re-checked in a full code review and **fixed** – see [CODE-REVIEW.md → Fix status](CODE-REVIEW.md#fix-status--7-october-2026-after-the-fixes) for what was fixed, the test results, what is still open and what you must do in Railway. This report is kept as the record of the 6 October state.

---

# PART 1 – ISSUES REPORT

## 🔴 Critical – fix before launch

### C1. The live site thinks its address is "your-app.up.railway.app" — verified on the live site
- **What's wrong:** The Railway setting `NEXT_PUBLIC_SITE_URL` is still the example value. Every page tells Google its real address is `https://your-app.up.railway.app`, robots.txt and the sitemap (240 links) point there, and the links inside emails (password reset, "confirm your email", "confirm your order", tracking) are built from it.
- **Where:** Railway → web service → Variables (`NEXT_PUBLIC_SITE_URL`). Visible in the live page source, `/robots.txt`, `/sitemap.xml`.
- **Why it matters:** Google won't index your pages under your domain; every link a customer gets by email/WhatsApp is broken.
- **Fix:** Set `NEXT_PUBLIC_SITE_URL` to your real address (`https://www.urkotechstore.com` once the domain points at Railway; until then the Railway address), then **redeploy** (it's baked in at build time). Check `/robots.txt` afterwards.

### C2. Anyone can see another customer's name, phone and address — ✅ FIXED (6 Oct 2026)
- **Fixed:** the order cookie is now signed (only the server can make it); new order numbers have 6 secure-random digits (old 4-digit numbers still work); "Find my orders" never shows orders on screen – it sends the numbers by WhatsApp (when the `WHATSAPP_TEMPLATE_ORDER_LOOKUP` template is approved) and to the email used on those orders; accounts list guest orders only by **confirmed email**, not by phone. Tested: forged cookies refused; a stranger signing up with the buyer's phone sees nothing; the buyer sees the order after confirming their email.

*Original finding:*
- **What's wrong:** The order confirmation page shows full details to whoever has a cookie containing the order number. The cookie isn't secret – anyone can set it in their own browser. Order numbers are `UTS-date-4 digits` (only 9,000 per day) and the page has no attempt limit. On top, **"Find my orders"** on the account page lists anyone's order numbers from just a phone number, without signing in.
- **Where:** `src/app/(frontend)/(store)/order-confirmation/[orderNumber]/page.tsx:41`, `src/lib/repo/orders.ts:28` (order numbers), `src/app/(frontend)/(store)/account/actions.ts` (`findOrdersByPhoneAction`), `account/orders/load.ts:11`.
- **Why it matters:** A simple script could collect every customer's address and phone. Serious privacy and trust problem (and a legal one).
- **Fix:** Put a long random secret in the cookie (or sign it) and compare that; make order numbers longer/random; rate-limit the page; only show "find my orders" results after a one-time code to that phone, and only link account orders by phone once the phone is verified.

### C3. Fake or rejected payment screenshots still reduce what the rider collects — verified in code
- **What's wrong:** (a) For COD orders with an advance, the "collect" amount on the order and on the printed slip subtracts the advance as soon as a screenshot is uploaded – even before you check it, and **even after you press Reject** (Reject doesn't clear the advance). (b) JazzCash / EasyPaisa / bank orders always show "collect Rs 0", even if the payment was never approved; nothing stops you confirming and shipping them.
- **Where:** `src/payload/admin/orders/OrderPanel.tsx:95` and `:333` (Reject), `src/app/(payload)/cms-print/[id]/route.ts:41`, `checkout/actions.ts:209`.
- **Why it matters:** One fake screenshot = a laptop shipped with Rs 5,000 (or the full price) never collected.
- **Fix:** Only subtract the advance once it's **approved**; Reject sets the advance to 0; block "Confirm"/"Mark as shipped" for online-payment orders until payment is **Paid** (manager override allowed); print "COLLECT FULL AMOUNT" when unpaid. *Until fixed: follow the warning in [ORDERS.md](ORDERS.md) section 2.*

### C4. COD customers may never receive their confirmation code → orders auto-cancelled — verified in code
- **What's wrong:** By default **every COD order must be confirmed** by the customer within 24 hours or it's cancelled. But the normal WhatsApp order message uses the *order* template (name, number, total) – **no link or code**. Without that template, a free-text WhatsApp is sent, which WhatsApp blocks for first-time contacts. SMS is skipped silently if not set up; email is optional at checkout.
- **Where:** `src/lib/notify.ts` (`notifyNewOrder`), defaults in `src/lib/protection.ts:31`.
- **Why it matters:** Real orders get cancelled automatically and customers are confused ("we sent you a code").
- **Fix:** Always send the confirmation with the `WHATSAPP_TEMPLATE_CONFIRM` template (link + code); warn in `/cms` (and don't auto-cancel) when no WhatsApp template or SMS is set up. **Until then: turn off "Customers must confirm cash-on-delivery orders" in Settings → Fake order protection, and confirm by phone instead.**

### C5. Turning on the bot check (Turnstile) would break checkout and every form — verified in code
- **What's wrong:** The Turnstile site key isn't passed into the build (`NEXT_PUBLIC_TURNSTILE_SITE_KEY` is missing from the Dockerfile's build arguments). If you set the Turnstile keys in Railway as the docs say, the server demands the check but the browser never shows it.
- **Where:** `Dockerfile:31-41`, `src/components/ui/turnstile.tsx:22`, `src/lib/turnstile.ts`.
- **Why it matters:** Nobody could place an order or send any form.
- **Fix:** Add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (and `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_ENVIRONMENT`, `NEXT_PUBLIC_BING_SITE_VERIFICATION`) as build arguments; make the server skip the check when the site key is missing. **Don't set the Turnstile keys until this is fixed.**

### C6. Made-up reviews, ratings and testimonials on the live site — verified on the live site
- **What's wrong:** The home page shows six invented testimonials ("Ahmed Raza, Karachi…") and "4.8★ average customer rating"; the About page repeats 4.8★. Product cards show stars even with 0 reviews; migrated products kept invented ratings and "sold" numbers; Google is told the product has these ratings (structured data).
- **Where:** `src/lib/repo/catalog.ts:393-414` (falls back to demo testimonials/FAQs), `src/lib/data/seed/*`, `src/components/product/product-card.tsx:130`, `src/lib/seo.ts:202`, `about/page.tsx:36`, `src/lib/content/home.ts:109`.
- **Why it matters:** Misleading customers is a trust and consumer-law risk; Google can penalise fake review markup.
- **Fix:** In `/cms`: **Online store → Testimonials** – replace with real ones (or remove the Testimonials section) and **FAQs** – save your own. In code: never fall back to demo content in production; show stars only when there are real reviews; recalculate ratings/sold counts from real data; remove the "4.8★" text.

## 🟠 High – important, fix soon after (or before) launch

| # | What's wrong | Where | Why it matters | How to fix |
|---|---|---|---|---|
| H1 | **Staff can change any user's password or email – including the Owner's.** | `src/payload/collections/Users.ts:40` (`update: staffOrSelf`) | A staff member could take over or lock out the owner. | Only allow editing yourself or lower roles; only the Owner may change an Owner. |
| H2 | **2-step verification for Owner/Manager is only enforced by a pop-up**, not by the server. | `src/payload/admin/AdminProviders.tsx`, `endpoints/two-factor.ts` | An Owner/Manager who hasn't set it up yet can be used with just a password. | Refuse admin actions on the server until 2-step is on (Owner/Manager). Meanwhile: turn it on for everyone now. |
| H3 | **2-step codes can be guessed** – the attempt limit can be dodged with a fake IP header and wrong codes don't count toward lockout. | `endpoints/two-factor.ts:59`, `src/lib/rate-limit.ts` | Someone with a stolen password could brute-force the code. | Count wrong codes per account in the database (lock after 5); use Cloudflare's real-IP header everywhere. |
| H4 | **Staff-written text can run scripts on the website** (descriptions, page texts, blog are shown without cleaning); no Content-Security-Policy. | `src/components/ui/markdown.tsx:8`, `src/lib/blog.ts:31`, `next.config.ts` | A staff account (or a hacked one) could steal the Owner's session. | Clean the HTML (DOMPurify) and add a CSP header. |
| H5 | **Every deploy pre-builds pages from the old database tables or demo data**, so for a few minutes after each deploy visitors (and Google) can see old prices/stock. | `Dockerfile:44-51`, `src/lib/db/config.ts:5` | Wrong prices shown; stale pages cached. | Pass `PAYLOAD_SECRET` to the build or don't pre-build catalog pages; remove the old Prisma migrate step. |
| H6 | **Demo bank details / old texts show until each setting is saved once** (testimonials, FAQs "card payments coming soon", old announcement). Bank transfer is on by default but account number/IBAN aren't required. | `src/lib/repo/catalog.ts:393`, `src/payload/globals/commerce.ts:96` | Customers could see empty or fake account numbers. | Save every settings page once; code: require details when a method is on and hide methods with empty details. |
| H7 | **Delivery prices on city pages and the shipping-policy text use old fixed prices** (Karachi Rs 200, Lahore Rs 300), not your zones. | `src/app/(frontend)/(store)/[category]/page.tsx:78`, `src/lib/content/page-defaults.ts:32`, `src/lib/city-content.ts:59` | Customers (and Google answers) see a different fee than checkout charges. | Use the live zones everywhere. |
| H8 | **Installments page says "launching soon"** even after plans are turned on; its FAQ isn't editable. | `src/app/(frontend)/(store)/installments/page.tsx` | Confusing; contradicts itself. | Switch text on the setting; move FAQ into the admin. Until then keep EMI off or hide the page from menus. |
| H9 | **Coupon silently dropped** if it stops being valid between cart and "Place order"; the order is placed at the higher total. | `checkout/actions.ts:139` | Customers pay more than shown; online-payment amounts won't match. | Stop and show the new total instead of placing the order. |
| H10 | **Dependency security warnings** (33: 16 high). Main real ones: `nodemailer` 8 (fixed in 10.0.6+), `undici` inside Payload (fixed in 7.29.1). Others are in tools not used at runtime (old Prisma's `mysql2`, dev tools). | `package.json` | Known bugs in email sending and web requests. | Add npm `overrides` for `nodemailer@^10.0.6` (next-auth's limit) and `undici@^7.29.1`; test; update Payload when a fixed version ships. |

## 🟡 Medium

| # | What's wrong | Where | How to fix |
|---|---|---|---|
| M1 | Editing items/quantity on an existing order doesn't adjust stock or totals. | `src/payload/collections/content.ts` (orderStock) | Lock items after creation, or recalc stock and totals on change. |
| M2 | Deleting an order doesn't give its stock / laptop units back. | `content.ts` (no delete hook) | Release stock on delete, or forbid deleting (use Cancel). |
| M3 | Returns can put stock back twice; several returns for one order; refund amount has no upper limit. | `src/payload/collections/aftersales.ts:151` | Skip restock if already released; cap refunds; one return per item. |
| M4 | Coupon usage limit can be exceeded by simultaneous orders; cancelled orders still use it up; percent coupons not capped at 100. | `src/lib/coupons.ts`, `src/lib/cms/sales.ts` | Count usage atomically inside the order; give it back on cancel; max 100%. |
| M5 | With **no** zones set, "Free delivery above = 0" makes **all** delivery free (zones work correctly). Cart bar says "FREE delivery all over Pakistan" even where a zone isn't free. | `src/lib/cities.ts:98`, `cart-view.tsx`, `free-delivery-bar.tsx` | Fix the zero check; use the city's rule in the cart bar. *Workaround: always have a "Rest of Pakistan" zone.* |
| M6 | One person can hold a lot of stock with fake COD orders (up to 30 lines × 20 each) for 24 hours. | `checkout/actions.ts:58` | Cap each product per order (e.g. 2–3 laptops); shorter hold for unconfirmed orders. |
| M7 | All rate limits trust a header the visitor can fake, and limits are per server copy. | `src/lib/rate-limit.ts:12` | Use `CF-Connecting-IP` (Cloudflare) / Railway's real IP. |
| M8 | The 6-digit order-confirmation code has no per-order attempt limit. | `src/lib/cms/confirm.ts` | Lock after ~5 wrong tries. |
| M9 | Staff can see **cost prices** through stock counts; staff can download exports the Owner made (may include costs). | `src/payload/endpoints/inventory.ts:40`, `payload.config.ts:142` | Don't store cost in counts; limit exports to their creator / managers. |
| M10 | Customers can sign in to the API directly and read internal order notes / risk reasons on their own orders. | `content.ts:187`, `access.ts` | Make those fields staff-only. |
| M11 | Abandoned-cart reminders send shopper-typed text to any phone/email – can be abused for spam. | `checkout/draft-actions.ts`, `src/lib/engagement-jobs.ts` | Rebuild item names/prices on the server; only remind real customers. |
| M12 | Laptop serial allocation can quietly come up short if the shop counter sells the last unit at the same moment. | `content.ts` orderUnits, `src/payload/stock.ts:87` | Fail the order or flag it for staff. |
| M13 | Shop counter (POS): any staff can sell at any price (even Rs 0); a double "Void" could return stock twice. | `src/payload/endpoints/pos.ts:80` | Manager approval below list price; make void a one-time update. |
| M14 | Admin hints point to the retired old admin; empty hero slider falls back to old banners nobody can edit. | `src/payload/blocks.ts:51,157`, `top-bar.tsx:16` | Fix labels; remove old fallbacks. |
| M15 | Product admin: "Was price must be higher" isn't checked; price 0 and negative stock/upgrade prices allowed; products can go "On store" with no photo. Fields `What's in the box`, `shipping class`, `weight` are saved but not used. | `src/payload/collections/catalog.ts` | Add validation; use or remove those fields. |
| M16 | A short admin/database hiccup can turn pages into 404s that stay cached for 5 minutes. | `src/lib/cms/pages.ts:166` | Keep serving the last good page on errors. |
| M17 | Old `/products/<name>` links redirect *temporarily* to a search page (blocked in robots.txt) – loses their Google value. | `next.config.ts:41`, `src/app/robots.ts:33` | Permanent redirect to the real product page. |
| M18 | Product feeds send WebP images (Meta/TikTok often reject) and strip hyphens from model names ("i5-1135G7" → "i5 1135G7"). | `src/lib/feeds.ts:68,96` | Serve JPEG for feeds; keep hyphens. |
| M19 | Staging: background jobs are blocked by the staging password (auto-cancel/reminders never run there); feeds, sitemap and photos are reachable without the password. | `src/proxy.ts:27,69` | Let the internal job call through; protect feeds on staging. |
| M20 | On iPhones the sticky "Buy" bar, WhatsApp button and cookie notice overlap the bottom menu. | `bottom-nav.tsx`, `buy-box.tsx:364`, `whatsapp-float.tsx`, `cookie-notice.tsx` | Shared bottom offset including the iPhone safe area. |
| M21 | The whole catalogue is cached as one block; past a few hundred products it gets too big to cache and every page rebuilds it (slow). | `src/lib/repo/catalog.ts:77` | Cache a slim list + each product separately. |
| M22 | Backups are in the **same bucket with the same keys** as photos; photos themselves aren't backed up; no alert if a backup fails; backup tool pinned to Postgres 17. | `scripts/backup/*` | Separate bucket / write-only key; copy photos too; alert on failure; match the Postgres version. |
| M23 | Uptime monitor can only email through Resend – with SMTP you'd get no "site down" emails. | `scripts/uptime/monitor.mjs` | Add SMTP support / warn when no channel set. |
| M24 | Contact-form alerts are off by default (docs say they're on). | `src/payload/globals/notifications.ts:31` | Turn on **Settings → Notifications → Contact form message**; change default. |
| M25 | Old database layer (Prisma) still runs at every deploy and start, with fallback code paths. If the admin were ever seen as "off", orders would go to tables no screen shows. | `scripts/docker-entrypoint.sh`, `src/lib/repo/*`, `src/lib/auth.ts` | Remove after launch (needs your OK – it touches old tables). |
| M26 | Heavy animation library on every page; sections invisible until scripts load; product cards download a second photo even on phones. | `src/components/ui/reveal.tsx`, `product-card.tsx` | Lighter CSS animations; load hover photo only on desktop. |

## 🟢 Low / polish

- **Customer "blocked" tick doesn't stop orders** (they can check out as a guest) – use **Orders → Blocked numbers** instead. (`Users.ts:151`)
- **No protection against double orders** if the connection drops after "Place order" and the customer retries.
- **Payment screenshots of failed orders** stay in storage. **Flash sale prices** don't revert by themselves when the countdown ends.
- Order confirmation page ignores zone delivery times; "Advance paid (pending verification)" label never updates after approval. `Ask advance above = 0` with an advance amount shows the advance box on every COD order.
- **Fee tester** doesn't include the COD fee.
- Track-order shows staff notes from the order history. (`track-order/actions.ts:70`)
- Sign-up reveals whether an email already has an account; `/cms` forgot-password has no attempt limit; one could lock the Owner out by trying wrong passwords (10 tries → 15 min).
- Staff can create redirects to outside websites; Media uploads have no size limit (staff-only); public API shows stock counts and sold counts.
- **Fake social posts** in the Instagram/TikTok section (`src/components/home/sections.tsx:134`).
- Unknown category/brand URLs return "200" instead of "404" (marked noindex, so minor).
- Sitemap lists pages you set to noindex, uses "created" not "updated" dates, includes empty categories. `/returns` and `/sell-your-laptop` SEO isn't editable in `/cms`.
- Business structured data has fixed price range / payment methods; uploaded logo shown at full size; blog posts without a cover tell Google the home page is their image.
- Old abandoned carts / alerts / export files are never cleaned up (personal data).
- **Out-of-date docs:** README (Prisma workflow, seed admin, old upload system, project structure), `docs/CONVENTIONS.md` (Supabase, old admin), `.env.example` missing several variables, `infra/bucket-cors.json` placeholder domain. A session lock file `.claude/scheduled_tasks.lock` is committed.
- Leftover scripts: `scripts/generate-placeholders.mjs`, `generate-blog-covers.mjs`, rehearsal files in `docs/payload-migration/`.

## ✅ Checked and fine

- **Prices and totals are recalculated on the server** from the database (the browser only sends product ids and quantities); coupons re-checked; total never below 0.
- **No overselling:** stock is taken in one atomic database step, shared by website and shop counter; laptop units are reserved safely; cancel/refuse/return give stock back exactly once.
- Delivery fee, COD fee, COD limit and allowed payment methods are enforced on the server with the same rules the customer sees.
- Payment screenshots: real file-type check, 5 MB max, private folder, staff-only viewing.
- **Old URLs:** 168/168 old addresses redirect correctly (checked during the QA pass); product slug changes create permanent redirects automatically.
- Image upload fix is live (photos with spaces in their names load).
- No `console.log`, TODO or lorem ipsum in code; GraphQL off; staging is password-protected and hidden from Google; analytics wait for cookie consent.
- Lighthouse (mobile, earlier QA): Accessibility / Best practices / SEO 100 on home, category, product; Performance 61–91.

---

# PART 2 – SECURITY REPORT

| Area | Item | Status | Notes / how to fix |
|---|---|---|---|
| **Data access** | Cost prices on products, units, purchases | ✅ Safe | Owner-only. |
| | Cost prices via stock counts & export files | ⚠️ Risk (Medium) | See M9. |
| | Serial numbers / laptop units | ✅ Safe | Staff-only. |
| | Payment screenshots | ✅ Safe | Private folder; staff-only viewer; never served publicly. |
| | Other customers' orders – via order confirmation page | ✅ Safe (fixed) | Signed cookie; see C2. |
| | Other customers' orders – via "find my orders by phone" / account phone | ✅ Safe (fixed) | Sent to the phone/email only; accounts link by confirmed email. |
| | Customers reading internal notes/risk on own orders via API | ⚠️ Risk (Medium) | See M10. |
| | Customer notes, tags, blocked flag; staff list | ✅ Safe | Staff-only. |
| | Suppliers, purchases, POS sales, cash-ups, returns, warranty, trade-ins, messages, wholesale, discount codes | ✅ Safe | Staff-only. |
| | 2-step secrets and backup codes | ✅ Safe | Never readable; encrypted / hashed. |
| | Admin custom tools (orders, POS, reports, stock, privacy, settings backup) | ✅ Safe | Every one checks the user's role. |
| | Stock / sold counts visible in public API | ⚠️ Risk (Low) | Make staff-only. |
| **Login & accounts** | Staff can edit Owner/Manager password or email | 🔴 Risk (High) | See H1. |
| | Managers can delete the Owner | ⚠️ Risk (Low) | Only an Owner may delete an Owner. |
| | 2-step forced for Owner/Manager | ⚠️ Risk (High) | Pop-up only; see H2. |
| | 2-step code brute force | ⚠️ Risk (High) | See H3. |
| | 2-step itself (code check, reuse, backup codes) | ✅ Safe | Timing-safe checks, codes can't be reused. |
| | Account lockout (10 tries / 15 min) | ✅ Safe / ⚠️ Low | Works; strangers could lock the Owner out on purpose – add IP limits on login. |
| | Customer login rate limit | ⚠️ Risk (Medium) | Can be skipped by calling the login URL directly; add limit in `proxy.ts`. |
| | Customer password reset | ✅ Safe | 1-hour single-use link; same answer whether or not the email exists; staff need 10+ characters. |
| | Email confirmation | ✅ Safe | Signed 7-day link; changing email clears it; customers can't mark themselves confirmed. |
| | `/cms` forgot-password flooding | ⚠️ Risk (Low) | Add a rate limit. |
| | Rate limiting in general | ⚠️ Risk (Medium) | Uses a fake-able header; see M7. |
| | Session cookies | ✅ Safe | Secure + SameSite in production; CSRF origin list configured. |
| **Secrets** | Keys/passwords in code | ✅ Safe | None. The only "password" found is the local test database on your own computer (`127.0.0.1`). Dev-only fallback secrets are never used in production. |
| | Keys in Git history | ✅ Safe | No `.env` file ever committed; scan of all 56 commits found no real keys. |
| | Session file in Git | ⚠️ Low | `.claude/scheduled_tasks.lock` – remove from Git. |
| **Forms & uploads** | Spam protection (checkout, contact, reviews, questions, wholesale, trade-in, returns, warranty) | ✅ Safe | Hidden trap field + rate limit + Turnstile-ready. |
| | Turnstile actually active | ⚠️ Risk | Not active now; turning it on breaks forms until C5 is fixed. Sign-up/login have no Turnstile. |
| | Abandoned-cart form | ⚠️ Risk (Medium) | See M11. |
| | Payment screenshots / review photos | ✅ Safe | Real content check (JPG/PNG/WebP), 5 MB / 2 MB limits. |
| | Admin media uploads | ⚠️ Risk (Low) | No size limit (staff-only). Add one. |
| | SVG uploads | ✅ Safe | Served with a sandbox policy so scripts can't run. |
| | Staff-written text shown on site | 🔴 Risk (High) | Not cleaned; see H4. |
| **Headers & errors** | HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy | ✅ Safe | Set. |
| | Content-Security-Policy | ⚠️ Risk (Medium) | Missing; add with H4. |
| | Error pages | ✅ Safe | Show only a reference number, no technical details. |
| | GraphQL / playground | ✅ Safe | Disabled. |
| **Dependencies** | `npm audit` | ⚠️ Risk (High) | 33 warnings; see H10. |
| **Bucket & database** | Photos | ✅ Safe | Bucket is private; only image folders are served by the site. |
| | `payments/`, `returns/`, `warranty/`, `tradein/` | ✅ Safe | Staff-only routes. |
| | `backups/` | ✅ Safe / ⚠️ Low | Never served; but same bucket and keys as the website – see M22. |
| | Database | ✅ Safe | Not public in the app config; uses Railway's private network. *Check that the Postgres "public URL" (TCP proxy) is only used for builds and keep that password private.* |
| | Open redirect via staff-made redirects | ⚠️ Risk (Low) | Allow only own-site paths for staff. |

---

# PART 4 – LAUNCH READINESS

## Ready for launch: **Yes, for a soft launch – after your Railway steps** (updated 7 Oct 2026)

The code problems that would lose money, leak customer data or break emails are fixed (C2–C6, H1–H10 and the rest – details in [CODE-REVIEW.md](CODE-REVIEW.md)). Before going live:

1. **C1** – set the real `NEXT_PUBLIC_SITE_URL` and redeploy (until then `/api/health` and the `/cms` Home screen show a warning).
2. Email settings (`SMTP_*` or `RESEND_API_KEY`, `EMAIL_FROM`).
3. **Back up the database, then deploy** – this release adds 3 database migrations (applied automatically during the build; needs `DATABASE_BUILD_URL` and `PAYLOAD_SECRET`).
4. Enter real JazzCash / EasyPaisa / bank details – a method without real details is now hidden from checkout.
5. Run the test plan below on staging.

## What you must do yourself
- **Railway:** set `NEXT_PUBLIC_SITE_URL`; email settings (`SMTP_*` or `RESEND_API_KEY`, `EMAIL_FROM`); check `PAYLOAD_SECRET`, `AUTH_SECRET` and the `S3_*` keys are set; confirm the backup service ran last night.
- **DNS / Cloudflare:** point the domain to Railway, SSL Full (strict), cache rules ([DEPLOYMENT.md](DEPLOYMENT.md) section 7).
- **Email domain:** add SPF / DKIM records from your email provider so emails don't go to spam.
- **WhatsApp Business:** get message templates approved (order, status, **confirm**), or keep COD confirmation off.
- **Payment details:** enter and double-check JazzCash, EasyPaisa, bank account and IBAN.
- **Legal:** have a lawyer review privacy policy, terms, returns & warranty, and shipping policy.
- **Content:** real products with real photos and prices; real testimonials and FAQs; store details, logo, theme; delivery zones that match your courier costs.
- **Accounts:** turn on 2-step for every Owner/Manager; give staff the right roles; protect Railway, Cloudflare, GitHub, email and domain accounts with 2-step.
- **Google:** Search Console verified + sitemap submitted; GA4 ID in **Settings → Google & SEO**; Merchant Center if you'll use the Google feed.

## Test plan – do these on **staging** before going live

Use a real phone number and email you own. After each, check the order in `/cms`, the stock, and the message/email received.

| # | Test | Expected result |
|---|---|---|
| 1 | COD order, Karachi, below free-delivery amount | Fee = Karachi zone fee (+ COD fee); stock goes down by 1; confirmation email/WhatsApp received; links open your real domain. |
| 2 | COD order, small town not in any zone | "Rest of Pakistan" fee; delivery time shown. |
| 3 | Order above the free-delivery amount | Delivery Rs 0 in cart, checkout, and the saved order. |
| 4 | Order with a valid coupon; then a coupon below its minimum | Discount applied; invalid coupon refused with a message. |
| 5 | JazzCash order with screenshot → **Approve** | Shows "Payment to check" → after Approve "Paid"; slip says collect Rs 0. |
| 6 | JazzCash order with screenshot → **Reject** | Customer contacted; the order can't be confirmed or shipped; slip says "PAYMENT NOT VERIFIED – DO NOT SHIP". |
| 7 | High-value COD (above "Ask advance above") with advance screenshot | Advance asked; slip collect = total − advance **only after Approve**. |
| 8 | COD confirmation flow (if switched on) | Customer receives link/code; confirming moves order to "To confirm / To ship"; an unconfirmed test order auto-cancels after the set hours and stock returns. |
| 9 | Order the **last unit** of a product from two browsers at once | One succeeds, the other is told it's sold out. |
| 10 | Serial-tracked laptop: order → ship → deliver | Unit Reserved → Sold; stock = in-stock units. |
| 11 | Cancel an order in `/cms` | Stock returns; customer told. |
| 12 | Refused (RTO) and a Return with refund | Stock returns once; credit note prints; order shows Returned. |
| 13 | Manual WhatsApp order created in `/cms` | Stock taken; invoice and packing slip print correctly. |
| 14 | Shop counter sale + Void + Cash-up | Stock down then back up; receipt prints; cash-up saved. |
| 15 | Customer: sign up → confirm email → sign out → forgot password → reset | Emails arrive with your real domain; new password works; old doesn't. |
| 16 | Privacy check: in a different browser, open someone else's order-confirmation URL | Must show "only on the device that placed the order" (even with the order number typed into the cookie). |
| 17 | Staff account: try to open Settings, cost prices, and edit the Owner | All refused. |
| 18 | Mobile (iPhone + Android): home, category filters, product, cart, checkout | Nothing overlaps; buttons easy to tap. |
| 19 | Contact form, review with photo, wholesale quote, trade-in | Saved in `/cms`; team alert email received. |
| 20 | `/api/health`, `/robots.txt`, `/sitemap.xml` on the final domain | Health ok; robots/sitemap use the real domain. |
