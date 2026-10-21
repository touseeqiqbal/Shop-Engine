# 13 · Enterprise audit, repair and verification (18–19 Oct 2026)

**Status: COMPLETE (three passes).** Every check in section F ran on the final code (after the third pass); the readiness verdict is in section J. The issue register is below sections A–J; the third pass has its own table just before it. Each "remaining" or "open" row is real, open work.

- Each row's status is one of: **open**, **fixed (not yet verified)**, **fixed + verified (test named)**, or **documented** (not fixed in code; the reason is given).
- Branch: `main`. The user commits their own changes, so no branch was created and nothing was committed.
  - The first pass is in the user's commit `04a1f87`.
  - Everything after it is uncommitted: the REG-1/REG-2 fixes, the whole second pass and the whole third pass (`git status` shows it).

## A. Executive summary

**Who this is for:** the shop's owner and developers.

**What was audited:** five audit agents went through the whole app – security and tenant isolation, sign-in for every role, UX and WCAG 2.2, money and data integrity, and infrastructure.
- **Findings:** 110, in 109 register rows (UX-31/32 share one row).
- **Two passes:**
  - **First pass (18–19 Oct):** every P1 except part of OPS-3, plus most P2s.
  - **Second pass (19 Oct):**
    - OPS-3: the catalogue cache is now split into parts;
    - DATA-8: order saves no longer overwrite each other;
    - DATA-15: refunds that fail later at the provider are noticed;
    - DATA-7: combined discounts both count as used (one additive migration);
    - DATA-25: database errors inside a save are no longer hidden;
    - AUTH-9: sign-up and sign-in no longer reveal which emails exist;
    - more infrastructure items;
    - every smaller P3 UX item.
  - **Third pass (19 Oct):** a code review of the second pass (10 findings, all fixed), then four new audits – the API surface, SaaS / multi-store flows, integrations and notifications, and money arithmetic. **75 new rows** (6 P1, 23 P2, 46 P3), in the table "Third pass" below section J. All 6 P1s are fixed; 3 of them have a test.

**Most serious problems fixed in the third pass:**
- **Unlimited password guessing (API-1):** a URL-encoded sign-in path (`/cms-api/users/%6Cogin`) skipped every sign-in rate limit.
- **Wrong card amounts (INT-1):** Stripe charged and refunded 3-decimal currencies (KWD, BHD, OMR, JOD, TND) at a tenth of the amount.
- **Taking over a domain (SAAS-1):** changing a custom domain while "Verify" waited on DNS could verify another store's sub-domain, or the main site, for the attacker.
- **Paid plans for free:**
  - a new store could stay "trialing" with no plan, unlimited, for ever (SAAS-2);
  - the annual cycle of a plan whose annual price was left at 0 activated the paid plan free (SAAS-3).
- **Other stores' drafts readable (SAAS-4):** draft preview wasn't tied to the store being previewed, so drafts and unpublished stores of other stores could be read.

**Most serious problems fixed in the first two passes:**
- **Store settings could reach the platform's internal network (SEC-1).** A store's integration settings could make the server call internal addresses, such as the cloud metadata service, and return the answer.
- **Sign-in and accounts:**
  - shopper password reset always failed (AUTH-2);
  - a reset didn't end old sessions (AUTH-1);
  - account ids could be set by the account itself (AUTH-3);
  - owner actions on Account → Stores skipped 2-step (AUTH-4).
- **Money:**
  - refunds could total more than was paid (DATA-4);
  - a payment arriving after cancellation was accepted silently (DATA-3);
  - "try again" after a failed card start lost the cart and showed a cancelled order (DATA-1);
  - a burst of checkouts could exhaust the database pool (DATA-2);
  - two saves of the same order overwrote each other and leaked stock (DATA-8).
- **Operations:**
  - the build migrated the live database (OPS-1);
  - courier tracking stopped for everyone after about 200 finished orders (OPS-2);
  - one store's page renames changed other stores' redirects (OPS-4);
  - a big catalogue was silently left uncached (OPS-3).
- **UX:** on phones, the WhatsApp button covered "Place order" (UX-1).

**Verification:**
- Rows marked "fixed + verified" name the test that checks them; it ran on the final code.
- Rows marked only "fixed" were type-checked, linted and covered by the full test run, but have no dedicated test.
- Section F lists what was not run.
- The final production build passed every check in section F. For that run the catalogue was cut into 3-product parts, so every page used the new split cache.
- Two regressions the second pass introduced were caught by those checks and fixed (REG-1, REG-2).
- The third pass's full run caught one regression of its own (stores looked closed to the cart-reminder job when it ran from a script). It was fixed before the final run.

**Verdict: Conditionally ready** (section J). The large-catalogue condition from the first pass is gone. The third pass adds two conditions: the open P2 payment-plugin items (INT-2, INT-6, INT-7, INT-8) and a Stripe test of the plan changes (SAAS-8).

## B. Issues fixed (by severity)

Counted from the register rows below.

| Severity | Register rows | Fixed + verified by a test | Fixed (no dedicated test) | Partly fixed | Documented / open |
|---|---|---|---|---|---|
| P1 | 16 | 13 | 3 (DATA-2, OPS-1, UX-1) | 0 | 0 |
| P2 | 49 | 11 | 30 | 4 (AUTH-7, OPS-11, OPS-14, OPS-16) | 4 (OPS-5, OPS-15, DEP-1 documented; OPS-13 open) |
| P3 | 44 | 8 | 31 | 3 (UX-26, UX-36, UX-39) | 2 open (DATA-23, OPS-18) |

**Third pass** (counted from the "Third pass" table; MONEY-1 is the same finding as INT-1 and has no row of its own):

| Severity | Rows | Fixed + verified by a test | Fixed (no dedicated test) | Partly fixed | Open |
|---|---|---|---|---|---|
| P1 | 6 | 3 (INT-1, SAAS-4, API-1) | 3 (SAAS-1, SAAS-2, SAAS-3) | 0 | 0 |
| P2 | 23 | 3 (CR-1, MONEY-3, MONEY-5) | 14 | 1 (SAAS-7) | 5 (INT-2, INT-6, INT-7, INT-8, MONEY-7) |
| P3 | 46 | 0 | 14 | 2 (API-10, API-15) | 30 |

## C. Security findings

