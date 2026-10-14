import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";

/** Outside a Next.js request (CLI scripts, migrations, jobs) there is nothing to revalidate – any other error is real. */
const outsideNext = (e: unknown) => /store missing|outside a request|static generation|workAsyncStorage|not.*request scope|after\(\) was called/i.test(String((e as Error)?.message ?? e));
const report = (e: unknown) => {
  if (!outsideNext(e)) console.error("[revalidate]", e);
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

function run(tags: string[], paths: string[], layout: boolean) {
  for (const t of tags) revalidateTag(t, { expire: 0 });
  for (const p of paths) revalidatePath(p);
  if (layout) revalidatePath("/", "layout");
}

/**
 * Revalidate cache tags and paths; a no-op outside a Next.js request.
 * Hooks run BEFORE the database commit, so it runs now and once more after the response (= after the commit) –
 * otherwise a visitor in between could cache the old data again.
 */
export function revalidate(tags: string[], paths: string[] = [], layout = false) {
  try {
    run(tags, paths, layout);
  } catch (e) {
    report(e);
    return;
  }
  try {
    after(() => {
      try {
        run(tags, paths, layout);
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
export const REVIEWS_TAG = "reviews";

/** Payload hook: refresh the storefront catalog after a save/delete (skipped when context.skipRevalidate is set). */
export const revalidateCatalog = <T>({ doc, context }: { doc: T; context?: Record<string, unknown> }): T => {
  // the header/menus show category and product names and links too
  if (!context?.skipRevalidate) revalidate([CATALOG_TAG, CHROME_TAG], ["/", "/sitemap.xml", "/llms.txt"]);
  return doc;
};
