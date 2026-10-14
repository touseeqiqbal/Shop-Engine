# 02 · Backend architecture: current vs. target

State audited: **commit `aab6879`** (ShopEngine — *the engine that powers shops*). Read-only inspection plus local reproduction of the boot failure.

## 1. Stack discovered

| Concern | What the code actually uses | Evidence |
|---|---|---|
| Languages | TypeScript (strict), a few `.mjs` scripts | `tsconfig.json`, `scripts/` |
| Frontend | Next.js 16.4 App Router, React 19.3, Tailwind CSS 4, Zustand (cart/UI state), framer-motion | `package.json` |
| Backend | Next.js server components + **server actions** for the storefront; **Payload CMS 3.90** (admin at `/cms`, REST at `/cms-api`) for admin and data | `src/payload.config.ts:94` |
| Database | PostgreSQL. Payload owns schema `payload` (tables `cms_*`); a frozen legacy Prisma schema lives in `public` | `src/payload.config.ts:147-157`, `prisma/schema.prisma` |
| ORM / query | Payload Local API (Drizzle underneath) + raw Drizzle `sql` for stock/locks; Prisma still reachable on a few legacy paths | `src/payload/stock.ts:86-89`, `src/lib/repo/catalog.ts:404-454` |
| Authentication | Storefront: Auth.js v5 credentials (30-day JWT) validated against Payload users. Admin/REST: Payload `payload-token` (7 days) + TOTP 2FA | `src/auth.ts:23-48`, `src/payload/collections/Users.ts:45-50`, `src/payload/two-factor.ts` |
| Authorization | Payload collection/field `access` functions in `src/payload/access.ts`; legacy roles `owner/manager/staff/customer` plus a new `platformRole` | `src/payload/access.ts` |
| API style | REST (Payload auto-REST + custom endpoints), Next route handlers, server actions. GraphQL **disabled** | `src/payload.config.ts:121` |
| Payments | Manual only: COD, bank transfer, JazzCash/EasyPaisa with screenshot proof. No gateway | `src/app/(frontend)/(store)/checkout/actions.ts:219-256` |
| File storage | S3-compatible private bucket, served through `/media/*` | `src/payload.config.ts:178-189`, `src/app/media/[...key]/route.ts` |
| Background jobs | In-process timer → `/api/cron` → housekeeping (advisory lock); Payload jobs queue (`schedulePublish` only) auto-running in every instance | `src/instrumentation.ts:20-42`, `src/lib/housekeeping.ts`, `src/payload.config.ts:123-127` |
| Caching | `unstable_cache` with global keys (e.g. `catalog-snapshot-v4`), tag revalidation | `src/lib/repo/catalog.ts:107-115`, `src/payload/revalidate.ts` |
| Notifications | Email (SMTP/Resend), WhatsApp Cloud API, SMS webhook; sent inline via `after()` | `src/lib/mailer.ts`, `src/lib/notify.ts` |
| Observability | JSON logger, optional Sentry (no tracing), `/api/health`, external uptime monitor script | `src/lib/log.ts`, `src/instrumentation.ts`, `scripts/uptime/monitor.mjs` |
| Deployment | Docker (3-stage, standalone output), Railway, separate backup cron image | `Dockerfile`, `railway.json`, `scripts/backup/` |
| Multi-tenancy | **Schema-only.** `stores`, `store-memberships`, billing collections and `store` fields on a few catalog collections; no tenant resolution, no migration | see §4 |
| Tests | Vitest unit tests (5 files, 40 tests — all passing); DB/server scripts not in CI | `tests/unit/`, `scripts/tests/` |
| CI/CD | GitHub Actions: migration guard, lint, typecheck, unit, migrate on empty DB, build | `.github/workflows/ci.yml` |
| Repo shape | Single Next.js app (not a monorepo) | — |

## 2. Directory map