| ID | Sev | Status |
|---|---|---|
| SEC-1/1b | P1 | Server requests to internal addresses blocked on the address actually connected to, including IPv4 written inside IPv6; no redirects followed. Tested (`tests/unit/public-request.test.ts`) |
| SEC-2 | P3 | Webhooks use the same guard, so DNS rebinding no longer works; addresses checked when set or changed |
| SEC-3 | P3 | A hosted non-production deploy without real secrets refuses to start |
| AUTH-1…10 | P1–P3 | All fixed except AUTH-7, which is partly fixed: the old address gets a notice, but there is no re-authentication yet |
| Tenant isolation | – | `test:tenants`: 21 checks, including redirects and stores that still own records |
| Dependencies | P2 | 20 production advisories (13 high, 0 critical), all in Payload's and Prisma's own dependencies. Not changed, because dependency changes weren't allowed; CI reports them |
| API-1 (third pass) | P1 | URL-encoded sign-in path skipped the rate limits. Fixed + verified: unit test, and on the production build 22 encoded attempts → 20 × 401 then 429 |
| SAAS-1, SAAS-4 (third pass) | P1 | Custom-domain verification race, and draft preview across stores. Both fixed; SAAS-4 has a unit test |
| API-2, SAAS-5/6/9, INT-17 (third pass) | P2–P3 | A Store API key could cancel paid orders; plan features and seat limits were bypassable; read-only stores were editable; the integration test endpoint skipped the owner-only check. All fixed |
| API-6, API-8, API-15 (rest), SAAS-10, SAAS-13 (third pass) | P3 | Open: X-Forwarded-Host for OAuth redirects (exploitability NOT VERIFIED), raw SQL errors in responses, /2fa/reset without step-up, no `no-store` on private JSON, offline stores' catalogues readable, edit locks readable across stores |

**Checked and found sound by the security agent:** cross-tenant reads and writes, field access on the new collections, privilege escalation, file serving, SQL and HTML injection, open redirects, webhook signatures and replay protection, rate limits, and that no secrets are committed.

## D. UI/UX and accessibility

- **Fixed:** every UX finding (P1–P3), REG-1 and CRAWL-1/2.
- **Partly fixed:**
  - UX-26: error toasts don't pause on hover;
  - UX-36: the admin search has no listbox pattern;
  - UX-39: "missing photos" can't be a list filter.
- **Browser checks that ran:**
  - `test:e2e` on desktop and phone, 77/77;
  - the admin screens, 16/16, including the reports, POS and order panel;
  - a crawl of every storefront page;
  - screenshots of the changed report screens, which show data.
- **NOT checked in a browser:**
  - the light-theme contrast;
  - mega-menu keyboard use;
  - pagination at 360 px;
  - the hero pause button;
  - focus traps and the WhatsApp popup;
  - the sticky-bar overlap on a real phone.

  The browser devtools connection failed this session; these need a manual look.

## E. User journey matrix

| Journey | Result |
|---|---|
| Shopper: browse → cart → checkout (COD, gift card, pre-order, digital download) → confirmation | ✓ `test:e2e` (desktop + phone), on the split catalogue cache |
| Shopper: sign up / sign in / password reset (old sessions end, link single-use) | ✓ `test:account-security` |
| Shopper: card payment → provider webhook → paid; replay / forged / expired | ✓ `test:webhooks` (19) |
| Shopper: retry after a failed card start; a typed code with an automatic discount | ✓ `test:orders` |
| Store team: 2-step sign-in, reset with 2-step, step-up for plan/domain/payout/publish | ✓ `test:account-security` |
| Store team: orders – cancel, re-open, edit (totals), two saves at once, returns and refunds (incl. a refund failing later), shipments, courier sync | ✓ `test:orders`, `test:payment-integrity`, `test:webhooks`, `test:shipments`, `test:courier-sync` |
| Store team: POS sale and cash-up | ✓ `test:pos-payments`; screen ✓ admin smoke |
| Store team: gift cards, loyalty, pre-orders, stock counts | ✓ `test:gift-cards`, `test:loyalty`, `test:preorders` |
| Owner: plan billing events | ✓ `test:billing`, `test:webhooks` |
| Another store / anonymous visitor: no access to private data or staff routes | ✓ `test:tenants`, security sweep |
| Platform admin | ✓ `test:platform-ops` |

## F. Testing results (final code, 19 Oct 2026 – third pass)

| Check | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| `eslint` (whole project) | 0 problems |
| vitest | 27 files / **224 tests** passed (second pass 217; baseline 199) |
| DB suites on the test database (21 suites) | **21/21 passed, 287 checks**. In the full run `test:unsubscribe` failed once: a regression of this pass, which was fixed and that suite re-run (11/11). One of its checks (a later cart gets no reminder) can't run from a script, because the job needs the server's cache. It was skipped the same way in the second pass, and the suite prints the skip |
| Migration check (`check-migrations`) | passes (no new migration in the third pass) |
| Production build (`next build`) | exit 0 |
| Browser checkout `test:e2e` (production build, catalogue cut into 3-product parts) | **77/77** |
| Payment webhooks `test:webhooks` (production build) | **19/19** |
| Security sweep (production build) | **passed** |
| Crawl (production build) | 48 pages, 54 links, 2 images – **0 problems** |
| Encoded sign-in probe, API-1 (production build) | 22 attempts at `/cms-api/users/%6Cogin` → **20 × 401, then 429** |
| Admin smoke (headless Chrome, store owner, production build) | **passed**: sign-in + 14 screens, including the POS, an order, the reports and the settings |
| Media 304 (production build, disk storage) | matching ETag → 304 with no body; stale ETag → 200 (second pass; not re-run) |
| `npm audit --omit=dev` | 20 advisories (13 high, 7 moderate, 0 critical) – first pass; not re-run because no dependency changed |

**NOT run:**
- a load test (DATA-2, DATA-8 under real concurrency – both have single-race DB tests);
- any live provider: Stripe, couriers, SMS, SMTP;
- S3 (the 304 path was checked on disk storage only);
- the backup job;
- a Docker image build;
- the visual checks listed in D;
- the sign-in timing equalisation (AUTH-9), which wasn't measured;
- third pass:
  - the Stripe subscription changes (SAAS-8) and the 3-decimal currency amounts (INT-1) against real Stripe – INT-1 has a unit test only;
  - custom-domain verification (SAAS-1) against real DNS;
  - the preview cookie (SAAS-4) in a browser across two stores;
  - CR-1's lock checked by its DB test only, not under load.

## G. Database and infrastructure

- **One additive migration:** `20261019_080158_combined_discounts` adds one column and one index to orders. It is applied to the test database, and runs automatically when the new server starts.
- **Database pool:**
  - `connectionTimeoutMillis` 10 s;
  - `idle_in_transaction_session_timeout` 60 s;
  - `lock_timeout` 30 s.
