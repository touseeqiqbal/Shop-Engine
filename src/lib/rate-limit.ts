import "server-only";
import { headers } from "next/headers";
import { ipFromHeaders } from "./client-ip";

export { ipFromHeaders };

/**
 * Fixed-window in-memory rate limiter for forms (checkout, contact, tracking, login, reviews).
 * Per server instance – good protection against casual abuse; swap for Upstash/Redis for strict global limits.
 */
const buckets = new Map<string, { count: number; reset: number }>();

export async function clientIp() {
  return ipFromHeaders(await headers());
}

/** Returns true when the request is allowed. */
export async function rateLimit(name: string, limit: number, windowMs: number) {
  return rateLimitKey(`${name}:${await clientIp()}`, limit, windowMs);
}

/** True when `key` still has room (doesn't count this call). */
export function rateLimitPeek(key: string, limit: number) {
  const b = buckets.get(key);
  return !b || b.reset < Date.now() || b.count < limit;
}

/** Same, for any key (e.g. a phone number, so one number can't be messaged over and over from many IPs). */
export function rateLimitKey(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    return true;
  }
  b.count++;
  return b.count <= limit;
}
