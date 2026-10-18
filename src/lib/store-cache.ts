import { unstable_cache } from "next/cache";
import { CATALOG_ALL, catalogTagOf } from "./cache-tags";

/**
 * A cached loader with one cache per store, tagged with the shared catalog tag AND that store's own
 * (src/lib/cache-tags.ts): an order or a product / collection edit in one store refreshes that store's entries only.
 */
export function perStoreCache<A extends unknown[], R>(key: string, fn: (storeId: number | null, ...args: A) => Promise<R>, revalidate: number): (storeId: number | null, ...args: A) => Promise<R> {
  const made = new Map<string, (...args: A) => Promise<R>>();
  return (storeId, ...args) => {
    const k = String(storeId ?? "none");
    let cached = made.get(k);
    if (!cached) {
      cached = unstable_cache((...a: A) => fn(storeId, ...a), [key, k], { tags: [...new Set([CATALOG_ALL, catalogTagOf(storeId)])], revalidate });
      made.set(k, cached);
    }
    return cached(...args);
  };
}
