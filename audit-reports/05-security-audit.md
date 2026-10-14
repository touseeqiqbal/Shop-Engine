# 05 · Security audit

State audited: **commit `aab6879`**. Static review of every auth, access, endpoint and money path; no live exploitation was performed.
Two facts change how the findings below should be read:

1. At this commit the Payload config does not build (duplicate `store` field) and the multi-tenant tables have no migration, so the SaaS code paths
   could not run as committed. **The moment those two blockers are fixed (a routine step), SEC-01 to SEC-03 become live.**
2. Before the SaaS changes this was a well-hardened single-store app (2FA, signed order cookies, atomic stock, sanitised HTML, safe paths).
   Nearly every serious finding comes from the multi-tenant layer being bolted onto single-store role checks.

Severity counts: **CRITICAL 3 · HIGH 6 · MEDIUM 11 · LOW 9**.

## CRITICAL

### SEC-01 · Any customer can make themselves platform admin or join any tenant
- **Files:** `src/payload/collections/Users.ts:197-225` (`platformRole`, `stores`, `currentStore` have no field `access`); `src/payload/access.ts:120-128` (`editableUsers` allows self-update); `src/payload/collections/Users.ts:103-115` (the rank guard checks `role` only); consumers `access.ts:57,74`.
- **Conditions:** a storefront account (open sign-up, no email verification). `POST /cms-api/users/login` issues a Payload token to customers.
- **Exploit:** `PATCH /cms-api/users/<own id>` with `{"platformRole":"platform_admin"}` or `{"stores":[<id>]}` (ids are sequential).
- **Impact:** full CRUD on stores, memberships, plans, subscriptions (e.g. mark own subscription active), invoices and the catalog of every tenant including the original shop. Not recorded in the activity log (`history.ts:185-188` skips non-staff actors).
- **Fix:** platform-admin-only field access on all three fields plus a `beforeChange` guard; derive tenant access from server-managed memberships, never from user-editable arrays.

### SEC-02 · Self-service store creation grants owner/manager/staff rights over every tenant
- **Files:** `src/lib/store-tenant.ts:262-272` (sets `platformRole: "merchant_owner"`), `src/payload/access.ts:43,63-67` (`merchant_*` ⇒ `isStaffUser/isManagerUser/isOwnerUser`), `access.ts:131-136` (`deletableUsers`). Unit tests assert this behaviour (`tests/unit/access.test.ts:24-28`).
- **Conditions:** any signed-in customer opens `/account/stores` and creates a store; then enables 2FA through `/cms-api/2fa/setup` + `/enable` with the pre-2FA token (or immediately if `TWO_FACTOR_REQUIRED=false`).
- **Impact:** read every customer's PII, every order and payment screenshot (`/cms-proof/[id]`); change order and payment status; mint coupons valid on every store; void POS sales; export/erase any person (`privacy.ts:58,81,116`); overwrite all globals via `config-import`; **delete any user including the platform owner**; message other stores' customers via resend-confirmation.
- **Fix:** separate platform authority from store authority; store roles come only from active `store-memberships`; scope every collection, global and custom endpoint by store.

### SEC-03 · Merchants can change the platform-wide payment account details (payment diversion)
- **Files:** `src/payload/globals/commerce.ts:73` (`payments` global `update: managers`), reachable via SEC-02.
- **Impact:** the bank IBAN / JazzCash / EasyPaisa numbers shown to **every** store's customers at checkout can be replaced with the attacker's.
- **Fix:** payment details per store, editable only by that store's owner/manager; platform globals editable by platform admins only.

## HIGH

