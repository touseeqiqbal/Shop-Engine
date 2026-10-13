/**
 * Staging environment guard. Set on the Railway staging service only:
 *   STAGING=true  STAGING_USER=…  STAGING_PASSWORD=…
 * Effects: HTTP Basic Auth on every page + API (proxy.ts), `X-Robots-Tag: noindex` on every response
 * (next.config headers), `robots.txt` disallows everything, and all customer/admin notifications
 * (email, WhatsApp, SMS) are suppressed (notify.ts).
 */
export const isStaging = process.env.STAGING === "true";

/** Constant-time-ish string compare usable on any runtime. */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** True when the request carries valid staging Basic-Auth credentials (or staging is off). */
export function stagingAuthorized(authorization: string | null): boolean {
  if (!isStaging) return true;
  const user = process.env.STAGING_USER || "urko";
  const pass = process.env.STAGING_PASSWORD || "";
  if (!pass) return false; // fail closed: staging without a password is never public
  if (!authorization?.startsWith("Basic ")) return false;
  let decoded = "";
  try {
    decoded = atob(authorization.slice(6));
  } catch {
    return false;
  }
  const i = decoded.indexOf(":");
  return i > 0 && safeEqual(decoded.slice(0, i), user) && safeEqual(decoded.slice(i + 1), pass);
}
