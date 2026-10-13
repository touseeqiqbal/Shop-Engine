# Urko Tech Store – code conventions (read before editing)

Stack: **Next.js 16.4 App Router (Turbopack)**, React 19, **Payload CMS 3** on PostgreSQL (admin at `/cms`, API at `/cms-api`), Auth.js for customer accounts, Tailwind CSS v4 (CSS-first config in `src/app/globals.css`), Framer Motion, Zustand. TypeScript strict.

Before every commit: `npm run typecheck`, `npm run lint` (0 warnings) and `npm test` must pass. Keep commits small and focused.

## Next.js 16 specifics (check `node_modules/next/dist/docs/` when unsure)
- `params` / `searchParams` are **Promises**: `const { slug } = await params;`. Same in `generateMetadata`.
- `cookies()` / `headers()` are async.
- Middleware is `src/proxy.ts` (`export function proxy(req)`, Node runtime): redirects, rate limits, staging password.
- `revalidateTag(tag, "max")` needs 2 args; in Server Actions prefer `updateTag(tag)`. Work that must happen after the response (emails, messages) goes in `after()`.
- `next lint` is gone – ESLint runs through `npm run lint` (`eslint.config.mjs`).
- No `cacheComponents`. Use `export const revalidate = …` and `unstable_cache` (see `src/lib/repo/catalog.ts`).
- `src/instrumentation.ts` runs on the Edge runtime too: put Node-only code in a module loaded with `import()` (see `src/lib/startup-checks.ts`).

## Layout & routing
- `src/app/(frontend)/(store)/…` = storefront. `src/app/(payload)/…` = Payload admin, its API and print pages – don't edit the generated files there (`importMap.js`, `layout.tsx` boilerplate).
- Product URLs: `/{topCategorySlug}/{productSlug}` → `(store)/[category]/[product]/page.tsx`. Use `product.url` – never build URLs by hand.
- Category pages: `/category/[slug]`; city landing pages `/laptops-in-{city}` are handled by `(store)/[category]/page.tsx`.
- Top-level category slugs must not clash with routes (`RESERVED_SLUGS` in `src/payload/collections/catalog.ts`).

