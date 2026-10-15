# ShopEngine — the engine that powers shops
# 00 · Executive summary of the platform audit

**State audited:** commit `aab6879` on `main` (Next.js 16.4 + Payload CMS 3.90 + PostgreSQL), 14 October 2026.
**Method:** read-only inspection of every module (five parallel deep-dives: catalog/inventory, checkout/payments/orders, auth/security/API,
storefront/tenancy/billing, infra/tests/database), plus running the unit tests, typecheck, lint, `npm audit` and the Payload migrations on an
empty local PostgreSQL. Evidence for every claim is in reports 01–10.

> **Remediation status (14–15 Oct 2026):** the findings below were fixed in the working tree (not committed yet). Broken features
> 24 → 0, confirmed coverage 44.2 % → 86.9 %, SEC-01…03 closed, migrations added and run; on 15 Oct every store got its own country,
> currency, time zone and payment methods (payment provider plugins, Stripe first). What changed, how it was verified and what is
> still open: **`11-remediation-log.md`**; per-feature evidence after the fixes: **`12-feature-checklist-after.md`**. The text below is
> the audit of commit `aab6879` and is kept unchanged as the baseline.

## Verdict

ShopEngine is a **well-built single-store commerce app with an unfinished, unsafe multi-tenant layer on top.**

- The single-store core is genuinely strong: server-side pricing, one DB transaction for coupon + stock + order, atomic oversell protection,
  drafts/versions, variants, rule-based collections, POS, returns, 2FA, signed order cookies and sanitised content.
- The SaaS layer (stores, memberships, plans) exists only as schema plus an onboarding page. It **cannot run as committed**: the Payload
  config fails to build and no migration creates the tenant tables.
- Once it does run, it is **dangerous**. Any shopper who creates a store becomes owner of every store's data, including the payment account
  numbers shown to all customers.

**It is not safe to onboard a second merchant or take online payments on this commit.** Running the original single shop is fine once the
boot blocker is removed and nobody uses `/account/stores`.

## Scorecard

| Metric | Value |
|---|---|
| Features assessed (Shopify-like baseline) | 295 |
| Complete / Partial / Missing / Broken / Not Verified | 85 / 91 / 91 / 24 / 4 |
| **Confirmed feature coverage** | **44.2 %** (130.5 / 295 points) |
| **Verified-only coverage** | **44.8 %** (130.5 / 291) |
| Unverified features | 4 |
| Critical security issues | **3** (plus 6 high, 11 medium, 9 low) |
| Broken business flows | **4 of 8** (onboarding, tenant isolation, staff authorization, SaaS subscription); 1 missing (failed online payment) |
| Unit tests | 40 / 40 pass. They assert the insecure merchant-role behaviour and miss every runtime blocker |

| Module | Coverage | Module | Coverage |
|---|---|---|---|
| Collections | 78.6 % | Shipping & fulfillment | 53.6 % |
| Products | 73.3 % | Cart & checkout | 52.9 % |
| Storefront | 71.9 % | Discounts & marketing | 46.9 % |
| Variants | 65.0 % | Analytics | 41.7 % |
| Customers | 63.6 % | Access control | 35.0 % |
| Inventory | 58.8 % | Jobs & integrations | 33.3 % |
| Themes | 57.1 % | Production readiness | 32.4 % |
| Orders | 56.5 % | Onboarding | 30.8 % |
| | | Super admin | 27.8 % |
| | | Payments | 13.9 % |
| | | Store management | 13.2 % |
| | | SaaS billing | 12.5 % |

> Coverage counts how much Shopify-like functionality exists in code. **It is not a security or production-readiness certification.**
> "Complete" storefront/admin features are complete *for one store*; the tenant gaps are scored in their own rows.

**Uncertainty:**
- Not checked in a browser: mobile layout and page speed.
- Not traced: two dashboard metrics.
- Not confirmed: the Next.js server-action Origin check behind Railway's proxy.
- Security findings come from reading the code. No live exploit was run.

---

## A. What already works (evidence-backed)

**Checkout and money**
- Server-side pricing: the client cannot set prices, discounts, shipping or totals (`src/lib/cart-pricing.ts:67,83`; `checkout/actions.ts:164-175`).
- One transaction covers coupon use, stock take and order creation (`src/lib/cms/sales.ts:123-166`).
- `attemptId` stops duplicate orders (`migrations/20261006_213603_order_safety.ts`).
- Oversell-proof stock: the decrement is a single conditional `UPDATE … WHERE stock >= qty` (`src/payload/stock.ts:86-89`). Two buyers of the last unit cannot both succeed.
- Coupon usage limits are race-safe (`src/payload/stock.ts:123-131`).