- **Order integrity:** every order save locks its row and refuses a stale write; database errors inside a save are no longer swallowed.
- **Migrations and the build:**
  - migrations no longer run during the build;
  - `SKIP_MIGRATIONS` works;
  - the migration check also catches type changes, `NOT NULL`, and dropped indexes, constraints and defaults.
- **Caching:**
  - the catalogue is cached as an index plus parts;
  - blog posts are cached per post;
  - each store's events refresh only that store's caches;
  - orders refresh the catalogue in the background.
- **Images:**
  - WebP only;
  - optimised images kept for 31 days;
  - the media route answers 304 without fetching the file.
- **Health probe:** also reports dead and late messages and when housekeeping last ran.
- **Housekeeping:** sends queued messages first and gives the slow chores a time budget.
- **Headers and build arguments:**
  - HSTS `includeSubDomains; preload` only on the platform's own domain;
  - `PLATFORM_ROOT_DOMAIN` and the Sentry rate are Docker build arguments.
- **Backups:** include digital product files and courier labels.
- **S3:** requests have timeouts.
- **DEPLOYMENT.md now says:**
  - run **exactly one web replica**;
  - which variables are built into the image;
  - when `CLIENT_IP_HEADER` is safe to use;
  - which Stripe events to subscribe to;
  - to cache `/_next/image` at the CDN.
- **CI now runs:**
  - 3 new DB suites;
  - the security sweep and the crawl against the built server;
  - a dependency-advisory report.

## H. Remaining work (prioritised)

**From the third pass (most urgent first):**
1. **Payment plugins (P2):**
   - INT-7: refund retries can double-refund on Razorpay, Paystack and Flutterwave;
   - INT-8: a connection in test mode settles real orders as Paid;
   - INT-6: plugin refunds that end "pending" are never settled;
   - INT-2: PayPal (HUF, TWD) and Mercado Pago (COP) reject their own rounded amounts as a mismatch.
2. **MONEY-7 (P2):** tax is spread over all lines when a coupon covers only some products.
3. **SAAS-7 (P2, rest):** integration syncs and storefront write actions still run for closed stores.
4. **API (P3):**
   - API-8: raw SQL error messages are returned to callers;
   - API-15 (rest): /2fa/reset without step-up, no `no-store` on private JSON, no limits on heavy endpoints;
   - API-6: OAuth redirects trust X-Forwarded-Host;
   - API-7: weak input bounds give 500s;
   - API-3, API-4, API-9, API-11, API-14.
5. **The other open P3 rows of the third-pass table:**
   - money: MONEY-9…12 and MONEY-15…19;
   - multi-store: SAAS-10…15;
   - integrations: INT-10, INT-11, INT-12, INT-14, INT-15, INT-16;
   - API-10: rate limits on /feed-image.

**From the first two passes:**

1. **OPS-5 (P2):** shared cache, rate limits and job timers, and a lock on migrations at start. Until then, run one replica.
2. **OPS-13 / OPS-14 (P2):** a build that needs no database; Railway "Wait for CI"; a Docker build in CI.
3. **AUTH-7 (P2):** ask for the current password to change the email or password in /cms (needs a custom account view).
4. **OPS-11 / DATA-23 (P2/P3):** aggregate reports in SQL and stream exports. Ranges are already capped at a year.
5. **OPS-16 (P2):** an external image service, if the single server's CPU becomes the limit.
6. **OPS-18 (P3):** per-host HTML caching of storefront pages (an architecture change: the host as a route segment).
7. **P3:** UX-26 (pause on hover), UX-36 (listbox pattern), UX-39 (a "missing photos" flag on products).
8. **DEP-1:** follow up the advisories when Payload and Prisma release fixed versions.

## I. Changed files

**First pass:**
- **Security and network:**
  - `src/lib/net/public-request.ts` (new), `src/lib/webhooks.ts`;
  - `src/lib/integrations/{http.ts,providers/sms.ts,providers/email.ts}`;
  - `src/payload/collections/webhooks.ts`, `src/lib/startup-checks.ts`;
  - `next.config.ts`, `Dockerfile`, `scripts/docker-build.sh`.
- **Sign-in:**
  - `src/auth.ts`, `src/lib/auth.ts`, `src/lib/session-validity.ts` (new), `src/lib/account-email.ts`;
  - `src/lib/cms/{sales,catalog-source}.ts`, `src/payload/fields.ts`;
  - `src/payload/collections/{Users,StoreMemberships}.ts`, `src/payload/endpoints/two-factor.ts`;
  - `src/app/(frontend)/(store)/account/{actions.ts,stores/actions.ts,stores/page.tsx}`.
- **Money and data:**
  - `src/payload/refunds.ts` (new), `src/lib/payments/{index,webhook}.ts`, `src/lib/integrations/payments.ts`, `src/lib/billing.ts`;
  - `src/payload/endpoints/{payments,pos,inventory}.ts`;
  - `src/payload/collections/{content,aftersales,Stores,inventory,engagement,Media}.ts`;
  - `src/payload/{downloads,stock,loyalty}.ts`, `src/lib/{outbox,outbox-handlers,housekeeping,engagement-jobs}.ts`;
  - `src/app/(frontend)/(store)/checkout/actions.ts`.
- **Operations:**
  - `src/payload.config.ts`, `src/payload/{slug-redirects,revalidate}.ts`;
  - `src/lib/integrations/couriers.ts`, `src/lib/repo/{catalog,redirects}.ts`, `src/lib/storage.ts`;
  - `src/app/api/{stats,health}/route.ts`;
  - `scripts/backup/backup.sh`, `docs/DEPLOYMENT.md`, `.github/workflows/ci.yml`, `package.json`.
- **UX:** storefront components; `src/hooks/use-sticky-bar.ts`; `src/components/ui/file-preview.tsx`; the about, installments, not-found and order-confirmation pages; the admin order, after-sales and POS panels.

**Second pass:**
- **New files:**
  - `src/lib/catalog-parts.ts`, `src/payload/tx-errors.ts`;
  - `src/components/account/account-nav-context.tsx`;
  - `src/migrations/20261019_080158_combined_discounts.{ts,json}`.
- **Changed:**
  - `src/lib/repo/catalog.ts`, `src/lib/cms/{site,sales}.ts`;
  - `src/payload/{stock,downloads,revalidate}.ts`;
  - `src/payload/collections/{content,Users}.ts`;
  - `src/lib/payments/{index,stripe-gateway}.ts`;
  - `src/lib/{auth,storage,housekeeping,store-tenant,webhooks,types}.ts`;
  - `src/app/media/[...key]/route.ts`, `src/app/api/health/route.ts`;
  - `src/payload/endpoints/{sales-report,orders}.ts`;
  - `src/app/(frontend)/(store)/{checkout/actions.ts,account/layout.tsx,account/actions.ts,order-confirmation/actions.ts}`;
  - `src/components/providers/preferences.tsx`, `src/components/account/account-ui.tsx`;
  - `src/payload.config.ts`, `next.config.ts`, `src/payload-types.ts`.
