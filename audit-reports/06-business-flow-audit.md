# Business flow audit

## Flow A: Merchant onboarding

Status: Partial

- Frontend: `src/components/account/store-onboarding.tsx`, `src/app/(frontend)/(store)/account/stores/page.tsx`
- Backend: `src/lib/store-tenant.ts`, `src/app/(frontend)/(store)/account/stores/actions.ts`
- Data model: `src/payload/collections/Stores.ts`, `src/payload/collections/Users.ts`
- Missing or incomplete: more complete merchant lifecycle, domain and publish enforcement, plan activation enforcement, staff invite flow completion

## Flow B: Product lifecycle

Status: Partial

- Product and catalog collection code exists in `src/payload/collections/catalog.ts`
- Storefront product page logic exists in app routes
- Missing or incomplete: deep variant lifecycle verification, image publishing, stock enforcement, and archive/publish safeguards across all states

## Flow C: Successful customer purchase

Status: Partial

- Cart pricing: `src/lib/cart-pricing.ts`
- Checkout order placement: `src/app/(frontend)/(store)/checkout/actions.ts`
- Order persistence: `src/lib/cms/sales.ts`
- Payment flow: partially represented; not fully provider-backed
- Missing or incomplete: complete payment verification, financial event handling, and inventory release proofs under failed paths

## Flow D: Failed payment

Status: Partial

- The repo has risk checks and stock logic, but the full failed-payment recovery path is not proven complete
- Risks: reservation release, duplicate retry handling, order cancellation semantics, and final state transitions

## Flow E: Refund

Status: Missing / partial

- Return requests and warranty flows exist in `src/payload/collections/aftersales.ts`
- Full provider refund and financial ledger reconciliation are not clearly implemented end-to-end

## Flow F: Multi-tenant isolation

Status: Partial

- Access control foundation implemented in `src/payload/access.ts`
- Clear user/store membership primitives exist
- Not fully proven across every collection and every admin action

## Flow G: Staff authorization

Status: Partial

- Role model is present, and access logic exists
- Full invitation, acceptance, and permission enforcement still needs broader validation across all staff operations

## Flow H: SaaS subscription

Status: Partial

- `src/payload/collections/billing.ts` provides plan/subscription/invoice records
- Merchant onboarding includes plan selection
- Real renewal, failed-payment handling, feature entitlements, and platform enforcement are not complete

## Overall business-flow conclusion

The system has a viable product foundation and a realistic merchant/customer flow, but the business-critical flows still require explicit completion for payment integrity, inventory guarantees, and tenant security before production usage.
