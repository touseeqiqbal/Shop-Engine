# 01 · Feature checklist (Shopify-like comparison)

State audited: **commit aab6879**. Every row was checked against the code; "Evidence" is the file (and line) that proves the status.
Status legend: **Complete** = works end to end in code · **Partial** = some requirements unmet · **Missing** = not found after searching ·
**Broken** = an implementation exists but has an evident defect · **Not Verified** = could not be confirmed statically · **N/A** = out of scope.

> Important context: at commit aab6879 the Payload config did not build (duplicate `store` field) and no migration created the multi-tenant tables,
> so *nothing* CMS-backed could start. Feature rows below describe the code as written (what it does once it boots), and those two blockers
> are scored separately under **Production readiness**. "Complete" for storefront/admin features means complete **for a single store**;
> multi-tenant gaps are scored in their own rows (tenant scoping, per-store settings, routing).

## Scores

Scoring: Complete = 1, Partial = 0.5, Missing/Broken = 0. Not Verified rows are excluded from *verified-only* coverage but counted in the
denominator of *confirmed* coverage. N/A rows are excluded entirely.

| Metric | Value |
|---|---|
| Features assessed | 295 |
| Complete / Partial / Missing / Broken / Not Verified | 85 / 91 / 91 / 24 / 4 |
| **Confirmed feature coverage** (points ÷ all applicable) | **44.2%** (130.5 / 295) |
| **Verified-only coverage** (points ÷ verified) | **44.8%** (130.5 / 291) |
| Unverified features | 4 |
| Broken features that are P0 | 15 |

> Feature coverage measures how much Shopify-like functionality exists in code. It is **not** a security or production-readiness
> certification: a store can score well here and still be unsafe to launch (see 05-security-audit.md).

### Module scores

| Module | Features | C | P | M | B | NV | Confirmed | Verified-only |
|---|---|---|---|---|---|---|---|---|
| Access control | 30 | 4 | 13 | 7 | 6 | 0 | 35.0% | 35.0% |
| Onboarding | 13 | 1 | 6 | 3 | 3 | 0 | 30.8% | 30.8% |
| Store management | 19 | 0 | 5 | 13 | 1 | 0 | 13.2% | 13.2% |
| Products | 15 | 9 | 4 | 1 | 1 | 0 | 73.3% | 73.3% |
| Variants | 10 | 6 | 1 | 2 | 1 | 0 | 65.0% | 65.0% |
| Collections | 7 | 5 | 1 | 1 | 0 | 0 | 78.6% | 78.6% |
| Inventory | 17 | 6 | 8 | 2 | 1 | 0 | 58.8% | 58.8% |
| Storefront | 16 | 10 | 3 | 1 | 0 | 2 | 71.9% | 82.1% |
| Themes | 7 | 3 | 2 | 2 | 0 | 0 | 57.1% | 57.1% |
| Cart & checkout | 17 | 7 | 4 | 5 | 1 | 0 | 52.9% | 52.9% |
| Payments | 18 | 1 | 3 | 13 | 1 | 0 | 13.9% | 13.9% |
| Orders | 23 | 10 | 6 | 4 | 3 | 0 | 56.5% | 56.5% |
| Shipping & fulfillment | 14 | 5 | 5 | 4 | 0 | 0 | 53.6% | 53.6% |
| Customers | 11 | 6 | 2 | 2 | 1 | 0 | 63.6% | 63.6% |
| Discounts & marketing | 16 | 5 | 5 | 6 | 0 | 0 | 46.9% | 46.9% |
| Analytics | 12 | 4 | 2 | 4 | 0 | 2 | 41.7% | 50.0% |
| SaaS billing | 12 | 0 | 3 | 8 | 1 | 0 | 12.5% | 12.5% |
| Super admin | 9 | 0 | 5 | 4 | 0 | 0 | 27.8% | 27.8% |
| Jobs & integrations | 12 | 2 | 4 | 6 | 0 | 0 | 33.3% | 33.3% |
| Production readiness | 17 | 1 | 9 | 3 | 4 | 0 | 32.4% | 32.4% |

## Checklist

