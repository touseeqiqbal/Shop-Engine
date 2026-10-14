# 12 · Feature checklist after remediation (Shopify-like comparison)

State: **working tree after remediation (14 Oct 2026)**. Same 295 features, same scoring rules and evidence standard as report 01 (which stays as the audit baseline of commit
`aab6879`). Rows that changed carry their new evidence; tests named in "Evidence" / "Notes" were actually run (see report 11 §4).
Status legend: **Complete** = works end to end in code · **Partial** = some requirements unmet · **Missing** = not built ·
**Broken** = implemented with an evident defect · **Not Verified** = could not be confirmed · **N/A** = out of scope.

> "Complete" here still means complete *in code*. Calls to Stripe's API, email/WhatsApp delivery, CI on GitHub and a production build were
> not run (report 11 §5).

## Scores

Scoring: Complete = 1, Partial = 0.5, Missing/Broken = 0. Not Verified rows are excluded from *verified-only* coverage but counted in the
denominator of *confirmed* coverage. N/A rows are excluded entirely.

| Metric | Value |
|---|---|
| Features assessed | 295 |
| Complete / Partial / Missing / Broken / Not Verified | 230 / 49 / 12 / 0 / 4 |
| **Confirmed feature coverage** (points ÷ all applicable) | **86.3%** (254.5 / 295) |
| **Verified-only coverage** (points ÷ verified) | **87.5%** (254.5 / 291) |
| Unverified features | 4 |
| Broken features that are P0 | 0 |

> Feature coverage measures how much Shopify-like functionality exists in code. It is **not** a security or production-readiness
> certification: a store can score well here and still be unsafe to launch (see 05-security-audit.md).

### Module scores

| Module | Features | C | P | M | B | NV | Confirmed | Verified-only |
|---|---|---|---|---|---|---|---|---|
| Access control | 30 | 24 | 3 | 3 | 0 | 0 | 85.0% | 85.0% |
| Onboarding | 13 | 11 | 2 | 0 | 0 | 0 | 92.3% | 92.3% |
| Store management | 19 | 14 | 5 | 0 | 0 | 0 | 86.8% | 86.8% |
| Products | 15 | 15 | 0 | 0 | 0 | 0 | 100.0% | 100.0% |
| Variants | 10 | 10 | 0 | 0 | 0 | 0 | 100.0% | 100.0% |
| Collections | 7 | 6 | 1 | 0 | 0 | 0 | 92.9% | 92.9% |
| Inventory | 17 | 12 | 3 | 2 | 0 | 0 | 79.4% | 79.4% |
| Storefront | 16 | 14 | 0 | 0 | 0 | 2 | 87.5% | 100.0% |
| Themes | 7 | 4 | 2 | 1 | 0 | 0 | 71.4% | 71.4% |
| Cart & checkout | 17 | 14 | 3 | 0 | 0 | 0 | 91.2% | 91.2% |
| Payments | 18 | 15 | 3 | 0 | 0 | 0 | 91.7% | 91.7% |
| Orders | 23 | 21 | 2 | 0 | 0 | 0 | 95.7% | 95.7% |
| Shipping & fulfillment | 14 | 8 | 3 | 3 | 0 | 0 | 67.9% | 67.9% |
| Customers | 11 | 10 | 1 | 0 | 0 | 0 | 95.5% | 95.5% |
| Discounts & marketing | 16 | 13 | 2 | 1 | 0 | 0 | 87.5% | 87.5% |
| Analytics | 12 | 7 | 2 | 1 | 0 | 2 | 66.7% | 80.0% |
| SaaS billing | 12 | 12 | 0 | 0 | 0 | 0 | 100.0% | 100.0% |
| Super admin | 9 | 4 | 5 | 0 | 0 | 0 | 72.2% | 72.2% |
| Jobs & integrations | 12 | 9 | 3 | 0 | 0 | 0 | 87.5% | 87.5% |
| Production readiness | 17 | 7 | 9 | 1 | 0 | 0 | 67.6% | 67.6% |

## Checklist