| ID | Finding | Files | Exploit conditions | Impact | Remediation |
|---|---|---|---|---|---|
| SEC-04 | Store filter ignored on **create** | `access.ts:69-78`; Payload `create.js:126-130`; `catalog.ts:297,342,407,573`; `inventory.ts:24,103,147`; `catalog.ts:68-91` | any user with ≥1 store id | plant products/categories/reviews in another tenant or with `store=null` (shown on the main storefront) | create access validates `data.store`; `beforeChange` assigns store from verified membership and locks it |
| SEC-05 | Customers obtain Payload REST tokens | Payload `users/login`; `src/proxy.ts:71` | any account | enables SEC-01; enlarges attack surface of all `/cms-api` routes | refuse admin/REST login for accounts with no admin authority (`beforeLogin`), keep storefront login on the local API |
| SEC-06 | Legacy staff escalate to owner by creating a store; storefront login skips 2FA | `store-tenant.ts:268`; `access.ts:67`; `two-factor.ts:176` | a `staff` account password | owner rights (cost prices, config import, delete users) | never derive store authority from `platformRole`; require 2FA for admin-capable accounts everywhere |
| SEC-07 | Privacy find/export/erase is platform-wide and unlogged | `privacy.ts:28-49,113-157` | any manager-level account (every merchant) | bulk PII export, erasure of other merchants | platform-admin or store-scoped; activity-log every call |
| SEC-08 | Cross-tenant print/proof/file routes | `cms-print/[id]/route.ts:36-38`, `credit-note/[id]/route.ts:32-34`, `cms-proof/[id]/route.ts:14-17`, `cms-file/route.ts:17` | Staff (any merchant) + sequential ids | invoices, credit notes, payment screenshots of all stores | check the document's store against the caller's memberships |
| SEC-09 | No friction on sign-up or store creation | `account/actions.ts:65-80`; `account/stores/actions.ts:27-49` | scripted | mass tenant creation, each with SEC-02 rights; DB spam | verified email + Turnstile + per-user store cap + shared rate limiter |

## MEDIUM

| ID | Finding | Files | Remediation |
|---|---|---|---|
| SEC-10 | In-memory, per-instance rate limits; client IP from last XFF entry / `x-real-ip` | `rate-limit.ts:11-38`; `proxy.ts:35-45`; `client-ip.ts:13-14` | shared store (Postgres/Redis) and a trusted-proxy setting |
| SEC-11 | Anyone can lock any account (10 failures → 15 min), incl. the owner | `Users.ts:48-49` | progressive delay/CAPTCHA, IP-aware lockout |
| SEC-12 | Session revocation gaps: 30-day storefront JWT survives REST password change; logout only clears cookie | `src/auth.ts:23`; `sales.ts:355,390` | set `sessionsValidAfter` whenever the password changes; shorter max age |
| SEC-13 | Activity log: managers read all tenants' entries; platform collections, config-import, privacy-erase and REST logins not logged | `history.ts:81,185-188,244-248` | store-scoped read; log every authenticated actor and all collections |
| SEC-14 | Perpetual free trial / unpaid paid plan | `store-tenant.ts:163-183,361-373,417-506` | trial once per store, active plans only, paid plans gated on payment |
| SEC-15 | Empty CSRF origin list if no site URL env is set; tenant subdomains on the same registrable domain count as same-site | `payload.config.ts:66-83` | require `serverURL`; host admin on a separate domain from tenant storefronts |
| SEC-16 | Refunds can exceed the amount paid | `aftersales.ts:163-167` | cap cumulative refunds at order total minus prior refunds |
| SEC-17 | Payment-proof screenshots have no transaction reference / duplicate check; any staff can mark paid | `checkout/actions.ts:219-256,292`; `content.ts:114-116`; `OrderPanel.tsx:338` | require unique transaction id; manager approval for paid |
| SEC-18 | POS sales editable via REST outside the void flow | `shop.ts:120` | `update: nobody`; void only via endpoint |
| SEC-19 | Coupon counter drift lets a code exceed its limit | `content.ts:180-188,212` | `couponConsumed` flag; release only if consumed |
| SEC-20 | `csv-parse <7.0.2` (GHSA-8cw4-87c7-c6xx) reachable through CSV import | `@payloadcms/plugin-import-export` | restrict imports to managers; track upstream fix |