```
.
├─ src/
│  ├─ app/
│  │  ├─ (frontend)/(store)/      storefront routes: home, [category]/[product], shop, collections, cart, checkout,
│  │  │                           account/* (incl. account/stores = merchant onboarding), returns, track-order, blog …
│  │  ├─ (payload)/               Payload admin (/cms), REST (/cms-api), print/proof/file routes
│  │  ├─ api/                     auth (Auth.js), cron, health, preview, products, search
│  │  └─ feeds/, media/, og/, sitemap.ts, robots.ts, llms.txt
│  ├─ payload/
│  │  ├─ collections/             34 collections: catalog, content (orders/posts), sales, aftersales, shop (POS),
│  │  │                           engagement, inventory, history, Stores, StoreMemberships, billing, Users, Media …
│  │  ├─ globals/                 19 singleton settings documents (theme, shipping, payments, store info, SEO …)
│  │  ├─ endpoints/               custom REST: reports, sales-report, pos, orders, inventory, privacy, 2fa, config-transfer
│  │  ├─ admin/                   custom admin React views (dashboard, POS, reports, stock count, security, privacy)
│  │  ├─ access.ts                role / tenant access helpers
│  │  └─ stock.ts                 atomic stock, coupon and row-lock SQL
│  ├─ lib/                        domain logic: cart-pricing, coupons, cities (shipping), cms/* loaders, repo/*,
│  │                              store-tenant (SaaS onboarding), auth, notify, mailer, rate-limit, search …
│  ├─ components/                 storefront UI
│  ├─ migrations/                 31 Payload migrations (+ JSON snapshots)
│  └─ proxy.ts                    Next 16 proxy: staging auth, auth rate limits, /admin → /cms, redirects
├─ prisma/                        legacy schema + 2 migrations (frozen)
├─ scripts/                       ci/, backup/, uptime/, tests/ (stock-race, security-sweep, crawl), migrate/, maintenance/
├─ tests/unit/                    vitest
└─ docs/                          ops/runbooks and earlier single-store audits
```

## 3. Current architecture

```mermaid
flowchart LR
  subgraph Browser
    SF[Storefront pages<br/>cart in localStorage]
    ADM[/cms admin UI/]
  end
  subgraph NextApp["Next.js 16 app (single process)"]
    PX[proxy.ts<br/>staging auth, auth rate limits, redirects]
    SA[Server actions<br/>checkout, account, stores onboarding]
    RH[Route handlers<br/>/api/*, feeds, media, print]
    PL[Payload CMS 3<br/>REST /cms-api + admin /cms]
    EP[Custom endpoints<br/>reports, POS, inventory, privacy, 2FA]
    HK[Housekeeping timer<br/>→ /api/cron]
    JQ[Payload jobs autoRun<br/>every instance]
    CACHE[(unstable_cache<br/>global keys)]
  end
  PG[(PostgreSQL<br/>schema payload: cms_*<br/>schema public: legacy Prisma)]
  S3[(S3-compatible bucket<br/>private)]
  MAIL[[SMTP / Resend]]
  WA[[WhatsApp Cloud API / SMS webhook]]
  SENTRY[[Sentry - optional]]

  SF --> PX --> SA
  SF --> RH
  ADM --> PL
  ADM --> EP
  SA -->|Local API, overrideAccess| PL
  SA --> CACHE
  RH --> CACHE
  PL --> PG
  EP --> PG
  SA -->|after()| MAIL
  SA -->|after()| WA
  HK --> PG
  JQ --> PG
  PL --> S3
  NextApp -. errors .-> SENTRY
```

Key properties of the current design:
- **One process does everything**: web, admin, REST, background chores and the jobs queue. Scaling to N instances runs the jobs queue N times.
- **The storefront reads one global catalog snapshot** (`src/lib/repo/catalog.ts:107-115`) and 19 global settings documents; there is no notion of "which store is this request for".
- **Authorization is role-based, not tenant-based.** `isStaffUser`/`isManagerUser`/`isOwnerUser` (`src/payload/access.ts:63-67`) answer "is this person staff?", never "staff *of which store*?".
- **Money paths are well built for one shop**: server-side pricing, a single DB transaction for coupon + stock + order (`src/lib/cms/sales.ts:123-166`), atomic conditional stock UPDATE (`src/payload/stock.ts:86-89`).

## 4. Multi-tenant layer: what exists vs. what runs

| Piece | Exists in code | Wired into runtime | Evidence |
|---|---|---|---|
| `stores` collection | Yes | No migration → table missing | `src/payload/collections/Stores.ts` |
| `store-memberships` | Yes | Rows written at onboarding, **never read for authorization** | `src/lib/store-tenant.ts:216-228` |
| Billing (plans, subscriptions, invoices) | Yes | No provider, no lifecycle, no migration | `src/payload/collections/billing.ts` |
| `users.platformRole/stores/currentStore` | Yes | **Self-editable**; no migration | `src/payload/collections/Users.ts:197-225` |
| `store` field on catalog/inventory | 7 collections | Nullable, no default, no migration; duplicated on Suppliers (boot failure) | `catalog.ts:297,342,407,573`, `inventory.ts:24-25,103` |
| `store` on orders, discounts, customers, pages, menus, media … | **No** | — | `content.ts:374-403` |
| Host/subdomain/custom-domain → store | **No** | — | `src/proxy.ts:55-101` |
| Per-store settings (theme, shipping, payments …) | **No** | 19 shared globals | `src/payload.config.ts:141` |
| Plan limits / suspension enforcement | **No** | — | grep finds definitions only |

