# ShopEngine — the engine that powers shops
# 11 · Remediation log (what was fixed and built after the audit)

**Baseline:** the audit in reports 00–10 describes commit `aab6879`. This log describes the **working tree on top of it** (not committed),
14 October 2026, with the international work of 15 October 2026 (§2.12), the integrations of 16 October (§2.14) and the "fix all" pass of 17 October (§2.15). Every claim below was checked by reading the code; where it says "run", it was actually run. Nothing here was run against
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
| Unit tests | 40 pass (asserting insecure behaviour) | **199 / 199 pass** (17 Oct; secure behaviour, money, tax, pre-orders, gift cards, loyalty, downloads …) |
| Database / server tests | none | **17 suites, 223 checks, all pass** (17 Oct, §5) – all of them in CI, plus a browser test of checkout |

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
| **Every store's settings pages (Delivery, Payments, Theme, Store details …) answered "Nothing found" for owners and managers** | owner of a second store opened Settings → Payments in a browser (15 Oct) | the per-store settings collections were marked `admin.hidden`, and Payload 404s every page of a hidden collection; now not hidden (the custom menu only shows its own links) – `src/payload/store-settings.ts` |
| Admin orders rounded to whole units (`59.97` → `60`) | US-store database test (15 Oct) | totals rounded to the order currency's smallest unit |
| A new store created without a country got no country / currency / time zone; a country change didn't move the time zone when the admin sent every field | US-store database test (15 Oct) | Stores hook uses `operation`, and "changed" means "different from before" |
| Store webhook test counted deliveries left over from an interrupted earlier run | test run (15 Oct) | the test first removes stale test endpoints |
| Shipping fee tester started with "Lahore" / 12000 on a store abroad | admin opened in a browser (15 Oct) | untouched fields follow the store's country once it has loaded |

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
- **Delivering abroad (16 Oct)** – Settings → Delivery → "Also deliver to" (names or codes, kept as ISO codes, unknown
  ones refused) and a **Countries** list per zone (a zone without countries is for the store's own country). Checkout
  then shows a country picker; phone, city list / typed city, state and postcode follow the chosen country; delivery
  charge, free-delivery limit and estimate come from that country's zones; the server refuses a country the store
  doesn't deliver to. Addresses abroad name their country on order pages, emails, invoices and packing slips; the
  shipping-policy page lists the countries; the fee tester has a country choice.
- **Shop counter** – each sale records its currency (receipts keep it if the store's currency changes later).
- **Migrations** `20261015_114028_international` – additive apart from two enum → text changes (marked
  `allow-destructive` with the reason: every value is kept); backfills stores to ISO codes and every existing order's
  currency, payment name and due time. `20261016_000546_pos_currency` – one new column, backfilled with each store's
  currency. Both run up → down → up on the local database.

### 2.13 ShopEngine marketing website (16 October 2026)

Asked for: a premium marketing website and landing page for ShopEngine, using the brand's own logos, with no invented
customers, metrics, ratings, prices or certifications.

- **Where it shows** – only on the addresses in `MARKETING_HOSTS` (opt-in; unset = nothing changes). `src/proxy.ts`
  serves `src/app/(marketing)/shopengine/*` at normal paths there. `/account/*`, `/cms`, the APIs and files pass through.
  Store addresses get a 404 for `/shopengine/*`. On a marketing address, account pages run in "platform mode": ShopEngine
  name, logo and favicons, dark theme like the website, and merchant copy on sign-up and sign-in (no shopper benefits, no phone field).
- **Pages** –
  - home: hero with an HTML/SVG dashboard picture labelled "Illustrative data", problem, 12 features with previews,
    multi-store diagram, 4 steps, audiences, security, pricing, roadmap (labelled planned), FAQ, call to action;
  - `/features`, `/pricing` (real active plans from `/cms` → Plans; without plans, names only and no prices);
  - `/solutions/{multi-store,retail,agencies}`, `/how-it-works`, `/security`, `/about`;
  - `/contact` (validated, honeypot, Turnstile, rate limit; saved as a store-less contact message, optionally emailed
    to `PLATFORM_CONTACT_EMAIL`);
  - `/blog` and 3 articles, `/faq` (searchable), `/privacy`, `/terms`, branded 404.
- **SEO** – per-page title, description and canonical (`MARKETING_SITE_URL`), Open Graph and Twitter cards with a social
  card built from the logo. JSON-LD: Organization, WebSite, SoftwareApplication (no offers or ratings), BreadcrumbList,
  Article; FAQPage on `/faq` only. Marketing `/sitemap.xml` and `/robots.txt`; noindex on the 404 and on staging.
- **Design (redesigned the same day at the owner's request: "not modern")** –
  - dark theme lit by the logo's blue → violet, Geist type, floating glass navigation;
  - hero with a tilting product picture and live-event cards; payment-method and currency rows that scroll on their own;
  - figures band – every number counted from the code (12 features, 180+ countries from `COUNTRY_CODES`), checked by a test;
  - bento feature grid with a small product picture per feature (also on `/features`); animated store → engine diagram;
  - security rings, a monthly / yearly pricing switch (saving computed from the real plan prices), a big wordmark footer;
  - motion: CSS only; scroll effects only where the browser supports them; none at all with "reduce motion"
    (content always visible). Code: `marketing.css`, `components/marketing/{bento,pricing,sections,dashboard-mockup}.tsx`.
- **Admin branding** – `/cms` logo, nav icon and favicons now use the real mark (`public/brand/shopengine/`).
- **Copy corrected against the code while writing** – one owner per store (changed by support), so agencies are invited
  as managers; trial length is per plan (can be 0), so "free trial on every plan" isn't claimed; plan changes and
  cancellations happen under "Your stores".
- **Tests** – `tests/unit/marketing.test.ts`: host matching, pass-through paths, every sitemap address has a page,
  content integrity, no banned claims, and the store-less inbox can't be triggered by a signed-in user.
- **Verified** – `tsc`, `eslint . --max-warnings=0`, `vitest` 111/111 and `next build` (exit 0; marketing pages
  pre-rendered) – re-run after the redesign. Every route checked on `localtest.me:3100` with `MARKETING_HOSTS=localtest.me`, desktop and 390 px
  phone width in headless Chrome: no console errors, no sideways scrolling, menus work with the keyboard, FAQ search
  works, and the contact form validates, saves with no store, and the test record was deleted. Store addresses
  (`localhost:3100`, `usdemo.localtest.me:3100`) unchanged.
- **Not verified** – real email delivery to `PLATFORM_CONTACT_EMAIL`; Turnstile with real keys; Lighthouse scores; a
  real domain or HTTPS. `/privacy` and `/terms` are plain-language starting texts and **need a legal review**. No
  analytics are wired on the marketing site.

### 2.14 Integrations for store owners and the Store API (16 October 2026)

Asked for: the integrations store owners need – couriers, online payments, WhatsApp / SMS / email, a store API with
webhooks, marketing tools, accounting, live chat and marketplaces – "do all these". Full guide: `docs/INTEGRATIONS.md`.

- **Foundation** – `/cms` → Integrations (search, kinds, connect window with the provider's steps).
  - Keys are AES-256-GCM encrypted; the admin only ever sees the last 4 characters.
  - Roles: the owner for money and sending identity; managers for the rest.
  - Rules per integration: plan feature, countries, one of each kind, a check on save.
  - Each store and provider gets a random address for webhooks and payment returns.
  - Store events reach integrations through the outbox, retried.
  - Code: `src/lib/integrations/*`, collection `integrations`, migration `20261016_031120_integrations`.
- **40 integrations:**
  - **Couriers (9):** PostEx, Leopards, TCS, Trax, M&P, Call Courier, Shippo, EasyPost, DHL Express.
    - From the order panel: book, label, tracking.
    - Tracking is followed automatically; COD payouts are checked; parcels can be marked returned.
    - Migration `20261016_035623_store_api_shipments` adds the shipment columns and the "returned" value.
  - **Payment gateways with the store's own account (11):** Safepay, JazzCash, Easypaisa, PayFast (PK), PayPal, Razorpay, Paystack, Flutterwave, Mercado Pago, Tap, PayTabs.
    - They are checkout methods with the same rules as Stripe: paid only when ShopEngine asks the provider with the store's keys for its own reference and the amount and currency match.
    - A failure or an abandoned page cancels the order (stock back). Refunds go through the provider where it has an API.
    - Providers opened with a form POST go through a page of ours whose CSP allows only that provider.
    - The thank-you page, tracking label and order panel now say "online payment".
  - **Messaging (8):** WhatsApp Cloud API (the store's number and templates); Twilio, Africa's Talking, branded SMS (PK) and any HTTP SMS gateway; Resend, Brevo and SMTP.
  - **Ads (4):** Google Tag Manager, Google Ads, Meta Conversions API, TikTok.
  - **Email marketing (2):** Mailchimp, Klaviyo. Klaviyo also gets "Started Checkout" from abandoned carts with an email.
  - **Live chat (2):** tawk.to, Crisp.
  - **Accounting (2), signed in with ShopEngine's app:** QuickBooks Online (a sales receipt per sale) and Xero (an invoice plus its payment). A sale is booked when paid online or delivered, never twice.
  - **Marketplaces (2), signed in with ShopEngine's app:** Daraz and Amazon (merchant-fulfilled stock only).
    - Every 30 minutes, marketplace orders come off the store's stock (cancelled ones go back).
    - Then the store's stock (and prices) is sent, matched by SKU.
- **Store API** (`/api/v1`, `docs/STORE-API.md`) – keys are made by the owner in Integrations → Store API.
  - A key is shown once and only its SHA-256 hash is kept.
  - Four permissions; 120 requests a minute per key; refused while the store is read-only.
  - Endpoints: products (list / one / update stock and price, written to Stock history) and orders (list / one / status with the staff rules).
  - Collection `api-keys`; same migration as above.
- **CSP** – the shop's policy now allows the scripts and connections of Google Ads, TikTok, tawk.to and Crisp. `/api/integrations/*` has its own stricter policy.
- **Verified:**
  - `tsc` and `eslint src tests scripts/tests next.config.ts`: clean.
  - `vitest`: **146 / 146**, including 35 integration tests with the providers' published test vectors (JazzCash, Razorpay and Daraz signatures) and computed examples (Easypaisa, PayFast).
  - `npm run test:integration-payments`: **passed, 22 checks**, on the real database with providers simulated – PayPal pay → capture → paid → refund; a wrong amount never pays; JazzCash's form page; a failed payment cancels; a forged Paystack update refused, a signed one pays; another store's address can't settle; an abandoned page cancelled by housekeeping.
  - Re-run after the changes: `test:orders`, `test:shipments`, `test:tenants`, `test:international`, `test:billing`, `test:store-webhooks` – all passed.
  - Store API against the dev server: 30 checks passed – keys, scopes, other store's product / order → 404, stock and price changes written to history, wrong order moves → 409, revoke.
  - Headless Chrome: the Integrations page with its Online payments and Store API tabs (desktop and 390 px); PayPal offered at a US store's checkout once switched on.
  - **`next build`: exit 0** (compiled; 69 pages generated; `/api/v1/*` and `/api/integrations/*` in the route list).
- **Not verified:** no integration has been run against the provider's real sandbox or live API (no accounts). All show "New" and ask owners to test first.
  - **Unconfirmed in the providers' documentation** (each listed in `docs/INTEGRATIONS.md`): Daraz quantity format and token lifetimes; Amazon's Orders v0 deprecation date and marketplace references; PayFast's status service for hosted merchants; JazzCash and Easypaisa notification formats; Safepay's signed webhook bytes.
  - **Not built:** BlueEx (its API host does not resolve).
- **Test data note:** `npm run test:stock` still passes both stock checks, but its clean-up fails. Product #1 in the local test database is published without photos, and an existing rule refuses to save it. This is unrelated to this work, and its stock was left as it was.

### 2.15 The "fix all" pass (17 October 2026)

After a gap analysis ("what else is missing"), the owner asked to fix everything: launch safety first, then quick wins,
then merchant features. Not committed – the working tree, as before.

**Launch safety and operations**
- **Browser test of the money path** (`scripts/tests/e2e-checkout.mjs`, `npm run test:e2e` after `test:e2e:seed`):
  real headless Chrome, desktop and phone, product → cart → checkout → order → thank-you page, plus gift cards (part
  and whole), a pre-order with a company invoice, a loyalty voucher and a digital download. In CI against a production
  build; the browser helper (`scripts/tests/lib/chrome.mjs`) now gives up on stuck calls instead of hanging.
- **Backup and restore drill in CI**: the backup image is built, a dump restored into a fresh database and every
  table's row count compared (`scripts/tests/compare-restore.mjs`).
- **Configuration checks** (`src/lib/config-warnings.ts`): settings that only work together, number ranges, minimum
  secret lengths in production, URL and email formats.
- **Logging**: server errors go through the structured logger (events, not `console.error`); Sentry trace sampling
  and source-map upload are configurable (`SENTRY_*`, see `docs/DEPLOYMENT.md`).
- **Migrations run when the server starts** (no longer during the build; `MIGRATE_DURING_BUILD=true` keeps the old
  way); shopper sign-ins last `SHOPPER_SESSION_DAYS` (default 14).
- **Platform admin**: 12-month history (orders, revenue per currency, invoices, stores); integration overview;
  "view a store as its team" for support (reason required, 30 minutes, recorded); alerts to ShopEngine's team for
  failed plan payments and stores closed by their owner (`PLATFORM_ALERT_EMAILS`).
- **Security events** (Platform → Security events): sign-ins, wrong passwords, 2-step changes, lockouts, support views –
  with shortened addresses, kept 180 days.
- **Store owners**: download all of the store's data (one JSON file, secrets left out) and close the store themselves
  (typed confirmation; data kept).
- **Integrations**: marketplace syncs can't run twice at once and record their result ("Last sync …", **Sync now**);
  courier cash payouts mark delivered cash-on-delivery orders Paid; QuickBooks / Xero also book refunds.
- **Storefront**: the header no longer scrolls sideways between 800 and 1,920 px; product, category, brand and blog
  pages render per store (they returned 500 in production); the first screen of the home page appears at once.

**Merchant features**
- **Delivery methods and weight pricing**: a zone can offer Express etc. (own price, free-above, delivery time) and
  charge per kg above an included weight; checkout asks for the method, the order keeps it.
- **Gift cards** (Marketing → Gift cards): codes with a balance, emailed to the recipient if wanted; pay all or part of
  an order (the balance is taken in the order's transaction – never spent twice); cancelling gives it back, re-opening
  takes it again; online payments are for what is left; shown on the order page, receipts, invoices and the Store API.
- **Pre-orders and backorders** (Product → When sold out): keep selling when sold out, or take pre-orders with a ship
  date; stock goes below 0 (units owed), the order's lines say "ships later"; the shop counter never oversells; stock
  counts keep what is owed; shopping feeds and search data say preorder / backorder.
- **Unsubscribe**: "stop reminders" and the email app's one-click Unsubscribe (`List-Unsubscribe`) put the shopper on the
  store's Unsubscribed list (Marketing → Unsubscribed); cart reminders and the subscribers export skip them; ticking
  "send me offers" at checkout takes them off again.
- **Flash sales with "% off"**: optional start time and discount; the shop, the cart and checkout charge the sale price
  while it runs and go back by themselves (housekeeping refreshes the catalog when a sale starts or ends).
- **Tax per product and company invoices**: Normal / Reduced / Exempt per product (Settings → Payments → Reduced rate);
  each line taxed at its rate, discounts shared out; invoices show one line per rate. Checkout: "Invoice in another
  name" (company, VAT / tax number, address) – on the invoice (Bill to / Deliver to), the order page and in /cms.
- **Loyalty points** (Settings → Installments & reminders → Loyalty points; Marketing → Loyalty points): signed-in
  customers earn points when an order is delivered (taken back if it comes back), turn them into a voucher (a gift card
  in their name) on their account page and pay with it at checkout; managers can correct a balance with a reason.
- **Stock value report** (Reports → Stock value, owners): stock at cost and at today's prices, how long it has gone
  without selling, slow movers.
- **Shop funnel** (Reports → Shop funnel, managers): product views → added to cart → checkout → online orders, by day and
  product – counted by the shop itself, no cookies and nothing about the person.
- **Collections**: "Show from" / "Show until" dates (seasonal collections appear and go by themselves).
- **Digital products** (Catalog → Digital files; Product → Digital product): private files; once an order is paid the
  customer gets signed, counted, expiring download links on the order pages and by email; a cart of downloads only
  pays no delivery.
- **Per-store caches**: an order, a shop sale or a product / collection edit in one store refreshes that store's
  catalog only (before, every store's).

**Bugs found while testing (fixed)**
- The **product edit page was blank** for anyone working in a store: the version history was queried with a plain
  `store` filter that versions can't use (`readVersions` now filters `version.store` – products, posts, pages, store
  settings). Guarded by `npm run test:versions`.
- A courier booking for an order partly paid by gift card would have asked the rider for the full total.
- With pre-orders: a stock count would have wiped the units owed, and a product with units owed couldn't be saved.
- The funnel first counted orders typed in by the team as online orders.

**Verified (run)** – see §5.

**Not done** (still open – see §7): a custom role builder, storefront translations, prices in several currencies,
stock per location, subscriptions, separate authorise / capture, return labels, marketplace orders as ShopEngine
orders, back-filling email tools, theme drafts (themes keep a version history with restore), a search index for very
large catalogs.

## 3. Branding
The platform is **ShopEngine** (admin, login, emails to merchants and staff, 2-step issuer, admin logo and icon – the brand's own artwork in `public/brand/shopengine/` since 16 October). The original shop is the
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
| **17 Oct:** `tsc --noEmit` · `eslint . --max-warnings=0` · `vitest run` | clean · clean · **199 / 199** |
| **17 Oct:** all 17 database suites (`test:tenants`, `orders`, `billing`, `shipments`, `international`, `stock`, `store-webhooks`, `integration-payments`, `platform-ops`, `gift-cards`, `preorders`, `unsubscribe`, `stock-value`, `loyalty`, `shop-funnel`, `versions`, `digital`) | **all pass – 223 checks, 0 failures** |
| **17 Oct:** `next build` (production) | **exit 0**; `/download/[token]`, `/api/stats`, `/api/unsubscribe/cart/[token]` in the route list |
| **17 Oct:** browser test on the production build (`npm run test:e2e`, headless Chrome) | **77 / 77**: desktop + phone checkout, gift card part / whole, pre-order + company invoice, loyalty voucher from the account page, a digital download (link downloads the file, no delivery charge) |
| **17 Oct:** `/cms` screens as a store owner on the production build (`scripts/tests/admin-smoke.mjs`) | **14 / 14** load without errors: gift cards (list, new), loyalty points, unsubscribed, stock value, product (Pricing & stock), flash sale, loyalty + tax settings, shop funnel, digital files, collection dates, an order with "Invoice to" |
| **17 Oct:** live on the dev server | flash sale 10 % → product page Rs 1,350, orders charged 1,350, price back 26 s after the sale ended; an order in one store refreshed only that store's catalog (another store kept its cached price); cart reminders: unsubscribed shopper not reminded, the control reminded, one-click POST stopped a cart; the reminder email carried `List-Unsubscribe` + `List-Unsubscribe-Post` (local mail sink) |
| `tsc --noEmit` · `eslint . --max-warnings=0` | clean · clean |
| `vitest run` | **101 / 101** (access rules, routing, availability, Stripe signatures, totals/tax, discounts, plans, outbox; currencies and rounding, store-local days incl. daylight saving, phone numbers from any country, payment methods by country, postcode zones, zones per country and addresses abroad) |
| `npm run test:tenants` (real DB, in CI) | **18 / 18**: own-store reads only; no cross-store writes or creates; no self-promotion or joining other teams; another store's payment settings unreadable and unwritable; same discount code in two stores without interference; merchants can't see other stores' people or delete accounts |
| `npm run test:orders` (real DB, in CI) | **13 / 13**: placed through the checkout's transaction; stock and coupon taken; "order received" queued; status messages once per change; cancel gives stock and coupon back exactly once; repeated cancel changes nothing; re-open takes them again |
| `npm run test:billing` (real DB, in CI) | **7 / 7**: trial end → past due + grace; grace over → expired and offline; default store untouched |
| `npm run test:shipments` (real DB, in CI) | **8 / 8**: can't over-ship; other store can't ship; partly shipped + parcel message; rest → dispatched; parcels delivered → delivered |
| `npm run test:webhooks` (running server, locally signed events) | **17 / 17**: paid only on exact match; replay ignored (also through the provider-plugin address `/api/webhooks/payments/stripe`); unknown provider 404; wrong amount or account never pays; bad or old signature 400; expiry cancels; SaaS invoice failed → past due → paid → active; subscription cancelled |
| `npm run test:store-webhooks` (real DB + local receiver) | **7 / 7**: delivered once and signed; other store gets nothing; failing endpoint retried; private addresses recognised (the test now first removes test endpoints an interrupted earlier run left behind) |
| `npm run test:international` (real DB, in CI) | **29 / 29**: delivery countries typed as names are kept as codes, unknown ones refused; an address abroad uses its country's zone (else the default charge), never a home zone; a country name becomes its code and brings currency + time zone; a store without a country is in Pakistan; unknown country / currency / time zone refused; money with cents, the original shop still "Rs"; own payment methods get stable unique ids; checkout offers no Pakistani wallets elsewhere; postcode zones; a dollar order keeps cents, currency, method name, due time and the full address; order numbers use the store's date; "paid before shipping" holds the order, "on delivery" doesn't; admin orders keep cents and get the store's currency |
| Running dev server, a US demo store and the original shop (curl) | the US store's pages show `$`, `en_US`, `USD` and "Price in the United States"; its shipping page shows its zones in dollars; 25 of its pages scanned – no Pakistan, Karachi, JazzCash, courier or rupee wording left; the original shop still shows `Rs`, `en_PK`, `PKR` and its "all over Pakistan" wording |
| Browser (headless Chrome) – `/cms` as the US demo store's owner (2-step sign-in) | Stores → Region: United States / USD – US Dollar / America/New_York pickers; Settings → Payments: no JazzCash / EasyPaisa, "Popular ways to pay: Zelle, Venmo, Cash App", Stripe offered, own methods "Zelle · before shipping" and "Card on delivery · on delivery"; Settings → Delivery: typed places (`New York`, `100*` …), no Pakistani city picker, zone row "New York City · $4.99 · 4 places", fee tester with Postcode and `$`; Orders list `$84.98 · Card on delivery · +12125550199`; order page: address "Brooklyn, NY 11201", money in `$`, "Rider collects $84.98", method / due / currency fields (USD), timeline in New York time; dashboard in `$`; no console errors |
| Browser (headless Chrome) – delivering abroad (16 Oct) | the US store's owner added "Canada" through the admin API (kept as `CA`) with a Canada zone; checkout showed "We deliver to the United States and Canada" and a country picker; Toronto M5V 2T6 → Canada zone $14.50, 4–7 working days, total $74.49; confirmation "Toronto, ON M5V 2T6, Canada"; a country slipped into the form that the store doesn't deliver to (France) was refused by the server |
| Shop counter API as the US store's owner (16 Oct) | a sale with a 25¢ discount → total $149.25, currency USD, "Wallet / other" payment; a cash sale of $149.50 for $150 → change $0.50; receipt numbered by the New York date; both voided |
| Browser (headless Chrome) – checkout of the US demo store | phone hint `+1 …`, typed city + State + Postcode, payment options Bank Transfer / Zelle / Card on delivery (no JazzCash), Zelle shows its account and the store's memo instruction, Brooklyn 11201 matched the NYC zone ($4.99, next day), total $84.98; order `BKG-…` placed with Card on delivery; confirmation shows "Brooklyn, NY 11201", "Card on delivery · Unpaid", "Please keep $84.98 ready when your order arrives"; no console errors |
| Migrations on a DB with legacy-shaped rows | up → down → up; zero rows without a store; team, customers, coupons, fulfilment backfilled |
| Running dev server, two stores (curl) | each store shows only its own categories, products and search; product URLs 404 on the other store; per-store canonical, sitemap, robots, titles and icons; draft store "Opening soon" and disallow; unknown sub-domain 404 |
| Browser – storefront checkout (default store) | coupon applied, free-delivery hint after discount, totals right; order saved with store, coupon counted, stock down, notification sent through the outbox |
| Browser – `/cms` as staff | ShopEngine branding with the store name; dashboard incl. new customer and checkout figures; confirm order; ship items → Shipped → parcel Delivered → order Delivered |
| Browser – saved cart | cart added on device A, signed in on device C → same cart, priced from the catalogue |

## 6. Not verified
- **Not run against third parties:**
  - Stripe's API: checkout creation, Connect onboarding, refunds, subscription checkout. Only the webhook side was run, with locally signed events.
  - Email, WhatsApp and SMS delivery: no provider is configured locally, so messages were built and queued but not sent.
  - None of the 40 store integrations (§2.14) against its provider's real API.
- **Not run here:**
  - GitHub Actions (the workflow wasn't run on GitHub);
  - the backup image build;
  - DNS TXT verification on a real domain.
- **Not exercised in a browser:**
  - platform-admin screens (2-step login isn't automated; the 17 Oct owner screens were checked with 2-step sign-in switched off locally);
  - merchant onboarding (Account → Stores).
- **17 Oct features, not run against real services:** the downloads email and the gift card / reminder emails were
  built and caught by a local mail sink (no provider); digital files were stored on local disk, not in the S3 bucket;
  `List-Unsubscribe` was not tried in Gmail / Outlook; the shop funnel was fed by test traffic only; GitHub Actions
  (the new CI steps – browser test, backup drill, the new database suites) has not run on GitHub.
- **Not re-measured:** mobile layout and page speed (still Not Verified).
- **Payload's own date fields** ("Placed", "Last modified") show the viewer's computer time, not the store's time zone
  (the order panel's timeline and all reports, numbers and messages do use the store's).

## 7. Remaining gaps (12 Missing, 45 Partial – see report 12)

> Report 12's counts were made before §2.14. Three of its "Missing" items now have built (provider-unverified) code: platform integrations, carrier APIs and accounting / marketplace links. The counts were **not re-scored**.

**Missing:**
- **Access and permissions:** custom permissions / a granular role builder; platform integrations.
- **Inventory:** multiple inventory locations and stock per location.
- **Themes:** a theme library.
- **Fulfilment:** location-based fulfilment; carrier APIs; return shipping labels.
- **Marketing and analytics:** campaign records. (Traffic tracking: the shop's own funnel since 17 Oct.)
- **Testing:** (an automated browser test of checkout is in CI since 17 Oct – not yet run on GitHub.)
- **Still open after 17 Oct:** a custom role builder; storefront translations; prices in several currencies; stock per
  location; subscriptions; separate authorise / capture; return labels; marketplace orders as ShopEngine orders;
  back-filling email tools; theme drafts (themes have a version history with restore); a search index for very large
  catalogs.

**Notable partials:**
- One currency per store (no conversion or prices in several currencies); shoppers abroad pay in the store's currency.
- A store's language sets number / date formats and the page language; storefront text is English (plus the existing
  Urdu toggle).
- Stripe is the only provider on ShopEngine's own platform account. Since §2.14, stores can also connect their own gateway
  accounts (Safepay, JazzCash, Easypaisa, PayFast in Pakistan; PayPal, Razorpay, Paystack, Flutterwave, Mercado Pago,
  Tap, PayTabs elsewhere). None has been tried against a live provider yet.
- Card payments capture immediately (no separate authorise/capture step).
- COD remittance: the payouts of connected couriers are read and shown per parcel (§2.14), but they aren't matched
  against bank statements.
- Platform revenue is current figures only (no history or charts).
- Rate limits are per server instance.
- The storefront session lasts `SHOPPER_SESSION_DAYS` (default 14 since 17 Oct).

## 8. Deploying this
1. **Back up the database**, then deploy. The four migrations run on start and backfill existing data
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
   - It also follows courier parcels, settles store-connected payment pages that expired, and runs marketplace syncs.
6. **Integrations (optional).** Integrations that sign in with the provider's page need ShopEngine's own app keys:
   - QuickBooks, Xero, Daraz and Amazon (`docs/DEPLOYMENT.md`, `.env.example`). Without them, those cards say "not switched on yet".
   - Store-connected payment gateways send shoppers back to the store's own HTTPS address.
   - Migrations `20261016_031120_integrations` and `20261016_035623_store_api_shipments` are additive.
7. **17 Oct migrations** (all additive, run on start): security events, support view, shipping methods, gift cards,
   pre-orders, unsubscribed, flash-sale discount, tax classes + billing, loyalty points, shop stats, collection dates,
   digital products. New optional settings: `PLATFORM_ALERT_EMAILS`, `SHOPPER_SESSION_DAYS`, `SENTRY_TRACES_SAMPLE_RATE`,
   `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT`, `MIGRATE_DURING_BUILD` (`docs/DEPLOYMENT.md`). Digital files
   go to the bucket under `downloads/` – never served by `/media`.
8. **After deploying,** run the CI database tests against staging, and `npm run test:webhooks` against a staging server.
   - Also `npm run test:integration-payments`: it creates and removes its own connections and orders.
   - **Never against production:** they create and delete test records.
