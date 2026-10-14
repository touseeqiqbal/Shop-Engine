# 07 · Missing and incomplete features

State audited: **commit `aab6879`**. Only rows that are **Broken**, **Missing**, **Partial** or **Not Verified** in
`01-feature-checklist.md` appear here, grouped by priority and then by module.
P0 = security, tenant isolation, payment/data integrity, core purchasing · P1 = essential merchant workflows and reliability ·
P2 = important commercial features · P3 = advanced/optional.

| Priority | Broken | Missing | Partial | Not Verified |
|---|---|---|---|---|
| P0 | 15 | 21 | 9 | 0 |
| P1 | 8 | 31 | 52 | 0 |
| P2 | 1 | 26 | 26 | 4 |
| P3 | 0 | 13 | 4 | 0 |

## P0

### Access control

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Staff: per-store roles | Broken | `store_owner/manager/staff` never evaluated; `merchant_*` mapped to global legacy roles. | `src/payload/access.ts:63-67` |
| Staff: revoke access | Broken | Access derives from `users.stores`; suspending/deleting a membership changes nothing. | `src/payload/access.ts:34-38` |
| Different roles in different stores | Broken | Role is a single global `platformRole`, overwritten on each create/accept. | `src/lib/store-tenant.ts:268,323` |
| Tenant data isolation | Broken | Any merchant (self-service) gets staff/manager/owner over every tenant's orders, customers and settings. | `src/payload/access.ts:63-67,85-87` |
| Field-level protection of role/tenant fields | Broken | `platformRole`, `stores`, `currentStore` have no field access: self-PATCH → platform admin. | `src/payload/collections/Users.ts:197-225` |
| Platform super-admin role | Partial | Legacy `owner` or `platformRole=platform_admin`; but `platformRole` is self-assignable (see Broken row below). | `src/payload/access.ts:57` |
| Backend authorization enforced | Partial | Payload access functions run server-side, but merchant roles are global. | `src/payload/access.ts` |
| Secure session management | Partial | Good cookie flags; 30-day storefront JWT survives password change; storefront login skips 2FA. | `src/auth.ts:23; src/payload/two-factor.ts:176` |

### Onboarding

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| 4. Create store | Broken | No migration for `cms_stores` etc. → runtime failure; also grants global owner rights. | `src/lib/store-tenant.ts:133-275` |
| 9. Configure payment providers | Missing | Only a platform-wide global. | `src/payload/globals/commerce.ts:73` |

### Store management

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Tenant isolation of store-specific operations | Broken | See Access control. | `src/payload/access.ts:63-87` |
| Suspension enforcement | Missing | Never read by storefront or admin. | `—` |
| Subdomain routing | Missing | No host → store resolution. | `src/proxy.ts:55-101` |
| Store memberships | Partial | Rows written but never used for authorization. | `src/payload/collections/StoreMemberships.ts` |

### Products

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Tenant ownership of products | Broken | No migration; null by default; create ignores the store filter. | `src/payload/collections/catalog.ts:407; src/payload/access.ts:69-78` |
| Storefront hides unpublished | Partial | Variants of draft/archived parents remain visible and sellable. | `src/lib/repo/catalog.ts:136-138` |

### Variants

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Variant + upgrade purchasable | Broken | Checkout rejects the line; cart silently drops it. | `src/components/product-detail/buy-box.tsx:42; src/lib/cart-pricing.ts:57-61` |

### Collections

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Tenant scoping | Missing | No store field. | `src/payload/collections/ProductCollections.ts:21` |

### Inventory

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Concurrent checkout safety | Partial | Lines locked in cart order → deadlock possible. | `src/payload/stock.ts:201-212` |

### Storefront

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Per-tenant routing | Missing | One global catalog snapshot. | `src/proxy.ts; src/lib/repo/catalog.ts:107-115` |

### Themes

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Per-store theme | Missing | Globals are shared by all tenants. | `src/payload.config.ts:141` |

