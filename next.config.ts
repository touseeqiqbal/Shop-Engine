import type { NextConfig } from "next";
import { withPayload } from "@payloadcms/next/withPayload";
import { withSentryConfig } from "@sentry/nextjs/config";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/**
 * HTTPS-only (HSTS). `includeSubDomains; preload` only on ShopEngine's own domain (PLATFORM_ROOT_DOMAIN and its store
 * sub-domains): sent on a merchant's custom domain it would force HTTPS on ALL of their sub-domains for two years –
 * their other services could break, and it can't be undone quickly. Custom domains get plain HSTS.
 */
const platformRoot = (process.env.PLATFORM_ROOT_DOMAIN ?? "").trim().toLowerCase().replace(/^\.+|\.+$/g, "");
const platformHosts = platformRoot ? `(?:.+\\.)?${platformRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?::\\d+)?` : null;
const hsts = (value: string) => [{ key: "Strict-Transport-Security", value }];

/**
 * Content-Security-Policy for the shop (not /cms, which Payload manages). Limits where scripts, frames and data can
 * come from – a second line of defence behind the HTML cleaning of /cms text (src/lib/sanitize.ts).
 * Inline scripts stay allowed (theme switch, analytics snippets, JSON-LD); nonces would make every page dynamic.
 */
// Integrations a store can switch on (/cms → Integrations): Google Ads, TikTok pixel, tawk.to and Crisp chat.
const ADS = "https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.google.com";
const TIKTOK = "https://analytics.tiktok.com https://*.tiktok.com";
const CHAT = "https://embed.tawk.to https://*.tawk.to https://client.crisp.chat https://*.crisp.chat";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net https://challenges.cloudflare.com ${ADS} ${TIKTOK} ${CHAT}`,
  `style-src 'self' 'unsafe-inline' ${CHAT}`,
  "img-src 'self' data: blob: https:",
  `font-src 'self' data: ${CHAT}`,
  `connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://www.facebook.com https://connect.facebook.net https://challenges.cloudflare.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io ${ADS} ${TIKTOK} ${CHAT} wss://*.tawk.to wss://client.relay.crisp.chat wss://*.crisp.chat`,
  `frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://www.google.com https://maps.google.com https://challenges.cloudflare.com https://www.facebook.com https://td.doubleclick.net https://www.googletagmanager.com ${CHAT}`,
  "media-src 'self' https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // `next dev` only: other local addresses allowed to load dev scripts, e.g. DEV_ALLOWED_ORIGINS=localtest.me,*.localtest.me
  // so store sub-domains (acme.localtest.me) work in a browser while developing. Unset = Next.js' default (localhost only).
  ...(process.env.DEV_ALLOWED_ORIGINS ? { allowedDevOrigins: process.env.DEV_ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean) } : {}),
  output: "standalone",
  images: {
    // WebP only: AVIF encoding is slow and runs on the shop's own server (one copy – docs/DEPLOYMENT.md), taking CPU from
    // page rendering; WebP is nearly as small. Optimised images are kept for a month instead of being re-checked
    // every minute (photo addresses change when the photo does).
    formats: ["image/webp"],
    minimumCacheTTL: 2_678_400,
    qualities: [60, 75, 90],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  experimental: {
    // Two root layouts ((frontend) storefront + (payload) admin) → app/global-not-found.tsx handles unmatched URLs.
    globalNotFound: true,
    optimizePackageImports: ["lucide-react", "framer-motion"],
    // Checkout uploads payment screenshots (≤ 5 MB) through a Server Action; default limit is 1 MB.
    serverActions: { bodySizeLimit: "6mb" },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      ...(platformHosts
        ? [
            { source: "/:path*", has: [{ type: "host" as const, value: platformHosts }], headers: hsts("max-age=63072000; includeSubDomains; preload") },
            { source: "/:path*", missing: [{ type: "host" as const, value: platformHosts }], headers: hsts("max-age=63072000") },
          ]
        : [{ source: "/:path*", headers: hsts("max-age=63072000") }]),
      // the shop only (dev server needs eval for hot reload)
      // (not /api/integrations: a payment provider's auto-submitting page sets its own, stricter policy)
      ...(process.env.NODE_ENV === "production" ? [{ source: "/((?!cms|cms-api|_next|media/|api/integrations/).*)", headers: [{ key: "Content-Security-Policy", value: csp }] }] : []),
      // Staging builds (STAGING=true) are never indexed – covers pages, images and files alike.
      ...(process.env.STAGING === "true" ? [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }] : []),
      {
        source: "/images/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
  async redirects() {
    // Static, code-level redirects. Admin-managed 301s live in the `redirects` table and are applied in src/proxy.ts.
    return [
      { source: "/categories", destination: "/category", permanent: true },
    ];
  },
};

const config = withPayload(nextConfig, { devBundleServerPackages: false });
const payloadHeaders = config.headers;

const finalConfig = {
  ...config,
  // Payload sends Accept-CH / Critical-CH (the admin's colour scheme) on EVERY page. Critical-CH makes Chrome repeat the
  // first request of a visit (~1 s on mobile), so the store pages don't get it – only the admin (/cms) needs it.
  async headers() {
    const all = (await payloadHeaders?.()) ?? [];
    return all.map((h) => (h.source === "/:path*" && h.headers.some((x) => x.key === "Critical-CH") ? { ...h, source: "/cms/:path*" } : h));
  },
} satisfies NextConfig;

// Readable error locations in Sentry: the build uploads its source maps (then deletes them from the server) – only
// when the upload credentials are set for the build. Otherwise the config is unchanged.
const uploadSourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT);
export default uploadSourceMaps
  ? withSentryConfig(finalConfig, { org: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT, authToken: process.env.SENTRY_AUTH_TOKEN, silent: true, telemetry: false, sourcemaps: { deleteSourcemapsAfterUpload: true } })
  : finalConfig;
