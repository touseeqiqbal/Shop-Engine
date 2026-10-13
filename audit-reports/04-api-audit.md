# API audit

## Discovered API surface

The project exposes multiple kinds of interfaces:

- Next.js App Router endpoints under `src/app/api`
- Payload endpoint routes under `src/payload/endpoints`
- Server actions in `src/app/(frontend)/(store)` for checkout and account actions
- Internal library functions and Payload collection accessors for business logic

## Key routes and interfaces

| Interface | Path / handler | Status | Notes |
|---|---|---|---|
| Auth | `src/app/api/auth/[...nextauth]/route.ts` | Partial | Auth.js session handling is present |
| Health | `src/app/api/health/route.ts` | Partial | Health endpoint exists |
| Products | `src/app/api/products/route.ts` | Partial | Product listing route exists |
| Search | `src/app/api/search/route.ts` | Partial | Search API exists |
| Payload API | `src/app/(payload)/cms-api/[...slug]/route.ts` | Partial | Payload CMS API is in place |
| Checkout server action | `src/app/(frontend)/(store)/checkout/actions.ts` | Partial | Cart re-pricing and order creation logic exists |
| Account actions | `src/app/(frontend)/(store)/account/stores/actions.ts` | Partial | Store creation and invite flow exists |
| Endpoint modules | `src/payload/endpoints/*.ts` | Partial | Reports, inventory, privacy, orders, two-factor endpoints exist |

## Important API observations

- The project uses both route handlers and server actions, which is normal for Next.js but makes a large API surface harder to audit uniformly
- There is evidence of store-scoped access guards, but not a uniform end-to-end proof of tenant enforcement on every API route
- The payment and refund APIs are not clearly described as a full provider-integrated path
- Some flows depend on internal logic rather than a clean external REST/GraphQL contract, which reduces transparency

## Missing or partial API work

Missing or incomplete evidence for the following categories:

- full provider payment webhook validation / replay protection
- full refund processing APIs
- idempotent checkout APIs with explicit recovery semantics
- platform admin revenue/billing APIs tied to enforcement
- a formal tenant-aware authorization matrix for all payload collections

## Assessment

The app has a real API surface and the basic route structure required for a commerce app, but the API layer is not yet fully enterprise-hardened for SaaS billing, payment integrity, or tenant-isolated administration.
