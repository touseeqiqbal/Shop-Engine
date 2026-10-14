# 04 · API audit

State audited: **commit `aab6879`**. Interfaces found: Payload auto-REST (`/cms-api/{collection}`, `/cms-api/globals/{slug}`),
Payload custom endpoints (`src/payload/endpoints/*`, `src/payload/collections/catalog.ts:47`), Next route handlers (`src/app/**/route.ts`)
and server actions (`"use server"` files). GraphQL is disabled (`src/payload.config.ts:121`). No tests exercise any endpoint over HTTP.

Abbreviations — **Staff / Manager / Owner** = `isStaffUser` / `isManagerUser` / `isOwnerUser` in `src/payload/access.ts:63-67`.
At this commit all three are **true for any self-service merchant** (`platformRole=merchant_*`) once 2FA is on, so "Staff" does not mean
"staff of this store". Every custom endpoint uses `overrideAccess: true` internally and has **no tenant filter**.

## 1. Payload custom endpoints

| Method | Path | Handler | Auth / permission | Tenant isolation | Validation | Rate limit | Idempotency | Status |
|---|---|---|---|---|---|---|---|---|
| GET | `/cms-api/reports` | `endpoints/reports.ts` | Staff (`:36`) | None | n/a | None | n/a | Partial — all tenants' orders |
| GET | `/cms-api/reports/sales` | `endpoints/sales-report.ts` | Manager (`:39`); cost columns Owner | None | Manual date regex | None | n/a | Partial |
| GET | `/cms-api/config-export` | `endpoints/config-transfer.ts` | Owner (`:36`) | None | n/a | None | n/a | Unsafe for SaaS |
| POST | `/cms-api/config-import` | `endpoints/config-transfer.ts` | Owner (`:64`) | None — overwrites **every global** | `format` string only | None | No; not activity-logged | Unsafe for SaaS |
| GET | `/cms-api/pos/lookup` | `endpoints/pos.ts` | Staff (`:46`) | None | Manual | None | n/a | Partial |
| POST | `/cms-api/pos/sale` | `endpoints/pos.ts` | Staff (`:73`); below-list price needs Manager (`:99-108`) | None | Manual numeric | None | **No key** (double click = two sales) | Partial |
| POST | `/cms-api/pos/void` | `endpoints/pos.ts` | Manager (`:185`) | None | Manual | None | Row lock | Partial |
| GET/POST | `/cms-api/pos/cashup` | `endpoints/pos.ts` | Staff (`:278,:290`) | None | Manual | None | No | Partial |
| POST | `/cms-api/order-tools/resend-confirmation` | `endpoints/orders.ts` | Staff (`:134`) | None | `num()` | **None** (SMS/WhatsApp spam) | No | Partial |
| GET | `/cms-api/order-tools/rto` | `endpoints/orders.ts` | Staff (`:151`) | None — all customers' names/phones | Date regex | None | n/a | Partial |
| POST | `/cms-api/stock-count/{start,scan,set,finish}` | `endpoints/inventory.ts` | Staff; apply = Manager (`:172`) | None | Manual | None | No | Broken (double subtract, `:70,82-83,183`) |
| POST | `/cms-api/products/:id/create-variants` | `collections/catalog.ts:43-98` | Staff (`:47`) | None; variants created without `store` | Manual | None | Skips existing combos | Partial |
| GET | `/cms-api/privacy/find`, `/privacy/export` | `endpoints/privacy.ts` | Manager (`:58,:81`) | **None — any person, all tenants** | email/phone match | None | n/a | Unsafe |
| POST | `/cms-api/privacy/erase` | `endpoints/privacy.ts` | Manager (`:116`) + `confirm:"DELETE"` | **None** (can erase other merchants) | Manual | None | No; not logged | Unsafe |
| GET | `/cms-api/2fa/status` | `endpoints/two-factor.ts` | Any authenticated | Self | n/a | None | n/a | OK |
| POST | `/cms-api/2fa/{setup,enable,backup-codes,disable}` | `endpoints/two-factor.ts` | Any authenticated; code required once enabled | Self | Manual | 10/10 min/user (memory) | n/a | OK |
| POST | `/cms-api/2fa/reset` | `endpoints/two-factor.ts` | `role==="owner"` + Owner (`:318`) | None | `Number()` | None | n/a | OK |
| POST | `/cms-api/2fa/login` | `endpoints/two-factor.ts` | Public; rejects `role==="customer"` (`:341`) | n/a | Manual | 10/10 min/IP + proxy | n/a | Broken for merchants (they keep role `customer`) |

## 2. Payload auto-REST

| Operation | Path | Notes |
|---|---|---|
| CRUD | `/cms-api/{collection}[/:id]` | Governed by each collection's `access`. 34 collections; only 7 carry a `store` field and their create access ignores it (`create` treats a `Where` result as allowed, `payload/dist/collections/operations/create.js:126-130`). |
| Read/Update | `/cms-api/globals/{slug}` | 19 platform-wide globals; most writable by Manager (incl. **payments** account numbers, `globals/commerce.ts:73`). |
| Auth | `/cms-api/users/{login,logout,refresh-token,forgot-password,reset-password,unlock,first-register}` | `login` is open to **every** account including customers (no `access.admin` check), returning a token accepted by all `/cms-api/*` routes. Proxy rate-limits login/forgot/reset only (`src/proxy.ts:30-34`). |
| Self update | `PATCH /cms-api/users/:id` | `editableUsers` lets a customer update themselves; `platformRole`, `stores`, `currentStore` have no field access → **privilege escalation** (`Users.ts:197-225`). |

## 3. Next.js route handlers

