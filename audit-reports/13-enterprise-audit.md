# 13 · Enterprise audit, repair and verification (18 Oct 2026)

**Status: IN PROGRESS.** This is the working issue register. It is also the handoff document if the session ends before the work is done.

- Each row's status is one of: **open**, **fixed (not yet verified)**, **fixed + verified (test named)**, or **documented** (not fixed in code; the reason is given).
- Branch: `main`, with everything uncommitted. The user commits their own changes, so no branch was created and nothing was committed.

## Baseline (before this pass)

| Check | Result |
|---|---|
| git | `main`; 80 uncommitted entries (42 modified, 38 new); last commit 09c1a17 |
| `tsc --noEmit` | 0 errors |
| `eslint` | 0 problems |
| vitest | 20 files / 199 tests passing |
| `check-migrations` | ✓ |
| `npm audit` | 23 advisories: 16 high, 7 moderate, 0 critical (all in dependencies of dependencies, see DEP-1) |
| security sweep (`scripts/tests/security-sweep.mjs`, extended this pass) on the production build :3101 | PASSED |
| crawl (`scripts/tests/crawl.mjs`) on :3101 | 48 pages / 58 links; **8 broken links** (CRAWL-1); 6 pages over 3 s when the cache was cold |

## Method

1. Five read-only audit agents ran in parallel:
   - auth journeys (AUTH-*);
   - UI/UX and WCAG 2.2 (UX-*);
   - security and tenant isolation (SEC-*);
   - backend, money and data integrity (DATA-*);
   - performance, infrastructure and deployment (OPS-*).
2. Each finding was then re-checked against the code before any fix.
3. Every fix has a regression test where one can be written: a unit test (vitest), a DB suite on the test database :54339, or a browser check.

## Issue register

### Security and auth

| ID | Sev | Finding | Status |
|---|---|---|---|
| SEC-1 | P1 | SSRF: store integrations ("any SMS provider" send link, custom SMTP host) could call internal addresses, e.g. cloud metadata, and echo the answer back | fixed + verified (`tests/unit/public-request.test.ts`) |
| SEC-1b | P1 | The private-address check (also used by webhooks) missed IPv4 written in IPv6 hex form (`[::ffff:127.0.0.1]` is parsed to `::ffff:7f00:1`), NAT64 and 6to4 | fixed + verified (same test) |
| SEC-2 | P3 | Webhook guard: DNS resolved, then fetch resolved again (DNS-rebinding window); no check when the address is saved | fixed + verified (`test:store-webhooks` delivers through the guard; `tests/unit/public-request.test.ts` – DNS name with an internal address refused at connect) |
| SEC-3 | P3 | Hard-coded fallback secrets when NODE_ENV ≠ production (a public preview deploy would be forgeable) | fixed (a hosted non-production deploy – Railway/Render/Vercel/Fly/Cloud Run variables present – refuses to start without PAYLOAD_SECRET and AUTH_SECRET); local development keeps its fallbacks |
| AUTH-1 | P1 | Password reset didn't end shop sessions (Auth.js renews `iat` on every refresh) | fixed + verified (`tests/unit/session-validity.test.ts`) |
| AUTH-2 | P1 | Shopper password reset / "set your password" always failed (Payload runs the /cms 2-step hook) | fixed + verified (`test:account-security`) |
| AUTH-3 | P1 | `legacyId` writable via the API; storefront looked accounts up by `id OR legacyId` | fixed + verified (`test:account-security`) |
| AUTH-4 | P1 | Owner actions on Account → Stores (publish, plan, payouts, domain) skipped 2-step | fixed + verified (`test:account-security`, step-up checks) |
| AUTH-5 | P2 | Shop sign-in had no per-account limit | fixed (code) |
| AUTH-6 | P2 | 2-step accounts couldn't recover a forgotten password | fixed by AUTH-2 + verified (`test:account-security`) |
| AUTH-7 | P2 | /cms email and password change without re-entering the password | partly fixed: your own email/password change in /cms now emails the OLD address (with a reset link) and records a security event (`test:account-security`); asking for the current password needs a custom Payload account view – remaining |
| AUTH-8 | P3 | 2-step code / backup code reusable under concurrency | fixed + verified (`test:account-security`, race check) |
| AUTH-9 | P3 | Account existence can be told apart (messages/timing) | open |
| AUTH-10 | P3 | Invitation dates editable after creation | fixed (field access) |

### Money and data integrity