## Data
- Types for the storefront: `src/lib/types.ts`. Payload's generated types: `src/payload-types.ts` (`npm run cms:types`).
- Pages read data ONLY through `src/lib/repo/*` (server-only, cached). With a database they call `src/lib/cms/*` (Payload's local API); without one they fall back to the seed catalog (`src/lib/data/seed/*`, "demo mode"). Never import seed files in pages.
- Admin logic lives in `src/payload/`: collections, globals, hooks, endpoints, `access.ts` (roles, 2-step), `stock.ts` (atomic SQL).
- **Money and stock rules have one home each** – reuse them, never re-implement:
  - `src/lib/order-money.ts` – what the rider collects (`amountToCollect`) and whether an order may ship (`paymentBlocksShipping`).
  - `src/lib/cities.ts` – delivery fee (`deliveryCharge`, `freeDeliveryAbove`), COD fee, which payment methods are on (`paymentEnabled`).
  - `src/lib/coupons.ts` (`couponDiscount`), `src/lib/cart-pricing.ts`, `src/lib/cart-limits.ts`.
  - `src/payload/stock.ts` – `takeStock`, `putBackStock`, `consumeCoupon`, units… Stock is always changed with a single SQL `UPDATE … SET stock = stock - n WHERE stock >= n`, inside the request's transaction (`req`). Never read-modify-write stock.
- Checkout creates the order, takes stock, uses the coupon and reserves serial units in **one transaction**; a retry with the same `attemptId` returns the existing order.
- Cache tags: `TAGS` in `src/lib/repo/catalog.ts`; Payload hooks refresh them through `src/payload/revalidate.ts`.

## Database changes
- Change the collection/global in `src/payload/`, then `npm run cms:migrate:create -- <name>`, read the SQL, `npm run cms:migrate`, `npm run cms:types`. Commit the migration `.ts` + `.json`.
- Migrations must only **add** (columns, tables, enum values, indexes). The build applies them while the old version is still live.
- The legacy Prisma tables (`public` schema) are never modified. Payload owns the `payload` schema (`cms_` tables).
- Take a backup (`pg_dump`) before applying migrations anywhere that matters.

## Security rules
- Access: use the helpers in `src/payload/access.ts` (`staff`, `managers`, `owners`, `staffField`…). Owners and managers without 2-step get no rights (`needsTwoFactorSetup`). A user may only change themselves or a lower role (`editableUsers`).
- Fields customers must not see get `access: { read: staffField }`. Storefront code reads with `overrideAccess: true` and picks only what it shows.
- HTML/Markdown written in `/cms` is rendered through the sanitizing components (`Markdown`, `sanitizeHtml` in `src/lib/sanitize.ts`). Never use `dangerouslySetInnerHTML` with unsanitized text.
- Redirect targets from users go through `safePath()` (`src/lib/safe-path.ts`).
- Rate limits key on `clientIp()` (`src/lib/rate-limit.ts` / `src/lib/client-ip.ts`) – never on the first `X-Forwarded-For` entry.
- Errors meant for staff: throw `userError(message, status)` (`src/payload/errors.ts`) – Payload hides plain `APIError` messages in production builds.
- Never log or commit secrets. Email/WhatsApp/SMS go through `src/lib/notify.ts` and `src/lib/mailer.ts`.

## UI kit (reuse – don't reinvent)
- CSS component classes (globals.css): `container-x`, `card`, `glass`, `gradient-text`, `btn btn-primary|btn-secondary|btn-whatsapp|btn-ghost`, `btn-sm|btn-lg|btn-icon`, `input`, `label`, `chip`, `skeleton`, `glow-hover`, `bg-grid`, `snap-row`, `prose-store`. Utility: `bg-brand-gradient`.
- Theme tokens as Tailwind colors: `bg-bg`, `bg-bg-elevated`, `bg-surface`, `bg-surface-strong`, `border-border`, `border-border-strong`, `text-fg`, `text-muted`, `text-subtle`. Font: `font-display` for headings. Light-mode variant: `light:` (dark is default).
- Components: `@/components/ui/*` – `Breadcrumbs` (emits BreadcrumbList JSON-LD), `JsonLd`, `Reveal`, `SectionHeading`, `Stars`, `Price`, `ConditionBadge`, `Countdown`, `Skeleton`/`ProductGridSkeleton`, `Markdown`, `CategoryIcon`.
- Product: `@/components/product/product-card`, `product-grid`, `product-carousel`, `compatibility-finder`.
- Client stores: `@/store/cart`, `@/store/lists` (wishlist/compare/recent), `@/store/ui` (`toast`, search/menu). Use `useHydrated()` before rendering persisted state.
- Floating elements at the bottom of the screen use the `--mobile-nav` offset and a `data-float` attribute (globals.css) so they don't cover the mobile menu or the product page's buy bar.
- SEO: `pageMetadata({ title, description, path, … })` from `@/lib/seo` (or `getPageMeta` from `@/lib/page-seo` for pages editable in /cms) on every page. JSON-LD builders in `@/lib/seo`. Ratings in JSON-LD only from approved reviews.
- Exactly ONE `<h1>` per page. Mobile-first: test at 375px.
- Accessibility: labels on all inputs, `aria-label` on icon buttons, alt text on images, keyboard operable.

## Tests
- Unit tests: `tests/unit/*.test.ts` (Vitest; `@` → `src`, `server-only` stubbed). Add one whenever you touch money, delivery, coupons, access or security helpers.
- Against a running build (`npm run build && npm start`): `npm run test:smoke`, `test:security`, `test:crawl`, `test:urls`, `test:stock`.
