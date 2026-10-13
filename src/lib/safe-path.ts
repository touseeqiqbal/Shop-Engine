/**
 * A redirect target that can only be a page of THIS site. Browsers treat "/\evil.com", "//evil.com", tabs and other
 * control characters in a path as another website – all of those are refused. Client-safe.
 */
export function safePath(value: unknown, fallback: string): string {
  if (typeof value !== "string" || value.length > 512) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const u = new URL(value, "https://same.site");
    return u.origin === "https://same.site" ? `${u.pathname}${u.search}${u.hash}` : fallback;
  } catch {
    return fallback;
  }
}
