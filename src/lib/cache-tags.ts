/**
 * Cache tag of ONE store's catalog. A product saved, an order placed or a shop sale in one store refreshes that store's
 * catalog only – not every store on the platform. The shared "catalog" tag still refreshes them all (rare, global
 * changes). Client-safe; used by the storefront caches (src/lib/repo/catalog.ts) and the Payload hooks.
 */
export const CATALOG_ALL = "catalog";

export function catalogTagOf(store: unknown): string {
  const id = Number(store && typeof store === "object" ? (store as { id?: unknown }).id : store);
  return Number.isFinite(id) && id > 0 ? `catalog:s${id}` : CATALOG_ALL;
}