| Module | Feature | Status | Evidence | Priority | Notes |
|---|---|---|---|---|---|
| Access control | Platform super-admin role | Complete | `src/payload/tenancy.ts:56-58; Users.ts platformRole field (platform-only)` | P0 | Owner or platform_admin, 2-step required; not self-assignable (scripts/tests/tenant-isolation.ts (18/18 ✓, real DB)). |
| Access control | Super admin: view merchants & stores | Complete | `src/payload/admin/platform/PlatformView.tsx; src/payload/endpoints/platform.ts` | P1 | Platform section in /cms nav; Stores collection grouped under Platform. |
| Access control | Super admin: create / suspend / reactivate stores | Complete | `src/payload/endpoints/platform.ts (POST /platform/stores/:id/status); src/lib/tenant-shared.ts storeAvailability` | P1 | Status enforced: shop offline + /cms read-only. |
| Access control | Super admin: platform metrics | Complete | `src/payload/endpoints/platform.ts overviewFor` | P2 | Stores by status, new stores, merchants, subscriptions by status, MRR, 30-day GMV, top stores, failing payments, dead deliveries. |
| Access control | Super admin: manage SaaS plans | Complete | `src/payload/collections/billing.ts SubscriptionPlans` | P1 | Platform-only CRUD; limits and features enforced (src/payload/entitlements.ts). |
| Access control | Super admin: monitor subscriptions & invoices | Complete | `src/lib/billing.ts handleBillingEvent / runBillingLifecycle` | P1 | Invoices written from provider events; status transitions (scripts/tests/billing-lifecycle.ts (7/7 ✓); scripts/tests/payment-webhooks.mjs (15/15 ✓, running server)). |
| Access control | Super admin: platform configuration | Complete | `src/payload/store-settings.ts; src/payload/globals/* (update: platformAdmins)` | P2 | Globals = platform defaults; every store edits its own copy. |
| Access control | Super admin: audit log review | Partial | `src/payload/collections/history.ts:81,185-188,244-248` | P1 | Activity log exists; platform collections and non-staff actors not logged. |
| Access control | Super admin: platform integrations | Missing | `—` | P3 |  |
| Access control | Super admin: controlled support access (impersonation) | Partial | `src/payload/endpoints/platform.ts switchStore (logged)` | P2 | Platform admins can open any store; every entry is written to that store's activity log. No per-user impersonation. |
| Access control | Merchant: create & configure own store | Complete | `src/lib/store-tenant.ts createStoreForUser; Stores.ts update access (store_owner)` | P1 | Create + configure own store and its settings. |
| Access control | Merchant: manage employees | Complete | `src/payload/collections/StoreMemberships.ts` | P1 | Owners/managers invite, suspend and remove (never above their own role). |
| Access control | Staff: invite | Complete | `StoreMemberships.ts issueInvite/sendInvite; src/lib/notify.ts notifyStoreInvite` | P1 | Emailed one-time token (only its hash stored), 7-day expiry, plan team limit. |
| Access control | Staff: accept invitation | Complete | `src/lib/store-tenant.ts acceptStoreInvitation` | P1 | Only the invited email's confirmed account; expiry checked; no global role change. |
| Access control | Staff: per-store roles | Complete | `src/payload/tenancy.ts resolveTenant/storeScope` | P0 | store_owner > store_manager > store_staff from active memberships only (tests/unit/access.test.ts). |
| Access control | Staff: custom permissions | Missing | `—` | P2 |  |
| Access control | Staff: restrict sensitive operations | Complete | `catalog.ts storeRoleField (price/cost/stock); content.ts money decisions = manager; payments refund = manager` | P1 |  |
| Access control | Staff: revoke access | Complete | `tenancy.ts resolveTenant (active memberships only)` | P0 | Suspending/deleting a membership removes access on the next request. |
| Access control | Customer: browse, search, cart, checkout | Complete | `src/app/(frontend)/(store)/*` | P0 | Single-tenant storefront. |
| Access control | Customer: guest checkout | Complete | `src/app/(frontend)/(store)/checkout/actions.ts:109` | P0 |  |
| Access control | Customer: optional account | Complete | `src/app/(frontend)/(store)/account/actions.ts` | P1 |  |
| Access control | Customer: order history & addresses | Complete | `src/app/(frontend)/(store)/account/orders/load.ts:10-37` | P1 |  |
| Access control | Customer: request returns | Complete | `src/app/(frontend)/(store)/returns/actions.ts:20; src/lib/cms/aftersales.ts` | P2 | POS receipt format fixed; per store. |
| Access control | One user in multiple stores | Complete | `tenancy.ts roles Map; nav/StoreSwitcher.tsx` | P1 |  |
| Access control | Different roles in different stores | Complete | `tenancy.ts` | P0 | Role per store membership (tests/unit/access.test.ts). |
| Access control | Backend authorization enforced | Complete | `src/payload/tenancy.ts; endpoints/guard.ts storeGate` | P0 | Collections, fields, endpoints and print routes scoped server-side. |
| Access control | Tenant data isolation | Complete | `tenancy.ts readFor/writeFor/createFor/assignStore; src/lib/tenant.ts` | P0 | scripts/tests/tenant-isolation.ts (18/18 ✓, real DB); host routing checked on a running server. |
| Access control | Field-level protection of role/tenant fields | Complete | `Users.ts field access (platformRole, customerOf, emailVerified: platform-only)` | P0 | Self-promotion refused (scripts/tests/tenant-isolation.ts (18/18 ✓, real DB)). |
| Access control | Granular permission model | Missing | `—` | P2 | Four fixed legacy roles only. |
| Access control | Secure session management | Partial | `proxy.ts per (account, network) sign-in limit; Users.ts maxLoginAttempts 0` | P0 | No lock-out DoS; storefront session length unchanged (30 days). |
| Onboarding | 1. Merchant landing / sign-up entry | Partial | `src/app/(frontend)/(store)/account/stores/page.tsx` | P2 | Reuses storefront customer registration; no merchant landing. |
| Onboarding | 2. Sign up | Complete | `src/app/(frontend)/(store)/account/actions.ts:65-80` | P1 |  |
| Onboarding | 3. Email verification before store creation | Complete | `src/lib/store-tenant.ts createStoreForUser` | P1 | Confirmed email required; Turnstile; 3/day; MAX_STORES_PER_USER. |
| Onboarding | 4. Create store | Complete | `src/lib/store-tenant.ts; migration 20261013_233003_multi_tenancy` | P0 | Draft store + owner membership + settings docs (not run in a browser). |
| Onboarding | 5. Unique slug / subdomain | Complete | `src/payload/collections/Stores.ts (unique slug/subdomain, reserved names)` | P1 |  |
| Onboarding | 6. Country & currency | Partial | `Stores.ts country/currency` | P1 | Stored and used for card payments; storefront prices still formatted in PKR. |
| Onboarding | 7. Default settings initialized | Complete | `src/payload/store-settings.ts ensureStoreSettings` | P1 | Store info + SEO seeded with the store's own name. |
| Onboarding | 8. Plan / trial selection | Complete | `src/lib/billing.ts choosePlan` | P1 | Active plans only; one trial per store; paid plans via provider checkout. |
| Onboarding | 9. Configure payment providers | Complete | `src/lib/payments/index.ts paymentsOnboardingLink; per-store Settings → Payments` | P0 | Connect onboarding needs STRIPE_SECRET_KEY (not exercised against Stripe). |
| Onboarding | 10. Configure shipping | Complete | `store-shipping settings (src/payload/store-settings.ts)` | P1 |  |
| Onboarding | 11. Add products | Complete | `catalog.ts (store-scoped) + entitlements.ts productLimit` | P1 |  |
| Onboarding | 12. Storefront branding | Complete | `store-theme-settings / header / footer per store` | P1 |  |
| Onboarding | 13. Publish store | Complete | `src/lib/store-tenant.ts publishStore` | P1 | Owner only, from draft, active/trialing plan, ≥1 active product. |
| Store management | Store CRUD | Complete | `Stores.ts; platform.ts` | P1 |  |
| Store management | Store ownership | Complete | `Stores.ts owner + store_owner membership` | P1 |  |
| Store management | Store memberships | Complete | `StoreMemberships.ts` | P0 |  |
| Store management | Status lifecycle (active/suspended/closed) | Complete | `Stores.ts status; tenant-shared.ts storeAvailability` | P1 |  |
| Store management | Suspension enforcement | Complete | `src/app/(frontend)/(store)/layout.tsx; tenancy.ts readOnly` | P0 | Suspended/closed/lapsed: storefront offline, /cms read-only. |
| Store management | Logo & branding per store | Complete | `store-theme-settings per store` | P1 |  |
| Store management | Contact information per store | Complete | `store-store-info per store; src/lib/repo/site-content.ts getSiteInfo(storeId)` | P1 |  |
| Store management | Currency configuration | Partial | `Stores.ts currency` | P1 | Card checkout uses it; storefront formatting is PKR-only. |
| Store management | Timezone configuration | Partial | `Stores.ts timezone` | P2 | Stored; dates and order numbers still use Pakistan time. |
| Store management | Business address | Complete | `store-info per store` | P2 |  |
| Store management | Store language | Partial | `Stores.ts defaultLanguage` | P3 | Stored only. |
| Store management | Store preferences | Complete | `/cms/settings/:page per store (src/payload/admin/settings/StoreSettingsView.tsx)` | P2 |  |
| Store management | Custom domain connection | Complete | `src/lib/store-tenant.ts setCustomDomainForUser; Stores.ts` | P1 | Plan feature custom_domain. |
| Store management | Subdomain routing | Complete | `src/lib/tenant-shared.ts matchStore; src/lib/tenant.ts` | P0 | Checked on a running server (sub-domain, unknown → 404, draft → coming soon). |
| Store management | Domain ownership verification | Complete | `src/lib/store-tenant.ts verifyCustomDomainForUser (DNS TXT)` | P1 |  |
| Store management | Domain status & SSL | Partial | `Stores.ts domainVerifiedAt` | P2 | Verification status shown; SSL is the host's job (not automated). |
| Store management | Multi-store switching | Complete | `src/payload/admin/nav/StoreSwitcher.tsx; POST /cms-api/platform/switch-store` | P1 |  |
| Store management | Store deletion & data retention | Partial | `Stores.ts beforeDelete` | P2 | Refuses default store / stores with orders; no retention or export flow. |
| Store management | Tenant isolation of store-specific operations | Complete | `endpoints/guard.ts; route-access.ts` | P0 | scripts/tests/tenant-isolation.ts (18/18 ✓, real DB) |
| Products | Create / edit products | Complete | `src/payload/collections/catalog.ts:375-559` | P0 |  |
| Products | Delete / archive | Complete | `catalog.ts refuseProductDelete; delete = store_manager` | P1 |  |
| Products | Draft / active / scheduled | Complete | `src/payload/collections/catalog.ts:404,539-546` | P1 |  |
| Products | Title, description, images | Complete | `src/payload/collections/catalog.ts:414,420-422` | P0 |  |
| Products | Categories | Complete | `src/payload/collections/catalog.ts:419` | P1 |  |
| Products | Product type | Complete | `catalog.ts productType` | P3 |  |
| Products | Brand / vendor | Complete | `src/payload/collections/catalog.ts:416` | P2 |  |
| Products | Tags | Complete | `src/payload/collections/catalog.ts:549` | P2 |  |
| Products | SEO metadata | Complete | `src/payload.config.ts:190-231` | P2 | Meta titles hardcode 'Urko Tech Store'. |
| Products | URL slug | Complete | `fields.ts perStoreUnique` | P1 | Unique within a store. |
| Products | Publication visibility | Complete | `src/lib/cms/catalog-source.ts:131` | P0 |  |
| Products | Tenant ownership of products | Complete | `catalog.ts storeField + assignStore` | P0 | scripts/tests/tenant-isolation.ts (18/18 ✓, real DB) |
| Products | Historical order integrity after delete | Complete | `src/lib/cms/sales.ts orderData (sku/options snapshot)` | P1 |  |
| Products | Storefront hides unpublished | Complete | `src/lib/repo/catalog.ts groupVariants` | P0 | Variants of inactive parents hidden. |
| Products | Backend price & variant validation | Complete | `src/lib/cart-pricing.ts:27-83` | P0 |  |
| Variants | Product options (≤3) | Complete | `src/payload/collections/catalog.ts:511-533` | P1 |  |
| Variants | Option combinations generator | Complete | `src/payload/collections/catalog.ts:43-98` | P1 |  |
| Variants | Variant SKU / price / compare-at | Complete | `src/payload/collections/catalog.ts` | P1 |  |
| Variants | Barcode | Complete | `catalog.ts barcode (unique per store); pos.ts lookup` | P3 | Scanned at the shop counter. |
| Variants | Variant images | Complete | `src/lib/repo/catalog.ts:60,64` | P2 |  |
| Variants | Variant weight | Complete | `catalog.ts createVariantsEndpoint (copies weight, shipping class, tags)` | P3 |  |
| Variants | Per-variant inventory | Complete | `src/payload/stock.ts:184-192` | P0 |  |
| Variants | Stable variant IDs | Complete | `integer product ids` | P0 |  |
| Variants | Variant + upgrade purchasable | Complete | `src/lib/cart-pricing.ts (parent's upgrades)` | P0 |  |
| Variants | Unique option combinations | Complete | `catalog.ts uniqueOptions; createVariantsEndpoint` | P2 | Two variants of one product can't have the same choices. |
| Collections | Manual collections | Complete | `src/payload/collections/ProductCollections.ts:36` | P2 |  |
| Collections | Automated / rule-based | Complete | `src/payload/collections/ProductCollections.ts:37-72` | P2 |  |
| Collections | Image & description | Complete | `src/payload/collections/ProductCollections.ts:25-26` | P3 |  |
| Collections | Product assignment | Complete | `src/lib/cms/collections.ts:68-99` | P2 |  |
| Collections | Collection SEO | Complete | `src/payload.config.ts:191` | P3 |  |
| Collections | Visibility | Partial | `src/payload/collections/ProductCollections.ts:86` | P3 | Checkbox only; no drafts/schedule. |
| Collections | Tenant scoping | Complete | `ProductCollections.ts store field + sameStore` | P0 |  |
| Inventory | Inventory items | Partial | `src/payload/collections/shop.ts:56-90` | P1 | Stock column per product + serial units. |
| Inventory | Inventory locations | Missing | `—` | P3 |  |
| Inventory | Levels by variant & location | Missing | `—` | P3 | Per variant only. |
| Inventory | Stock adjustment | Complete | `catalog.ts guardStock (row lock)` | P1 |  |
| Inventory | Stock movement history | Complete | `src/payload/collections/history.ts:35-67` | P1 |  |
| Inventory | Low-stock alerts | Complete | `src/payload/stock.ts lowStockAlert` | P2 | The store's team is emailed when a sale reaches the warning level or sells out (once a day). |
| Inventory | Out-of-stock behaviour | Complete | `src/lib/cart-pricing.ts:72-81` | P1 | Deny only. |
| Inventory | Reservations | Partial | `src/payload/stock.ts:238-247` | P1 | Stock taken at order placement; no checkout hold. |
| Inventory | Reservation expiry | Partial | `src/lib/cms/confirm.ts:95-125` | P1 | Unconfirmed COD auto-cancel only. |
| Inventory | Commit on purchase | Complete | `src/lib/cms/sales.ts:137-153` | P0 |  |
| Inventory | Release on failed / cancelled | Complete | `src/payload/collections/content.ts:196-214` | P0 |  |
| Inventory | Return restocking | Complete | `src/payload/collections/aftersales.ts:194-232` | P1 |  |
| Inventory | Adjustment permissions | Complete | `inventory endpoints storeGate` | P1 |  |
| Inventory | Overselling protection | Complete | `src/payload/stock.ts:86-89` | P0 | Atomic conditional UPDATE. |
| Inventory | Concurrent checkout safety | Complete | `src/payload/stock.ts lockProducts (id order)` | P0 |  |
| Inventory | Stock count accuracy | Complete | `src/payload/endpoints/inventory.ts (firstTouch expected stock)` | P1 |  |
| Inventory | Purchase receiving concurrency | Complete | `inventory.ts purchase receive lock` | P1 |  |
| Storefront | Per-tenant routing | Complete | `src/lib/tenant.ts; src/proxy.ts storeIdForHost` | P0 | Pages render per request (unstable_rethrow) – data cached per store. |
| Storefront | Homepage | Complete | `src/app/(frontend)/(store)/page.tsx` | P1 |  |
| Storefront | Product listing / filtering / sorting | Complete | `src/components/shop/*` | P1 |  |
| Storefront | Product details | Complete | `src/app/(frontend)/(store)/[category]/[product]/page.tsx` | P0 |  |
| Storefront | Collections pages | Complete | `src/app/(frontend)/(store)/collections/[slug]/page.tsx` | P2 |  |
| Storefront | Search | Complete | `src/lib/search.ts` | P1 | In-memory ranker over the snapshot. |
| Storefront | Cart & checkout pages | Complete | `src/app/(frontend)/(store)/cart, checkout` | P0 |  |
| Storefront | Customer account pages | Complete | `src/app/(frontend)/(store)/account/*` | P1 |  |
| Storefront | Navigation menus | Complete | `src/payload/collections/Menus.ts` | P2 |  |
| Storefront | Static & contact pages | Complete | `src/app/(frontend)/(store)/pages/[slug], contact` | P2 |  |
| Storefront | Legal pages | Complete | `src/lib/content/page-defaults.ts (plain texts for other stores); src/lib/repo/site-content.ts` | P2 | The original shop keeps its own policies; other stores get neutral ones with their name and details until they save their own. |
| Storefront | SEO metadata | Complete | `app/(frontend)/layout.tsx metadataBase per store; src/lib/seo.ts relative canonicals; src/lib/page-seo.ts` | P2 | Checked: canonical on a store's own address. |
| Storefront | Sitemap | Complete | `src/app/sitemap.ts; src/app/robots.ts` | P2 | Per host; closed stores list nothing / disallow all. |
| Storefront | Robots | Complete | `src/app/robots.ts` | P3 |  |
| Storefront | Mobile responsiveness | Not Verified | `—` | P2 | Not rendered in a browser during this audit. |
| Storefront | Page performance | Not Verified | `docs/APP-AUDIT.md` | P2 | Prior audit reported mobile LCP 3.8–6.5 s; not re-measured. |
| Themes | Theme selection / library | Missing | `—` | P3 | One built-in theme. |
| Themes | Theme configuration (no-code) | Complete | `src/payload/globals/online-store.ts:31-101` | P1 | Single-tenant. |
| Themes | Homepage & reusable sections | Complete | `src/payload/blocks.ts:43-234` | P1 | 10 blocks. |
| Themes | Theme preview | Partial | `src/payload/collections/Pages.ts:46-54` | P2 | Pages/products only. |
| Themes | Draft theme settings / publish | Partial | `src/payload/globals/online-store.ts:26-28` | P2 | Theme saves go live immediately. |
| Themes | Theme versioning | Complete | `src/migrations/20261012_115415_theme_history.ts` | P3 |  |
| Themes | Per-store theme | Complete | `store-theme-settings per store` | P0 |  |
| Cart & checkout | Guest cart | Complete | `src/store/cart.ts:41-91` | P0 | localStorage. |
| Cart & checkout | Customer (server-side) cart | Complete | `customer-carts collection; cart/saved-cart.ts; components/layout/cart-persistence.tsx` | P2 | Per (customer, store); merged after sign-in. Checked in a browser: cart from device A restored on device C. |
| Cart & checkout | Quantity changes | Complete | `src/store/cart.ts:57-79` | P1 |  |
| Cart & checkout | Live re-price / availability sync | Complete | `src/app/(frontend)/(store)/cart/actions.ts:26-38` | P1 |  |
| Cart & checkout | Server-side price calculation | Complete | `src/lib/cart-pricing.ts:67,83; checkout/actions.ts:164-175` | P0 | Client cannot set prices; `expectedTotal` is compare-only. |
| Cart & checkout | Discount application | Complete | `src/lib/coupons.ts:12-34` | P0 |  |
| Cart & checkout | Shipping calculation | Complete | `src/lib/cities.ts:90-102` | P0 |  |
| Cart & checkout | Free-delivery threshold after discount | Complete | `src/lib/order-totals.ts` | P2 | Same function in browser and server; checked in a browser checkout. |
| Cart & checkout | Tax calculation | Complete | `src/lib/order-totals.ts; Settings → Payments → tax` | P1 | Inclusive or added; optional on delivery. |
| Cart & checkout | Checkout sessions & expiry | Partial | `src/lib/payments/index.ts (30-min card checkout)` | P1 | Card sessions expire; other methods stateless. |
| Cart & checkout | Inventory reservation | Partial | `src/lib/cms/sales.ts:137-153` | P1 | At placement only. |
| Cart & checkout | Payment initialization (online) | Complete | `src/lib/payments/index.ts startCardPayment` | P0 | Hosted Stripe Checkout (needs Stripe keys). |
| Cart & checkout | Order creation (transactional) | Complete | `src/lib/cms/sales.ts:123-166` | P0 |  |
| Cart & checkout | Duplicate order prevention / idempotency | Partial | `src/lib/cms/sales.ts:125-127; migrations/20261006_213603_order_safety.ts:8` | P0 | Only when the client sends `attemptId`. |
| Cart & checkout | Failed checkout recovery | Complete | `order-confirmation/[orderNumber]/pay-action.ts; failCheckout` | P2 | Pay-now link; unpaid card orders cancelled with stock back. |
| Cart & checkout | Abandoned checkout tracking | Complete | `src/lib/cms/engagement.ts; cart/restore/[token]/page.tsx` | P2 | Upgrades kept, owner cookie, POST-only stop. |
| Cart & checkout | Order attributed to a store | Complete | `src/app/(frontend)/(store)/checkout/actions.ts` | P0 | Verified in a browser checkout (store_id set). |
| Payments | Online payment provider | Complete | `src/lib/payments/*` | P0 | Stripe over REST; scripts/tests/payment-webhooks.mjs (15/15 ✓, running server). |
| Payments | Manual methods (COD, bank, wallets with proof) | Complete | `src/app/(frontend)/(store)/checkout/actions.ts:219-256` | P1 |  |
| Payments | Merchant payment account onboarding | Complete | `src/lib/payments/index.ts paymentsOnboardingLink / refreshPaymentsAccount` | P0 | Not exercised against Stripe. |
| Payments | Hosted secure collection | Complete | `Stripe Checkout (hosted)` | P0 | Card data never touches ShopEngine. |
| Payments | Authorization / capture | Partial | `Checkout Sessions capture immediately` | P1 | No separate authorize/capture. |
| Payments | Failure / cancellation handling | Complete | `src/lib/payments/index.ts failCheckout` | P1 | scripts/tests/payment-webhooks.mjs (15/15 ✓, running server) |
| Payments | Provider refunds | Complete | `src/lib/payments/index.ts refundCardOrder; POST /cms-api/payments/refund` | P1 | Capped by charged − refunded; not exercised against Stripe. |
| Payments | Partial refunds | Complete | `refundCardOrder; partially-refunded status` | P1 |  |
| Payments | Payment event history | Complete | `collections/payments.ts (payment-transactions, payment-events)` | P0 |  |
| Payments | Webhook signature verification | Complete | `src/lib/payments/stripe.ts verifyStripeWebhook` | P0 | Unit + scripts/tests/payment-webhooks.mjs (15/15 ✓, running server). |
| Payments | Replay protection & dedup | Complete | `payment-events unique (provider, eventId); 300 s tolerance` | P0 | scripts/tests/payment-webhooks.mjs (15/15 ✓, running server) |
| Payments | Idempotency keys | Complete | `stripe() idempotencyKey on every write` | P0 |  |
| Payments | Reconciliation | Partial | `src/lib/payments/index.ts reconcileCardPayments` | P1 | Card checkouts reconciled; COD remittance still manual. |
| Payments | Provider reference IDs | Complete | `payment-transactions providerRef unique; orders paymentReference per-store unique` | P1 |  |
| Payments | Multi-currency | Partial | `store currency → Stripe` | P3 | Storefront shows PKR only. |
| Payments | Customer payments separate from SaaS billing | Complete | `collections/payments.ts vs collections/billing.ts` | P1 |  |
| Payments | Merchant payouts via provider | Complete | `Stripe Connect (direct charges to the merchant's account)` | P1 | Payouts by Stripe. |
| Payments | Per-store payment account details | Complete | `store-payments per store; globals platform-only` | P0 | scripts/tests/tenant-isolation.ts (18/18 ✓, real DB) |
| Orders | Order creation | Complete | `src/lib/cms/sales.ts:123-166` | P0 |  |
| Orders | Order number generation | Complete | `Stores.orderPrefix; repo/orders.ts generateOrderNumber` | P1 |  |
| Orders | Order details & line items | Complete | `src/payload/collections/content.ts:374-490` | P0 |  |
| Orders | Customer association | Complete | `src/payload/collections/content.ts` | P1 |  |
| Orders | Product/variant snapshots | Complete | `sales.ts orderData sku/options` | P1 |  |
| Orders | Price snapshots | Complete | `src/lib/cms/sales.ts:83-97` | P0 |  |
| Orders | Tax snapshots | Partial | `orders.taxTotal` | P1 | Order-level tax total; no per-line breakdown. |
| Orders | Address snapshots | Partial | `src/payload/collections/content.ts:416-432` | P2 | Single address, no billing/shipping split. |
| Orders | Timeline | Complete | `src/payload/collections/content.ts:329-342` | P1 |  |
| Orders | Payment status (separate field) | Complete | `src/payload/collections/content.ts:463-476` | P0 |  |
| Orders | Fulfillment status (separate field) | Complete | `content.ts fulfillmentStatus (derived)` | P1 | scripts/tests/order-lifecycle.ts (13/13 ✓, in CI) |
| Orders | Order status state machine | Complete | `content.ts STAFF_MOVES` | P0 | Managers may override. |
| Orders | Cancellation (restock, coupon release) | Complete | `src/payload/collections/content.ts:196-214` | P1 |  |
| Orders | Partial fulfillment | Complete | `payload/endpoints/orders.ts ship / shipment; content.ts shipments + partially_fulfilled` | P2 | scripts/tests/shipments.ts (8/8 ✓, in CI) |
| Orders | Refund processing | Complete | `aftersales.ts + payments refunds` | P1 | Card refunds through the provider; cumulative cap. |
| Orders | Refund cap | Complete | `src/payload/collections/aftersales.ts` | P0 | Cumulative against order total. |
| Orders | Coupon usage consistency | Complete | `content.ts couponConsumed/couponReturned` | P1 | scripts/tests/order-lifecycle.ts (13/13 ✓, in CI) |
| Orders | Concurrent edit safety | Complete | `content.ts (row lock on every status change)` | P1 | scripts/tests/order-lifecycle.ts (13/13 ✓, in CI) |
| Orders | Returns | Complete | `src/payload/collections/aftersales.ts` | P1 |  |
| Orders | Order notes | Complete | `orders.customerNote` | P2 |  |
| Orders | Filtering & search | Complete | `src/payload/collections/content.ts:380-401` | P1 |  |
| Orders | Notifications | Complete | `src/lib/notify.ts` | P1 | Not durable (see Jobs). |
| Orders | Tenant scoping of orders | Complete | `content.ts storeField + readFor/writeFor` | P0 | scripts/tests/tenant-isolation.ts (18/18 ✓, real DB) |
| Shipping & fulfillment | Shipping zones | Complete | `src/payload/globals/commerce.ts` | P1 | Single-tenant. |
| Shipping & fulfillment | Shipping methods | Partial | `src/lib/cities.ts:90-102` | P2 | One rate per zone + COD fee. |
| Shipping & fulfillment | Shipping rates | Complete | `src/lib/cities.ts:90-102` | P1 |  |
| Shipping & fulfillment | Free shipping rules | Complete | `src/lib/cities.ts:95,99` | P2 | See checkout bug. |
| Shipping & fulfillment | Location-based fulfillment | Missing | `—` | P3 |  |
| Shipping & fulfillment | Fulfillment creation | Complete | `POST /cms-api/order-tools/ship` | P1 | A shipment per parcel with its items, courier and tracking. |
| Shipping & fulfillment | Partial fulfillment | Complete | `orders.ts ship (any part of the remaining items)` | P2 | scripts/tests/shipments.ts (8/8 ✓, in CI) |
| Shipping & fulfillment | Tracking numbers & URLs | Complete | `src/lib/couriers.ts:14-71` | P2 |  |
| Shipping & fulfillment | Carrier integration | Missing | `—` | P2 |  |
| Shipping & fulfillment | Shipment notifications | Complete | `src/payload/collections/content.ts:355-371` | P2 |  |
| Shipping & fulfillment | Delivery tracking | Partial | `shipments courier/tracking per parcel; parcel delivered` | P2 | Statuses set by staff – no carrier tracking sync. |
| Shipping & fulfillment | Return shipping | Missing | `—` | P3 |  |
| Shipping & fulfillment | Fulfillment cancellation | Complete | `POST /cms-api/order-tools/shipment (cancelled)` | P2 | A cancelled parcel's items can be shipped again. |
| Shipping & fulfillment | Fulfillment independent of payment | Partial | `src/payload/collections/content.ts:114-116` | P1 | Online orders blocked unless paid; COD delivered stays unpaid with no reconciliation. |
| Customers | Store-scoped customer records | Complete | `users.customerOf + usersRead (store's own customers only)` | P0 | scripts/tests/tenant-isolation.ts (18/18 ✓, real DB) |
| Customers | Guest customers | Complete | `src/payload/collections/Users.ts:169-178` | P1 |  |
| Customers | Registered customers & profiles | Complete | `src/payload/collections/Users.ts` | P1 |  |
| Customers | Addresses | Partial | `src/payload/collections/Users.ts:231-237` | P2 | Pakistan-only validation. |
| Customers | Order history | Complete | `src/app/(frontend)/(store)/account/orders/load.ts` | P1 |  |
| Customers | Customer search | Complete | `src/payload/collections/Users.ts:23` | P2 |  |
| Customers | Tags & notes | Complete | `src/payload/collections/Users.ts:244-246` | P2 |  |
| Customers | Marketing consent | Complete | `checkout-form.tsx consent box (unticked); orders.marketingConsent; users.marketingConsent (per store)` | P1 | Recorded per store; each store sees only its own. |
| Customers | Authentication & password reset | Complete | `src/lib/cms/sales.ts:370-394` | P1 |  |
| Customers | Data export / deletion | Complete | `account/data-export/route.ts (customer self-service JSON); src/payload/endpoints/privacy.ts (platform erase)` | P1 | Erasure stays a platform-admin action (logged). |
| Customers | PII tenant isolation | Complete | `privacy.ts platform-only; usersRead scoped` | P0 | scripts/tests/tenant-isolation.ts (18/18 ✓, real DB) |
| Discounts & marketing | Percentage & fixed discounts | Complete | `src/payload/collections/sales.ts:8-42` | P1 |  |
| Discounts & marketing | Free-shipping discount | Complete | `collections/sales.ts kind free_shipping; lib/coupons.ts` | P2 |  |
| Discounts & marketing | Discount codes | Complete | `src/payload/collections/sales.ts:19` | P1 | Unique platform-wide, not per store. |
| Discounts & marketing | Automatic discounts | Complete | `sales.ts automatic; lib/coupons.ts resolveDiscounts` | P2 |  |
| Discounts & marketing | Start / end dates | Complete | `sales.ts startsAt/expiresAt` | P2 |  |
| Discounts & marketing | Redemption limits | Complete | `src/payload/stock.ts:123-131` | P1 | Race-safe UPDATE. |
| Discounts & marketing | Per-customer limits | Complete | `sales.ts perCustomerLimit; lib/cms/sales.ts couponUsesByCustomerCms` | P2 |  |
| Discounts & marketing | Minimum purchase | Complete | `src/payload/collections/sales.ts` | P2 |  |
| Discounts & marketing | Product / collection-specific | Complete | `sales.ts appliesTo products/categories/collections` | P2 | Variants covered (unit test). |
| Discounts & marketing | Stacking rules | Complete | `sales.ts combinable` | P3 |  |
| Discounts & marketing | Backend coupon validation | Complete | `src/lib/coupons.ts:18-34` | P0 |  |
| Discounts & marketing | Usage tracking | Complete | `consumeCoupon/releaseCoupon per store` | P1 | scripts/tests/order-lifecycle.ts (13/13 ✓, in CI) |
| Discounts & marketing | Flash sales | Partial | `src/payload/collections/sales.ts:442-461` | P3 | Display only; never affect price. |
| Discounts & marketing | Campaign records | Missing | `—` | P3 |  |
| Discounts & marketing | Email marketing integration | Partial | `src/payload/endpoints/marketing.ts subscribers.csv` | P3 | Consenting customers per store as CSV for any email tool; no direct API integration. |
| Discounts & marketing | Abandoned checkout recovery | Complete | `src/lib/engagement-jobs.ts sendCartReminders (per store, queued)` | P2 | Plan feature abandoned_carts. |
| Analytics | Total / gross / net sales | Complete | `src/payload/endpoints/sales-report.ts:26-60` | P1 |  |
| Analytics | Order count & AOV | Complete | `src/payload/endpoints/reports.ts:26-133` | P1 |  |
| Analytics | Sales by date / product | Complete | `src/payload/endpoints/reports.ts` | P1 |  |
| Analytics | Refund reporting | Complete | `src/payload/endpoints/sales-report.ts:174-183` | P1 |  |
| Analytics | Customer count | Not Verified | `src/payload/admin/Dashboard.tsx` | P2 | Not traced. |
| Analytics | Returning customers | Complete | `src/payload/endpoints/reports.ts customers (new vs returning by phone); Dashboard.tsx` | P2 | Checked by calling the report on the test database. |
| Analytics | Sales by channel | Not Verified | `src/payload/endpoints/sales-report.ts` | P2 | POS vs online split not traced. |
| Analytics | Inventory reporting | Partial | `src/payload/endpoints/reports.ts:61-62` | P2 |  |
| Analytics | Traffic tracking | Missing | `src/components/analytics.tsx` | P2 | GA4 / Meta pixel snippets only. |
| Analytics | Conversion reporting | Partial | `reports.ts checkout (started vs completed, won back by reminders)` | P2 | Checkout completion only – no visitor/session tracking. |
| Analytics | Dashboard KPI correctness | Complete | `reports.ts (sales = orders that went ahead; range ≤ 400 days)` | P2 |  |
| Analytics | Store-scoped analytics | Complete | `src/payload/endpoints/reports.ts (storeGate inStore)` | P0 |  |
| SaaS billing | Subscription plans & pricing | Complete | `billing.ts SubscriptionPlans; store-tenant.ts listSubscriptionPlans` | P1 | No seeding on page view; starter plans seeded by the migration. |
| SaaS billing | Free trials | Complete | `billing.ts choosePlan (Stores.trialUsed)` | P1 | scripts/tests/billing-lifecycle.ts (7/7 ✓) |
| SaaS billing | Recurring billing | Complete | `src/lib/billing.ts (Stripe Billing subscriptions)` | P1 | Needs provider price ids per plan. |
| SaaS billing | Subscription status lifecycle | Complete | `handleBillingEvent / runBillingLifecycle` | P1 | scripts/tests/billing-lifecycle.ts (7/7 ✓); scripts/tests/payment-webhooks.mjs (15/15 ✓, running server) |
| SaaS billing | Upgrades / downgrades | Complete | `choosePlan (prorated plan change)` | P2 | Not exercised against Stripe. |
| SaaS billing | Cancellations | Complete | `cancelPlan (at period end)` | P2 | scripts/tests/payment-webhooks.mjs (15/15 ✓, running server) |
| SaaS billing | Payment failure / dunning | Complete | `src/lib/billing.ts planAlert` | P1 | Past due + grace date; the store's team is emailed on a failed payment, an ended trial and expiry (queued). |
| SaaS billing | Invoice history | Complete | `store-invoices written from provider events` | P2 | scripts/tests/payment-webhooks.mjs (15/15 ✓, running server) |
| SaaS billing | Billing webhooks | Complete | `src/app/api/webhooks/stripe/route.ts` | P1 | scripts/tests/payment-webhooks.mjs (15/15 ✓, running server) |
| SaaS billing | Feature entitlements | Complete | `src/payload/entitlements.ts` | P2 | pos, reports, discounts, abandoned carts, card payments, custom domain. |
| SaaS billing | Staff / product / storage limits | Complete | `entitlements.ts productLimit/storageLimit; StoreMemberships team limit` | P1 |  |
| SaaS billing | Expiry, grace period, access restriction | Complete | `runBillingLifecycle; storeAvailability; tenancy readOnly` | P1 | scripts/tests/billing-lifecycle.ts (7/7 ✓) |
| Super admin | Platform overview dashboard | Complete | `src/payload/admin/platform/PlatformView.tsx; overviewFor` | P1 | Counts, MRR, GMV, top stores, failing payments. |
| Super admin | All merchants / stores lists | Complete | `Platform nav section (UrkoNav.tsx)` | P1 |  |
| Super admin | Store status management | Complete | `POST /platform/stores/:id/status (logged)` | P1 |  |
| Super admin | Plans & SaaS billing admin | Complete | `Plans / subscriptions / invoices collections (platform-only)` | P1 |  |
| Super admin | Platform revenue reporting | Partial | `overviewFor (MRR, 30-day GMV)` | P2 | Current figures only; no history or charts. |
| Super admin | Failed payment monitoring | Partial | `overviewFor failingPayments; payment-events; planAlert` | P2 | Listed for platform admins and emailed to the store; no platform-side alert. |
| Super admin | Support tools / impersonation | Partial | `switchStore support access (logged)` | P2 | Store-level support access; no impersonation of a person. |
| Super admin | Audit trail for admin actions | Partial | `src/payload/collections/history.ts:244-248` | P1 | Platform collections, config-import and privacy erase not logged. |
| Super admin | Security events view | Partial | `src/payload/admin/security/SecurityView.tsx` | P2 | Per-user 2FA screen; no platform security log. |
| Jobs & integrations | Background job processing | Partial | `src/lib/housekeeping.ts; src/payload.config.ts:123-127` | P1 | In-process timer + Payload jobs in every instance. |
| Jobs & integrations | Retries / backoff / dead-letter | Complete | `src/lib/outbox.ts (backoff, MAX_ATTEMPTS, dead)` | P1 |  |
| Jobs & integrations | Scheduled tasks | Complete | `src/instrumentation.ts:20-42` | P1 |  |
| Jobs & integrations | Transactional outbox | Complete | `src/lib/outbox.ts enqueue in the same transaction` | P1 | scripts/tests/order-lifecycle.ts (13/13 ✓, in CI) |
| Jobs & integrations | Event deduplication | Complete | `outbox dedupe_key unique; payment-events unique` | P1 |  |
| Jobs & integrations | Webhook sending | Complete | `src/lib/webhooks.ts; collections/webhooks.ts` | P3 | Signed, retried via the outbox, private addresses refused. |
| Jobs & integrations | Webhook receiving | Complete | `src/app/api/webhooks/stripe/route.ts` | P0 | scripts/tests/payment-webhooks.mjs (15/15 ✓, running server) |
| Jobs & integrations | Email / SMS / WhatsApp notifications | Complete | `src/lib/mailer.ts; src/lib/notify.ts` | P1 | Inline, no retry. |
| Jobs & integrations | Cache invalidation | Partial | `src/payload/revalidate.ts:41-59` | P1 | Global tags; redirect cache per instance. |
| Jobs & integrations | Search indexing | Partial | `src/lib/search.ts` | P2 | Full scan of the in-memory snapshot. |
| Jobs & integrations | Payment reconciliation | Complete | `reconcileCardPayments (housekeeping)` | P1 |  |
| Jobs & integrations | Reservation cleanup | Complete | `COD auto-cancel + expired card checkouts` | P1 |  |
| Production readiness | Application boots (Payload config valid) | Complete | `inventory.ts duplicate field removed` | P0 | Dev server boots; storefront and API answer (checked). |
| Production readiness | Database migrations match config | Complete | `src/migrations/20261013_233003_multi_tenancy.ts` | P0 | Generated from the config; up → down → up verified with legacy rows; additive per CI rule. |
| Production readiness | Unit tests | Complete | `tests/unit/*` | P1 | 77/77 pass; assert the secure behaviour. |
| Production readiness | Integration / API tests | Complete | `.github/workflows/ci.yml; scripts/tests/*` | P1 | Tenant isolation, plan lifecycle, partial shipments and order lifecycle run against CI's Postgres; payment webhooks and store webhooks need a running server / an existing order (run locally). |
| Production readiness | End-to-end tests | Missing | `—` | P1 |  |
| Production readiness | Tenant-isolation tests | Complete | `scripts/tests/tenant-isolation.ts (in CI)` | P0 | 18 checks against a real database. |
| Production readiness | Permission tests (collection/field) | Complete | `tests/unit/access.test.ts; scripts/tests/tenant-isolation.ts (18/18 ✓, real DB)` | P0 |  |
| Production readiness | Checkout / payment webhook / refund tests | Partial | `scripts/tests/payment-webhooks.mjs (15/15 ✓, running server); tests/unit/platform.test.ts` | P0 | Webhooks/signatures/totals covered; no full browser checkout test in CI. |
| Production readiness | Inventory concurrency tests | Partial | `scripts/tests/stock-race.ts` | P1 | Not in CI; single-line only. |
| Production readiness | Environment validation | Partial | `src/lib/startup-checks.ts:9-18` | P1 | Ad hoc. |
| Production readiness | Health checks | Complete | `src/app/api/health/route.ts` | P1 | Discloses config warnings publicly. |
| Production readiness | Structured logging | Partial | `src/lib/log.ts` | P2 | 24 raw console.* calls remain. |
| Production readiness | Monitoring & error tracking | Partial | `src/instrumentation.ts; scripts/uptime/monitor.mjs` | P1 | Sentry optional, no tracing or source maps. |
| Production readiness | Database backups | Partial | `scripts/backup/Dockerfile (sed fixed)` | P0 | Image not built in this session. |
| Production readiness | Restore procedure | Partial | `docs/BACKUP-RESTORE.md:45-82` | P1 | Manual, untested. |
| Production readiness | CI/CD | Partial | `.github/workflows/ci.yml (main branch, lint clean, tenant + billing tests)` | P1 | Not run on GitHub in this session. |
| Production readiness | Deployment configuration | Partial | `scripts/docker-build.sh:23-30` | P1 | Migrations run against the live DB during image build. |