| ID | Sev | Finding | Status |
|---|---|---|---|
| DATA-1 | P1 | "Try again" after a failed card start returned the cancelled order as success; cart lost | fixed + verified (`test:orders`: same attempt → same order; changed cart / cancelled attempt → refused; client rotates the attempt id after every failure) |
| DATA-2 | P1 | DB pool can deadlock under burst checkout (lookups outside the open transaction; no pool timeout) | fixed (order data read before the transaction; webhook integration lookup inside it; pool `connectionTimeoutMillis` 10 s + `idle_in_transaction_session_timeout` 60 s) – load test NOT run |
| DATA-3 | P1 | Payment arriving after cancellation accepted silently (and delayed methods cancelled by reconcile) | fixed + verified (`test:payment-integrity`: cancel queues closing the payment page; late payment recorded, order stays cancelled, staff alert, no 'order received', no downloads; reconcile keeps delayed methods pending) |
| DATA-4 | P1 | Refunds can exceed what was paid (two channels capped separately; no lock; non-idempotent integration refunds) | fixed + verified (`test:payment-integrity`: one ledger across returns + provider refunds; beyond-total refused; card refund after cash refunds refused; order row locked; deterministic integration refund ref) |
| DATA-5 | P2 | /cms order edit recalculates total without tax / COD fee; edits on awaiting-payment orders | fixed + verified (`test:payment-integrity`: added tax follows the goods, COD fee kept; awaiting-payment orders can't change their total; a total below the gift-card part is refused) |
| DATA-6 | P2 | COD advance ignores the gift card | fixed (advance on what is due after the gift card, server + checkout form) |
| DATA-7 | P2 | Combined typed + automatic discounts: only the typed code's use is counted | documented – consuming every combined code needs a list of codes on the order (a schema change); remaining |
| DATA-8 | P2 | Concurrent order updates: last writer wins (stock leak on edit vs cancel; shipments lost) | partly fixed (courier sync re-reads the order before writing its parcel – OPS-2); optimistic concurrency for every order save – remaining |
| DATA-9 | P2 | Payment reconciliation can stall; orphan awaiting-payment orders hold stock | fixed + verified (`test:payment-integrity`: orphaned awaiting-payment orders cancelled by housekeeping, open payments left alone; both reconcilers rotate rows by updatedAt) |
| DATA-10 | P2 | SaaS billing webhooks applied without an ordering check | fixed (subscription events read the live subscription when Stripe is set up; a late 'payment failed' after the invoice was paid is ignored) – not tested against Stripe |
| DATA-11 | P2 | Webhook event store turns any DB error into "duplicate" + 200 | fixed (only a real duplicate answers 200; DB errors → 500 so the provider retries; in-flight event → 503; 'processed' never overwritten) – HTTP test pending |
| DATA-12 | P2 | POS accepts change larger than the cash tendered; several cash lines mis-recorded | fixed + verified (`test:pos-payments`) |
| DATA-13 | P2 | Outbox can send the same message twice (100-event claim, 10-minute re-claim) | fixed (each event's claim is checked and renewed before sending; status updates only by the claim's owner) – no dedicated race test |
| DATA-14 | P2 | Partial-shipment parcels each default to the whole COD amount; bookings can be orphaned | fixed (later parcels default to the cash still due; a booking that can't be saved is cancelled at the courier or named for manual cancel) – no courier-API test |
| DATA-15 | P2 | Pending refunds counted as done; failed refunds never noticed | documented – needs refund status from the providers (Stripe refund webhooks / polling); the ledger counts pending refunds so nothing is refunded twice; remaining |
| DATA-16 | P2 | Cancelling a paid order needs no refund decision | fixed (cancelling a paid / advance-paid order: owner or manager only, and the team gets a 'refund due' alert) |
| DATA-17 | P3 | Deleting an open order doesn't return gift card / coupon use | fixed + verified (`test:gift-cards`: deleting an open order puts its gift-card payment back; coupon use released) |
| DATA-18 | P3 | `addStock` floors at 0 (backorders owed are lost) | fixed + verified (`test:preorders`: receiving 1 while 2 are owed leaves 1 owed; a count never goes below 0 or below what was owed) |
| DATA-19 | P3 | Loyalty points kept after a return | fixed + verified (`test:loyalty`: a return after the points became a voucher leaves them owed – balance below 0 – and no new voucher until earned back); the account page shows the negative balance as is |
| DATA-20 | P3 | `stockHeld` / `attemptId` writable by staff | fixed (`stockHeld`, `attemptId`: create/update access false) |
| DATA-21 | P3 | Deleting a store orphans its records | fixed + verified (`test:tenants`: a store with products – or POS sales, gift cards, online payments, loyalty accounts, units – can't be deleted) |
| DATA-22 | P3 | Refund rounding breaks 3-decimal currencies | fixed for provider-plugin refunds (currency decimals); Stripe path unchanged |
| DATA-23 | P3 | Unbounded queries / N+1 in request paths | open |
| DATA-24 | P3 | Reused payment reference shows a generic error | fixed (a clash on the transaction id at save time answers "already used" on its field) |
| DATA-25 | P3 | SQL errors swallowed inside transactions | open |

### Infrastructure, performance and deployment

| ID | Sev | Finding | Status |
|---|---|---|---|
| OPS-1 | P1 | The production build still runs migrations against the live DB (parallel, no lock) | fixed (`prodMigrations` off when SHOPENGINE_BUILD / NEXT_PHASE build / SKIP_MIGRATIONS); see note under Remaining – a release whose pages need new columns at build time now fails the build instead of migrating |
| OPS-2 | P1 | Courier tracking / COD sync stops platform-wide once ~200 finished orders exist | fixed + verified (`test:courier-sync`: finished parcels not picked; failing courier rotates) |
| OPS-3 | P1 | Whole-catalogue cache entry exceeds Next's 2 MB limit at ~1,000–1,500 products; every order expires it | partly fixed (no Markdown conversion in the snapshot; related products as ids; >1.5 MB warning; orders/POS/returns refresh in the background) – splitting the snapshot is remaining work |
| OPS-4 | P1 | Redirect upkeep reads/writes other stores' redirects (cross-tenant) | fixed + verified (`test:tenants`: B's redirects untouched, A gets its own; both checks fail on the old code) |
| OPS-5 | P2 | In-process caches, rate limits and timers: not safe with several replicas | documented (DEPLOYMENT.md: run exactly one web replica until caches, limits and timers are shared) |
| OPS-6 | P2 | Oldest-first starvation: cart reminders, stock/price alerts, gateway reconciliation | fixed (reminders and stock/price alerts page through candidates with a cursor, up to 10 pages a run; reconcilers rotate – see DATA-9) – no dedicated test |
| OPS-7 | P2 | One store's events expire every store's caches | fixed (per-store catalogue tags for questions, purchases, stock counts, returns, media, flash sales) |
| OPS-8 | P2 | No DB pool / statement / idle-in-transaction timeouts | partly fixed (pool `connectionTimeoutMillis` 10 s, `idle_in_transaction_session_timeout` 60 s – DATA-2); `statement_timeout` / migration `lock_timeout` – remaining |
| OPS-9 | P2 | Outbox double-send; housekeeping has no time budget | partly fixed (no double send – DATA-13); a time budget per housekeeping chore – remaining |
| OPS-10 | P2 | `/api/stats` lets the public fill `shop_stats` (NULL store rows) | fixed (no store → nothing stored; unknown product ids ignored) |
| OPS-11 | P2 | Admin/report endpoints load whole tables into memory | open |
| OPS-12 | P2 | Backups miss `downloads/` and `labels/` | fixed (`downloads` and `labels` added to the backup's private folders) – backup job not run |
| OPS-13 | P2 | The build needs the public DB URL; secrets passed as build args | open |
| OPS-14 | P2 | CI/deploy gates: no "wait for CI", no Docker build, no dependency audit, some suites not in CI | partly fixed (CI: security sweep against the built server, dependency advisories reported, new DB suites); 'Wait for CI' on Railway and a Docker image build are deployer steps – remaining |
| OPS-15 | P2 | `CLIENT_IP_HEADER` trust is unsafe as documented | documented (DEPLOYMENT.md: only with the origin locked down; custom domains aren't behind Cloudflare) |
| OPS-16 | P2 | Image optimisation (AVIF) on the shop server; no CDN cache | open |
| OPS-17 | P2 | HSTS `includeSubDomains; preload` sent on merchants' custom domains | fixed (`includeSubDomains; preload` only on PLATFORM_ROOT_DOMAIN hosts, plain HSTS elsewhere; PLATFORM_ROOT_DOMAIN passed to the Docker build) |
| OPS-18 | P3 | No storefront HTML caching (tenant resolution uses `headers()`) | open |
| OPS-19 | P3 | Health check shallow; uptime monitor on the same provider | partly fixed (no full user count per probe); deeper checks and an external monitor – remaining |
| OPS-20 | P3 | Proxy caches have no single-flight | fixed (one load at a time for the proxy's store list and each store's redirects) |
| OPS-21 | P3 | Build args / docs drift (Sentry sample rate, SKIP_MIGRATIONS) | fixed (SKIP_MIGRATIONS implemented; NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE and PLATFORM_ROOT_DOMAIN are Docker build args; docs corrected) |
| OPS-22 | P3 | Migration "additive only" check is regex-only | open |
| OPS-23 | P3 | Blog posts cached as one entry per store | open |
| OPS-24 | P3 | Image preview object URLs never revoked | fixed (`FilePreview` releases its object URL) |
| OPS-25 | P3 | S3 client without timeouts; 304 path downloads the whole file | partly fixed (S3 client: 5 s connect / 60 s request timeouts); the 304 path still opens the object (it is cancelled at once) – remaining |
| DEP-1 | P2 | 23 npm advisories (20 in production dependencies: 13 high, 7 moderate, 0 critical) – all in dependencies of Payload (sass/chokidar/braces dev watchers, drizzle-kit/esbuild migration tooling, find-node-modules, csv-parse in the staff-only import plugin) and Prisma (deepmerge-ts). npm's suggested fixes are major downgrades | documented (no dependency changes allowed this pass; CI now reports advisories) |

### Storefront and UX

| ID | Sev | Finding | Status |
|---|---|---|---|
| CRAWL-1 | P2 | 8 broken links on /about and /installments (hard-coded laptop categories and a blog post) | fixed (links only to what the store has) – re-crawl pending |
| CRAWL-2 | P2 | 404 page listed hard-coded laptop categories in every store | fixed (store's own top categories) |
| UX-1 | P1 | Phone checkout/cart: "Place order" covered by the WhatsApp button / cookie notice; bar under the iPhone home bar | fixed (bar at `--mobile-nav`, floats lifted) – browser check pending |
| UX-2 | P2 | Light theme: status text contrast | fixed (light-theme `light:text-*-700/800` variants on checkout, cart, account, track-order, buy box and status text) |
| UX-3 | P2 | Invoice-in-another-name fields required but not validated | fixed (client validation of the invoice name/address/city/tax id/postcode with the server's rules; per-field aria; billing + gift card in FIELD_ORDER) |
| UX-4 | P2 | "Cash on Delivery" promised when COD is off | fixed (checkout, cart page, cart drawer and hero claim COD only when the store offers it; the product card's "COD available" removed – no client-side COD flag) |
| UX-5 | P2 | Failed shipping quote silently ignored | fixed (failed delivery quote: message + Retry; placing the order waits for a quote) |
| UX-8 | P2 | "Buy Now" adds to an existing line | fixed (Buy Now sets the chosen quantity; hitting the stock/limit shows "Only N in stock") |
| UX-9 | P2 | Pagination overflows at 360 px | fixed (phones: first · current · last; wraps as a fallback; 44 px prev/next) |
| UX-10 | P2 | Mega menu: no Escape / outside click | fixed (Escape returns focus to the trigger; outside click / focus leaving closes; Tab order bridged into the mega panel) |
| UX-17 | P2 | Forms clear input on a server error | fixed (login, register, reset, forgot, contact, return, warranty, trade-in, Q&A, alerts keep what was typed – onSubmit + startTransition, no-JS POST kept) |
| UX-18 | P2 | Confirmation page celebrates cancelled / unpaid orders | fixed (cancelled / unpaid / cancelled-but-paid / refunded heroes and tab titles; no "Confirm on WhatsApp" for them) |
| UX-20 | P2 | "Stores" tab for every shopper | partly fixed ("Manage stores" with its own icon, last in the nav); showing it only to merchants needs a lookup on every account page – remaining |
| UX-21 | P2 | Wishlist says empty when loading fails | fixed ("Couldn't load your saved items" + Retry, count kept) |
| UX-22 | P2 | Search swallows API errors | fixed (errors shown with Try again; stale results cleared; result count announced) |
| UX-23 | P2 | Urdu toggle marks the whole page as Urdu | open (needs the translated strings marked `lang="ur"` instead of the whole page – remaining) |
| UX-30 | P2 | Cancel plan without confirmation; undefined colour tokens | fixed (cancel plan needs a confirmation tick; undefined colour tokens replaced with brand / fg tokens) |
| UX-31/32 | P2 | Order panel / card payments: no loading or error state; silent refund errors | fixed (order + after-sales panels: loading and failed-with-retry states; payments: load error ≠ 'no payment'; network errors on refund / parcels reported) |
| UX-33 | P2 | "Block this number" confirm semantics inverted | fixed (explicit choice 1 / 2, Cancel changes nothing; network errors reported) – a proper dialog is P3 |
| UX-34 | P2 | POS shows zeros when loading fails | fixed (failed loads say so with a retry; cash-up can't be saved until the day's figures loaded) |
| UX-19 | P3 | "Pay now" had no pending state | fixed ("Opening payment page…", disabled while pending) |
| UX-6,7,11–16,24–29,35–40 | P3 | Smaller UX / accessibility items (see the agent report) | open – remaining |

Full agent reports (evidence, file:line): saved during the session to the scratchpad file `agent-reports.md`. The register above is the durable copy.
