import "server-only";
import { listAll } from "./db";
import { isCmsConfigured } from "@/lib/db/config";
import { cmsRedirects } from "@/lib/cms/site";

/**
 * Redirects for the proxy, cached for 60 s. The cache lives on globalThis so /cms can clear it the moment a
 * redirect is saved (see clearRedirectCache in src/payload/revalidate.ts) – the proxy shares the process.
 */
type Cache = { at: number; map: Map<string, { toPath: string; permanent: boolean }> } | null;
const g = globalThis as unknown as { __urkoRedirectCache?: Cache };

export async function getRedirectMap() {
  const cache = g.__urkoRedirectCache ?? null;
  if (cache && Date.now() - cache.at < 60_000) return cache.map;
  try {
    if (isCmsConfigured) {
      g.__urkoRedirectCache = { at: Date.now(), map: await cmsRedirects() }; // /cms → Settings → Redirects
    } else {
      const rows = await listAll("redirects");
      g.__urkoRedirectCache = { at: Date.now(), map: new Map(rows.map((r) => [r.fromPath, { toPath: r.toPath, permanent: r.permanent }])) };
    }
  } catch (e) {
    console.error("[redirects] load failed", e);
    g.__urkoRedirectCache = { at: Date.now(), map: cache?.map ?? new Map() };
  }
  return g.__urkoRedirectCache!.map;
}

/** Call after editing redirects so the change applies immediately on this instance. */
export function clearRedirectCache() {
  g.__urkoRedirectCache = null;
}
