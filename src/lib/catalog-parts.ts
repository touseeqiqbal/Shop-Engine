/**
 * A store's catalogue is cached in parts (src/lib/repo/catalog.ts): Next.js silently refuses to cache an entry over
 * 2 MB, and a store with a thousand-odd products is more than that – then every page would reload the whole catalogue
 * from the database. A product's part follows from its id (not its position), so a part rebuilt later from newer data
 * never repeats or loses a product of another part; the index keeps the order.
 */

/** How many parts for this many products (`size` products per part, at least one part). */
export const partsFor = (count: number, size: number) => Math.max(1, Math.ceil(count / Math.max(1, size)));

/** The part a product belongs to (FNV-1a of its id – stable across builds and processes). */
export function partOf(id: string, parts: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return parts <= 1 ? 0 : h % parts;
}

/** The products of one part. */
export const productsOfPart = <T extends { id: string }>(products: T[], part: number, parts: number): T[] => products.filter((p) => partOf(p.id, parts) === part);

/**
 * All parts back in the catalogue's order. A product a part has but the index doesn't (newer than the index) comes
 * last; one the index lists but no part has any more (removed meanwhile) is left out.
 */
export function joinParts<T extends { id: string }>(order: string[], parts: T[][]): T[] {
  const byId = new Map<string, T>();
  for (const list of parts) for (const p of list) byId.set(p.id, p);
  const out: T[] = [];
  for (const id of order) {
    const p = byId.get(id);
    if (!p) continue;
    out.push(p);
    byId.delete(id);
  }
  return [...out, ...byId.values()];
}

/**
 * One build of a store's whole catalogue at a time, shared by the cache entries made from it (its index and parts):
 * when they refresh together they don't each reload it from the database. Forgotten on every revalidation
 * (payload/revalidate.ts, the checkout), so a refresh after a change never gets a build from before it. Kept on
 * globalThis – the storefront and /cms hooks may load this module separately.
 */
const g = globalThis as unknown as { __shopengineCatalogBuilds?: Map<string, { done: number | null; build: Promise<unknown> }> };
const SHARE_MS = 10_000;

/** Shared while it runs (however long a big store's build takes) and for SHARE_MS after it finished. */
export function sharedCatalogBuild<T>(storeId: number | null, build: () => Promise<T>): Promise<T> {
  const builds = (g.__shopengineCatalogBuilds ??= new Map());
  const key = String(storeId ?? "none");
  const known = builds.get(key);
  if (known && (known.done === null || Date.now() - known.done < SHARE_MS)) return known.build as Promise<T>;
  const fresh = build();
  const entry = { done: null as number | null, build: fresh as Promise<unknown> };
  builds.set(key, entry);
  fresh.then(
    () => (entry.done = Date.now()),
    () => builds.get(key) === entry && builds.delete(key),
  );
  return fresh;
}

/** A catalogue (or anything it is made from) changed: the next refresh builds it anew. */
export function forgetCatalogBuilds() {
  g.__shopengineCatalogBuilds?.clear();
}