| Method | Path | Auth | Tenant | Validation | Rate limit | Status |
|---|---|---|---|---|---|---|
| GET/POST | `/api/auth/[...nextauth]` | Auth.js (own CSRF token) | n/a | zod (`src/auth.ts:14`) | proxy 20/10 min on callback | OK |
| POST | `/api/cron` | Bearer `CRON_SECRET` / internal key, timing-safe (`cron/route.ts:12-19`); 404 if unset | n/a | `reason` ≤20 chars | None | OK |
| GET | `/api/health` | Public | n/a | n/a | None | Discloses config warnings (`health/route.ts:18,36`) |
| GET | `/api/preview` | Staff (`preview/route.ts:16`) + `safePath` | None | `safePath` | None | OK |
| POST | `/api/preview/exit` | Public, same-origin referer redirect | n/a | n/a | None | OK |
| GET | `/api/products?ids=` | Public | None | regex, ≤12 ids | CDN cache | Leaks staff-only stock/soldCount/variant data (`route.ts:22-27`) |
| GET | `/api/search?q=` | Public | None | ≤80 chars | None | OK (single tenant) |
| GET | `/feeds/{google.xml,meta.xml,tiktok.csv}` | Public, switchable | None | n/a | None | OK (single tenant) |
| GET | `/media/[...key]`, `/feed-image/[...key]` | Public, folder allow-list (`lib/media.ts:14-35`) | n/a | traversal-safe | None | OK |
| GET | `/products/[slug]`, `/llms.txt`, `/og/blog/[slug]` | Public | None | slug | None | OK |
| GET | `/cms-file?key=` | Staff (`cms-file/route.ts:17`) | None | regex allow-list | None | Cross-tenant |
| GET | `/cms-print/[id]`, `/cms-print/credit-note/[id]`, `/cms-print/labels` | Staff | **None (sequential ids)** | `^\d+$`, HTML-escaped | None | Cross-tenant |
| GET | `/cms-proof/[id]` | Staff (`cms-proof/[id]/route.ts:14`) | **None** — payment screenshots | `payments/` prefix | None | Cross-tenant |
| GET | `/account/orders/[n]/invoice` | Order owner or signed order cookie (`account/orders/load.ts:25-37`) | Per user | `ORDER_NUMBER_RE` | None | OK |

## 4. Server actions

| File | Actions | Auth | Validation | Abuse protection | Status |
|---|---|---|---|---|---|
| `account/actions.ts` | login, register, forgot, reset, resendConfirmation | Public (resend: session) | zod | 10/5/5/10/3 per window per IP; register has honeypot only, **no Turnstile** | OK |
| `account/actions.ts` | saveAddresses, syncWishlist, setWishlist | Session | zod | None | OK |
| `account/actions.ts` | findOrdersByPhone | Public | phone normalisation | 8/10 min/IP + 3/day/phone | OK |
| `account/stores/actions.ts` | **createStore** | Any session | zod | **None** — no verification, captcha, cap; grants global `merchant_owner` | Unsafe |
| `account/stores/actions.ts` | acceptInvitation | Session + membership owner | not zod | None | Broken (no status check) |
| `account/stores/actions.ts` | publishStore | Store owner | not zod | None | Broken (resets trial, un-suspends) |
| `cart/actions.ts` | repriceCart, applyCoupon | Public | zod | — / 30 per 10 min | OK |
| `checkout/actions.ts` | **placeOrder** | Public | zod; screenshot type sniffed, ≤5 MB | honeypot + Turnstile + 20/10 min/IP + 5/h/phone; `attemptId` idempotency | OK (single tenant) |
| `checkout/draft-actions.ts` | saveDraft | Public | — | 30/10 min + 6/h/contact | Partial (can overwrite another contact's draft) |
| `confirm-order/actions.ts` | confirmByLink, cancelByLink, confirmByCode | 144-bit token / signed cookie | regex | 20/10 min; 6/10 min + per-order tries | OK |
| contact, returns, warranty, sell-your-laptop, wholesale, review, askQuestion | various | Public | zod | honeypot + Turnstile + per-IP/h; uploads sniffed, private bucket (`uploads.ts:9-34`) | OK |
| subscribeAlert, lookupForReturn, trackOrder | various | Public | partly zod | 10/h, 15/10 min, 15/10 min | Partial (POS receipt regex wrong, `returns/actions.ts:21`) |
| `order-confirmation/actions.ts` | createAccountFromOrder | Signed cookie | — | 5/30 min | OK |

No `serverActions.allowedOrigins` is configured; Next's default Origin/Host check is relied upon (behaviour behind Railway's proxy not verified).

## 5. Missing API operations (Shopify-like baseline)

| Area | Missing operation | Priority |
|---|---|---|
| Payments | `POST /api/payments/:provider/checkout` (create hosted session), `POST /api/webhooks/:provider` (signed), refund via provider, payment events read | P0 |
| Tenancy | host → store resolution; store switcher (`POST /cms-api/stores/switch`); merchant store settings update | P0 |
| Staff | invite (`POST` membership invite by email + token), accept by token, change role, revoke | P1 |
| SaaS billing | plan checkout / change / cancel, billing webhook, invoice list | P1 |
| Orders | fulfillment create/cancel (partial), refund create with cap, payment mark-paid with reference | P1 |
| Checkout | server cart / checkout session create + expire | P2 |
| Customers | store-scoped customer CRUD, marketing consent, self-service data export | P2 |
| Platform admin | overview metrics, suspend/reactivate store, impersonation with audit | P1–P2 |
| Domains | add custom domain, verify (DNS TXT), status | P1 |
