# Developer task checklist

## P0 — critical path

- [ ] Harden checkout server action to enforce atomic price, discount, tax, and inventory validation before final order creation
  - Files: `src/app/(frontend)/(store)/checkout/actions.ts`, `src/lib/cart-pricing.ts`, `src/lib/cms/sales.ts`
  - Acceptance: final totals are server-generated and never trust client-supplied values
  - Tests: duplicate submit, stock shortfall, failed payment recovery

- [ ] Verify inventory reservation and release behavior under failed or cancelled checkout
  - Files: `src/payload/stock.ts`, `src/lib/cms/sales.ts`, `src/payload/collections/content.ts`
  - Acceptance: stock is released on failed payment, cancelled order, or timeout
  - Tests: race-condition and retry scenarios

- [ ] Add provider-backed payment verification with webhook validation, replay protection, and deduplication
  - Files: new payment integration module(s), checkout flow files, webhook endpoints
  - Acceptance: provider IDs are stored and handled idempotently
  - Tests: webhook resend, duplicate event, signature mismatch

- [ ] Complete tenant isolation proof on all store-scoped collections and admin actions
  - Files: `src/payload/access.ts`, collection definitions under `src/payload/collections/`
  - Acceptance: users cannot read or mutate records across stores
  - Tests: cross-store read/write denial cases

- [ ] Separate order status, payment status, and fulfillment status into distinct safe state transitions
  - Files: `src/lib/cms/sales.ts`, order-related collections, fulfillment logic
  - Acceptance: no status combination undermines integrity
  - Tests: invalid transitions and event handling

## P1 — merchant and platform operations

- [ ] Finish merchant onboarding lifecycle with publish, domain, and settings rules
  - Files: `src/lib/store-tenant.ts`, `src/app/(frontend)/(store)/account/stores/actions.ts`, `src/payload/collections/Stores.ts`
  - Acceptance: store creation and activation are consistent and safe
  - Tests: duplicate slug, onboarding success, publish validation

- [ ] Complete subscription plan enforcement and billing state transitions
  - Files: `src/payload/collections/billing.ts`, `src/lib/store-tenant.ts`
  - Acceptance: trial/active/past-due/cancelled states are enforced and auditable
  - Tests: plan change, expiry, grace period, failed billing

- [ ] Implement refund and return reconciliation with audit records
  - Files: `src/payload/collections/aftersales.ts`, order and payment files
  - Acceptance: refund events are linked to original payment and stock rules
  - Tests: partial refund, restock rules, audit logging

- [ ] Strengthen platform admin and support tooling with audit logs and action review
  - Files: `src/payload.config.ts`, admin files under `src/payload/admin`, audit/history collections
  - Acceptance: high-risk actions are logged and reviewable
  - Tests: admin action audits and permission checks

## P2 — experience and scale

- [ ] Improve storefront configuration, theme management, and publish/version workflows
  - Files: storefront globals and theme settings
  - Acceptance: draft and published storefront states are consistent
  - Tests: preview/publish control tests

- [ ] Validate analytics against reliable financial events
  - Files: `src/payload/endpoints/reports.ts`, `src/payload/endpoints/sales-report.ts`
  - Acceptance: sales data is computed from order and payment states, not guesswork
  - Tests: refund and cancellation impact reporting

## P3 — advanced platform work

- [ ] Add broader channel and referral system support
- [ ] Extend notification and automation pipeline with event logs and retry controls
- [ ] Add deeper monitoring and deployment health validation for production operations

## Final note

This checklist reflects the actual codebase state, not a generic Shopify feature list. The current work should focus on the transaction-critical path first before broad feature expansion.
