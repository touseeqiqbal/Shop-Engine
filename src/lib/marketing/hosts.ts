/**
 * Which web addresses show ShopEngine's own marketing website (instead of a store). Edge-safe (used by the proxy).
 *
 *   MARKETING_HOSTS=shopengine.app,www.shopengine.app      (comma-separated host names; unset = no marketing site)
 *
 * On these addresses the proxy serves the marketing pages (src/app/(marketing)/shopengine/*) at the normal paths
 * (/, /features, /pricing …); /account/* (merchant sign-up, sign-in, Stores), /cms and the APIs keep working, under
 * ShopEngine's name instead of a store's. Every other address keeps resolving its store exactly as before.
 * It is opt-in on purpose: the original shop's own domain is never taken over by accident.
 */

/** The internal folder the marketing pages live in (never shown in a URL). */
export const MARKETING_PREFIX = "/shopengine";

const host = (h: string | null | undefined) =>
  String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");

let cache: { raw: string; hosts: Set<string> } | null = null;

export function marketingHosts(): Set<string> {
  const raw = process.env.MARKETING_HOSTS ?? "";
  if (cache?.raw !== raw) cache = { raw, hosts: new Set(raw.split(",").map(host).filter(Boolean)) };
  return cache.hosts;
}

export const isMarketingHost = (h: string | null | undefined) => {
  const hosts = marketingHosts();
  return hosts.size > 0 && hosts.has(host(h));
};

/** Paths a marketing address hands on to the app as they are (accounts, admin, APIs, files). */
export const PASS_THROUGH = /^\/(?:account|cms|cms-api|api|_next|media|cms-print|cms-file|cms-proof|feed-image|monitoring)(?:\/|$)/;
