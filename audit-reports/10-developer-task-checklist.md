# 10 · Developer task checklist

Actionable list derived from reports 01–09 (state audited: commit `aab6879`). Tasks are ordered so each one only depends on tasks above it.
"Files" lists existing files to change, or *proposed* new files.

## Next 20 development tasks

### 1. Make the Payload config build — P0 · Platform
- **Files:** `src/payload/collections/inventory.ts`
- **Depends on:** —
- **Acceptance:** `npx payload migrate` loads the config; `npm run lint` exits 0.
- **Tests:** CI "Payload migrations on an empty database" step passes.

### 2. CI runs on `main`, plus a schema-drift check — P0 · Platform
- **Files:** `.github/workflows/ci.yml`, *proposed* `scripts/ci/check-schema-drift.mjs`
- **Depends on:** 1
- **Acceptance:** pushes to `main` trigger CI; a config change without a migration fails CI.
- **Tests:** deliberately add a field without a migration in a branch → CI red.

### 3. Lock role and tenant fields on users — P0 · Access control
- **Files:** `src/payload/collections/Users.ts`, `src/payload/access.ts`
- **Depends on:** 1
- **Acceptance:** a customer's `PATCH /cms-api/users/<self>` with `platformRole`, `stores` or another user's store in `currentStore` is rejected or ignored; platform admins can still set them.
- **Tests:** Local API test with `overrideAccess:false` for each field.

### 4. Separate platform authority from store authority — P0 · Access control
- **Files:** `src/payload/access.ts`, *proposed* `src/payload/tenancy.ts`, `tests/unit/access.test.ts`
- **Depends on:** 3
- **Acceptance:** `merchant_*` platform roles grant nothing by themselves; store rights come from active memberships (cached per request); legacy `owner` = platform admin; legacy `manager`/`staff` = default store only.
- **Tests:** rewritten `access.test.ts` covering per-store roles, suspended memberships, 2FA requirement.

### 5. Multi-tenant migration with default-store backfill — P0 · Database
- **Files:** *proposed* `src/migrations/2026…_multi_tenancy.ts` (+ JSON), `src/migrations/index.ts`, `src/payload-types.ts`
- **Depends on:** 4 (final field list)
- **Acceptance:** SaaS tables, users columns and `store_id` on every tenant table exist; every existing row belongs to the default store; migration is additive (passes `check-migrations.mjs`).
- **Tests:** migrate an empty DB and a DB with seed data; counts of `store_id IS NULL` = 0.

### 6. `store` on every tenant collection with server-assigned value — P0 · Tenancy
- **Files:** `src/payload/collections/*` (catalog, content, sales, aftersales, shop, engagement, inventory, history, Pages, Menus, Media, ProductCollections), *proposed* `src/payload/tenancy.ts` (`storeField`, `assignStore`, `tenantAccess`)
- **Depends on:** 4, 5
- **Acceptance:** creates without a store get the admin's active store; a store the user isn't a member of is rejected; `store` cannot change after create (except platform admin).
- **Tests:** tenant-isolation script: create/read/update/delete across stores.

### 7. Per-store uniqueness — P0 · Database
- **Files:** `src/payload/fields.ts` (`slugField`), `src/payload/collections/catalog.ts` (SKU), `src/payload/collections/sales.ts` (code)
- **Depends on:** 5, 6
- **Acceptance:** two stores can use the same slug/SKU/code; the same store cannot.
- **Tests:** DB test creating duplicates in same and different stores.

### 8. Scope custom endpoints and print routes by store — P0 · Security
- **Files:** `src/payload/endpoints/{reports,sales-report,pos,orders,inventory,privacy,config-transfer}.ts`, `src/payload/collections/catalog.ts:43-98`, `src/app/(payload)/cms-print/**`, `src/app/(payload)/cms-proof/[id]/route.ts`, `src/app/(payload)/cms-file/route.ts`
- **Depends on:** 4, 6
- **Acceptance:** each endpoint filters by the caller's active store and refuses documents of other stores; privacy/config-import are platform-admin (or store-scoped) and activity-logged.
- **Tests:** endpoint tests with two stores.

