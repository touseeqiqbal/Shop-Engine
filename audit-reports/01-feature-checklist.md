# Feature checklist

| Module | Feature | Status | Evidence | Priority | Notes |
|---|---|---|---|---|---|
| Platform foundation | Multi-tenant user and store model | Partial | `src/payload/collections/Users.ts`, `src/payload/collections/Stores.ts`, `src/payload/access.ts` | P0 | Strong foundation exists, but full cross-collection enforcement is not proven |
| Platform foundation | Platform admin access | Partial | `src/payload/access.ts` | P0 | Platform admin is implemented; store-level role checks need broad verification |
| Merchant onboarding | Store creation flow | Partial | `src/lib/store-tenant.ts`, `src/app/(frontend)/(store)/account/stores/actions.ts`, `src/components/account/store-onboarding.tsx` | P1 | Creation and plan association exist; not a complete merchant lifecycle yet |
| Merchant onboarding | Invite/accept store membership | Partial | `src/lib/store-tenant.ts` | P1 | Core invite flow exists; broader acceptance and staff permission enforcement require more auditing |
| Store management | Store CRUD and metadata | Partial | `src/payload/collections/Stores.ts` | P1 | Fields exist; lifecycle, suspension, deletion retention, and domain verification are not fully implemented |
| Store management | Store memberships | Partial | `src/payload/collections/StoreMemberships.ts` | P1 | Model exists; permission enforcement across every action still needs verification |
| SaaS billing | Subscription plans | Partial | `src/payload/collections/billing.ts`, `src/lib/store-tenant.ts` | P0 | Plan records exist; real billing enforcement and provider integration are missing |
| SaaS billing | Store subscription lifecycle | Partial | `src/payload/collections/billing.ts` | P0 | Lifecycle fields exist; automation and renewals are not complete |
| SaaS billing | Invoice records | Partial | `src/payload/collections/billing.ts` | P0 | Invoice records exist; payment reconciliation and billing webhooks are not complete |
| Products | Product CRUD | Partial | `src/payload/collections/catalog.ts`, storefront catalog code | P1 | Catalog structure exists; not all product lifecycle rules have been fully verified |
| Products | Variants and SKU structure | Partial | `src/payload/collections/catalog.ts` | P1 | Variant support exists in the catalog model; validation and cross-store stock integrity need stronger verification |
| Inventory | Stock levels by product and variant | Partial | `src/payload/collections/inventory.ts`, `src/payload/stock.ts` | P0 | Inventory primitives exist; concurrency and failed-checkout release need proof |
| Inventory | Reservation / release workflow | Partial | `src/payload/stock.ts`, `src/lib/cms/sales.ts` | P0 | Stock lock and release logic exist but not fully proven under failure/retry conditions |
| Storefront | Storefront theme + pages | Partial | `src/payload/globals/online-store.ts`, frontend app routing | P2 | Built-in storefront config exists; theme publishing and versioning are not fully enterprise-grade |
| Storefront | Search/filter/sort | Partial | storefront route logic and catalog query code | P2 | Search and product listing appear implemented; not all storefront flow validation was reviewed end-to-end |
| Cart & checkout | Cart re-pricing and server-side totals | Partial | `src/lib/cart-pricing.ts`, `src/app/(frontend)/(store)/checkout/actions.ts` | P0 | Server-side pricing is implemented; full transaction safety and failed-payment recovery remain needed |
| Cart & checkout | Payment screenshot / COD flow | Partial | `src/app/(frontend)/(store)/checkout/actions.ts` | P0 | Checkout flow exists; provider-integrated payment processing is not complete |
| Cart & checkout | Guest carts / cart persistence | Partial | cart-related actions and cookies | P1 | Basic flow exists; persistence and recovery need solid verification |
| Payments | Provider onboarding and webhook flow | Missing | No verified provider integration found in repo | P0 | Payment provider integration is not confirmed |
| Payments | Refund processing | Missing | No verified full refund flow found in repo | P0 | The repo includes return patterns but not a complete payment refund lifecycle |
| Orders | Order creation and status tracking | Partial | `src/lib/cms/sales.ts`, `src/payload/collections/content.ts` | P0 | Order creation exists; status separation and duplicate-event safety need stronger enforcement |
| Fulfillment | Shipping and fulfillment states | Partial | shipping and order collections | P1 | Some shipping-related structures exist, but not a complete provider-driven fulfillment system |
| Customer management | Customer accounts and addresses | Partial | customer auth and account routes | P1 | Customer accounts exist; tenant isolation and deletion/export flows need stronger proof |
| Discounts | Promo and coupon validation | Partial | `src/lib/coupons.ts`, discount collections | P1 | Coupon logic exists; risk of backend validation gaps remains to audit |
| Analytics | Sales reporting | Partial | `src/payload/endpoints/reports.ts`, `src/payload/endpoints/sales-report.ts` | P2 | Reporting exists; metric reliability requires validation against payment and refund states |
| Super admin | Platform dashboard controls | Partial | admin dashboards and payload globals | P1 | Admin presence exists; audit and enforcement logic still need broader verification |
| Security | Auth, session, and access controls | Partial | `src/payload/access.ts`, `src/app/api/auth/[...nextauth]/route.ts`, auth config | P0 | Strong foundation exists, but no full security review evidence on all routes and actions |
| Testing | Unit and security checks | Partial | `tests/unit/access.test.ts`, scripts under `scripts/tests/` | P1 | Some tests exist; project-wide production readiness still needs broad execution |

## Coverage interpretation

This checklist is intentionally conservative and only marks a feature as complete when there is direct code evidence that the requirement is implemented and not merely implied by the project structure.
