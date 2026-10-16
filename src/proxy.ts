import { NextResponse, type NextRequest } from "next/server";
import { getRedirectMap, storeIdForHost } from "@/lib/repo/redirects";
import { isStaging, stagingAuthorized } from "@/lib/staging";
import { ipFromHeaders } from "@/lib/client-ip";
import { isMarketingHost, MARKETING_PREFIX, PASS_THROUGH } from "@/lib/marketing/hosts";

/**
 * Next.js 16 Proxy (formerly Middleware) – runs on the Node.js runtime before every matched request.
 *
 * 1. Redirect manager: looks up the pathname in the redirects of the store this host belongs to (/cms → Settings →
 *    Redirects, cached 60s by `getRedirectMap()`) and answers with 301 (permanent) or 307 (temporary).
 * 2. The old admin was retired: `/admin` and everything under it goes to the store admin at `/cms`.
 * 3. ShopEngine's marketing website (MARKETING_HOSTS – src/lib/marketing/hosts.ts): its addresses show the pages in
 *    src/app/(marketing)/shopengine at the normal paths; accounts, /cms and the APIs pass through. Store addresses
 *    never show those pages.
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
const SIGN_IN = /^\/(?:cms-api\/users\/login|cms-api\/2fa\/login|api\/auth\/callback\/credentials)$/;

/** The email a sign-in request is for (JSON or form body) – to limit guesses per account and network. */
async function signInEmail(request: NextRequest): Promise<string> {
  try {
    const type = request.headers.get("content-type") ?? "";
    const body = await request.clone().text();
    if (body.length > 20_000) return "";
    const email = type.includes("json") ? (JSON.parse(body) as { email?: unknown }).email : new URLSearchParams(body).get("email");
    return typeof email === "string" ? email.trim().toLowerCase().slice(0, 200) : "";
  } catch {
    return "";
  }
}

/**
 * /cms-api calls that change something must come from the platform's own pages: a store's storefront on a platform
 * sub-domain is "same-site" for the browser (its cookies would be sent), so the Origin is checked here as well.
 */
const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);
function foreignOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin || !request.cookies.has("payload-token")) return false;
  try {
    const host = new URL(origin).host;
    if (host === request.headers.get("host")) return false;
    const allowed = [process.env.NEXT_PUBLIC_SITE_URL, process.env.RAILWAY_PUBLIC_DOMAIN, ...(process.env.PAYLOAD_CSRF_ORIGINS ?? "").split(",")]
      .map((u) => (u ?? "").trim())
      .filter(Boolean)
      .map((u) => {
        try {
          return new URL(u.includes("://") ? u : `https://${u}`).host;
        } catch {
          return "";
        }
      });
    return !allowed.includes(host);
  } catch {
    return true;
  }
}
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

const inMarketingFolder = (pathname: string) => pathname === MARKETING_PREFIX || pathname.startsWith(`${MARKETING_PREFIX}/`);

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const marketing = isMarketingHost(request.headers.get("host"));
  if (marketing) {
    // the marketing site's own sitemap and robots rules
    if (pathname === "/sitemap.xml" || pathname === "/robots.txt") return NextResponse.rewrite(new URL(`${MARKETING_PREFIX}${pathname}`, request.url));
    // one address per page: the internal folder name never appears in a URL
    if (inMarketingFolder(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = pathname.slice(MARKETING_PREFIX.length) || "/";
      return NextResponse.redirect(url, 308);
    }
  } else if (inMarketingFolder(pathname)) {
    // a store's address: ShopEngine's marketing pages don't exist here (the store's own "not found" page)
    return NextResponse.rewrite(new URL("/__not-found", request.url));
  }
  if (!isStaging && STATIC.test(pathname)) return NextResponse.next();

  // ── Staging: password-protect everything (pages, APIs, feeds, photos) except the health check ──
  if (isStaging && pathname !== "/api/health" && !isOwnCronCall(request) && !stagingAuthorized(request.headers.get("authorization"))) {
    return new NextResponse("Staging – authentication required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="ShopEngine staging", charset="UTF-8"', "X-Robots-Tag": "noindex, nofollow" },
    });
  }
  if (UNSAFE.has(request.method) && pathname.startsWith("/cms-api/") && foreignOrigin(request))
    return NextResponse.json({ errors: [{ message: "This request must come from the admin itself." }] }, { status: 403 });
  if (request.method === "POST") {
    const ip = ipFromHeaders(request.headers);
    const rule = AUTH_LIMITS.find(([re]) => re.test(pathname));
    if (rule && limited(`${pathname}:${ip}`, rule[1], rule[2]))
      return NextResponse.json({ errors: [{ message: "Too many attempts – please wait a few minutes and try again." }] }, { status: 429 });
    // wrong passwords for one account from one network: 8 per 15 minutes (other networks – the owner – are not affected)
    if (SIGN_IN.test(pathname)) {
      const email = await signInEmail(request);
      if (email && limited(`signin:${email}:${ip}`, 8, 15 * 60_000))
        return NextResponse.json({ errors: [{ message: "Too many sign-in attempts for this account – please wait 15 minutes." }] }, { status: 429 });
    }
  }
  if (pathname.startsWith("/api/") || pathname.startsWith("/cms-api/")) return NextResponse.next();

  // ── Old admin → /cms (bookmarks keep working) ──
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/cms";
    url.search = "";
    return NextResponse.redirect(url, 308);
  }

  // ── ShopEngine's marketing website: its pages, or accounts / admin / files passed through ──
  if (marketing) {
    if (PASS_THROUGH.test(pathname)) return NextResponse.next();
    return NextResponse.rewrite(new URL(`${MARKETING_PREFIX}${pathname === "/" ? "" : pathname}${search}`, request.url));
  }

  // ── Redirect manager (storefront only) ──
  if (request.method === "GET" || request.method === "HEAD") {
    try {
      // the Host header only (as the pages do); a host no store answers on has no redirects
      const storeId = await storeIdForHost(request.headers.get("host"));
      if (storeId === undefined) return NextResponse.next();
      const map = await getRedirectMap(storeId);
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