### 9. Payment settings and other globals per store — P0 · Tenancy
- **Files:** `src/payload/globals/*`, `src/lib/cms/{site,chrome,notify-settings,commerce}.ts`, *proposed* `src/payload/collections/store-settings.ts`
- **Depends on:** 6
- **Acceptance:** a merchant edits only their store's payment/shipping/theme settings; globals are platform-admin-only and act as the default store's settings.
- **Tests:** store B cannot read/update store A's payment details.

### 10. Storefront store resolution by host — P0 · Storefront
- **Files:** `src/proxy.ts`, *proposed* `src/lib/tenant.ts`, `src/lib/repo/catalog.ts`, `src/lib/cms/catalog-source.ts`, `src/lib/cms/pages.ts`, `src/lib/cms/site.ts`, checkout/account actions
- **Depends on:** 6, 9
- **Acceptance:** `store-b.<platform domain>` shows only store B's catalog, pages, menus and settings; orders, carts, contact messages are written with store B; suspended/closed stores show an unavailable page.
- **Tests:** unit tests for the resolver; DB test that loaders filter by store.

### 11. Staff invitations and per-store roles — P1 · Staff
- **Files:** `src/lib/store-tenant.ts`, `src/app/(frontend)/(store)/account/stores/*`, `src/components/account/store-onboarding.tsx`, `src/payload/collections/StoreMemberships.ts`
- **Depends on:** 4
- **Acceptance:** owner invites by email, invitee accepts via token, owner changes role/revokes; revocation takes effect on the next request.
- **Tests:** membership lifecycle tests.

### 12. Merchant admin sign-in and store switcher — P1 · Admin
- **Files:** `src/payload/endpoints/two-factor.ts:341`, `src/payload/admin/nav/UrkoNav.tsx`, *proposed* `src/payload/admin/StoreSwitcher.tsx`
- **Depends on:** 4
- **Acceptance:** merchant accounts can log in to `/cms` with 2FA; switching store changes what every list shows.
- **Tests:** Local API with two memberships.

### 13. Fix onboarding/billing integrity — P1 · SaaS billing
- **Files:** `src/lib/store-tenant.ts`, `src/app/(frontend)/(store)/account/stores/actions.ts`
- **Depends on:** 5
- **Acceptance:** verified email required; ≤N stores per user; reserved names refused; only active plans; trial set once; publish only from draft; suspended stores cannot self-reactivate.
- **Tests:** unit tests for each guard.

### 14. Plan limits and subscription lifecycle — P1 · SaaS billing
- **Files:** *proposed* `src/payload/entitlements.ts`, `src/lib/housekeeping.ts`
- **Depends on:** 6, 13
- **Acceptance:** creating the (maxProducts+1)th product or (maxStaff+1)th member is refused server-side; expired trials move to `expired` after a grace period and the store becomes read-only/unavailable.
- **Tests:** hook tests; job test with fake clock.

### 15. Online payment provider with signed webhooks — P0 · Payments
- **Files:** *proposed* `src/lib/payments/{provider.ts,stripe.ts}`, `src/app/api/webhooks/[provider]/route.ts`, `src/payload/collections/payments.ts` (payments + payment-events), `src/app/(frontend)/(store)/checkout/actions.ts`
- **Depends on:** 10
- **Acceptance:** card checkout redirects to a hosted page; only a verified webhook marks the order paid; duplicate/replayed events are ignored; failures leave the order unpaid and release stock after expiry.
- **Tests:** signature verification unit tests; event processor idempotency tests.

### 16. Order money and state integrity — P0 · Orders
- **Files:** `src/payload/collections/content.ts`, `src/payload/collections/aftersales.ts`, `src/payload/collections/shop.ts`, `src/payload/endpoints/pos.ts`
- **Depends on:** —
- **Acceptance:** refunds capped by amount paid minus prior refunds; coupon released only if consumed; order row always locked on status change; POS sale idempotent and not editable via REST; money fields ≥ 0; illegal status jumps refused.
- **Tests:** unit + DB tests for each guard.

### 17. Inventory race fixes — P0 · Inventory
- **Files:** `src/payload/collections/catalog.ts:122-148`, `src/payload/stock.ts:201-212`, `src/payload/endpoints/inventory.ts`, `src/payload/collections/inventory.ts:44-88`
- **Depends on:** —
- **Acceptance:** admin stock edits apply as atomic deltas; multi-line orders lock rows in id order; stock count uses expected stock at first scan; purchases can't be received twice.
- **Tests:** extended `stock-race.ts` with multi-line and reversed orders; run in CI.

