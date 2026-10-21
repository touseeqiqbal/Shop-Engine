import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { cache } from "react";
import { cookies, draftMode, headers } from "next/headers";
import { unstable_cache } from "next/cache";
// the server-side rethrow (next/navigation also pulls in client React, which scripts and jobs can't load)
import { unstable_rethrow } from "next/dist/client/components/unstable-rethrow";
import { isCmsConfigured } from "@/lib/db/config";
import { PREVIEW_STORE_COOKIE, matchStore, storeAvailability, storeOrigin, toDirectoryEntry, type StoreDirectoryEntry } from "./tenant-shared";
import { isMarketingHost } from "./marketing/hosts";
import { readPreviewCookie } from "./preview-cookie";

export { storeAvailability, storeOrigin, type StoreDirectoryEntry } from "./tenant-shared";

/**
 * The store the current request is for (see tenant-shared.ts for the rules). Storefront loaders, server actions and
 * route handlers call `currentStoreId()`; background jobs (no request) wrap their work in `runInStore(id, …)`.
 */

const explicit = new AsyncLocalStorage<number | null>();

/** Runs `fn` for one store (jobs, webhooks, scripts): every loader inside uses this store instead of the request host. */
export const runInStore = <T,>(storeId: number | null, fn: () => Promise<T>) => explicit.run(storeId, fn);

type StoreDoc = Record<string, unknown>;

/** Every store's routing details, cached for a minute (Stores changes clear the "stores" tag). */
const directory = unstable_cache(
  async (): Promise<StoreDirectoryEntry[]> => {
    const { payloadClient } = await import("@/lib/cms/catalog-source");
    const payload = await payloadClient();
    const res = await payload.find({ collection: "stores", limit: 0, pagination: false, depth: 0, overrideAccess: true, sort: "id" });
    return (res.docs as unknown as StoreDoc[]).map(toDirectoryEntry);
  },
  ["store-directory-v1"],
  { tags: ["stores"], revalidate: 60 },
);

export async function storeDirectory(): Promise<StoreDirectoryEntry[]> {
  return isCmsConfigured ? directory().catch(() => []) : [];
}

/** The current request's store (null in demo mode – one built-in shop – or for an unknown sub-domain). */
export async function getCurrentStore(): Promise<StoreDirectoryEntry | null> {
  if (!isCmsConfigured) return null;
  // an explicit store (runInStore – jobs, cached loaders, webhooks) always wins over the request's host
  const forced = explicit.getStore();
  if (forced !== undefined) {
    const stores = await storeDirectory();
    return stores.find((x) => x.id === forced) ?? stores.find((x) => x.isDefault) ?? null;
  }
  return storeOfRequest();
}

/** The store named by the request's host (or the store being previewed in Draft Mode) – worked out once per request. */
const storeOfRequest = cache(async (): Promise<StoreDirectoryEntry | null> => {
  const stores = await storeDirectory();
  let host = "";
  let previewId: number | null = null;
  try {
    // the Host header only (a CDN caches by it; X-Forwarded-Host could be used to poison another store's cache)
    host = (await headers()).get("host") ?? "";
    // only a cookie /api/preview signed (for a store this person works in) – never a store id typed into it
    if ((await draftMode()).isEnabled) previewId = readPreviewCookie((await cookies()).get(PREVIEW_STORE_COOKIE)?.value);
  } catch (e) {
    // Next.js signals "this page depends on the request" by throwing: let it through, so a page is never cached once
    // and then shown on every store's address (pages are rendered per request; their data stays cached per store)
    unstable_rethrow(e);
    // outside a request (scripts): the default store
  }
  if (previewId) {
    const preview = stores.find((x) => x.id === previewId);
    if (preview) return preview;
  }
  // ShopEngine's own address (marketing site, merchant sign-up): no store
  if (isMarketingHost(host)) return null;
  return matchStore(stores, host);
});

/** The request's host, or "" outside a request. */
async function requestHost(): Promise<string> {
  try {
    return (await headers()).get("host") ?? "";
  } catch (e) {
    unstable_rethrow(e);
    return "";
  }
}

/**
 * Is this request on ShopEngine's own address (MARKETING_HOSTS) – the marketing site and the merchant account pages
 * (sign-up, sign-in, Stores), shown under ShopEngine's name instead of a store's? Jobs (runInStore) never are.
 */
export async function isPlatformRequest(): Promise<boolean> {
  if (explicit.getStore() !== undefined) return false;
  return isMarketingHost(await requestHost());
}

/** ShopEngine's own address as the visitor uses it, e.g. "https://shopengine.app" (links in sign-up emails). */
export async function platformOrigin(): Promise<string> {
  const host = await requestHost();
  let proto = "https";
  try {
    proto = (await headers()).get("x-forwarded-proto")?.split(",")[0]?.trim() || (process.env.NODE_ENV === "production" ? "https" : "http");
  } catch (e) {
    unstable_rethrow(e);
  }
  return host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
}

/** The current store's public address (verified custom domain, its sub-domain, else the main site) – no trailing slash. */
export async function currentOrigin(): Promise<string> {
  if (await isPlatformRequest()) return platformOrigin();
  const store = await getCurrentStore();
  const main = (process.env.NEXT_PUBLIC_SITE_URL || "https://urkotechstore.com").replace(/\/+$/, "");
  return store ? storeOrigin(store, main) || main : main;
}

/** A link on the current store's own address (sitemaps, feeds, structured data). */
export async function storeUrl(path = "/"): Promise<string> {
  return `${await currentOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Moves links built for the main address (src/lib/site.ts) onto the current store's own address. */
export async function toStoreUrls(text: string): Promise<string> {
  const origin = await currentOrigin();
  const main = (process.env.NEXT_PUBLIC_SITE_URL || "https://urkotechstore.com").replace(/\/+$/, "");
  return origin && origin !== main ? text.split(main).join(origin) : text;
}

/** Id of the current request's store (null in demo mode). */
export async function currentStoreId(): Promise<number | null> {
  return (await getCurrentStore())?.id ?? null;
}

/**
 * Is a team member previewing THIS store's drafts? Draft Mode on AND a signed preview cookie (/api/preview) naming the
 * current store. Draft Mode alone isn't enough: its cookie copied to another store's address would open that store's
 * drafts.
 */
export async function isPreviewing(): Promise<boolean> {
  try {
    if (!(await draftMode()).isEnabled) return false;
    const previewId = readPreviewCookie((await cookies()).get(PREVIEW_STORE_COOKIE)?.value);
    return previewId != null && previewId === (await currentStoreId());
  } catch (e) {
    unstable_rethrow(e);
    return false;
  }
}

/** Is the current store open to shoppers (draft stores are open to their team in Draft Mode)? */
export async function currentAvailability() {
  const store = await getCurrentStore();
  if (!isCmsConfigured) return { store, availability: { open: true } as const };
  const availability = storeAvailability(store);
  if (!availability.open && availability.reason === "setting-up") {
    try {
      if (await isPreviewing()) return { store, availability: { open: true } as const };
    } catch (e) {
      unstable_rethrow(e);
    }
  }
  return { store, availability };
}