**Catalog**
- Products support drafts, autosave, scheduled publishing and versions.
- Variants: up to 3 options with their own SKU, price, stock and image (`src/payload/collections/catalog.ts`).
- Collections can be manual or rule-based.
- CSV import/export, SEO fields and redirects are in place.

**Orders and after-sales**
- Orders keep a timeline, a separate payment status, cancellation with restock, returns with credit notes, a PDF invoice and WhatsApp/SMS/email notifications.

**Point of sale**
- Shop counter with cash-ups and serial-number units.

**Security**
- 2FA (TOTP) with replay protection and encrypted secrets.
- PBKDF2 password hashing and good cookie flags.
- Signed order cookies; no storefront order IDOR found.
- Sanitised rich text, safe media paths, no SQL injection or open redirects found.

**Operations**
- Dockerised standalone build and a health check.
- External uptime monitor.
- Encrypted nightly backups (the script; the image is broken).
- CI pipeline design: migration guard, lint, types, tests, build.

## B. Partially implemented (what's missing)

| Area | What is missing |
|---|---|
| Stores & memberships | Tables not migrated. Memberships are never used for authorization. Merchants cannot edit their own store. No switcher. Status never enforced. |
| Merchant onboarding | Email verification is not required. No per-store payments, shipping or branding. Publish resets the trial. |
| Payments | Only manual methods (COD, bank, wallets by screenshot). No transaction reference, ledger or reconciliation. |
| Orders | No fulfillment status separate from order status. No partial fulfillment. Mostly free-form status transitions. No SKU or option snapshot. |
| Refunds | Manual credit notes only. No ledger. Order payment status is never updated. |
| Discounts | No start date, free-shipping type, automatic discounts, per-customer limits or product/collection scope. Flash sales are display-only. |
| Inventory | Single location. No checkout reservation. Low-stock alerts don't notify. |
| Analytics | Not store-scoped. No traffic/conversion tracking or returning customers. The `paidOrders` KPI is mislabelled. |
| SaaS billing | Plans, subscriptions and invoices are schema only. No provider, lifecycle or limits. |
| Jobs | Background chores run in-process with no retries, outbox or dead-letter queue. |
| Tests | Unit tests only. Integration scripts exist but are not in CI. |

## C. Completely missing (by module)

- **Tenancy:**
  - host/subdomain/custom-domain routing;
  - per-store settings (19 shared globals);
  - `store` on orders, customers, discounts, pages, menus and media;
  - per-store uniqueness of slugs, SKUs and codes.
- **Payments:**
  - online gateway and merchant account onboarding;
  - webhooks, payment events, idempotency keys and provider refunds;
  - payouts.
- **Staff:** invitations, custom permissions and revocation that actually works.
- **SaaS:**
  - recurring billing, upgrades/downgrades, cancellation and dunning;
  - billing webhooks;
  - entitlements, limits, grace periods and access restriction.
- **Super admin:** platform dashboard, revenue, failed payments, support access/impersonation.
- **Commerce:** tax, checkout sessions, server-side carts, locations, carrier integration, marketing consent.
- **Reliability:** transactional outbox, dedicated worker, shared rate limiter, tenant/permission/E2E tests, schema-drift check.

## D. Broken or unsafe

1. **The app does not boot.** There is a duplicate `store` field on Suppliers (`inventory.ts:24-25`); I reproduced it locally.
2. **No migration exists for the multi-tenant schema**, so login and catalog queries would fail.
3. **SEC-01:** a customer can self-PATCH `platformRole` / `stores` and become platform admin (`Users.ts:197-225`).
4. **SEC-02:** creating a store grants global owner/manager/staff over every tenant (`store-tenant.ts:268`, `access.ts:63-67`).
5. **SEC-03:** any merchant can edit the payment account numbers shown to every customer (`globals/commerce.ts:73`).
6. **Store-scoped create is ignored**, so records can be planted in other tenants (`access.ts:69-78`).
7. **Cross-tenant endpoints:**
   - privacy export/erase;
   - print, proof and file routes;
   - reports;
   - POS and stock count;
   - config import.