### 18. Variant purchasing fixes — P0 · Variants
- **Files:** `src/lib/cart-pricing.ts`, `src/lib/repo/catalog.ts`, `src/payload/collections/catalog.ts:43-98`
- **Depends on:** —
- **Acceptance:** a variant with an upgrade can be bought; variants of draft/archived parents are hidden and not sellable; create-variants is transactional and inherits status/store.
- **Tests:** `cart-pricing` unit tests with variant fixtures.

### 19. Durable notifications (transactional outbox) — P1 · Jobs
- **Files:** *proposed* `src/payload/collections/outbox.ts`, `src/lib/outbox.ts`, `src/lib/notify.ts`, `src/lib/housekeeping.ts`
- **Depends on:** 5
- **Acceptance:** order/status notifications are written in the same transaction as the change and delivered by the worker with retries, backoff and a dead-letter state.
- **Tests:** processor tests (success, retry, dead-letter, idempotent send).

### 20. Tenant-isolation and permission test suite in CI — P0 · Testing
- **Files:** *proposed* `scripts/tests/tenant-isolation.ts`, `.github/workflows/ci.yml`
- **Depends on:** 6, 8, 10
- **Acceptance:** CI seeds two stores and asserts every collection, global and custom endpoint denies cross-store access.
- **Tests:** this is the test.

## Full checklist

### Platform & CI
- [ ] Remove duplicate Suppliers `store` field and unused imports (`inventory.ts:2,24-25`)
- [ ] CI trigger `main`; `LOCAL_PRODUCTION_TEST: "true"` (`ci.yml:7,36`)
- [ ] Backup image `sed 's/\r$//'` (`scripts/backup/Dockerfile:11-12`)
- [ ] Schema-drift check in CI
- [ ] Docs say `main` (`docs/DEPLOYMENT.md:18,83,159`)

### Access & tenancy
- [ ] Field access on `platformRole`, `stores`, `currentStore`, `internalNotes`
- [ ] Membership-based store authority; legacy role mapping
- [ ] Block admin/REST login for customer-only accounts
- [ ] Rank-aware `deletableUsers` / `editableUsers` across stores
- [ ] `store_id` + `assignStore` + tenant access on every tenant collection
- [ ] Per-store unique slug / SKU / discount code
- [ ] Same-store relationship validation
- [ ] Scope every custom endpoint and print route

### Storefront
- [ ] Host → store resolver; per-store caches
- [ ] Per-store settings (19 globals)
- [ ] Store status gate
- [ ] Store name/currency instead of hardcoded "Urko"/PKR; per-store order prefix

### Commerce
- [ ] Variant + upgrade checkout; hide variants of inactive parents
- [ ] Refund cap; coupon consumed flag; order row lock; POS idempotency & `update: nobody`
- [ ] Atomic admin stock edits; ordered row locks; stock-count fix; purchase lock
- [ ] Product delete guard; SKU/options snapshot on order lines
- [ ] Separate `fulfillmentStatus`; partial fulfillment (P2)
- [ ] Free delivery after discount; POS receipt regex; non-negative money
- [ ] Tax per store (P1)

### Payments
- [ ] Provider adapter + hosted checkout
- [ ] `payments` / `payment-events` with unique provider event id
- [ ] Signed webhook route with replay window
- [ ] Provider refunds; reconciliation job

### Merchant & SaaS
- [ ] Staff invite/accept/revoke/role change
- [ ] Merchant `/cms` login + store switcher
- [ ] Merchant store profile editing (branding, contact, currency, timezone)
- [ ] Custom domains with DNS verification
- [ ] Onboarding guards (verified email, caps, reserved names, active plans, one trial)
- [ ] Entitlement enforcement (products, staff, storage)
- [ ] Trial expiry / grace / restriction job
- [ ] Billing provider subscriptions + webhooks + invoices
- [ ] Platform overview dashboard; audit of platform actions

### Reliability & tests
- [ ] Transactional outbox + worker with retries/dead-letter
- [ ] Jobs `autoRun` only on a worker instance
- [ ] Shared rate limiter
- [ ] Tenant-isolation / permission / checkout / webhook / refund / concurrency tests in CI
- [ ] Sentry tracing + source maps; automated restore test