## LOW

| ID | Finding | Files |
|---|---|---|
| SEC-21 | Turnstile fails open and is absent on login/register/forgot/createStore | `turnstile.ts:14,28-31` |
| SEC-22 | CSP allows `'unsafe-inline'` scripts; `/cms*` (incl. print pages) has no CSP | `next.config.ts:19,54` |
| SEC-23 | `/api/health` publicly returns configuration warnings | `health/route.ts:18,36` |
| SEC-24 | Reserved subdomains (`admin`, `api`, `www`, `cms`) claimable; custom domains unverified | `store-tenant.ts:34-42,140`; `Stores.ts:41` |
| SEC-25 | POS sale double submit; resend-confirmation has no rate limit | `pos.ts:70-176`; `orders.ts:130-143` |
| SEC-26 | Account enumeration by timing (legacy bcrypt only when a legacy hash exists) | `Users.ts:73-99` |
| SEC-27 | `/api/products` returns staff-only stock/soldCount/variant data for arbitrary ids | `api/products/route.ts:22-27` |
| SEC-28 | Abandoned-cart draft for another contact can be overwritten; stop link is a state-changing GET | `engagement.ts:135-139`; `cart/restore/[token]/page.tsx:12` |
| SEC-29 | Confirm-code attempt counter is read-modify-write | `confirm.ts:36-44` |

## Checked and found sound

| Control | Evidence |
|---|---|
| Password hashing | Payload PBKDF2-SHA256 (600k); legacy bcrypt upgraded on login (`Users.ts:73-99`) |
| Cookies | HttpOnly, SameSite=Lax, Secure in production (`Users.ts:50`, `src/auth.ts:23`) |
| 2FA | TOTP with replay protection, AES-GCM-encrypted secrets, hashed backup codes, lockout (`two-factor.ts:67-168`) |
| SQL injection | All raw SQL via Drizzle's parameterised `sql` template; the one `sql.raw` uses an internal union (`stock.ts:294`) |
| XSS | `sanitizeHtml` on Markdown/rich text; hex-validated theme CSS; JSON-LD escapes `<` (`sanitize.ts`, `chrome-types.ts:125`) |
| Path traversal / open redirect | `isPublicMediaKey`, `safePath`, same-origin redirect checks (`lib/media.ts:14-35`, `safe-path.ts`, `proxy.ts:88-89`) |
| Storefront order IDOR | owner or HMAC-signed order cookie; 144-bit confirm tokens (`account/orders/load.ts:25-37`, `order-cookie.ts`, `protection.ts:152`) |
| Cron auth | timing-safe Bearer compare (`api/cron/route.ts:12-19`) |
| File uploads | type sniffing, size caps, private bucket for customer photos (`uploads.ts:9-34`) |
| CORS | not enabled (no ACAO headers) |
| Secrets | production refuses to start without `DATABASE_URL`/`PAYLOAD_SECRET`/`AUTH_SECRET` (`startup-checks.ts:10-18`) |

## Dependencies (`npm audit --omit=dev`, run during the audit)

20 advisories: **13 high, 7 moderate, 0 critical** across 664 production packages — `braces ≤3.0.3` (ReDoS, via Payload storage/sass),
`deepmerge-ts <8` (via Prisma config), `csv-parse <7.0.2` (via import-export plugin, runtime-relevant), `esbuild ≤0.24.2` (dev server only,
via drizzle-kit). Most have no non-breaking fix; track Payload/Prisma upstream.

## Backup & recovery

Nightly encrypted `pg_dump` + private-upload archive exists (`scripts/backup/backup.sh`), but the backup image **could not build**
(`scripts/backup/Dockerfile:11-12` contained a literal newline inside the `sed` expression), and restore is a manual, untested runbook
(`docs/BACKUP-RESTORE.md:45-82`).