8. **Variant + upgrade cannot be bought.** Variants of draft or archived parents stay sellable.
9. **Money and stock integrity:**
   - refunds can exceed the amount paid;
   - the coupon counter drifts;
   - concurrent cancels can restock twice;
   - an admin stock save can lose a concurrent sale;
   - a stock count subtracts sales twice;
   - multi-line orders can deadlock.
10. **Billing:** the free trial never ends, any plan can be chosen without payment, and suspended stores can re-activate themselves.
11. **Infra:**
    - CI never runs on `main`;
    - the backup image can't build;
    - lint fails CI;
    - migrations run against the live DB during the image build.

## E. Highest-priority fixes (ranked)

| # | Fix | Files | Depends on | Acceptance |
|---|---|---|---|---|
| 1 | Make the config build; lint clean | `src/payload/collections/inventory.ts` | — | `payload migrate` and `npm run lint` pass |
| 2 | Lock `platformRole`/`stores`/`currentStore` | `src/payload/collections/Users.ts` | 1 | a customer's self-PATCH cannot change them |
| 3 | Membership-based store authority; `merchant_*` grants nothing | `src/payload/access.ts`, new `src/payload/tenancy.ts` | 2 | a store-A member is denied every store-B record |
| 4 | Multi-tenant migration + default-store backfill | `src/migrations/*` | 3 | no `store_id IS NULL`; migration additive |
| 5 | `store` + `assignStore` + tenant access on every tenant collection | `src/payload/collections/*` | 4 | cross-store CRUD denied in tests |
| 6 | Scope custom endpoints/print routes; privacy and config-import platform-only | `src/payload/endpoints/*`, `src/app/(payload)/*` | 3 | two-store endpoint tests pass |
| 7 | Per-store payment/shipping/theme settings | `src/payload/globals/*`, `src/lib/cms/*` | 5 | merchants edit only their own settings |
| 8 | Host → store resolution on the storefront | `src/proxy.ts`, new `src/lib/tenant.ts`, loaders | 5, 7 | each host shows only its store |
| 9 | Order/refund/POS/inventory integrity fixes | `content.ts`, `aftersales.ts`, `pos.ts`, `stock.ts`, `catalog.ts` | — | guards covered by tests |
| 10 | Online payments with signed webhooks + payment events | new `src/lib/payments/*`, `src/app/api/webhooks/*` | 8 | only verified events mark orders paid |

## F. Production blockers (before taking real orders and payments from more than one merchant)

1. Boot failure and missing migration (D1, D2).
2. SEC-01, SEC-02 and SEC-03, plus create-ignores-store (SEC-04).
3. No tenant attribution on orders, customers or settings, and no host routing. One store's checkout uses another's payment details.
4. No online payment verification. Manual screenshots can be reused across orders.
5. Refund cap and coupon-counter integrity bugs.
6. CI not running and backups not building.

## G. Recommended build sequence

Phases, with dependencies (detail in `08-implementation-roadmap.md`):
- **0 Unblock** → **1 Lock down authority** → **2 Tenant data model** (one additive migration; backfill to a default store)
- → **3 Storefront tenancy and per-store settings** → **4 Online payments**
- In parallel after phase 2: **5 Commerce integrity**, **6 Merchant operations**, **8 Reliability**
- **7 SaaS billing and platform admin** comes last, because it needs payments and memberships to be trustworthy.

## H. Executive scorecard

See the scorecard table above, module scores in `01-feature-checklist.md`, risk register in `05-security-audit.md` and `09-testing-gaps.md`.

## I. Next 20 development tasks

The prioritised list, with files, dependencies, acceptance criteria and suggested tests, is in `10-developer-task-checklist.md`.

---

| Report | Contents |
|---|---|
| `01-feature-checklist.md` | 295-row Shopify-like comparison with scores |
| `02-backend-architecture.md` | Stack, directory map, current and target diagrams, risks |
| `03-database-audit.md` | Entity comparison, constraints, ERD, drift |
| `04-api-audit.md` | Every endpoint and server action, missing APIs |
| `05-security-audit.md` | 29 findings by severity, dependencies, backups |
| `06-business-flow-audit.md` | Flows A–H traced end to end |
| `07-missing-features.md` | Only gaps, grouped by priority |
| `08-implementation-roadmap.md` | Phased plan |
| `09-testing-gaps.md` | Test results actually run, gaps, risks |
| `10-developer-task-checklist.md` | Next 20 tasks and the full checklist |