| Module | Feature | Status | Evidence | Priority | Notes |
|---|---|---|---|---|---|
| Access control | Platform super-admin role | Partial | `src/payload/access.ts:57` | P0 | Legacy `owner` or `platformRole=platform_admin`; but `platformRole` is self-assignable (see Broken row below). |
| Access control | Super admin: view merchants & stores | Partial | `src/payload/collections/Stores.ts:15-28` | P1 | Raw Payload collection only; no platform UI or nav entry (UrkoNav.tsx). |
| Access control | Super admin: create / suspend / reactivate stores | Partial | `src/payload/collections/Stores.ts:26-28,34-39` | P1 | CRUD exists; `status` is never enforced anywhere. |
| Access control | Super admin: platform metrics | Missing | `—` | P2 | No platform dashboard (MRR, stores, GMV). |
| Access control | Super admin: manage SaaS plans | Partial | `src/payload/collections/billing.ts:5-46` | P1 | Collection CRUD only. |
| Access control | Super admin: monitor subscriptions & invoices | Partial | `src/payload/collections/billing.ts:47-158` | P1 | Collections exist; nothing generates invoices or transitions status. |
| Access control | Super admin: platform configuration | Partial | `src/payload.config.ts:141` | P2 | 19 globals double as both platform and single-store settings. |
| Access control | Super admin: audit log review | Partial | `src/payload/collections/history.ts:81,185-188,244-248` | P1 | Activity log exists; platform collections and non-staff actors not logged. |
| Access control | Super admin: platform integrations | Missing | `—` | P3 |  |
| Access control | Super admin: controlled support access (impersonation) | Missing | `—` | P2 |  |
| Access control | Merchant: create & configure own store | Partial | `src/lib/store-tenant.ts:133-275; Stores.ts:27` | P1 | Create only; merchants cannot update their own store (update is platform-admin only). |
| Access control | Merchant: manage employees | Missing | `src/payload/collections/StoreMemberships.ts:27` | P1 | Only platform admins can create memberships. |
| Access control | Staff: invite | Missing | `—` | P1 | No invite UI, API, token or email. |
| Access control | Staff: accept invitation | Broken | `src/lib/store-tenant.ts:283-301,323` | P1 | No `status==='invited'` check; overwrites global `platformRole` (demotes owners of other stores). |
| Access control | Staff: per-store roles | Broken | `src/payload/access.ts:63-67` | P0 | `store_owner/manager/staff` never evaluated; `merchant_*` mapped to global legacy roles. |
| Access control | Staff: custom permissions | Missing | `—` | P2 |  |
| Access control | Staff: restrict sensitive operations | Partial | `src/payload/collections/catalog.ts:430-432` | P1 | Field-level rules (cost owner-only, price manager-only) exist for the single shop. |
| Access control | Staff: revoke access | Broken | `src/payload/access.ts:34-38` | P0 | Access derives from `users.stores`; suspending/deleting a membership changes nothing. |
| Access control | Customer: browse, search, cart, checkout | Complete | `src/app/(frontend)/(store)/*` | P0 | Single-tenant storefront. |
| Access control | Customer: guest checkout | Complete | `src/app/(frontend)/(store)/checkout/actions.ts:109` | P0 |  |
| Access control | Customer: optional account | Complete | `src/app/(frontend)/(store)/account/actions.ts` | P1 |  |
| Access control | Customer: order history & addresses | Complete | `src/app/(frontend)/(store)/account/orders/load.ts:10-37` | P1 |  |
| Access control | Customer: request returns | Partial | `src/app/(frontend)/(store)/returns/actions.ts:21` | P2 | Online-order returns work; POS-receipt returns always fail (regex mismatch). |
| Access control | One user in multiple stores | Partial | `src/payload/collections/Users.ts:211-225` | P1 | Modelled, but no migration creates the columns/tables. |
| Access control | Different roles in different stores | Broken | `src/lib/store-tenant.ts:268,323` | P0 | Role is a single global `platformRole`, overwritten on each create/accept. |
| Access control | Backend authorization enforced | Partial | `src/payload/access.ts` | P0 | Payload access functions run server-side, but merchant roles are global. |
| Access control | Tenant data isolation | Broken | `src/payload/access.ts:63-67,85-87` | P0 | Any merchant (self-service) gets staff/manager/owner over every tenant's orders, customers and settings. |
| Access control | Field-level protection of role/tenant fields | Broken | `src/payload/collections/Users.ts:197-225` | P0 | `platformRole`, `stores`, `currentStore` have no field access: self-PATCH → platform admin. |
| Access control | Granular permission model | Missing | `—` | P2 | Four fixed legacy roles only. |
| Access control | Secure session management | Partial | `src/auth.ts:23; src/payload/two-factor.ts:176` | P0 | Good cookie flags; 30-day storefront JWT survives password change; storefront login skips 2FA. |
| Onboarding | 1. Merchant landing / sign-up entry | Partial | `src/app/(frontend)/(store)/account/stores/page.tsx` | P2 | Reuses storefront customer registration; no merchant landing. |
| Onboarding | 2. Sign up | Complete | `src/app/(frontend)/(store)/account/actions.ts:65-80` | P1 |  |
| Onboarding | 3. Email verification before store creation | Partial | `src/lib/auth.ts:173-177` | P1 | Verification exists but is not required to create a store. |
| Onboarding | 4. Create store | Broken | `src/lib/store-tenant.ts:133-275` | P0 | No migration for `cms_stores` etc. → runtime failure; also grants global owner rights. |
| Onboarding | 5. Unique slug / subdomain | Partial | `src/lib/store-tenant.ts:34-42,150-161` | P1 | Check-then-create race; no reserved names (`admin`, `api`, `www`). |
| Onboarding | 6. Country & currency | Partial | `src/lib/store-tenant.ts:194-197; src/lib/utils.ts:7-11` | P1 | Stored, never used (storefront hardcodes Rs/en-PK). |
| Onboarding | 7. Default settings initialized | Partial | `src/lib/store-tenant.ts:205-210` | P1 | Only a `settings` JSON blob; real settings are shared globals. |
| Onboarding | 8. Plan / trial selection | Broken | `src/lib/store-tenant.ts:163-183,361-373` | P1 | Archived/paid plans selectable without payment; trial resets on every publish. |
| Onboarding | 9. Configure payment providers | Missing | `src/payload/globals/commerce.ts:73` | P0 | Only a platform-wide global. |
| Onboarding | 10. Configure shipping | Missing | `src/payload/globals/commerce.ts:23` | P1 | Only a platform-wide global. |
| Onboarding | 11. Add products | Partial | `src/payload/collections/catalog.ts:395,407` | P1 | Store field exists but defaults to null and has no migration. |
| Onboarding | 12. Storefront branding | Missing | `src/payload/collections/Stores.ts:47-48` | P1 | `logo`/`brandColor` never read; theme is a shared global. |
| Onboarding | 13. Publish store | Broken | `src/lib/store-tenant.ts:333-415` | P1 | Un-suspends suspended stores, resets trial; store is not routable. |
| Store management | Store CRUD | Partial | `src/payload/collections/Stores.ts` | P1 |  |
| Store management | Store ownership | Partial | `src/payload/collections/Stores.ts:46` | P1 |  |
| Store management | Store memberships | Partial | `src/payload/collections/StoreMemberships.ts` | P0 | Rows written but never used for authorization. |
| Store management | Status lifecycle (active/suspended/closed) | Partial | `src/payload/collections/Stores.ts:34-39` | P1 | Field only. |
| Store management | Suspension enforcement | Missing | `—` | P0 | Never read by storefront or admin. |
| Store management | Logo & branding per store | Missing | `src/payload/collections/Stores.ts:47-48` | P1 | Unused. |
| Store management | Contact information per store | Missing | `src/payload/collections/Stores.ts:49-50` | P1 | Unused; storefront reads StoreInfo global. |
| Store management | Currency configuration | Missing | `src/lib/utils.ts:7-11` | P1 | Hardcoded PKR. |
| Store management | Timezone configuration | Missing | `src/payload/endpoints/reports.ts:17` | P2 | Hardcoded PKT. |
| Store management | Business address | Missing | `—` | P2 | No field on store. |
| Store management | Store language | Missing | `src/payload/collections/Stores.ts:45` | P3 | Stored, unused. |
| Store management | Store preferences | Partial | `src/payload/collections/Stores.ts:51` | P2 | Free-form JSON. |
| Store management | Custom domain connection | Missing | `src/payload/collections/Stores.ts:41` | P1 | Text field, no uniqueness/validation. |
| Store management | Subdomain routing | Missing | `src/proxy.ts:55-101` | P0 | No host → store resolution. |
| Store management | Domain ownership verification | Missing | `—` | P1 |  |
| Store management | Domain status & SSL | Missing | `—` | P2 |  |
| Store management | Multi-store switching | Missing | `src/lib/store-tenant.ts:508-519` | P1 | `getCurrentStoreForUser` unused; no switcher. |
| Store management | Store deletion & data retention | Missing | `—` | P2 |  |
| Store management | Tenant isolation of store-specific operations | Broken | `src/payload/access.ts:63-87` | P0 | See Access control. |
| Products | Create / edit products | Complete | `src/payload/collections/catalog.ts:375-559` | P0 |  |
| Products | Delete / archive | Partial | `src/payload/collections/catalog.ts:395,539-546` | P1 | Archive OK; delete has no guard and legacy staff can now delete. |
| Products | Draft / active / scheduled | Complete | `src/payload/collections/catalog.ts:404,539-546` | P1 |  |
| Products | Title, description, images | Complete | `src/payload/collections/catalog.ts:414,420-422` | P0 |  |
| Products | Categories | Complete | `src/payload/collections/catalog.ts:419` | P1 |  |
| Products | Product type | Missing | `—` | P3 |  |
| Products | Brand / vendor | Complete | `src/payload/collections/catalog.ts:416` | P2 |  |
| Products | Tags | Complete | `src/payload/collections/catalog.ts:549` | P2 |  |
| Products | SEO metadata | Complete | `src/payload.config.ts:190-231` | P2 | Meta titles hardcode 'Urko Tech Store'. |
| Products | URL slug | Partial | `src/payload/fields.ts:11-33` | P1 | Unique across the whole DB, so tenants collide. |
| Products | Publication visibility | Complete | `src/lib/cms/catalog-source.ts:131` | P0 |  |
| Products | Tenant ownership of products | Broken | `src/payload/collections/catalog.ts:407; src/payload/access.ts:69-78` | P0 | No migration; null by default; create ignores the store filter. |
| Products | Historical order integrity after delete | Partial | `src/payload/collections/content.ts:438-451` | P1 | Title/price snapshotted; SKU and option values lost. |
| Products | Storefront hides unpublished | Partial | `src/lib/repo/catalog.ts:136-138` | P0 | Variants of draft/archived parents remain visible and sellable. |
| Products | Backend price & variant validation | Complete | `src/lib/cart-pricing.ts:27-83` | P0 |  |
| Variants | Product options (≤3) | Complete | `src/payload/collections/catalog.ts:511-533` | P1 |  |
| Variants | Option combinations generator | Complete | `src/payload/collections/catalog.ts:43-98` | P1 |  |
| Variants | Variant SKU / price / compare-at | Complete | `src/payload/collections/catalog.ts` | P1 |  |
| Variants | Barcode | Missing | `src/payload/endpoints/inventory.ts:124-125` | P3 | SKU doubles as barcode. |
| Variants | Variant images | Complete | `src/lib/repo/catalog.ts:60,64` | P2 |  |
| Variants | Variant weight | Partial | `src/payload/collections/catalog.ts:68-90,470` | P3 | Not copied by create-variants. |
| Variants | Per-variant inventory | Complete | `src/payload/stock.ts:184-192` | P0 |  |
| Variants | Stable variant IDs | Complete | `integer product ids` | P0 |  |
| Variants | Variant + upgrade purchasable | Broken | `src/components/product-detail/buy-box.tsx:42; src/lib/cart-pricing.ts:57-61` | P0 | Checkout rejects the line; cart silently drops it. |
| Variants | Unique option combinations | Missing | `src/payload/collections/catalog.ts:511-520` | P2 |  |
| Collections | Manual collections | Complete | `src/payload/collections/ProductCollections.ts:36` | P2 |  |
| Collections | Automated / rule-based | Complete | `src/payload/collections/ProductCollections.ts:37-72` | P2 |  |
| Collections | Image & description | Complete | `src/payload/collections/ProductCollections.ts:25-26` | P3 |  |
| Collections | Product assignment | Complete | `src/lib/cms/collections.ts:68-99` | P2 |  |
| Collections | Collection SEO | Complete | `src/payload.config.ts:191` | P3 |  |
| Collections | Visibility | Partial | `src/payload/collections/ProductCollections.ts:86` | P3 | Checkbox only; no drafts/schedule. |
| Collections | Tenant scoping | Missing | `src/payload/collections/ProductCollections.ts:21` | P0 | No store field. |
| Inventory | Inventory items | Partial | `src/payload/collections/shop.ts:56-90` | P1 | Stock column per product + serial units. |
| Inventory | Inventory locations | Missing | `—` | P3 |  |
| Inventory | Levels by variant & location | Missing | `—` | P3 | Per variant only. |
| Inventory | Stock adjustment | Partial | `src/payload/collections/catalog.ts:122-148` | P1 | Admin save reads stock without a lock and writes it back (lost-update race). |
| Inventory | Stock movement history | Complete | `src/payload/collections/history.ts:35-67` | P1 |  |
| Inventory | Low-stock alerts | Partial | `src/payload/collections/catalog.ts:213-223,447` | P2 | Status + dashboard counter, no notification. |
| Inventory | Out-of-stock behaviour | Complete | `src/lib/cart-pricing.ts:72-81` | P1 | Deny only. |
| Inventory | Reservations | Partial | `src/payload/stock.ts:238-247` | P1 | Stock taken at order placement; no checkout hold. |
| Inventory | Reservation expiry | Partial | `src/lib/cms/confirm.ts:95-125` | P1 | Unconfirmed COD auto-cancel only. |
| Inventory | Commit on purchase | Complete | `src/lib/cms/sales.ts:137-153` | P0 |  |
| Inventory | Release on failed / cancelled | Complete | `src/payload/collections/content.ts:196-214` | P0 |  |
| Inventory | Return restocking | Complete | `src/payload/collections/aftersales.ts:194-232` | P1 |  |
| Inventory | Adjustment permissions | Partial | `src/payload/endpoints/inventory.ts:172` | P1 | Not tenant-scoped. |
| Inventory | Overselling protection | Complete | `src/payload/stock.ts:86-89` | P0 | Atomic conditional UPDATE. |
| Inventory | Concurrent checkout safety | Partial | `src/payload/stock.ts:201-212` | P0 | Lines locked in cart order → deadlock possible. |
| Inventory | Stock count accuracy | Broken | `src/payload/endpoints/inventory.ts:70,82-83,183` | P1 | Sales during a count are subtracted twice. |
| Inventory | Purchase receiving concurrency | Partial | `src/payload/collections/inventory.ts:44-88` | P1 | No row lock; double receive doubles stock. |
| Storefront | Per-tenant routing | Missing | `src/proxy.ts; src/lib/repo/catalog.ts:107-115` | P0 | One global catalog snapshot. |
| Storefront | Homepage | Complete | `src/app/(frontend)/(store)/page.tsx` | P1 |  |
| Storefront | Product listing / filtering / sorting | Complete | `src/components/shop/*` | P1 |  |
| Storefront | Product details | Complete | `src/app/(frontend)/(store)/[category]/[product]/page.tsx` | P0 |  |
| Storefront | Collections pages | Complete | `src/app/(frontend)/(store)/collections/[slug]/page.tsx` | P2 |  |
| Storefront | Search | Complete | `src/lib/search.ts` | P1 | In-memory ranker over the snapshot. |
| Storefront | Cart & checkout pages | Complete | `src/app/(frontend)/(store)/cart, checkout` | P0 |  |
| Storefront | Customer account pages | Complete | `src/app/(frontend)/(store)/account/*` | P1 |  |
| Storefront | Navigation menus | Complete | `src/payload/collections/Menus.ts` | P2 |  |
| Storefront | Static & contact pages | Complete | `src/app/(frontend)/(store)/pages/[slug], contact` | P2 |  |
| Storefront | Legal pages | Partial | `src/lib/content/page-defaults.ts` | P2 | Fixed routes with Urko defaults. |
| Storefront | SEO metadata | Partial | `src/app/(frontend)/(store)/[category]/[product]/page.tsx:68,82-92` | P2 | Brand hardcoded. |
| Storefront | Sitemap | Partial | `src/app/sitemap.ts:15-35` | P2 | Single host; laptop-specific static list. |
| Storefront | Robots | Complete | `src/app/robots.ts` | P3 |  |
| Storefront | Mobile responsiveness | Not Verified | `—` | P2 | Not rendered in a browser during this audit. |
| Storefront | Page performance | Not Verified | `docs/APP-AUDIT.md` | P2 | Prior audit reported mobile LCP 3.8–6.5 s; not re-measured. |
| Themes | Theme selection / library | Missing | `—` | P3 | One built-in theme. |
| Themes | Theme configuration (no-code) | Complete | `src/payload/globals/online-store.ts:31-101` | P1 | Single-tenant. |
| Themes | Homepage & reusable sections | Complete | `src/payload/blocks.ts:43-234` | P1 | 10 blocks. |
| Themes | Theme preview | Partial | `src/payload/collections/Pages.ts:46-54` | P2 | Pages/products only. |
| Themes | Draft theme settings / publish | Partial | `src/payload/globals/online-store.ts:26-28` | P2 | Theme saves go live immediately. |
| Themes | Theme versioning | Complete | `src/migrations/20261012_115415_theme_history.ts` | P3 |  |
| Themes | Per-store theme | Missing | `src/payload.config.ts:141` | P0 | Globals are shared by all tenants. |
| Cart & checkout | Guest cart | Complete | `src/store/cart.ts:41-91` | P0 | localStorage. |
| Cart & checkout | Customer (server-side) cart | Missing | `—` | P2 | No cross-device cart. |
| Cart & checkout | Quantity changes | Complete | `src/store/cart.ts:57-79` | P1 |  |
| Cart & checkout | Live re-price / availability sync | Complete | `src/app/(frontend)/(store)/cart/actions.ts:26-38` | P1 |  |
| Cart & checkout | Server-side price calculation | Complete | `src/lib/cart-pricing.ts:67,83; checkout/actions.ts:164-175` | P0 | Client cannot set prices; `expectedTotal` is compare-only. |
| Cart & checkout | Discount application | Complete | `src/lib/coupons.ts:12-34` | P0 |  |
| Cart & checkout | Shipping calculation | Complete | `src/lib/cities.ts:90-102` | P0 |  |
| Cart & checkout | Free-delivery threshold after discount | Broken | `src/app/(frontend)/(store)/checkout/actions.ts:174` | P2 | Uses pre-discount subtotal. |
| Cart & checkout | Tax calculation | Missing | `—` | P1 |  |
| Cart & checkout | Checkout sessions & expiry | Missing | `—` | P1 | Stateless server action. |
| Cart & checkout | Inventory reservation | Partial | `src/lib/cms/sales.ts:137-153` | P1 | At placement only. |
| Cart & checkout | Payment initialization (online) | Missing | `—` | P0 |  |
| Cart & checkout | Order creation (transactional) | Complete | `src/lib/cms/sales.ts:123-166` | P0 |  |
| Cart & checkout | Duplicate order prevention / idempotency | Partial | `src/lib/cms/sales.ts:125-127; migrations/20261006_213603_order_safety.ts:8` | P0 | Only when the client sends `attemptId`. |
| Cart & checkout | Failed checkout recovery | Partial | `src/app/(frontend)/(store)/cart/restore/[token]/page.tsx` | P2 |  |
| Cart & checkout | Abandoned checkout tracking | Partial | `src/app/(frontend)/(store)/checkout/draft-actions.ts:16-38` | P2 | Restore drops upgrades; stop link is a state-changing GET. |
| Cart & checkout | Order attributed to a store | Missing | `src/lib/cms/sales.ts:77-108` | P0 |  |
| Payments | Online payment provider | Missing | `docs/DELIVERY-PAYMENTS.md:58` | P0 | Card rejected. |
| Payments | Manual methods (COD, bank, wallets with proof) | Complete | `src/app/(frontend)/(store)/checkout/actions.ts:219-256` | P1 |  |
| Payments | Merchant payment account onboarding | Missing | `—` | P0 |  |
| Payments | Hosted secure collection | Missing | `—` | P0 |  |
| Payments | Authorization / capture | Missing | `—` | P1 |  |
| Payments | Failure / cancellation handling | Partial | `src/payload/collections/content.ts:196-214` | P1 | Order cancel only. |
| Payments | Provider refunds | Missing | `—` | P1 |  |
| Payments | Partial refunds | Partial | `src/payload/collections/aftersales.ts:155-265` | P1 | Manual credit notes. |
| Payments | Payment event history | Missing | `—` | P0 |  |
| Payments | Webhook signature verification | Missing | `—` | P0 | No webhook route exists. |
| Payments | Replay protection & dedup | Missing | `—` | P0 |  |
| Payments | Idempotency keys | Missing | `—` | P0 |  |
| Payments | Reconciliation | Missing | `—` | P1 | No COD remittance reconciliation. |
| Payments | Provider reference IDs | Missing | `src/app/(frontend)/(store)/checkout/actions.ts:292` | P1 | Screenshots can be reused across orders. |
| Payments | Multi-currency | Missing | `—` | P3 |  |
| Payments | Customer payments separate from SaaS billing | Partial | `src/payload/collections/billing.ts` | P1 | Separate collections; neither has a provider. |
| Payments | Merchant payouts via provider | Missing | `—` | P1 |  |
| Payments | Per-store payment account details | Broken | `src/payload/globals/commerce.ts:73` | P0 | Shared global editable by any merchant manager → payment diversion. |
| Orders | Order creation | Complete | `src/lib/cms/sales.ts:123-166` | P0 |  |
| Orders | Order number generation | Partial | `src/lib/repo/orders.ts:18-22` | P1 | Unique + retry; `UTS-` prefix hardcoded. |
| Orders | Order details & line items | Complete | `src/payload/collections/content.ts:374-490` | P0 |  |
| Orders | Customer association | Complete | `src/payload/collections/content.ts` | P1 |  |
| Orders | Product/variant snapshots | Partial | `src/lib/cms/sales.ts:83-97` | P1 | No SKU / option values. |
| Orders | Price snapshots | Complete | `src/lib/cms/sales.ts:83-97` | P0 |  |
| Orders | Tax snapshots | Missing | `—` | P1 |  |
| Orders | Address snapshots | Partial | `src/payload/collections/content.ts:416-432` | P2 | Single address, no billing/shipping split. |
| Orders | Timeline | Complete | `src/payload/collections/content.ts:329-342` | P1 |  |
| Orders | Payment status (separate field) | Complete | `src/payload/collections/content.ts:463-476` | P0 |  |
| Orders | Fulfillment status (separate field) | Missing | `src/payload/collections/content.ts:47-57` | P1 | Fulfillment folded into order status. |
| Orders | Order status state machine | Partial | `src/payload/collections/content.ts:106-116` | P0 | Mostly free-form (cancelled→delivered allowed). |
| Orders | Cancellation (restock, coupon release) | Complete | `src/payload/collections/content.ts:196-214` | P1 |  |
| Orders | Partial fulfillment | Missing | `—` | P2 |  |
| Orders | Refund processing | Partial | `src/payload/collections/aftersales.ts:155-265` | P1 | No ledger; paymentStatus never updated. |
| Orders | Refund cap | Broken | `src/payload/collections/aftersales.ts:163-167` | P0 | Refunds can exceed what was paid. |
| Orders | Coupon usage consistency | Broken | `src/payload/collections/content.ts:180-188,212` | P1 | Admin-created orders don't consume, cancellation releases → limit bypass. |
| Orders | Concurrent edit safety | Broken | `src/payload/collections/content.ts:84-90` | P1 | Row lock only with `expectStatus`; double restock possible. |
| Orders | Returns | Complete | `src/payload/collections/aftersales.ts` | P1 |  |
| Orders | Order notes | Partial | `src/app/(frontend)/(store)/checkout/actions.ts:296` | P2 | Customer note lands in internal notes. |
| Orders | Filtering & search | Complete | `src/payload/collections/content.ts:380-401` | P1 |  |
| Orders | Notifications | Complete | `src/lib/notify.ts` | P1 | Not durable (see Jobs). |
| Orders | Tenant scoping of orders | Missing | `src/payload/collections/content.ts:403` | P0 | No store field. |
| Shipping & fulfillment | Shipping zones | Complete | `src/payload/globals/commerce.ts` | P1 | Single-tenant. |
| Shipping & fulfillment | Shipping methods | Partial | `src/lib/cities.ts:90-102` | P2 | One rate per zone + COD fee. |
| Shipping & fulfillment | Shipping rates | Complete | `src/lib/cities.ts:90-102` | P1 |  |
| Shipping & fulfillment | Free shipping rules | Complete | `src/lib/cities.ts:95,99` | P2 | See checkout bug. |
| Shipping & fulfillment | Location-based fulfillment | Missing | `—` | P3 |  |
| Shipping & fulfillment | Fulfillment creation | Partial | `src/payload/collections/content.ts:47-57` | P1 | Status change only. |
| Shipping & fulfillment | Partial fulfillment | Missing | `—` | P2 |  |
| Shipping & fulfillment | Tracking numbers & URLs | Complete | `src/lib/couriers.ts:14-71` | P2 |  |
| Shipping & fulfillment | Carrier integration | Missing | `—` | P2 |  |
| Shipping & fulfillment | Shipment notifications | Complete | `src/payload/collections/content.ts:355-371` | P2 |  |
| Shipping & fulfillment | Delivery tracking | Partial | `src/app/(frontend)/(store)/track-order` | P2 | Manual statuses. |
| Shipping & fulfillment | Return shipping | Missing | `—` | P3 |  |
| Shipping & fulfillment | Fulfillment cancellation | Partial | `src/payload/collections/content.ts` | P2 |  |
| Shipping & fulfillment | Fulfillment independent of payment | Partial | `src/payload/collections/content.ts:114-116` | P1 | Online orders blocked unless paid; COD delivered stays unpaid with no reconciliation. |
| Customers | Store-scoped customer records | Missing | `src/payload/collections/Users.ts:16-19` | P0 | Users is global. |
| Customers | Guest customers | Complete | `src/payload/collections/Users.ts:169-178` | P1 |  |
| Customers | Registered customers & profiles | Complete | `src/payload/collections/Users.ts` | P1 |  |
| Customers | Addresses | Partial | `src/payload/collections/Users.ts:231-237` | P2 | Pakistan-only validation. |
| Customers | Order history | Complete | `src/app/(frontend)/(store)/account/orders/load.ts` | P1 |  |
| Customers | Customer search | Complete | `src/payload/collections/Users.ts:23` | P2 |  |
| Customers | Tags & notes | Complete | `src/payload/collections/Users.ts:244-246` | P2 |  |
| Customers | Marketing consent | Missing | `—` | P1 |  |
| Customers | Authentication & password reset | Complete | `src/lib/cms/sales.ts:370-394` | P1 |  |
| Customers | Data export / deletion | Partial | `src/payload/endpoints/privacy.ts` | P1 | Admin-only; erase skips several PII collections. |
| Customers | PII tenant isolation | Broken | `src/payload/endpoints/privacy.ts:58,81,116` | P0 | Any merchant can find/export/erase any person. |
| Discounts & marketing | Percentage & fixed discounts | Complete | `src/payload/collections/sales.ts:8-42` | P1 |  |
| Discounts & marketing | Free-shipping discount | Missing | `—` | P2 |  |
| Discounts & marketing | Discount codes | Complete | `src/payload/collections/sales.ts:19` | P1 | Unique platform-wide, not per store. |
| Discounts & marketing | Automatic discounts | Missing | `—` | P2 |  |
| Discounts & marketing | Start / end dates | Partial | `src/payload/collections/sales.ts` | P2 | Expiry only. |
| Discounts & marketing | Redemption limits | Complete | `src/payload/stock.ts:123-131` | P1 | Race-safe UPDATE. |
| Discounts & marketing | Per-customer limits | Missing | `—` | P2 |  |
| Discounts & marketing | Minimum purchase | Complete | `src/payload/collections/sales.ts` | P2 |  |
| Discounts & marketing | Product / collection-specific | Missing | `—` | P2 |  |
| Discounts & marketing | Stacking rules | Partial | `src/app/(frontend)/(store)/checkout/actions.ts:164-170` | P3 | One code per order, implicit. |
| Discounts & marketing | Backend coupon validation | Complete | `src/lib/coupons.ts:18-34` | P0 |  |
| Discounts & marketing | Usage tracking | Partial | `src/payload/collections/content.ts:212` | P1 | Counter drift (see Orders). |
| Discounts & marketing | Flash sales | Partial | `src/payload/collections/sales.ts:442-461` | P3 | Display only; never affect price. |
| Discounts & marketing | Campaign records | Missing | `—` | P3 |  |
| Discounts & marketing | Email marketing integration | Missing | `—` | P3 |  |
| Discounts & marketing | Abandoned checkout recovery | Partial | `src/lib/engagement-jobs.ts:50-90` | P2 |  |
| Analytics | Total / gross / net sales | Complete | `src/payload/endpoints/sales-report.ts:26-60` | P1 |  |
| Analytics | Order count & AOV | Complete | `src/payload/endpoints/reports.ts:26-133` | P1 |  |
| Analytics | Sales by date / product | Complete | `src/payload/endpoints/reports.ts` | P1 |  |
| Analytics | Refund reporting | Complete | `src/payload/endpoints/sales-report.ts:174-183` | P1 |  |
| Analytics | Customer count | Not Verified | `src/payload/admin/Dashboard.tsx` | P2 | Not traced. |
| Analytics | Returning customers | Missing | `—` | P2 |  |
| Analytics | Sales by channel | Not Verified | `src/payload/endpoints/sales-report.ts` | P2 | POS vs online split not traced. |
| Analytics | Inventory reporting | Partial | `src/payload/endpoints/reports.ts:61-62` | P2 |  |
| Analytics | Traffic tracking | Missing | `src/components/analytics.tsx` | P2 | GA4 / Meta pixel snippets only. |
| Analytics | Conversion reporting | Missing | `src/payload/admin/Dashboard.tsx:177-181` | P2 | Placeholder. |
| Analytics | Dashboard KPI correctness | Partial | `src/payload/endpoints/reports.ts:18-29,44-58` | P2 | `paidOrders` counts unpaid COD; unbounded range. |
| Analytics | Store-scoped analytics | Missing | `src/payload/endpoints/reports.ts:36` | P0 | All tenants' orders. |
| SaaS billing | Subscription plans & pricing | Partial | `src/payload/collections/billing.ts:5-46` | P1 | Seeded on a GET render; archived plans selectable. |
| SaaS billing | Free trials | Broken | `src/lib/store-tenant.ts:361,447` | P1 | Reset on every publish → perpetual trial. |
| SaaS billing | Recurring billing | Missing | `—` | P1 |  |
| SaaS billing | Subscription status lifecycle | Partial | `src/payload/collections/billing.ts:76-87` | P1 | Never transitions. |
| SaaS billing | Upgrades / downgrades | Missing | `src/lib/store-tenant.ts:417-506` | P2 | `setStorePlanForUser` unused. |
| SaaS billing | Cancellations | Missing | `—` | P2 |  |
| SaaS billing | Payment failure / dunning | Missing | `—` | P1 |  |
| SaaS billing | Invoice history | Partial | `src/payload/collections/billing.ts:110-158` | P2 | Collection exists, never written. |
| SaaS billing | Billing webhooks | Missing | `—` | P1 |  |
| SaaS billing | Feature entitlements | Missing | `—` | P2 |  |
| SaaS billing | Staff / product / storage limits | Missing | `src/payload/collections/billing.ts:99-101` | P1 | Fields only, never enforced. |
| SaaS billing | Expiry, grace period, access restriction | Missing | `—` | P1 |  |
| Super admin | Platform overview dashboard | Missing | `—` | P1 |  |
| Super admin | All merchants / stores lists | Partial | `src/payload/collections/Stores.ts` | P1 | Raw collections, not in nav. |
| Super admin | Store status management | Partial | `src/payload/collections/Stores.ts:34-39` | P1 | Not enforced. |
| Super admin | Plans & SaaS billing admin | Partial | `src/payload/collections/billing.ts` | P1 |  |
| Super admin | Platform revenue reporting | Missing | `—` | P2 |  |
| Super admin | Failed payment monitoring | Missing | `—` | P2 |  |
| Super admin | Support tools / impersonation | Missing | `—` | P2 |  |
| Super admin | Audit trail for admin actions | Partial | `src/payload/collections/history.ts:244-248` | P1 | Platform collections, config-import and privacy erase not logged. |
| Super admin | Security events view | Partial | `src/payload/admin/security/SecurityView.tsx` | P2 | Per-user 2FA screen; no platform security log. |
| Jobs & integrations | Background job processing | Partial | `src/lib/housekeeping.ts; src/payload.config.ts:123-127` | P1 | In-process timer + Payload jobs in every instance. |
| Jobs & integrations | Retries / backoff / dead-letter | Missing | `src/lib/engagement-jobs.ts` | P1 |  |
| Jobs & integrations | Scheduled tasks | Complete | `src/instrumentation.ts:20-42` | P1 |  |
| Jobs & integrations | Transactional outbox | Missing | `—` | P1 | Notifications sent via after(); lost on crash. |
| Jobs & integrations | Event deduplication | Missing | `—` | P1 |  |
| Jobs & integrations | Webhook sending | Missing | `—` | P3 |  |
| Jobs & integrations | Webhook receiving | Missing | `—` | P0 |  |
| Jobs & integrations | Email / SMS / WhatsApp notifications | Complete | `src/lib/mailer.ts; src/lib/notify.ts` | P1 | Inline, no retry. |
| Jobs & integrations | Cache invalidation | Partial | `src/payload/revalidate.ts:41-59` | P1 | Global tags; redirect cache per instance. |
| Jobs & integrations | Search indexing | Partial | `src/lib/search.ts` | P2 | Full scan of the in-memory snapshot. |
| Jobs & integrations | Payment reconciliation | Missing | `—` | P1 |  |
| Jobs & integrations | Reservation cleanup | Partial | `src/lib/cms/confirm.ts:95-125` | P1 | COD auto-cancel only. |
| Production readiness | Application boots (Payload config valid) | Broken | `src/payload/collections/inventory.ts:24-25` | P0 | Duplicate `store` field → DuplicateFieldName at boot (reproduced locally). |
| Production readiness | Database migrations match config | Broken | `src/migrations/index.ts` | P0 | No migration for stores/memberships/billing/store_id/platform_role. |
| Production readiness | Unit tests | Partial | `tests/unit/*.test.ts` | P1 | 40/40 pass; tests encode the insecure merchant behaviour. |
| Production readiness | Integration / API tests | Partial | `scripts/tests/*` | P1 | Scripts exist, need DB/server, not in CI. |
| Production readiness | End-to-end tests | Missing | `—` | P1 |  |
| Production readiness | Tenant-isolation tests | Missing | `—` | P0 |  |
| Production readiness | Permission tests (collection/field) | Partial | `tests/unit/access.test.ts` | P0 | Helper-level only. |
| Production readiness | Checkout / payment webhook / refund tests | Missing | `—` | P0 |  |
| Production readiness | Inventory concurrency tests | Partial | `scripts/tests/stock-race.ts` | P1 | Not in CI; single-line only. |
| Production readiness | Environment validation | Partial | `src/lib/startup-checks.ts:9-18` | P1 | Ad hoc. |
| Production readiness | Health checks | Complete | `src/app/api/health/route.ts` | P1 | Discloses config warnings publicly. |
| Production readiness | Structured logging | Partial | `src/lib/log.ts` | P2 | 24 raw console.* calls remain. |
| Production readiness | Monitoring & error tracking | Partial | `src/instrumentation.ts; scripts/uptime/monitor.mjs` | P1 | Sentry optional, no tracing or source maps. |
| Production readiness | Database backups | Broken | `scripts/backup/Dockerfile:11-12` | P0 | Backup image cannot build (literal newline in sed). |
| Production readiness | Restore procedure | Partial | `docs/BACKUP-RESTORE.md:45-82` | P1 | Manual, untested. |
| Production readiness | CI/CD | Broken | `.github/workflows/ci.yml:7` | P1 | Triggers on `master`; repo uses `main`; lint fails with 2 warnings. |
| Production readiness | Deployment configuration | Partial | `scripts/docker-build.sh:23-30` | P1 | Migrations run against the live DB during image build. |