### Cart & checkout

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Payment initialization (online) | Missing | — | `—` |
| Order attributed to a store | Missing | — | `src/lib/cms/sales.ts:77-108` |
| Duplicate order prevention / idempotency | Partial | Only when the client sends `attemptId`. | `src/lib/cms/sales.ts:125-127; migrations/20261006_213603_order_safety.ts:8` |

### Payments

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Per-store payment account details | Broken | Shared global editable by any merchant manager → payment diversion. | `src/payload/globals/commerce.ts:73` |
| Online payment provider | Missing | Card rejected. | `docs/DELIVERY-PAYMENTS.md:58` |
| Merchant payment account onboarding | Missing | — | `—` |
| Hosted secure collection | Missing | — | `—` |
| Payment event history | Missing | — | `—` |
| Webhook signature verification | Missing | No webhook route exists. | `—` |
| Replay protection & dedup | Missing | — | `—` |
| Idempotency keys | Missing | — | `—` |

### Orders

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Refund cap | Broken | Refunds can exceed what was paid. | `src/payload/collections/aftersales.ts:163-167` |
| Tenant scoping of orders | Missing | No store field. | `src/payload/collections/content.ts:403` |
| Order status state machine | Partial | Mostly free-form (cancelled→delivered allowed). | `src/payload/collections/content.ts:106-116` |

### Customers

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| PII tenant isolation | Broken | Any merchant can find/export/erase any person. | `src/payload/endpoints/privacy.ts:58,81,116` |
| Store-scoped customer records | Missing | Users is global. | `src/payload/collections/Users.ts:16-19` |

### Analytics

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Store-scoped analytics | Missing | All tenants' orders. | `src/payload/endpoints/reports.ts:36` |

### Jobs & integrations

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Webhook receiving | Missing | — | `—` |

### Production readiness

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Application boots (Payload config valid) | Broken | Duplicate `store` field → DuplicateFieldName at boot (reproduced locally). | `src/payload/collections/inventory.ts:24-25` |
| Database migrations match config | Broken | No migration for stores/memberships/billing/store_id/platform_role. | `src/migrations/index.ts` |
| Database backups | Broken | Backup image cannot build (literal newline in sed). | `scripts/backup/Dockerfile:11-12` |
| Tenant-isolation tests | Missing | — | `—` |
| Checkout / payment webhook / refund tests | Missing | — | `—` |
| Permission tests (collection/field) | Partial | Helper-level only. | `tests/unit/access.test.ts` |

## P1

### Access control

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Staff: accept invitation | Broken | No `status==='invited'` check; overwrites global `platformRole` (demotes owners of other stores). | `src/lib/store-tenant.ts:283-301,323` |
| Merchant: manage employees | Missing | Only platform admins can create memberships. | `src/payload/collections/StoreMemberships.ts:27` |
| Staff: invite | Missing | No invite UI, API, token or email. | `—` |
| Super admin: view merchants & stores | Partial | Raw Payload collection only; no platform UI or nav entry (UrkoNav.tsx). | `src/payload/collections/Stores.ts:15-28` |
| Super admin: create / suspend / reactivate stores | Partial | CRUD exists; `status` is never enforced anywhere. | `src/payload/collections/Stores.ts:26-28,34-39` |
| Super admin: manage SaaS plans | Partial | Collection CRUD only. | `src/payload/collections/billing.ts:5-46` |
| Super admin: monitor subscriptions & invoices | Partial | Collections exist; nothing generates invoices or transitions status. | `src/payload/collections/billing.ts:47-158` |
| Super admin: audit log review | Partial | Activity log exists; platform collections and non-staff actors not logged. | `src/payload/collections/history.ts:81,185-188,244-248` |
| Merchant: create & configure own store | Partial | Create only; merchants cannot update their own store (update is platform-admin only). | `src/lib/store-tenant.ts:133-275; Stores.ts:27` |
| Staff: restrict sensitive operations | Partial | Field-level rules (cost owner-only, price manager-only) exist for the single shop. | `src/payload/collections/catalog.ts:430-432` |
| One user in multiple stores | Partial | Modelled, but no migration creates the columns/tables. | `src/payload/collections/Users.ts:211-225` |