- **UX (29 files):**
  - storefront: layout, checkout, product, product-detail, account, home components; `src/store/ui.ts`; the account order page;
  - admin: TopActions, POS, AdminProviders, integrations, the reports, stock counts, platform, security, dashboard; `custom.css`.
- **Tooling, tests and docs:**
  - `scripts/ci/check-migrations.mjs`, `docs/DEPLOYMENT.md`;
  - `tests/unit/{catalog-parts,tx-errors}.test.ts`;
  - `scripts/tests/{order-lifecycle,payment-integrity,payment-webhooks.mjs}`.

**Third pass:**
- **New files:**
  - `src/lib/canonical-path.ts`, `src/lib/preview-cookie.ts`;
  - `tests/unit/{canonical-path,preview-cookie,stripe-amounts}.test.ts`.
- **Payments and money:**
  - `src/lib/payments/{index,stripe,stripe-gateway}.ts`, `src/lib/money.ts`;
  - `src/payload/collections/{content,aftersales}.ts`;
  - `src/payload/endpoints/pos.ts`;
  - `src/app/(frontend)/(store)/checkout/actions.ts`;
  - `src/components/checkout/{checkout-form,cart-view}.tsx`, `src/components/layout/cart-drawer.tsx`.
- **SaaS and tenancy:**
  - `src/payload/collections/{Stores,StoreMemberships}.ts`;
  - `src/lib/{store-tenant,billing,tenant,engagement-jobs}.ts`;
  - `src/payload/endpoints/store-data.ts`, `src/app/api/preview/route.ts`;
  - the storefront home, `pages/[slug]` and `[category]/[product]` (layout and page).
- **API and auth:**
  - `src/proxy.ts`, `src/lib/auth.ts`;
  - `src/app/api/v1/orders/[orderNumber]/status/route.ts`;
  - `src/app/{media,feed-image}/[...key]/route.ts`;
  - `src/payload/endpoints/{integrations,marketing}.ts`.
- **Integrations and operations:**
  - `src/lib/integrations/{http,couriers}.ts`, `src/lib/notify.ts`, `src/lib/cms/notify-settings.ts`;
  - `src/lib/{housekeeping,catalog-parts}.ts`, `src/app/api/health/route.ts`;
  - `src/components/product-detail/variant-picker.tsx`.
- **Tests:** `scripts/tests/{payment-integrity,order-lifecycle}.ts`.

## J. Readiness assessment: **Conditionally ready** for a production review

**Ready:**
- every P1 is fixed: 13 of 16 from the first two passes have a test, and 3 of the 6 found in the third pass do;
- money paths, order integrity, tenant isolation, sign-in and the main shopper journeys are tested on a production build;
- the catalogue now caches at any size.

**Conditions before going live:**
1. Run **one** web replica (OPS-5).
2. Set `PAYLOAD_SECRET`, `AUTH_SECRET`, S3 and `PLATFORM_ROOT_DOMAIN` at **build** time too.
3. Turn on Railway "Wait for CI" and take a `pg_dump` before deploying. This release contains one additive migration, applied when the new server starts.
4. Subscribe the Stripe connected-accounts webhook to the refund events (DEPLOYMENT.md).
5. Do the manual visual checks listed in D.
6. Test once against real Stripe, courier and email providers in a staging environment. This must include:
   - a KWD (or other 3-decimal) charge and refund;
   - a plan upgrade, a downgrade to free, and a store closing (SAAS-8);
   - a custom-domain verification.
7. Fix the open third-pass payment-plugin P2s (INT-2, INT-6, INT-7, INT-8) before switching on PayPal, Mercado Pago, Razorpay, Paystack or Flutterwave for live stores. Until then, only Stripe and the offline methods are in the verified set.

**Not production-ready** for running several replicas until OPS-5 is done.

### Third pass (19 Oct): code review of the second pass, and new audits

