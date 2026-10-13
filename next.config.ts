import type { NextConfig } from "next";
import { withPayload } from "@payloadcms/next/withPayload";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

/**
 * Content-Security-Policy for the shop (not /cms, which Payload manages). Limits where scripts, frames and data can
 * come from – a second line of defence behind the HTML cleaning of /cms text (src/lib/sanitize.ts).
 * Inline scripts stay allowed (theme switch, analytics snippets, JSON-LD); nonces would make every page dynamic.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://www.facebook.com https://connect.facebook.net https://challenges.cloudflare.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io",
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://www.google.com https://maps.google.com https://challenges.cloudflare.com https://www.facebook.com",
  "media-src 'self' https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  output: "standalone",
  images: {
    formats: ["image/avif", "image/webp"],
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
      // the shop only (dev server needs eval for hot reload)
      ...(process.env.NODE_ENV === "production" ? [{ source: "/((?!cms|cms-api|_next|media/).*)", headers: [{ key: "Content-Security-Policy", value: csp }] }] : []),
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

export default {
  ...config,
  // Payload sends Accept-CH / Critical-CH (the admin's colour scheme) on EVERY page. Critical-CH makes Chrome repeat the
  // first request of a visit (~1 s on mobile), so the store pages don't get it – only the admin (/cms) needs it.
  async headers() {
    const all = (await payloadHeaders?.()) ?? [];
    return all.map((h) => (h.source === "/:path*" && h.headers.some((x) => x.key === "Critical-CH") ? { ...h, source: "/cms/:path*" } : h));
  },
} satisfies NextConfig;