### Onboarding

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| 8. Plan / trial selection | Broken | Archived/paid plans selectable without payment; trial resets on every publish. | `src/lib/store-tenant.ts:163-183,361-373` |
| 13. Publish store | Broken | Un-suspends suspended stores, resets trial; store is not routable. | `src/lib/store-tenant.ts:333-415` |
| 10. Configure shipping | Missing | Only a platform-wide global. | `src/payload/globals/commerce.ts:23` |
| 12. Storefront branding | Missing | `logo`/`brandColor` never read; theme is a shared global. | `src/payload/collections/Stores.ts:47-48` |
| 3. Email verification before store creation | Partial | Verification exists but is not required to create a store. | `src/lib/auth.ts:173-177` |
| 5. Unique slug / subdomain | Partial | Check-then-create race; no reserved names (`admin`, `api`, `www`). | `src/lib/store-tenant.ts:34-42,150-161` |
| 6. Country & currency | Partial | Stored, never used (storefront hardcodes Rs/en-PK). | `src/lib/store-tenant.ts:194-197; src/lib/utils.ts:7-11` |
| 7. Default settings initialized | Partial | Only a `settings` JSON blob; real settings are shared globals. | `src/lib/store-tenant.ts:205-210` |
| 11. Add products | Partial | Store field exists but defaults to null and has no migration. | `src/payload/collections/catalog.ts:395,407` |

### Store management

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Logo & branding per store | Missing | Unused. | `src/payload/collections/Stores.ts:47-48` |
| Contact information per store | Missing | Unused; storefront reads StoreInfo global. | `src/payload/collections/Stores.ts:49-50` |
| Currency configuration | Missing | Hardcoded PKR. | `src/lib/utils.ts:7-11` |
| Custom domain connection | Missing | Text field, no uniqueness/validation. | `src/payload/collections/Stores.ts:41` |
| Domain ownership verification | Missing | — | `—` |
| Multi-store switching | Missing | `getCurrentStoreForUser` unused; no switcher. | `src/lib/store-tenant.ts:508-519` |
| Store CRUD | Partial | — | `src/payload/collections/Stores.ts` |
| Store ownership | Partial | — | `src/payload/collections/Stores.ts:46` |
| Status lifecycle (active/suspended/closed) | Partial | Field only. | `src/payload/collections/Stores.ts:34-39` |

### Products

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Delete / archive | Partial | Archive OK; delete has no guard and legacy staff can now delete. | `src/payload/collections/catalog.ts:395,539-546` |
| URL slug | Partial | Unique across the whole DB, so tenants collide. | `src/payload/fields.ts:11-33` |
| Historical order integrity after delete | Partial | Title/price snapshotted; SKU and option values lost. | `src/payload/collections/content.ts:438-451` |

### Inventory

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Stock count accuracy | Broken | Sales during a count are subtracted twice. | `src/payload/endpoints/inventory.ts:70,82-83,183` |
| Inventory items | Partial | Stock column per product + serial units. | `src/payload/collections/shop.ts:56-90` |
| Stock adjustment | Partial | Admin save reads stock without a lock and writes it back (lost-update race). | `src/payload/collections/catalog.ts:122-148` |
| Reservations | Partial | Stock taken at order placement; no checkout hold. | `src/payload/stock.ts:238-247` |
| Reservation expiry | Partial | Unconfirmed COD auto-cancel only. | `src/lib/cms/confirm.ts:95-125` |
| Adjustment permissions | Partial | Not tenant-scoped. | `src/payload/endpoints/inventory.ts:172` |
| Purchase receiving concurrency | Partial | No row lock; double receive doubles stock. | `src/payload/collections/inventory.ts:44-88` |

### Cart & checkout

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Tax calculation | Missing | — | `—` |
| Checkout sessions & expiry | Missing | Stateless server action. | `—` |
| Inventory reservation | Partial | At placement only. | `src/lib/cms/sales.ts:137-153` |

