/**
 * A path as the router matches it: percent-decoded (twice at most), single slashes, no trailing slash, lower case.
 * The proxy's sign-in limits and /cms-api checks match this – an encoded path (/cms-api/users/%6Cogin is the sign-in)
 * used to skip every limit.
 */
export function canonicalPath(pathname: string): string {
  let p = pathname;
  for (let i = 0; i < 2 && p.includes("%"); i++) {
    try {
      p = decodeURIComponent(p);
    } catch {
      break;
    }
  }
  p = p.replace(/\\/g, "/").replace(/\/{2,}/g, "/").toLowerCase();
  return p.length > 1 ? p.replace(/\/+$/, "") : p;
}
