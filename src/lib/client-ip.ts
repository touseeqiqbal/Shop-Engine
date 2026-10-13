/* Plain module (no "server-only"): also used by the Payload config, which its CLI loads outside Next.js. */

/**
 * The visitor's IP, from a header the visitor can't fake:
 * - CLIENT_IP_HEADER (e.g. "cf-connecting-ip" when the site is behind Cloudflare's proxy), else
 * - the LAST X-Forwarded-For entry – the one added by our own proxy (Railway). The first entries come from the
 *   visitor's request and can be anything.
 */
export function ipFromHeaders(h: { get(name: string): string | null }) {
  const custom = process.env.CLIENT_IP_HEADER?.trim().toLowerCase();
  const fromCustom = custom ? h.get(custom)?.split(",")[0].trim() : "";
  if (fromCustom) return fromCustom;
  const chain = (h.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return chain[chain.length - 1] || h.get("x-real-ip") || "unknown";
}
