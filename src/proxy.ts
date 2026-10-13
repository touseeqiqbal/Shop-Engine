import { NextResponse, type NextRequest } from "next/server";
import { getRedirectMap } from "@/lib/repo/redirects";
import { isStaging, stagingAuthorized } from "@/lib/staging";
import { ipFromHeaders } from "@/lib/client-ip";

/**
 * Next.js 16 Proxy (formerly Middleware) – runs on the Node.js runtime before every matched request.
 *
 * 1. Redirect manager: looks up the pathname in /cms → Settings → Redirects (cached 60s by
 *    `getRedirectMap()`) and answers with 301 (permanent) or 307 (temporary).
 * 2. The old admin was retired: `/admin` and everything under it goes to the store admin at `/cms`.
 */

function normalize(pathname: string) {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  try {
    return decodeURIComponent(p);
  } catch {
    return p;
  }
}

/** Static files (photos, scripts, feeds…) – nothing for the proxy to do outside staging. */
const STATIC = /^\/(?:media\/|images\/|brand\/|favicon\.ico|opengraph-image|twitter-image|manifest\.webmanifest)|\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|txt|xml|csv|woff2?)$/i;

/**
 * Sign-in, password-reset and 2-step requests: limited per visitor (Payload's own routes and the storefront
 * sign-in callback don't go through our form limits). Visitor = the proxy's IP entry, which can't be faked.
 */
const AUTH_LIMITS: [RegExp, number, number][] = [
  [/^\/cms-api\/users\/forgot-password$/, 5, 30 * 60_000],
  [/^\/cms-api\/users\/reset-password$/, 10, 30 * 60_000],
  [/^\/(?:cms-api\/users\/login|cms-api\/2fa\/login|api\/auth\/callback\/credentials)$/, 20, 10 * 60_000],
];
const hits = new Map<string, { n: number; reset: number }>();
function limited(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) {
    hits.set(key, { n: 1, reset: now + windowMs });
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    return false;
  }
  return ++h.n > max;
}

/** The site's own background-jobs call (instrumentation → /api/cron) carries its key, not the staging password. */
function isOwnCronCall(request: NextRequest) {
  if (request.nextUrl.pathname !== "/api/cron") return false;
  const auth = request.headers.get("authorization") ?? "";
  const keys = [process.env.HOUSEKEEPING_INTERNAL_KEY, process.env.CRON_SECRET].filter(Boolean);
  return keys.some((k) => auth === `Bearer ${k}`);
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (!isStaging && STATIC.test(pathname)) return NextResponse.next();

  // ── Staging: password-protect everything (pages, APIs, feeds, photos) except the health check ──
  if (isStaging && pathname !== "/api/health" && !isOwnCronCall(request) && !stagingAuthorized(request.headers.get("authorization"))) {
    return new NextResponse("Staging – authentication required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Urko staging", charset="UTF-8"', "X-Robots-Tag": "noindex, nofollow" },
    });
  }
  if (request.method === "POST") {
    const rule = AUTH_LIMITS.find(([re]) => re.test(pathname));
    if (rule && limited(`${pathname}:${ipFromHeaders(request.headers)}`, rule[1], rule[2]))
      return NextResponse.json({ errors: [{ message: "Too many attempts – please wait a few minutes and try again." }] }, { status: 429 });
  }
  if (pathname.startsWith("/api/") || pathname.startsWith("/cms-api/")) return NextResponse.next();

  // ── Old admin → /cms (bookmarks keep working) ──
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/cms";
    url.search = "";
    return NextResponse.redirect(url, 308);
  }

  // ── Redirect manager (storefront only) ──
  if (request.method === "GET" || request.method === "HEAD") {
    try {
      const map = await getRedirectMap();
      const hit = map.get(normalize(pathname)) ?? map.get(pathname);
      if (hit && hit.toPath && hit.toPath !== pathname) {
        // Only pages of this site (a redirect to another website would be an "open redirect" for phishing)
        const target = new URL(hit.toPath, request.url);
        if (target.origin !== request.nextUrl.origin) return NextResponse.next();
        // Keep the original query string unless the target defines its own.
        if (!target.search && search) target.search = search;
        return NextResponse.redirect(target, hit.permanent ? 301 : 307);
      }
    } catch (err) {
      // Never block the storefront because the redirect table is unreachable.
      console.error("[proxy] redirect lookup failed", err);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Run on everything (incl. API routes, for the staging password) except: Next.js internals, uploaded media, static images and
     * metadata files (favicon, icons, robots, sitemap, manifest, OG images) and any file with an extension.
     */
    // Everything except Next.js build files – static files return straight away (see STATIC) unless this is staging,
    // where they need the password too.
    "/((?!_next/static|_next/image).*)",
  ],
};
