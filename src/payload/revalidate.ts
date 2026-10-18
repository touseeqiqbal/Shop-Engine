import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";
import { log } from "../lib/log";

/** Outside a Next.js request (CLI scripts, migrations, jobs) there is nothing to revalidate – any other error is real. */
const outsideNext = (e: unknown) => /store missing|outside a request|static generation|workAsyncStorage|not.*request scope|after\(\) was called/i.test(String((e as Error)?.message ?? e));
const report = (e: unknown) => {
  if (!outsideNext(e)) log.error("revalidate.failed", e);
};

/** Cache tag for everything the storefront chrome reads from Payload (theme, header, footer, menus…). */
export const CHROME_TAG = "cms-chrome";

/**
 * Payload hook: refresh the storefront immediately after an admin save.
 * Outside a Next.js request (CLI scripts, migrations) revalidation isn't available – that's fine, ignore it.
 */
export const revalidateChrome = <T>({ doc }: { doc: T }): T => {
  revalidate([CHROME_TAG], [], true);
  return doc;
};

/** Cache tag for page-builder pages (Payload → Pages). */
export const PAGES_TAG = "cms-pages";

/** Drop the proxy's redirect and store-list caches (shared via globalThis, see src/lib/repo/redirects.ts) so a change applies at once. */
export function clearRedirectCache() {
  const g = globalThis as { __shopengineRedirects?: Map<string, unknown>; __shopengineStores?: unknown };
  g.__shopengineRedirects?.clear();
  g.__shopengineStores = undefined;
}

function run(tags: string[], paths: string[], layout: boolean, soft = false) {
  for (const t of tags) revalidateTag(t, soft ? "max" : { expire: 0 });
  for (const p of paths) revalidatePath(p);
  if (layout) revalidatePath("/", "layout");
}

/**
 * Revalidate cache tags and paths; a no-op outside a Next.js request. `soft`: stale-while-revalidate (the old data is
 * served while the new loads in the background) – for stock-only changes such as orders, where a short delay is fine.
 * Hooks run BEFORE the database commit, so it runs now and once more after the response (= after the commit) –
 * otherwise a visitor in between could cache the old data again.
 */
export function revalidate(tags: string[], paths: string[] = [], layout = false, opts: { soft?: boolean } = {}) {
  try {
    run(tags, paths, layout, opts.soft);
  } catch (e) {
    report(e);
    return;
  }
  try {
    after(() => {
      try {
        run(tags, paths, layout, opts.soft);
      } catch (e) {
        report(e);
      }
    });
  } catch (e) {
    report(e);
  }
}

/** Storefront catalog cache tags (same strings as TAGS in src/lib/repo/catalog.ts). */
export const CATALOG_TAG = "catalog";
import { catalogTagOf } from "../lib/cache-tags";
export const REVIEWS_TAG = "reviews";

/** One store's catalog cache tag (CATALOG_TAG – every store – when the store isn't known). */
export { catalogTagOf } from "../lib/cache-tags";

/** Payload hook: refresh the storefront catalog after a save/delete (skipped when context.skipRevalidate is set). */
export const revalidateCatalog = <T>({ doc, context }: { doc: T; context?: Record<string, unknown> }): T => {
  // that store's catalog; the header/menus show category and product names and links too
  if (!context?.skipRevalidate) revalidate([catalogTagOf((doc as { store?: unknown } | null)?.store), CHROME_TAG], ["/", "/sitemap.xml", "/llms.txt"]);
  return doc;
};
