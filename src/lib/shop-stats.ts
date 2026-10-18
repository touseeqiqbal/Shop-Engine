/**
 * First-party shop statistics (Reports → Shop funnel): how many product views, add-to-carts and checkouts a store
 * gets, counted per day (and per product) – no cookies, no addresses, nothing about the person, so no consent is
 * needed. Orders come from the orders themselves. Client-safe.
 */

export type StatKind = "view" | "cart" | "checkout";
export const STAT_KINDS: readonly StatKind[] = ["view", "cart", "checkout"];

/** A product's storefront id (or empty) – short, plain characters only. */
export const validRef = (ref: unknown): string | null => {
  const r = String(ref ?? "");
  return r === "" || /^[A-Za-z0-9_-]{1,60}$/.test(r) ? r : null;
};

/** Crawlers, link previews and monitors aren't shoppers. */
export const isBot = (userAgent: string | null | undefined) =>
  !userAgent || /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|lighthouse|pingdom|uptime|monitor|curl|wget|python-requests|httpclient/i.test(userAgent);

/** Counts one event (in the browser): sent in the background, never slows the page or fails it. */
export function shopStat(kind: StatKind, ref?: string) {
  if (typeof window === "undefined") return;
  try {
    // a product view counts once per tab (reloading the page doesn't add views)
    if (kind === "view" && ref) {
      const key = `se-viewed:${ref}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    }
  } catch {
    /* private mode: count it anyway */
  }
  try {
    const body = JSON.stringify({ k: kind, p: ref ?? "" });
    if (!navigator.sendBeacon?.("/api/stats", new Blob([body], { type: "text/plain" }))) void fetch("/api/stats", { method: "POST", body, keepalive: true }).catch(() => undefined);
  } catch {
    /* never mind */
  }
}