## 5. Architectural risks and missing infrastructure

| # | Risk | Severity | Evidence |
|---|---|---|---|
| A1 | App cannot boot: duplicate `store` field on Suppliers | Critical | `src/payload/collections/inventory.ts:24-25` (reproduced: `npx payload migrate` → `DuplicateFieldName`) |
| A2 | Config/DB drift: no migration for any SaaS table/column; no drift check in CI | Critical | `src/migrations/index.ts`; `.github/workflows/ci.yml` |
| A3 | Role model conflates "platform" and "store" authority | Critical | `src/payload/access.ts:43,57-67` |
| A4 | No tenant dimension in storefront data, caches, globals, order numbers, coupon codes, slugs, SKUs | High | `repo/catalog.ts:107-115`; `fields.ts:15`; `sales.ts:19`; `repo/orders.ts:18-22` |
| A5 | No payment gateway, no webhook ingestion, no payment-event ledger | High | `docs/DELIVERY-PAYMENTS.md:58` |
| A6 | Side effects (email/SMS/WhatsApp) are fire-and-forget in `after()`; no outbox, retries or dead-letter | High | `checkout/actions.ts:403`, `notify.ts:100-103` |
| A7 | Background work runs inside every web instance (jobs autoRun) | Medium | `src/payload.config.ts:123-127` |
| A8 | Rate limiting is in-memory per instance | Medium | `src/lib/rate-limit.ts:11`, `src/proxy.ts:35-45` |
| A9 | Image build runs migrations against the **live** DB before `next build` | Medium | `scripts/docker-build.sh:23-30` |
| A10 | Legacy Prisma paths still reachable in CMS mode (banners, FAQs, wholesale) | Medium | `src/lib/repo/catalog.ts:404-454`, `src/lib/repo/wholesale.ts:106-108` |
| A11 | Whole catalog held in one cache entry; search scans it per query | Medium (scale) | `src/lib/repo/catalog.ts:107-138`, `src/lib/search.ts` |
| A12 | Module-global mutable `site` object in notify (shared across concurrent requests) | Low | `src/lib/notify.ts:35-41` |

## 6. Recommended target architecture (keeps the current stack)

A rewrite is not needed: Payload's access-control model and the existing transactional stock/coupon code are the right foundations.
The target adds a **tenant dimension everywhere** and **durable side effects**.

```mermaid
flowchart LR
  subgraph Edge
    H[Host header<br/>shop.example.com / sub.platform.tld]
  end
  subgraph App["Next.js + Payload (web role)"]
    PX[proxy.ts]
    TR[Tenant resolver<br/>host → store (cached)]
    SF[Storefront loaders<br/>always filtered by store]
    ACC[Access layer<br/>platform admin | store membership role]
    HOOK[assignStore hooks<br/>store set & locked server-side]
    PAY[Payments module<br/>provider adapters]
    WH[/api/webhooks/:provider<br/>verify signature → payment_events/]
    OB[(outbox_events)]
  end
  subgraph Worker["Worker role (one instance)"]
    W[Outbox processor<br/>retries, backoff, dead-letter]
    SCH[Schedulers<br/>trial expiry, reservation sweep, reconciliation]
  end
  PG[(PostgreSQL<br/>store_id on every tenant row<br/>composite uniques per store)]

  H --> PX --> TR --> SF --> PG
  ACC --> PG
  HOOK --> PG
  PAY --> PG
  WH --> PG
  WH --> OB
  SF --> OB
  OB --> W
  W --> PG
  SCH --> PG
```

Target rules:
1. **Every tenant-owned row has `store_id`** (orders, products, customers' store profile, discounts, pages, menus, media, settings …), set by a server hook, never by the client, immutable after create.
2. **Authority comes from active `store_memberships`** (owner/manager/staff per store). `platformRole` is writable only by platform admins. Legacy `owner` stays the platform super admin; legacy `manager`/`staff` map onto the default store.
3. **Globals become per-store settings** (one row per store), with the existing globals acting as the default store's settings during migration.
4. **Uniqueness is per store**: `(store_id, slug)`, `(store_id, sku)`, `(store_id, code)`.
5. **Storefront resolves the store from the host** (subdomain of the platform domain, verified custom domain, otherwise the default store), refuses suspended/closed stores, and keys every cache by store.
6. **Payments are provider adapters** with hosted checkout, signed webhooks, a `payment_events` table with a unique provider-event id (dedup/replay), and order payment status driven only by verified events.
7. **Side effects go through a transactional outbox** written in the same transaction as the business change and processed by a single worker with retries and a dead-letter state.
8. **Plan entitlements are enforced in `beforeChange` hooks** (product count, staff count, storage) and subscription state gates admin writes and storefront availability.
