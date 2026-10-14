import "server-only";
import { listAll } from "./db";
import { isCmsConfigured } from "@/lib/db/config";
import { cmsRedirects } from "@/lib/cms/site";
import { matchStore, toDirectoryEntry, type StoreDirectoryEntry } from "@/lib/tenant-shared";

/**
 * Redirects for the proxy, per store, cached for 60 s. The cache lives on globalThis so /cms can clear it the moment a
 * redirect is saved (see clearRedirectCache in src/payload/revalidate.ts) – the proxy shares the process.
 */
type Entry = { at: number; map: Map<string, { toPath: string; permanent: boolean }> };
const g = globalThis as unknown as { __shopengineRedirects?: Map<string, Entry>; __shopengineStores?: { at: number; stores: StoreDirectoryEntry[] } };

/**
 * For the proxy: the store a host name belongs to. `undefined` = no store answers on this host (unknown sub-domain);
 * null = single-shop mode (no CMS). The store list is cached for 60 s here (the proxy can't use the page data cache).
 */
export async function storeIdForHost(host: string | null): Promise<number | null | undefined> {
  if (!isCmsConfigured) return null;
  const now = Date.now();
  if (!g.__shopengineStores || now - g.__shopengineStores.at > 60_000) {
    try {
      const { payloadClient } = await import("@/lib/cms/catalog-source");
      const res = await (await payloadClient()).find({ collection: "stores", limit: 0, pagination: false, depth: 0, overrideAccess: true });
      g.__shopengineStores = { at: now, stores: (res.docs as unknown as Record<string, unknown>[]).map(toDirectoryEntry) };
    } catch (e) {
      console.error("[proxy] store list failed", e);
      g.__shopengineStores = { at: now, stores: g.__shopengineStores?.stores ?? [] };
    }
  }
  return matchStore(g.__shopengineStores.stores, host)?.id ?? undefined;
}

export async function getRedirectMap(storeId: number | null) {
  const all = (g.__shopengineRedirects ??= new Map());
  const key = String(storeId ?? "default");
  const cache = all.get(key) ?? null;
  if (cache && Date.now() - cache.at < 60_000) return cache.map;
  try {
    if (isCmsConfigured) {
      all.set(key, { at: Date.now(), map: await cmsRedirects(storeId) }); // /cms → Settings → Redirects
    } else {
      const rows = await listAll("redirects");
      all.set(key, { at: Date.now(), map: new Map(rows.map((r) => [r.fromPath, { toPath: r.toPath, permanent: r.permanent }])) });
    }
  } catch (e) {
    console.error("[redirects] load failed", e);
    all.set(key, { at: Date.now(), map: cache?.map ?? new Map() });
  }
  return all.get(key)!.map;
}

/** Call after editing redirects so the change applies immediately on this instance. */
export function clearRedirectCache() {
  g.__shopengineRedirects?.clear();
  g.__shopengineStores = undefined;
}