### Payments

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Authorization / capture | Missing | — | `—` |
| Provider refunds | Missing | — | `—` |
| Reconciliation | Missing | No COD remittance reconciliation. | `—` |
| Provider reference IDs | Missing | Screenshots can be reused across orders. | `src/app/(frontend)/(store)/checkout/actions.ts:292` |
| Merchant payouts via provider | Missing | — | `—` |
| Failure / cancellation handling | Partial | Order cancel only. | `src/payload/collections/content.ts:196-214` |
| Partial refunds | Partial | Manual credit notes. | `src/payload/collections/aftersales.ts:155-265` |
| Customer payments separate from SaaS billing | Partial | Separate collections; neither has a provider. | `src/payload/collections/billing.ts` |

### Orders

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Coupon usage consistency | Broken | Admin-created orders don't consume, cancellation releases → limit bypass. | `src/payload/collections/content.ts:180-188,212` |
| Concurrent edit safety | Broken | Row lock only with `expectStatus`; double restock possible. | `src/payload/collections/content.ts:84-90` |
| Tax snapshots | Missing | — | `—` |
| Fulfillment status (separate field) | Missing | Fulfillment folded into order status. | `src/payload/collections/content.ts:47-57` |
| Order number generation | Partial | Unique + retry; `UTS-` prefix hardcoded. | `src/lib/repo/orders.ts:18-22` |
| Product/variant snapshots | Partial | No SKU / option values. | `src/lib/cms/sales.ts:83-97` |
| Refund processing | Partial | No ledger; paymentStatus never updated. | `src/payload/collections/aftersales.ts:155-265` |

### Shipping & fulfillment

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Fulfillment creation | Partial | Status change only. | `src/payload/collections/content.ts:47-57` |
| Fulfillment independent of payment | Partial | Online orders blocked unless paid; COD delivered stays unpaid with no reconciliation. | `src/payload/collections/content.ts:114-116` |

### Customers

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Marketing consent | Missing | — | `—` |
| Data export / deletion | Partial | Admin-only; erase skips several PII collections. | `src/payload/endpoints/privacy.ts` |

### Discounts & marketing

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Usage tracking | Partial | Counter drift (see Orders). | `src/payload/collections/content.ts:212` |

### SaaS billing

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Free trials | Broken | Reset on every publish → perpetual trial. | `src/lib/store-tenant.ts:361,447` |
| Recurring billing | Missing | — | `—` |
| Payment failure / dunning | Missing | — | `—` |
| Billing webhooks | Missing | — | `—` |
| Staff / product / storage limits | Missing | Fields only, never enforced. | `src/payload/collections/billing.ts:99-101` |
| Expiry, grace period, access restriction | Missing | — | `—` |
| Subscription plans & pricing | Partial | Seeded on a GET render; archived plans selectable. | `src/payload/collections/billing.ts:5-46` |
| Subscription status lifecycle | Partial | Never transitions. | `src/payload/collections/billing.ts:76-87` |

### Super admin

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Platform overview dashboard | Missing | — | `—` |
| All merchants / stores lists | Partial | Raw collections, not in nav. | `src/payload/collections/Stores.ts` |
| Store status management | Partial | Not enforced. | `src/payload/collections/Stores.ts:34-39` |
| Plans & SaaS billing admin | Partial | — | `src/payload/collections/billing.ts` |
| Audit trail for admin actions | Partial | Platform collections, config-import and privacy erase not logged. | `src/payload/collections/history.ts:244-248` |

### Jobs & integrations

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Retries / backoff / dead-letter | Missing | — | `src/lib/engagement-jobs.ts` |
| Transactional outbox | Missing | Notifications sent via after(); lost on crash. | `—` |
| Event deduplication | Missing | — | `—` |
| Payment reconciliation | Missing | — | `—` |
| Background job processing | Partial | In-process timer + Payload jobs in every instance. | `src/lib/housekeeping.ts; src/payload.config.ts:123-127` |
| Cache invalidation | Partial | Global tags; redirect cache per instance. | `src/payload/revalidate.ts:41-59` |
| Reservation cleanup | Partial | COD auto-cancel only. | `src/lib/cms/confirm.ts:95-125` |

