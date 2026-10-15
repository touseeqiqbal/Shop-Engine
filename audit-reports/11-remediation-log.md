# ShopEngine — the engine that powers shops
# 11 · Remediation log (what was fixed and built after the audit)

**Baseline:** the audit in reports 00–10 describes commit `aab6879`. This log describes the **working tree on top of it** (not committed),
14 October 2026, with the international work of 15 October 2026 (§2.12). Every claim below was checked by reading the code; where it says "run", it was actually run. Nothing here was run against
Stripe, an email/WhatsApp provider, GitHub Actions or production.

## 1. Result

**The headline:**
- **Multi-store is real.**
  - Every store-owned record carries its store, and every access rule is per store and per role.
  - Each store is served on its own address, with its own settings, including its own payment accounts.
- **The self-promotion path to platform admin is gone.**
- **Built:**
  - card payments (Stripe Checkout into each merchant's own account) with signed webhooks, refunds and reconciliation;
  - SaaS billing with trials, grace periods, expiry and plan limits;
  - a transactional outbox, invitations, custom domains;
  - merchant webhooks, partial shipments and saved carts.
  - **stores in any country (15 Oct):** each store's country sets its currency, time zone, phone format, address form
    and payment methods; payment methods are plugins (built-in, the store's own, and provider plugins with Stripe first).
- **Fixed:** all 24 broken features.

| Metric | Audit (`aab6879`) | Now |
|---|---|---|
| Complete / Partial / Missing / Broken / Not verified | 85 / 91 / 91 / 24 / 4 | **234 / 45 / 12 / 0 / 4** |
| Confirmed feature coverage (same 295 rows and scoring as report 01) | 44.2 % | **86.9 %** |
| Verified-only coverage | 44.8 % | **88.1 %** |
| Critical security issues (SEC-01…03) | 3 open | 0 open |
| App boots / migrations match the config | No / No | Yes / Yes (run) |
| Unit tests | 40 pass (asserting insecure behaviour) | **97 / 97 pass** (secure behaviour; 20 for currencies, time zones, phones, payment methods) |
| Database / server tests | none | **7 scripts, 96 checks, all pass** (§5) – 5 of them run in CI |

| Module | Audit | Now | Module | Audit | Now |
|---|---|---|---|---|---|
| Access control | 35.0 % | 85.0 % | Orders | 56.5 % | 95.7 % |
| Onboarding | 30.8 % | 96.2 % | Shipping & fulfillment | 53.6 % | 67.9 % |
| Store management | 13.2 % | 92.1 % | Customers | 63.6 % | 100 % |
| Products | 73.3 % | 100 % | Discounts & marketing | 46.9 % | 87.5 % |
| Variants | 65.0 % | 100 % | Analytics | 41.7 % | 66.7 % |
| Collections | 78.6 % | 92.9 % | SaaS billing | 12.5 % | 100 % |
| Inventory | 58.8 % | 79.4 % | Super admin | 27.8 % | 72.2 % |
| Storefront | 71.9 % | 87.5 % | Jobs & integrations | 33.3 % | 87.5 % |
| Themes | 57.1 % | 71.4 % | Production readiness | 32.4 % | 67.6 % |
| Cart & checkout | 52.9 % | 91.2 % | Payments | 13.9 % | 91.7 % |

Row-by-row evidence is in **`12-feature-checklist-after.md`**. Report 01 stays as the audit baseline.

## 2. What changed, by area

### 2.1 Tenancy and access (SEC-01, SEC-02, SEC-04)
- `src/payload/tenancy.ts` (new) works out one person's authority.
  - A platform admin is the legacy Owner or `platformRole = platform_admin`, with 2-step on.
  - Store roles come **only** from active `store-memberships`: store_owner > store_manager > store_staff.
  - Owners and managers count only with 2-step on.
  - The active store is `users.currentStore`, validated against the person's memberships.
  - Suspended, closed and lapsed stores are read-only.
- Access helpers: `readFor` / `writeFor` / `createFor` / `publicOrStore` / `storeRoleField`, plus the `assignStore()` hook.
  - The server sets every new record's store, and refuses a store the person isn't on the team of.
  - A record never moves to another store.
- `src/payload/access.ts` was rewritten.
  - The old global role helpers are gone.
  - A merchant sees their own account, their store's customers and their team.
  - Only platform admins delete accounts.
- `Users.ts`:
  - role and tenant fields are platform-admin-only;
  - only you (or a platform admin) change your email or password, and a password change ends other sessions;
  - customer store lists show a merchant only their own store.
- Every store-owned collection carries the store field, scoped access and per-store unique indexes. Relationship pickers only offer the same store's records, and this is enforced on save.
- Custom endpoints go through `storeGate()`: reports, POS, stock count, order tools, payments, marketing.
  - Print, proof and file routes check the record's store.
  - Privacy erase and config import are platform-admin-only and logged.

### 2.2 Per-store settings (SEC-03)
- Each settings global has a per-store twin (`store-<slug>`, tables `cms_ss_*`). The globals are platform defaults, editable by platform admins only.
- The leaked default JazzCash, EasyPaisa and bank details were removed.
- `/cms/settings/:page` opens the current store's own copy. Every storefront loader reads the current store's settings.

### 2.3 Storefront per store
- The store comes from the Host header:
  1. a verified custom domain;
  2. otherwise `<subdomain>.PLATFORM_ROOT_DOMAIN`;
  3. otherwise the default store. An unknown sub-domain gets a 404.
- **Found and fixed during the work:** ISR caches by path, not by host, so a page could have shown one store's content on another
  store's address. Pages now render per request (`unstable_rethrow`), and their data stays cached per store.
- Per-store everywhere:
  - metadata (`metadataBase` is the store's address; canonical links are relative);
  - JSON-LD, sitemap, robots, product feeds and `llms.txt`;
  - redirects (looked up per host in the proxy);
  - icons and manifest.
- Availability gate: a draft store shows "Opening soon", suspended or closed stores are offline, and closed stores are never indexed.

### 2.4 Checkout, discounts, tax, consent
- **Checkout** was rewritten:
  - the store must be open; prices come from the store's own catalogue;
  - one `orderTotals()` is shared by browser and server (free delivery judged after the discount, COD fee, tax inclusive or added);
  - order numbers use a per-store prefix; fraud rules are per store;
  - wallet and bank payments need a transaction ID, unique per store.
- **Discount engine:**
  - codes and automatic discounts; percent, fixed or free delivery;
  - start and end dates; usage limits and per-customer limits;
  - scope by product (variants included), category or collection;
  - combinability rules.
- **Marketing consent:** an unticked box. It is recorded on the order and on the customer, for that store only.
- **Saved carts (new):** a signed-in shopper's cart is kept per store on the server and merged after sign-in.

### 2.5 Card payments (new) — `src/lib/payments/*`, `src/app/api/webhooks/stripe/route.ts`
- **How payment works:**
  - Stripe Connect: each merchant is paid into their own account;
  - hosted Checkout, so card data never touches ShopEngine;
  - an idempotency key on every call;
  - an optional platform fee.
- **When an order counts as paid:**
  - only from a verified webhook or reconciliation, and only when amount, currency **and** account match;
  - replays and old events change nothing;
  - an expired or failed checkout cancels the order and puts the stock back.
- **Refunds and recovery:**
  - refunds go from the order screen: managers only, capped at charged minus already refunded;
  - "Pay now" on the thank-you page;
  - housekeeping reconciles checkouts whose webhook never arrived.

### 2.6 Orders, fulfilment, inventory, POS
- Every order status change locks the row and follows a state machine (managers can override). Fulfilment status is derived.
- SKU and option values are snapshotted. Coupon use is counted once and given back once.
- The refund cap is cumulative. POS-return restock is capped at what was sold.
- Locks against races:
  - stock is locked in id order;
  - the admin stock save is locked;
  - purchase receiving is locked.
- The stock count no longer subtracts sales twice.
- POS sales are idempotent; voids are same-day only.
- **Partial shipments (new):**
  - ship any part of an order, each parcel with its own courier and tracking;
  - "Partly shipped" status, and the customer gets a message per parcel;
  - all parcels shipped → Dispatched; all delivered → Delivered; a cancelled parcel's items can be sent again.
- **New on products:**
  - barcode, unique per store and scanned at the POS;
  - product type;
  - unique variant option combinations;
  - a low-stock / sold-out alert to the team.

### 2.7 Notifications and background work
- **Transactional outbox:**
  - events are written in the same transaction as the change;
  - claimed with `SKIP LOCKED`, retried with backoff, dead after 8 attempts;
  - one message per recipient and channel.
- Every email, WhatsApp and SMS caller now queues per store, with the store's own name, links and settings.
- **Found and fixed:** a message that failed to *build* used to be logged and swallowed, so the event was marked sent with nothing in it. It is now retried.
- **Housekeeping runs:**
  - outbox delivery and COD auto-cancel;
  - card reconciliation and the plan lifecycle;
  - per-store alerts and cart reminders (gated by plan);
  - data retention.
- **Merchant webhooks (new):**
  - events: order created / updated / paid, refund created;
  - HMAC-signed and retried via the outbox;
  - private and metadata addresses refused.

### 2.8 Merchant self-service, SaaS billing, platform admin
- **Opening a store** (Account → Stores):
  - needs a confirmed email and Turnstile, within caps and rate limits;
  - reserved names are refused;
  - the store starts as a draft, with the owner's membership and its own settings.
- **Running it:**
  - publish rules;
  - a payment-account link;
  - a custom domain verified by DNS TXT.
- **Invitations:** a one-time token (only its hash is stored), with a 7-day expiry. Only the invited email's own confirmed account can accept. The plan's team limit applies.
- **SaaS billing:**
  - free plans and one trial per store;
  - Stripe subscriptions, prorated changes, cancel at period end;
  - invoice and subscription webhooks;
  - past due → grace (`BILLING_GRACE_DAYS`) → expired, at which point the shop goes offline and `/cms` becomes read-only;
  - the store's team is emailed on a failed payment, an ended trial and expiry. The default store is never affected.
- **Plan limits and features** (`src/payload/entitlements.ts`):
  - limits on products, storage and team;
  - features: POS, reports, discounts, abandoned carts, card payments, custom domain.
- **Platform admin:**
  - overview of stores, merchants and subscriptions, with MRR, 30-day GMV, top stores, failing payments and dead deliveries;
  - status changes are logged;
  - opening a store you're not on the team of is logged in that store's activity log.
- **Store analytics:** new vs returning customers and checkout completion on the dashboard.

### 2.9 Security hardening
- Users can no longer self-promote (run: tenant test).
- Lock-out by strangers is gone. Wrong passwords are limited per (account, network).
- `/cms-api` writes are refused from a foreign Origin. Store sub-domains are "same-site" to browsers, so SameSite cookies alone weren't enough.
- Turnstile on sign-up and store creation.
- `/api/health` no longer lists configuration problems publicly. `/api/products` hides exact stock and sales counts.
- Webhook targets: private addresses are refused. The subscriber CSV neutralises formulas.
- Shoppers can download their own data (`/account/data-export`). Stores export only their own consenting customers (logged).

### 2.10 Infrastructure
- **Migration `20261013_233003_multi_tenancy`** creates the tenant schema, then **backfills**:
  - the default store, made from the shop's own details;
  - every record and version's store;
  - the team works in the default store, and its customers are linked;
  - coupon and fulfilment bookkeeping for past orders;
  - starter plans (placeholder prices – review them).
- **Migration `20261014_003019_store_extras`** adds:
  - barcode and product type;
  - order consent;
  - shipments and the "partly shipped" status;
  - webhook endpoints and saved carts;
  - empty defaults where the original shop's text was stored as a database default.
- **Both migrations follow CI's "migrations only add" rule.**
  - The old lock-out columns are kept, because the previous version reads them during a deploy.
  - Both `down()`s were made tolerant, and up → down → up was run.
- **CI runs on `main`.**
  - Lint is clean.
  - After migrating, it runs tenant isolation, plan lifecycle, partial shipments and order lifecycle against CI's Postgres.
- **Other:**
  - the backup image `sed` is fixed;
  - the Payload CLI works again (no `server-only` import reachable from the config).

### 2.11 Bugs found while verifying (all fixed)
| Bug | How it showed | Fix |
|---|---|---|
| Per-host pages could be cached for one store and served for another | code review of `headers()` handling | `unstable_rethrow` in `src/lib/tenant.ts` |
| `cms_users_rels` column is `cms_stores_id`, not `stores_id` | migration SQL review | raw SQL in `addCustomerOf` fixed |
| Redirect cache cleared the wrong global | code review | `clearRedirectCache` fixed |
| Generated `down()` failed (dropped a constraint after CASCADE) | ran `migrate:down` | `IF EXISTS` in both migrations |
| Migration dropped columns the running version still reads | CI rule applied to the new file | columns kept |
| `/cms-api/stores/mine` collided with Payload's `/stores/:id` (500 for everyone in `/cms`) | admin opened in a browser | endpoints moved to `/cms-api/platform/my-stores` and `/platform/switch-store` |
| Notifications lost when building a message failed | order lifecycle test log | build errors now retry via the outbox |
| Saved cart not restored after signing in (client-side navigation) | two-device browser test | re-check when leaving the sign-in page |

### 2.12 Stores in every country (15 October 2026)

Asked for: "currency for all world not only PKR, time zone according to country, and payment method plugins for
different countries". The original shop keeps **exactly** what it showed before (Rs, Pakistan time, 0300-1234567,
JazzCash / EasyPaisa) – checked by comparing old and new output.

- **Country → currency, time zone, phone code** – `src/lib/locale.ts` (≈190 countries; names from `Intl.DisplayNames`).
  Stores → Region has pickers (`payload/admin/RegionFields.tsx`); choosing a country fills in its currency and time
  zone (both editable). The Stores hook stores ISO codes ("Pakistan" → `PK`), refuses unknown countries, currencies and
  time zones, and a new store without a country is in Pakistan as before. Onboarding (Account → Stores) has the same pickers.
- **Money** – `src/lib/money.ts`: every amount is formatted in the store's currency with its own decimals
  (`$1,234.50`, `€`, 3 decimals for KWD; rupees stay whole numbers, PKR stays "Rs 145,000") and **rounded to the
  currency's smallest unit** everywhere totals are made: checkout and cart (`lib/order-totals.ts`), the Orders hook
  (admin orders used to round to whole units – `59.97` became `60`), coupons, POS, reports. Orders keep the
  **currency they were placed in** (`orders.currency`), so a later currency change never relabels old orders.
  Stripe is charged in the order's currency.
- **Time** – `src/lib/time.ts` replaces the fixed "+5 hours" Pakistan maths in 11 files: order, receipt, return and
  credit-note numbers, "today" in the dashboard, POS day and cash-up, sales / RTO / order reports, message deadlines and
  printed dates all use the store's time zone (daylight saving handled). Checked against the old formula for Pakistan.
- **Phones** – `src/lib/phone.ts`: Pakistan keeps `0300-1234567`; other countries store `+447700900123` (a local number
  gets the store's dialling code). Every form and server action (checkout, account, address book, contact, returns,
  wholesale, trade-in, track order, cart drafts) checks with the store's country; WhatsApp / SMS use international digits.
- **Checkout and addresses** – outside Pakistan the city is typed and there are State / province and Postcode fields
  (stored on the order and saved addresses; shown on invoices, slips, emails). Shipping zones take typed cities, areas
  and postcode starts (`SW1*`) next to the Pakistani city list; the fee tester takes a postcode.
- **Payment methods as plugins** – `src/lib/payments/methods.ts` (one list for the checkout page and the server):
  - built in: Cash on Delivery, bank transfer, card (provider plugin); JazzCash / EasyPaisa only for stores in Pakistan
    (their settings are hidden elsewhere);
  - **the store's own methods** (Settings → Payments → Other payment methods): any wallet or bank app (UPI, M-Pesa, PIX,
    bKash, Zelle …) paid before shipping with receipt + transaction id, or paid on delivery / pickup like COD. Each gets
    a stable id; renaming keeps old orders right. The page suggests what is popular in the store's country.
  - orders keep the method's **name** and **when it is paid** (`paymentMethodLabel`, `paymentDue`); "paid before
    shipping" blocks shipping until approved, for every method (`lib/order-money.ts`).
  - **payment provider plugins** – `PaymentGateway` interface (`lib/payments/gateway-types.ts`), registry
    (`lib/payments/gateways.ts`), Stripe as the first plugin (`lib/payments/stripe-gateway.ts`, countries where Stripe
    onboards businesses; accounts are opened in the store's country). One webhook handler for every provider
    (`/api/webhooks/payments/<provider>`, `/api/webhooks/stripe` kept); refunds and reconciliation go through the
    plugin. How to add Razorpay / Paystack / Mercado Pago …: `docs/PAYMENT-PLUGINS.md`.
- **Everything else that assumed Pakistan** – storefront copy ("all over Pakistan" → "nationwide"), SEO (Open Graph
  locale, `priceCurrency`, shipping country, structured data), product feeds, the `/laptops-in-{city}` pages (Pakistani
  original shop only), courier suggestions and tracking links (DHL, FedEx, UPS, USPS, Aramex, Royal Mail added), the
  shop counter ("Wallet / other" instead of JazzCash / EasyPaisa elsewhere), platform revenue (totals per currency –
  never added across currencies), the abandoned-cart text, and "(Rs)" labels in `/cms`.
- **Migration** `20261015_114028_international` – additive apart from two enum → text changes (marked
  `allow-destructive` with the reason: every value is kept). Backfills stores to ISO codes and every existing order's
  currency, payment name and due time. Run up → down → up on the local database.

## 3. Branding
The platform is **ShopEngine** (admin, login, emails to merchants and staff, 2-step issuer, admin icon). The original shop is the
**default store** and keeps its own name, texts, icons and city pages.

Every other store shows only its own name and details:
- page titles and SEO defaults;
- policy pages (neutral texts until it saves its own – no Saddar, Regal Chowk or "courts of Karachi" wording);
- footer, structured data, feeds, OG images;
- icon (its theme favicon or a neutral bag icon);
- emails to its customers.

Checked on a second store: home title "Acme Gadgets", product title "… | Acme Gadgets", terms "the courts where Acme Gadgets has its place of business", neutral icon, original-shop city pages return 404.

**Kept on purpose:**
- internal `urko-*` keys, so existing carts, settings and 2-step keep working;
- file and export names that the config references.

## 4. Configuration and behaviour changes to know about
- **`EMAIL_FROM`:** the built-in default is now `ShopEngine <no-reply@<site domain>>`. If production relied on the old default, set `EMAIL_FROM` explicitly or SMTP may reject the new sender.
- **Account lock-out:** removed. Payload's `maxLoginAttempts` is 0, and the proxy limits sign-in attempts per account and network instead.
- **Storefront rendering:** pages render per request (correct for multi-store, but slower). The data stays cached per store. If needed, the next step is a `/[store]` route segment so ISR can cache per store again.
- **Admin store endpoints:** `/cms-api/platform/my-stores` and `/cms-api/platform/switch-store` (renamed from `/stores/...` because of the collision above).
- **App icon:** moved from `src/app/icon.svg` and `apple-icon.png` to `public/`. The URLs are unchanged, and icons are now chosen per store in the metadata.

## 5. How it was verified (actually run)

| Check | Result |
|---|---|
| `tsc --noEmit` · `eslint . --max-warnings=0` | clean · clean |
| `vitest run` | **97 / 97** (access rules, routing, availability, Stripe signatures, totals/tax, discounts, plans, outbox; currencies and rounding, store-local days incl. daylight saving, phone numbers from any country, payment methods by country, postcode zones) |
| `npm run test:tenants` (real DB, in CI) | **18 / 18**: own-store reads only; no cross-store writes or creates; no self-promotion or joining other teams; another store's payment settings unreadable and unwritable; same discount code in two stores without interference; merchants can't see other stores' people or delete accounts |
| `npm run test:orders` (real DB, in CI) | **13 / 13**: placed through the checkout's transaction; stock and coupon taken; "order received" queued; status messages once per change; cancel gives stock and coupon back exactly once; repeated cancel changes nothing; re-open takes them again |
| `npm run test:billing` (real DB, in CI) | **7 / 7**: trial end → past due + grace; grace over → expired and offline; default store untouched |
| `npm run test:shipments` (real DB, in CI) | **8 / 8**: can't over-ship; other store can't ship; partly shipped + parcel message; rest → dispatched; parcels delivered → delivered |
| `npm run test:webhooks` (running server, locally signed events) | **17 / 17**: paid only on exact match; replay ignored (also through the provider-plugin address `/api/webhooks/payments/stripe`); unknown provider 404; wrong amount or account never pays; bad or old signature 400; expiry cancels; SaaS invoice failed → past due → paid → active; subscription cancelled |
| `npm run test:store-webhooks` (real DB + local receiver) | **7 / 7**: delivered once and signed; other store gets nothing; failing endpoint retried; private addresses recognised (the test now first removes test endpoints an interrupted earlier run left behind) |
| `npm run test:international` (real DB, in CI) | **26 / 26**: a country name becomes its code and brings currency + time zone; a store without a country is in Pakistan; unknown country / currency / time zone refused; money with cents, the original shop still "Rs"; own payment methods get stable unique ids; checkout offers no Pakistani wallets elsewhere; postcode zones; a dollar order keeps cents, currency, method name, due time and the full address; order numbers use the store's date; "paid before shipping" holds the order, "on delivery" doesn't; admin orders keep cents and get the store's currency |
| Running dev server, a US demo store and the original shop (curl) | the US store's pages show `$`, `en_US`; its shipping page shows its zones in dollars; the original shop still shows `Rs`, `en_PK` and `PKR` |
| Migrations on a DB with legacy-shaped rows | up → down → up; zero rows without a store; team, customers, coupons, fulfilment backfilled |
| Running dev server, two stores (curl) | each store shows only its own categories, products and search; product URLs 404 on the other store; per-store canonical, sitemap, robots, titles and icons; draft store "Opening soon" and disallow; unknown sub-domain 404 |
| Browser – storefront checkout (default store) | coupon applied, free-delivery hint after discount, totals right; order saved with store, coupon counted, stock down, notification sent through the outbox |
| Browser – `/cms` as staff | ShopEngine branding with the store name; dashboard incl. new customer and checkout figures; confirm order; ship items → Shipped → parcel Delivered → order Delivered |
| Browser – saved cart | cart added on device A, signed in on device C → same cart, priced from the catalogue |

## 6. Not verified
- **Not run against third parties:**
  - Stripe's API: checkout creation, Connect onboarding, refunds, subscription checkout. Only the webhook side was run, with locally signed events.
  - Email, WhatsApp and SMS delivery: no provider is configured locally, so messages were built and queued but not sent.
- **Not run here:**
  - GitHub Actions (the workflow wasn't run on GitHub);
  - `next build`;
  - the backup image build;
  - DNS TXT verification on a real domain.
- **Not exercised in a browser:**
  - platform-admin and owner screens (2-step login wasn't automated), apart from the access rules tested through Payload's API;
  - merchant onboarding (Account → Stores).
- **Not re-measured:** mobile layout and page speed (still Not Verified).
- **International work (15 Oct) not seen in a browser:** the browser tool couldn't connect, so the new checkout form,
  the Region / Payments admin pickers and the order screens were checked by type checks, unit / database tests and the
  server's HTML (curl), not by clicking through them.

## 7. Remaining gaps (12 Missing, 45 Partial – see report 12)

**Missing:**
- **Access and permissions:** custom permissions / a granular role builder; platform integrations.
- **Inventory:** multiple inventory locations and stock per location.
- **Themes:** a theme library.
- **Fulfilment:** location-based fulfilment; carrier APIs; return shipping labels.
- **Marketing and analytics:** campaign records; traffic tracking beyond the GA/Meta snippets.
- **Testing:** an automated browser end-to-end suite in CI.

**Notable partials:**
- One currency per store (no conversion or multi-currency prices); a store ships within its own country (the order
  records the country, but checkout has no country picker for shipping abroad).
- A store's language sets number / date formats and the page language; storefront text is English (plus the existing
  Urdu toggle).
- Only Stripe exists as a card provider plugin; stores in countries Stripe doesn't serve (e.g. Pakistan) use their own
  methods, bank transfer and COD until another plugin is added.
- Card payments capture immediately (no separate authorise/capture step).
- COD remittance isn't reconciled.
- Platform revenue is current figures only (no history or charts).
- Rate limits are per server instance.
- The storefront session lasts 30 days.

## 8. Deploying this
1. **Back up the database**, then deploy. The three migrations run on start and backfill existing data
   (`international` turns two enums into text – every value kept).
   - Optional: `DEFAULT_STORE_NAME`, `DEFAULT_STORE_SLUG`, `DEFAULT_STORE_ORDER_PREFIX`.
   - Existing orders keep `UTS-`.
2. **Domains.**
   - Set `PLATFORM_ROOT_DOMAIN`, with a wildcard DNS record and certificate for `*.<root>`.
   - Recommended: serve `/cms` and the main site on a different registrable domain from merchant sub-domains.
3. **Stripe.**
   - Set `STRIPE_SECRET_KEY`.
   - Create two webhook endpoints at `/api/webhooks/stripe` (or `/api/webhooks/payments/stripe`): the platform account → `STRIPE_WEBHOOK_SECRET`; connected accounts → `STRIPE_CONNECT_WEBHOOK_SECRET`.
   - Optional: `PLATFORM_FEE_PERCENT`.
   - In `/cms` → Plans, set each paid plan's Stripe price ids and **review the seeded prices**.
4. **Email.** Set `EMAIL_FROM` explicitly (see §4).
5. **Housekeeping.** Keep the internal timer or `/api/cron` (`CRON_SECRET`). It also delivers the outbox and reconciles payments.
6. **After deploying,** run the five CI database tests against staging, and `npm run test:webhooks` against a staging server.
   - **Never against production:** they create and delete test records.