| ID | Sev | Finding | Status |
|---|---|---|---|
| CR-1 | P2 | `settleRefund` read the refund's status before any lock – two events for one failure took it off twice | fixed + verified (`test:payment-integrity`: the same failure reported twice at once is taken off once) |
| CR-2 | P2 | A refund Stripe refused at once was still counted as refunded | fixed (refused → an error to staff, nothing recorded) |
| CR-3 | P2 | Sign-up with a known email sent a reset email every time (inbox flooding, a user's own reset link replaced) | fixed (one per address per 30 minutes; honest message when sending fails) |
| CR-4 | P3 | `expectStatus` no longer checked when no transaction is open | fixed (falls back to the status as read) |
| CR-5 | P3 | Refund webhook events stored without their store | fixed (the connected account's store) |
| CR-6 | P3 | Variant values reached via the auto-switch weren't shown as sold out | fixed |
| CR-7 | P3 | Cart quantity "+" enabled above the 10-per-item cap | fixed (drawer and cart page) |
| CR-8 | P3 | Housekeeping's outbox report lost the first send's failures | fixed |
| CR-9 | P3 | Catalogue build sharing expired during a long build (the whole catalogue loaded twice) | fixed (shared while running and 10 s after) |
| CR-10 | P3 | Health route duplicated the database helper | fixed |
| INT-1 | P1 | Stripe charged / refunded 3-decimal currencies (KWD, BHD, OMR, JOD, TND) at a tenth of the amount | fixed + verified (thousandths, last digit 0; `tests/unit/stripe-amounts.test.ts`) – same as MONEY-1 |
| INT-2 | P2 | PayPal (HUF, TWD) / Mercado Pago (COP) charge a rounded amount, then reject the payment as a mismatch | open |
| INT-3 | P2 | A mismatched payment is dropped silently and its order later auto-cancelled | fixed (a mismatched payment alerts the team; the orphan sweep leaves its order alone) |
| INT-4 | P2 | Messages through a store's own channel dropped (marked sent) on a network error instead of retried | fixed (network trouble / timeouts are retried; only the provider's own refusals are final) |
| INT-5 | P2 | On a transient error, store B's messages fall back to the original shop's identity / inbox | fixed (no fallback to the original shop's identity: a store that can't be looked up makes the message retry) |
| INT-6 | P2 | Provider-plugin refunds that end "pending" are never settled | open |
| INT-7 | P2 | Refund retries can double-refund on Razorpay, Paystack, Flutterwave | open |
| INT-8 | P2 | A connection in test mode settles real orders as Paid | open |
| INT-9 | P2 | "Cancel parcel" for couriers without a cancel API cancels only in ShopEngine | fixed (a courier without a cancel API: refused, with what to cancel by hand) |
| INT-10 | P3 | COD remittance marks Paid without checking the amount | open |
| INT-11 | P3 | Reconcile never gives up on a charge whose status check keeps failing | open |
| INT-12 | P3 | Shipment messages ignore the store's notification settings | open |
| INT-13 | P3 | Unreadable notification settings treated as "everything on" | fixed (unreadable settings make the message retry instead of switching everything on) |
| INT-14 | P3 | Call Courier collects at least Rs 1 on prepaid parcels | open |
| INT-15 | P3 | WhatsApp "Save & test" assumes a Pakistani number | open |
| INT-16 | P3 | Klaviyo "Started Checkout" ignores the store's opt-outs (impact NOT VERIFIED) | open |
| INT-17 | P3 | The integration "test" endpoint skips the owner-only role check | fixed (= API-15: owner-only integrations are tested by the owner; a write gate) |
| MONEY-2 | P2 | Gift-card balances with fractions the currency can't hold become unusable (rounding up past the balance) | fixed (a gift card pays at most its balance rounded DOWN to the currency's unit – server and checkout) |
| MONEY-3 | P2 | A refunded return's amount can be raised afterwards with no limit | fixed + verified (`test:payment-integrity`: a refunded return's amount / method / items can't be changed) |
| MONEY-4 | P2 | Returns against POS receipts / unlinked returns have no running refund total | fixed (returns of one shop-counter receipt together are capped at the sale's total, receipt row locked) |
| MONEY-5 | P2 | Per-item refund limit ignores the order discount | fixed + verified (`test:payment-integrity`: an item of a 50%-off order can't be refunded at full price) |
| MONEY-6 | P2 | A POS sale can record no payment (`1e400` → Infinity passes the checks; DB behaviour NOT VERIFIED) | fixed (only finite numbers count at the POS) |
| MONEY-7 | P2 | Tax spread over all lines when a coupon covers only some products | open |
| MONEY-8 | P2 | Downloads-only orders can use cash on delivery and pay the COD fee | fixed (downloads-only carts: no pay-on-delivery methods – checkout form and server) |
| MONEY-9 | P3 | After one "total changed" rejection the stale total is sent forever | open |
| MONEY-10 | P3 | Combinable discounts can add up to more than the items they cover | open |
| MONEY-11 | P3 | Free-delivery automatic discounts valued at 1 | open |
| MONEY-12 | P3 | Variant upgrades differ between product page and server | open |
| MONEY-13 | P3 | Checkout's "to pay" rounded to 2 decimals whatever the currency | fixed (the currency's own rounding for "to pay") |
| MONEY-14 | P3 | Free-delivery progress bar uses the amount before the discount | fixed (the cart page's bar measures after the discount) |
| MONEY-15 | P3 | Tax added on top missing from order emails / account order page; PDF "Paid" ignores the gift card | open |
| MONEY-16 | P3 | Loyalty points not reduced for partial refunds | open |
| MONEY-17 | P3 | Refund limit follows the edited order total, not what was paid | open |
| MONEY-18 | P3 | Orders typed in /cms get no tax or COD fee | open |
| MONEY-19 | P3 | Checkout doesn't check the flash-sale end time | open |
| SAAS-1 | P1 | Custom-domain verification race: change the domain while verify waits on DNS → another store's sub-domain or the main site is verified for the attacker | fixed (verify is a compare-and-set on the domain AND token that were checked; ShopEngine's own domains – platform root and its sub-domains, marketing hosts, the main site – can't be a custom domain) |
| SAAS-2 | P1 | Paid plan with no trial (or a failed plan call) leaves a new store "trialing" with no plan – unlimited, for ever | fixed (a new store starts "expired" until its plan is really set; a store without a plan gets no paid features) |
| SAAS-3 | P1 | Annual cycle of a plan with `priceAnnual` 0 (the default) activates the paid plan for free | fixed (a 0 price is free only when the plan costs nothing on both cycles) |
| SAAS-4 | P1 | Draft preview isn't tied to the previewer's stores – other stores' drafts and unpublished stores readable | fixed + verified (the preview cookie is signed with its store and expiry – `tests/unit/preview-cookie.test.ts`; drafts and draft stores open only while previewing THAT store) |
| SAAS-5 | P2 | Custom-domain plan feature bypassed via /cms and Verify | fixed (the custom-domain feature is checked when the domain is set through /cms or the API, and on verify) |
| SAAS-6 | P2 | Staff-seat limit bypassed by suspending and re-activating members | fixed (re-activating a member takes a seat – the plan's limit is checked) |
| SAAS-7 | P2 | Background jobs and storefront write actions ignore store status (closed stores keep messaging) | partly fixed (cart reminders and stock/price alerts skip stores that aren't open); integration syncs and storefront write actions – remaining |
| SAAS-8 | P2 | Downgrading to free / closing the store leaves the Stripe subscription running | fixed (a free plan ends the Stripe subscription; closing cancels it at the period end; events of a subscription that is no longer the store's are ignored) – not tested against Stripe |
| SAAS-9 | P3 | Owner can edit the Stores record of a read-only store | fixed (the owner can't edit a read-only store's record) |
| SAAS-10 | P3 | Offline stores' catalogues publicly readable via /cms-api; a null store means "all stores" in /api search/products | open |
| SAAS-11 | P3 | Storage limit counts only Media creates | open |
| SAAS-12 | P3 | Discount feature checked only when a discount is created | open |
| SAAS-13 | P3 | Edit locks readable/writable across stores | open |
| SAAS-14 | P3 | An unverified custom-domain claim blocks the real owner for ever | open |
| SAAS-15 | P3 | Free trial per store, not per merchant (design) | open |
| API-1 | P1 | An URL-encoded sign-in path (`/cms-api/users/%6Cogin`) skipped every sign-in rate limit (unlimited password guessing) | fixed + verified (the proxy matches the decoded, normalised path – `tests/unit/canonical-path.test.ts`; on the dev server 22 encoded sign-in attempts → 20 × 401 then 429) |
| API-2 | P2 | A Store API key can cancel a paid order without the manager rule or the refund reminder | fixed (the Store API refuses cancelling a paid / advance-paid order – done in /cms with the refund reminder) |
| API-3 | P3 | Lost updates on shipments (built from a copy read outside the transaction) | open |
| API-4 | P3 | Email link scanners can use up a download link's limit | open |
| API-5 | P3 | POS void checks the sale's status before its store | fixed (the sale's store is checked before its status is revealed or its row locked) |
| API-6 | P3 | Integrations trust X-Forwarded-Host for OAuth redirect addresses (exploitability NOT VERIFIED) | open |
| API-7 | P3 | Weak input bounds (Infinity/NaN, invalid dates, unbounded arrays, enum filters) give 500s | open |
| API-8 | P3 | Raw exception messages (SQL) returned to callers | open |
| API-9 | P3 | Public caching of responses that can depend on draft preview (NOT VERIFIED) | open |
| API-10 | P3 | /media and /feed-image decode twice; /feed-image transcodes without limits | partly fixed (a malformed escape is a 404, not a 500); /feed-image rate limiting – remaining |
| API-11 | P3 | Return requests accept duplicate / fractional / already-returned item picks | open |
| API-12 | P3 | Unverified custom-domain squatting (= SAAS-14) | open |
| API-13 | P3 | CSV formula escaping misses leading TAB / CR | fixed (leading tab / carriage return escaped too) |
| API-14 | P3 | A card refund can succeed at the provider while the local record rolls back (trigger NOT VERIFIED) | open |
| API-15 | P3 | Smaller gaps: integration test endpoint role check (= INT-17), /2fa/reset without step-up, no `no-store` on private /cms-api JSON, no limits on heavy owner endpoints, unknown Store API keys unthrottled | partly fixed (integration test endpoint: write gate + owner-only role check – = INT-17); /2fa/reset step-up, no-store headers, heavy-endpoint limits – remaining |

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
| AUTH-9 | P3 | Account existence can be told apart (messages/timing) | fixed (second pass: sign-up answers an existing account and an earlier guest order the same way – a set-password email; no "staff account" disclosure; a sign-in to an unknown email takes about as long as a wrong password) – timing not measured |
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
| DATA-7 | P2 | Combined typed + automatic discounts: only the typed code's use is counted | fixed + verified (second pass: the automatic discount used with a typed code is stored on the order – additive migration `20261019_080158_combined_discounts` – counted as used, released on cancel / delete, taken again on re-open, and counted for per-customer limits; `test:orders`) |
| DATA-8 | P2 | Concurrent order updates: last writer wins (stock leak on edit vs cancel; shipments lost) | fixed + verified (second pass: every order save locks the row and refuses when the order was saved by someone else after it was read; the download counter marks the order as changed; `test:orders`: cancel + item edit at the same moment → cancelled, every unit back – the same check fails on the previous code with a unit of stock lost) |
| DATA-9 | P2 | Payment reconciliation can stall; orphan awaiting-payment orders hold stock | fixed + verified (`test:payment-integrity`: orphaned awaiting-payment orders cancelled by housekeeping, open payments left alone; both reconcilers rotate rows by updatedAt) |
| DATA-10 | P2 | SaaS billing webhooks applied without an ordering check | fixed + verified for the local path (`test:webhooks`: failed → past due, paid → active, cancelled → cancelled); reading the live subscription/invoice from Stripe is NOT tested against Stripe |
| DATA-11 | P2 | Webhook event store turns any DB error into "duplicate" + 200 | fixed + verified (`test:webhooks` on the production build, 17/17: replays ignored, stored once; only a real duplicate answers 200, DB errors → 500, in-flight → 503) |
| DATA-12 | P2 | POS accepts change larger than the cash tendered; several cash lines mis-recorded | fixed + verified (`test:pos-payments`) |
| DATA-13 | P2 | Outbox can send the same message twice (100-event claim, 10-minute re-claim) | fixed (each event's claim is checked and renewed before sending; status updates only by the claim's owner) – no dedicated race test |
| DATA-14 | P2 | Partial-shipment parcels each default to the whole COD amount; bookings can be orphaned | fixed (later parcels default to the cash still due; a booking that can't be saved is cancelled at the courier or named for manual cancel) – no courier-API test |
| DATA-15 | P2 | Pending refunds counted as done; failed refunds never noticed | fixed + verified (second pass: a provider's final refund status – Stripe `charge.refund.updated` / `refund.updated` / `refund.failed` – updates the refund; a failed one is taken off the payment and the order again and the team is told; `test:payment-integrity` and `test:webhooks`) |
| DATA-16 | P2 | Cancelling a paid order needs no refund decision | fixed (cancelling a paid / advance-paid order: owner or manager only, and the team gets a 'refund due' alert) |
| DATA-17 | P3 | Deleting an open order doesn't return gift card / coupon use | fixed + verified (`test:gift-cards`: deleting an open order puts its gift-card payment back; coupon use released) |
| DATA-18 | P3 | `addStock` floors at 0 (backorders owed are lost) | fixed + verified (`test:preorders`: receiving 1 while 2 are owed leaves 1 owed; a count never goes below 0 or below what was owed) |
| DATA-19 | P3 | Loyalty points kept after a return | fixed + verified (`test:loyalty`: a return after the points became a voucher leaves them owed – balance below 0 – and no new voucher until earned back); the account page shows the negative balance as is |
| DATA-20 | P3 | `stockHeld` / `attemptId` writable by staff | fixed (`stockHeld`, `attemptId`: create/update access false) |
| DATA-21 | P3 | Deleting a store orphans its records | fixed + verified (`test:tenants`: a store with products – or POS sales, gift cards, online payments, loyalty accounts, units – can't be deleted) |
| DATA-22 | P3 | Refund rounding breaks 3-decimal currencies | fixed for provider-plugin refunds (currency decimals); Stripe path unchanged |
| DATA-23 | P3 | Unbounded queries / N+1 in request paths | open |
| DATA-24 | P3 | Reused payment reference shows a generic error | fixed (a clash on the transaction id at save time answers "already used" on its field) |
| DATA-25 | P3 | SQL errors swallowed inside transactions | fixed + verified (second pass: side jobs inside a transaction – order webhooks, status messages, low-stock alerts, webhook / integration lookups – rethrow DATABASE errors, so a save fails visibly instead of rolling back at COMMIT; other errors stay non-fatal; `tests/unit/tx-errors.test.ts`) |

### Infrastructure, performance and deployment

| ID | Sev | Finding | Status |
|---|---|---|---|
| OPS-1 | P1 | The production build still runs migrations against the live DB (parallel, no lock) | fixed (`prodMigrations` off when SHOPENGINE_BUILD / NEXT_PHASE build / SKIP_MIGRATIONS); see note under Remaining – a release whose pages need new columns at build time now fails the build instead of migrating |
| OPS-2 | P1 | Courier tracking / COD sync stops platform-wide once ~200 finished orders exist | fixed + verified (`test:courier-sync`: finished parcels not picked; failing courier rotates) |
| OPS-3 | P1 | Whole-catalogue cache entry exceeds Next's 2 MB limit at ~1,000–1,500 products; every order expires it | fixed + verified (second pass: the catalogue is cached as a small index plus parts of ~300 products, assigned by product id so a part rebuilt later never repeats or loses another part's products; one shared build per refresh, forgotten on every revalidation; `tests/unit/catalog-parts.test.ts`; the production build ran with 3 products per part – see section F) |
| OPS-4 | P1 | Redirect upkeep reads/writes other stores' redirects (cross-tenant) | fixed + verified (`test:tenants`: B's redirects untouched, A gets its own; both checks fail on the old code) |
| OPS-5 | P2 | In-process caches, rate limits and timers: not safe with several replicas | documented (DEPLOYMENT.md: run exactly one web replica until caches, limits and timers are shared) |
| OPS-6 | P2 | Oldest-first starvation: cart reminders, stock/price alerts, gateway reconciliation | fixed (reminders and stock/price alerts page through candidates with a cursor, up to 10 pages a run; reconcilers rotate – see DATA-9) – no dedicated test |
| OPS-7 | P2 | One store's events expire every store's caches | fixed (per-store catalogue tags for questions, purchases, stock counts, returns, media, flash sales) |
| OPS-8 | P2 | No DB pool / statement / idle-in-transaction timeouts | fixed (pool `connectionTimeoutMillis` 10 s, `idle_in_transaction_session_timeout` 60 s, `lock_timeout` 30 s – a migration's ALTER queued behind a long query fails instead of blocking everything); a general `statement_timeout` deliberately not set (long reports and migrations) |
| OPS-9 | P2 | Outbox double-send; housekeeping has no time budget | fixed (no double send – DATA-13; housekeeping sends queued messages first, and the slow courier / marketplace chores are left for the next run once a run has taken 60 s) |
| OPS-10 | P2 | `/api/stats` lets the public fill `shop_stats` (NULL store rows) | fixed (no store → nothing stored; unknown product ids ignored) |
| OPS-11 | P2 | Admin/report endpoints load whole tables into memory | partly fixed (second pass: the sales and refused-parcel reports cover at most a year at a time; the dashboard was already capped and field-limited); SQL aggregation and streamed exports – remaining |
| OPS-12 | P2 | Backups miss `downloads/` and `labels/` | fixed (`downloads` and `labels` added to the backup's private folders) – backup job not run |
| OPS-13 | P2 | The build needs the public DB URL; secrets passed as build args | open |
| OPS-14 | P2 | CI/deploy gates: no "wait for CI", no Docker build, no dependency audit, some suites not in CI | partly fixed (CI: security sweep against the built server, dependency advisories reported, new DB suites); 'Wait for CI' on Railway and a Docker image build are deployer steps – remaining |
| OPS-15 | P2 | `CLIENT_IP_HEADER` trust is unsafe as documented | documented (DEPLOYMENT.md: only with the origin locked down; custom domains aren't behind Cloudflare) |
| OPS-16 | P2 | Image optimisation (AVIF) on the shop server; no CDN cache | partly fixed (second pass: WebP only – AVIF's slow encoding taken off the shop server – and optimised photos kept 31 days; DEPLOYMENT.md: cache `/_next/image` at the CDN); an external image service – remaining |
| OPS-17 | P2 | HSTS `includeSubDomains; preload` sent on merchants' custom domains | fixed (`includeSubDomains; preload` only on PLATFORM_ROOT_DOMAIN hosts, plain HSTS elsewhere; PLATFORM_ROOT_DOMAIN passed to the Docker build) |
| OPS-18 | P3 | No storefront HTML caching (tenant resolution uses `headers()`) | open |
| OPS-19 | P3 | Health check shallow; uptime monitor on the same provider | fixed (no full user count per probe; the probe also reports dead / late outbox messages and how long ago housekeeping ran – reported, never failing it); an external uptime monitor is a deployer step |
| OPS-20 | P3 | Proxy caches have no single-flight | fixed (one load at a time for the proxy's store list and each store's redirects) |
| OPS-21 | P3 | Build args / docs drift (Sentry sample rate, SKIP_MIGRATIONS) | fixed (SKIP_MIGRATIONS implemented; NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE and PLATFORM_ROOT_DOMAIN are Docker build args; docs corrected) |
| OPS-22 | P3 | Migration "additive only" check is regex-only | fixed + verified (second pass: the check also refuses column type changes, SET NOT NULL, NOT NULL columns without a default and dropped indexes / constraints / defaults; run against a sample of each – all caught – and the repository's migrations, which pass; `CHECK_MIGRATIONS_FILES` lets it check given files) |
| OPS-23 | P3 | Blog posts cached as one entry per store | fixed (second pass: the post list is cached without the articles' text – a reading time instead – and each post with its text on its own) |
| OPS-24 | P3 | Image preview object URLs never revoked | fixed (`FilePreview` releases its object URL) |
| OPS-25 | P3 | S3 client without timeouts; 304 path downloads the whole file | fixed (S3 client timeouts; the media route answers 304 from the ETag without fetching the file – the bucket is asked with If-None-Match) |
| DEP-1 | P2 | 23 npm advisories (20 in production dependencies: 13 high, 7 moderate, 0 critical) – all in dependencies of Payload (sass/chokidar/braces dev watchers, drizzle-kit/esbuild migration tooling, find-node-modules, csv-parse in the staff-only import plugin) and Prisma (deepmerge-ts). npm's suggested fixes are major downgrades | documented (no dependency changes allowed this pass; CI now reports advisories) |

### Storefront and UX

| ID | Sev | Finding | Status |
|---|---|---|---|
| CRAWL-1 | P2 | 8 broken links on /about and /installments (hard-coded laptop categories and a blog post) | fixed + verified (crawl of the production build: 48 pages, 54 links, 2 images, 0 problems) |
| CRAWL-2 | P2 | 404 page listed hard-coded laptop categories in every store | fixed (store's own top categories) |
| REG-1 | P1 | **Introduced and caught in this pass:** the CRAWL-1 change made `/about` crash (HTTP 500) for the original store – a helper was used before it was defined. Found by the crawl of the production build | fixed + verified (crawl: 0 problems; `/about` 200). The crawl now runs in CI so a page error fails the build |
| REG-2 | P2 | **Introduced and caught in this pass:** a webhook endpoint's status save re-ran the URL check, so in production a failure couldn't be recorded (seen with old `http://localhost` test endpoints); the new DNS check would have done the same for any name that later points somewhere private | fixed + verified (the URL is checked only when it is set or changed; `test:store-webhooks` 7/7) |
| UX-1 | P1 | Phone checkout/cart: "Place order" covered by the WhatsApp button / cookie notice; bar under the iPhone home bar | fixed (bar at `--mobile-nav`, floats lifted) – the phone checkout in `test:e2e` passes; the overlap itself was NOT inspected visually |
| UX-2 | P2 | Light theme: status text contrast | fixed (light-theme `light:text-*-700/800` variants on checkout, cart, account, track-order, buy box and status text) |
| UX-3 | P2 | Invoice-in-another-name fields required but not validated | fixed (client validation of the invoice name/address/city/tax id/postcode with the server's rules; per-field aria; billing + gift card in FIELD_ORDER) |
| UX-4 | P2 | "Cash on Delivery" promised when COD is off | fixed (checkout, cart page, cart drawer and hero claim COD only when the store offers it; the product card's "COD available" removed – no client-side COD flag) |
| UX-5 | P2 | Failed shipping quote silently ignored | fixed (failed delivery quote: message + Retry; placing the order waits for a quote) |
| UX-8 | P2 | "Buy Now" adds to an existing line | fixed (Buy Now sets the chosen quantity; hitting the stock/limit shows "Only N in stock") |
| UX-9 | P2 | Pagination overflows at 360 px | fixed (phones: first · current · last; wraps as a fallback; 44 px prev/next) |
| UX-10 | P2 | Mega menu: no Escape / outside click | fixed (Escape returns focus to the trigger; outside click / focus leaving closes; Tab order bridged into the mega panel) |
| UX-17 | P2 | Forms clear input on a server error | fixed (login, register, reset, forgot, contact, return, warranty, trade-in, Q&A, alerts keep what was typed – onSubmit + startTransition, no-JS POST kept) |
| UX-18 | P2 | Confirmation page celebrates cancelled / unpaid orders | fixed (cancelled / unpaid / cancelled-but-paid / refunded heroes and tab titles; no "Confirm on WhatsApp" for them) |
| UX-20 | P2 | "Stores" tab for every shopper | fixed (second pass: "Manage stores" shows only on ShopEngine's own address or for an account that works in a store – decided once by the account layout) |
| UX-21 | P2 | Wishlist says empty when loading fails | fixed ("Couldn't load your saved items" + Retry, count kept) |
| UX-22 | P2 | Search swallows API errors | fixed (errors shown with Try again; stale results cleared; result count announced) |
| UX-23 | P2 | Urdu toggle marks the whole page as Urdu | fixed (second pass: the page keeps the store's language; each translated label is marked lang="ur" / right-to-left itself) |
| UX-30 | P2 | Cancel plan without confirmation; undefined colour tokens | fixed (cancel plan needs a confirmation tick; undefined colour tokens replaced with brand / fg tokens) |
| UX-31/32 | P2 | Order panel / card payments: no loading or error state; silent refund errors | fixed (order + after-sales panels: loading and failed-with-retry states; payments: load error ≠ 'no payment'; network errors on refund / parcels reported) |
| UX-33 | P2 | "Block this number" confirm semantics inverted | fixed (explicit choice 1 / 2, Cancel changes nothing; network errors reported) – a proper dialog is P3 |
| UX-34 | P2 | POS shows zeros when loading fails | fixed (failed loads say so with a retry; cash-up can't be saved until the day's figures loaded) |
| UX-19 | P3 | "Pay now" had no pending state | fixed ("Opening payment page…", disabled while pending) |
| UX-6 | P3 | Cart drawer quantity buttons never disable | fixed (disabled at 1 / at the stock limit, grouped and labelled) |
| UX-7 | P3 | Automatic-discount and repricing errors shown wrongly / not at all | fixed (no error under an empty coupon field; a soft notice when prices couldn't be refreshed) |
| UX-11 | P3 | Variant picker dead ends | fixed (a value stays enabled when any variant has it; picking it moves the other options to the nearest existing combination) |
| UX-12 | P3 | Purchase buttons without product context; labels differ | fixed (labels name the product; the sticky bar matches the main button; a missing combination says "Unavailable") |
| UX-13 | P3 | Hero carousel: no pause, rotating live region, misused tab roles | fixed (visible Pause/Play; live region off while rotating; buttons with aria-current) |
| UX-14 | P3 | Animations ignore reduced motion | fixed (`MotionConfig reducedMotion="user"`) |
| UX-15 | P3 | Q&A / alert forms: messages not announced | fixed (alert / status roles, focus to the result, "Sending…") |
| UX-16 | P3 | 16 px "Remove photo" button | fixed (24 px, labelled) |
| UX-24 | P3 | Order progress by colour only | fixed (aria-current="step", spoken completed / current / upcoming) |
| UX-25 | P3 | Active bottom-nav item by colour only | fixed (aria-current on every active item, storefront and admin) |
| UX-26 | P3 | Error toasts vanish after 3.2 s | partly fixed (errors stay 7 s; pause on hover – remaining) |
| UX-27 | P3 | Address book rules differ from checkout | fixed (same address/city rules; State / Postcode outside Pakistan) |
| UX-27b | P3 | **Found this pass:** editing a saved address abroad dropped its country (the form and the server's schema both left it out) | fixed (kept by the form and accepted by the schema) |
| UX-28 | P3 | Copy button fails silently | fixed ("Couldn't copy – select the number", announced) |
| UX-29 | P3 | WhatsApp numbers popup: no Escape, no focus | fixed (focus moves in; Escape returns focus; outside click closes) |
| UX-35 | P3 | Admin dialogs don't trap / move focus | fixed (focus trap in the 2-step gate, integrations and search dialogs; Escape closes the POS "sale complete") |
| UX-36 | P3 | Admin search: failures look like "Nothing found" | partly fixed ("Search failed" + Try again; stale answers can't overwrite newer ones; focus ring); the listbox pattern – remaining |
| UX-37 | P3 | Admin report tables can't scroll on phones | fixed (scrolling wrapper on every report table; the rule hiding the wrong column removed) |
| UX-38 | P3 | Admin screens load forever after a failure | fixed (reports, security screen and stock counts show the error with Try again) |
| UX-39 | P3 | Dashboard links go to unfiltered lists | partly fixed (unread messages filtered; products filtered to on-store – "missing photos" can't be a list filter without a stored flag) |
| UX-40 | P3 | POS controls lack state for screen readers | fixed (aria-pressed tabs, steppers name the product, lookup message announced) |

Full agent reports (evidence, file:line): saved during the session to the scratchpad file `agent-reports.md`. The register above is the durable copy.