### Production readiness

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| CI/CD | Broken | Triggers on `master`; repo uses `main`; lint fails with 2 warnings. | `.github/workflows/ci.yml:7` |
| End-to-end tests | Missing | — | `—` |
| Unit tests | Partial | 40/40 pass; tests encode the insecure merchant behaviour. | `tests/unit/*.test.ts` |
| Integration / API tests | Partial | Scripts exist, need DB/server, not in CI. | `scripts/tests/*` |
| Inventory concurrency tests | Partial | Not in CI; single-line only. | `scripts/tests/stock-race.ts` |
| Environment validation | Partial | Ad hoc. | `src/lib/startup-checks.ts:9-18` |
| Monitoring & error tracking | Partial | Sentry optional, no tracing or source maps. | `src/instrumentation.ts; scripts/uptime/monitor.mjs` |
| Restore procedure | Partial | Manual, untested. | `docs/BACKUP-RESTORE.md:45-82` |
| Deployment configuration | Partial | Migrations run against the live DB during image build. | `scripts/docker-build.sh:23-30` |

## P2

### Access control

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Super admin: platform metrics | Missing | No platform dashboard (MRR, stores, GMV). | `—` |
| Super admin: controlled support access (impersonation) | Missing | — | `—` |
| Staff: custom permissions | Missing | — | `—` |
| Granular permission model | Missing | Four fixed legacy roles only. | `—` |
| Super admin: platform configuration | Partial | 19 globals double as both platform and single-store settings. | `src/payload.config.ts:141` |
| Customer: request returns | Partial | Online-order returns work; POS-receipt returns always fail (regex mismatch). | `src/app/(frontend)/(store)/returns/actions.ts:21` |

### Onboarding

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| 1. Merchant landing / sign-up entry | Partial | Reuses storefront customer registration; no merchant landing. | `src/app/(frontend)/(store)/account/stores/page.tsx` |

### Store management

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Timezone configuration | Missing | Hardcoded PKT. | `src/payload/endpoints/reports.ts:17` |
| Business address | Missing | No field on store. | `—` |
| Domain status & SSL | Missing | — | `—` |
| Store deletion & data retention | Missing | — | `—` |
| Store preferences | Partial | Free-form JSON. | `src/payload/collections/Stores.ts:51` |

### Variants

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Unique option combinations | Missing | — | `src/payload/collections/catalog.ts:511-520` |

### Inventory

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Low-stock alerts | Partial | Status + dashboard counter, no notification. | `src/payload/collections/catalog.ts:213-223,447` |

### Storefront

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Legal pages | Partial | Fixed routes with Urko defaults. | `src/lib/content/page-defaults.ts` |
| SEO metadata | Partial | Brand hardcoded. | `src/app/(frontend)/(store)/[category]/[product]/page.tsx:68,82-92` |
| Sitemap | Partial | Single host; laptop-specific static list. | `src/app/sitemap.ts:15-35` |
| Mobile responsiveness | Not Verified | Not rendered in a browser during this audit. | `—` |
| Page performance | Not Verified | Prior audit reported mobile LCP 3.8–6.5 s; not re-measured. | `docs/APP-AUDIT.md` |

### Themes

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Theme preview | Partial | Pages/products only. | `src/payload/collections/Pages.ts:46-54` |
| Draft theme settings / publish | Partial | Theme saves go live immediately. | `src/payload/globals/online-store.ts:26-28` |

### Cart & checkout

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Free-delivery threshold after discount | Broken | Uses pre-discount subtotal. | `src/app/(frontend)/(store)/checkout/actions.ts:174` |
| Customer (server-side) cart | Missing | No cross-device cart. | `—` |
| Failed checkout recovery | Partial | — | `src/app/(frontend)/(store)/cart/restore/[token]/page.tsx` |
| Abandoned checkout tracking | Partial | Restore drops upgrades; stop link is a state-changing GET. | `src/app/(frontend)/(store)/checkout/draft-actions.ts:16-38` |

### Orders

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Partial fulfillment | Missing | — | `—` |
| Address snapshots | Partial | Single address, no billing/shipping split. | `src/payload/collections/content.ts:416-432` |
| Order notes | Partial | Customer note lands in internal notes. | `src/app/(frontend)/(store)/checkout/actions.ts:296` |

