# 09 · Testing gaps and production risks

State audited: **commit `aab6879`**. Commands below were actually run during the audit on Windows / Node 25 with the repo's lockfile.

## 1. What was run

| Command | Result |
|---|---|
| `npx vitest run` | **40 / 40 tests passed** in 5 files (access, invoice, money, safety, search), ~10 s |
| `npx tsc --noEmit` | **0 errors** (note: `scripts/` is excluded from `tsconfig.json`) |
| `npx eslint . --max-warnings=0` | **Fails**: 0 errors, 2 warnings (`managers`, `nobody` unused in `src/payload/collections/inventory.ts:2`) |
| `npx payload migrate` (empty local PostgreSQL) | **Failed** with `DuplicateFieldName: 'store'`; after removing the duplicate field all 31 migrations applied |
| `npm audit --omit=dev` | 20 advisories (13 high, 7 moderate) |

Not run (need a seeded database and/or a running server): `scripts/tests/stock-race.ts`, `scripts/tests/security-sweep.mjs`,
`scripts/tests/crawl.mjs`, `scripts/smoke-test.mjs`, `scripts/load-test.mjs`, `scripts/migrate/url-check.mjs`.

**Passing unit tests do not imply a working app**: tsc, vitest and eslint all pass while the Payload config cannot even be built, and
`tests/unit/access.test.ts:24-28` asserts the insecure behaviour (merchant roles treated as global owner/manager).

## 2. Coverage by category

| Category | Exists | Gap | Proposed test |
|---|---|---|---|
| Unit — money/delivery/coupon math | ✅ `money.test.ts` | free-delivery after discount, refund cap | extend `money.test.ts` |
| Unit — access helpers | ⚠ `access.test.ts` | encodes the insecure merchant mapping; no tenant cases | rewrite around store memberships |
| Collection / field access (Payload Local API, `overrideAccess:false`) | ✗ | would have caught SEC-01..04 | `scripts/tests/tenant-isolation.ts` against a real DB, in CI |
| Tenant isolation (store A user vs store B data) | ✗ | — | same script: products, orders, customers, settings, endpoints |
| Permission matrix (owner/manager/staff/customer per store) | ✗ | — | table-driven Local API tests |
| Checkout action (`placeOrder`) incl. idempotency | ✗ | only pricing helpers | DB test: same `attemptId` twice → one order |
| Payment webhook (signature, replay, dedup) | ✗ (no webhook exists) | — | unit tests for signature verification + event processor |
| Inventory concurrency | ⚠ `stock-race.ts` (single line, not in CI) | multi-line orders, variants, deadlock ordering | extend + run in CI (Postgres service already available) |
| Refunds | ✗ | cap, partial, restock | DB test on return-requests hooks |
| Migrations | ⚠ additive-only regex + migrate on empty DB | no config ↔ snapshot drift check (how the missing SaaS migration slipped in) | CI step that fails if `migrate:create` would produce changes |
| End-to-end (browser) | ✗ | — | Playwright: browse → cart → checkout (COD) → admin marks delivered |
| Notifications / jobs | ✗ | retries, crash safety | outbox processor unit tests |

## 3. Unverified behaviour (needs a running system)

- Mobile responsiveness and page performance (prior audit reported LCP 3.8–6.5 s on mobile; not re-measured).
- Next.js server-action Origin enforcement behind Railway's proxy.
- Whether Payload's `/users/refresh-token` runs `beforeLogin` (affects the 2FA bypass window).
- Customer count and sales-by-channel figures on the dashboard.

## 4. Production risks

| Risk | Why it matters | Evidence |
|---|---|---|
| App does not boot at this commit | every CMS-backed page, admin and health check fail | `inventory.ts:24-25` |
| Config/DB drift | login and catalog queries reference missing columns | `src/migrations/index.ts` |
| CI not running on pushes to `main` | regressions reach Railway unchecked | `.github/workflows/ci.yml:7` |
| Backups not building | no restorable backup after the next rebuild | `scripts/backup/Dockerfile:11-12` |
| Migrations run against the live DB during image build | a failing build can still change production | `scripts/docker-build.sh:23-30` |
| Notifications lost on crash/redeploy | customers not told about cancellations; duplicates on retry | `notify.ts:100-103`; `engagement-jobs.ts:157-158` |
| Jobs queue in every instance | duplicate scheduled work when scaled out | `payload.config.ts:123-127` |
| In-memory rate limits | limits reset on deploy, multiply by instance count | `rate-limit.ts:11` |
| No restore drill | backups unproven | `docs/BACKUP-RESTORE.md` |