### Shipping & fulfillment

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Partial fulfillment | Missing | — | `—` |
| Carrier integration | Missing | — | `—` |
| Shipping methods | Partial | One rate per zone + COD fee. | `src/lib/cities.ts:90-102` |
| Delivery tracking | Partial | Manual statuses. | `src/app/(frontend)/(store)/track-order` |
| Fulfillment cancellation | Partial | — | `src/payload/collections/content.ts` |

### Customers

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Addresses | Partial | Pakistan-only validation. | `src/payload/collections/Users.ts:231-237` |

### Discounts & marketing

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Free-shipping discount | Missing | — | `—` |
| Automatic discounts | Missing | — | `—` |
| Per-customer limits | Missing | — | `—` |
| Product / collection-specific | Missing | — | `—` |
| Start / end dates | Partial | Expiry only. | `src/payload/collections/sales.ts` |
| Abandoned checkout recovery | Partial | — | `src/lib/engagement-jobs.ts:50-90` |

### Analytics

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Returning customers | Missing | — | `—` |
| Traffic tracking | Missing | GA4 / Meta pixel snippets only. | `src/components/analytics.tsx` |
| Conversion reporting | Missing | Placeholder. | `src/payload/admin/Dashboard.tsx:177-181` |
| Inventory reporting | Partial | — | `src/payload/endpoints/reports.ts:61-62` |
| Dashboard KPI correctness | Partial | `paidOrders` counts unpaid COD; unbounded range. | `src/payload/endpoints/reports.ts:18-29,44-58` |
| Customer count | Not Verified | Not traced. | `src/payload/admin/Dashboard.tsx` |
| Sales by channel | Not Verified | POS vs online split not traced. | `src/payload/endpoints/sales-report.ts` |

### SaaS billing

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Upgrades / downgrades | Missing | `setStorePlanForUser` unused. | `src/lib/store-tenant.ts:417-506` |
| Cancellations | Missing | — | `—` |
| Feature entitlements | Missing | — | `—` |
| Invoice history | Partial | Collection exists, never written. | `src/payload/collections/billing.ts:110-158` |

### Super admin

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Platform revenue reporting | Missing | — | `—` |
| Failed payment monitoring | Missing | — | `—` |
| Support tools / impersonation | Missing | — | `—` |
| Security events view | Partial | Per-user 2FA screen; no platform security log. | `src/payload/admin/security/SecurityView.tsx` |

### Jobs & integrations

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Search indexing | Partial | Full scan of the in-memory snapshot. | `src/lib/search.ts` |

### Production readiness

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Structured logging | Partial | 24 raw console.* calls remain. | `src/lib/log.ts` |

## P3

### Access control

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Super admin: platform integrations | Missing | — | `—` |

### Store management

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Store language | Missing | Stored, unused. | `src/payload/collections/Stores.ts:45` |

### Products

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Product type | Missing | — | `—` |

### Variants

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Barcode | Missing | SKU doubles as barcode. | `src/payload/endpoints/inventory.ts:124-125` |
| Variant weight | Partial | Not copied by create-variants. | `src/payload/collections/catalog.ts:68-90,470` |

### Collections

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Visibility | Partial | Checkbox only; no drafts/schedule. | `src/payload/collections/ProductCollections.ts:86` |

### Inventory

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Inventory locations | Missing | — | `—` |
| Levels by variant & location | Missing | Per variant only. | `—` |

### Themes

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Theme selection / library | Missing | One built-in theme. | `—` |

### Payments

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Multi-currency | Missing | — | `—` |

### Shipping & fulfillment

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Location-based fulfillment | Missing | — | `—` |
| Return shipping | Missing | — | `—` |

### Discounts & marketing

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Campaign records | Missing | — | `—` |
| Email marketing integration | Missing | — | `—` |
| Stacking rules | Partial | One code per order, implicit. | `src/app/(frontend)/(store)/checkout/actions.ts:164-170` |
| Flash sales | Partial | Display only; never affect price. | `src/payload/collections/sales.ts:442-461` |

### Jobs & integrations

| Feature | Status | What is missing / wrong | Evidence |
|---|---|---|---|
| Webhook sending | Missing | — | `—` |
