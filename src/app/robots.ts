import type { MetadataRoute } from "next";
import { getSeoSettings } from "@/lib/repo/site-content";
import { currentAvailability, currentOrigin } from "@/lib/tenant";

export const revalidate = 300;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const [seo, origin, { availability }] = await Promise.all([getSeoSettings(), currentOrigin(), currentAvailability()]);
  // Staging, the switch in /cms → Settings → Google & SEO, or a shop that isn't open: block every crawler.
  if (seo.discourageIndexing || process.env.STAGING === "true" || !availability.open) return { rules: [{ userAgent: "*", disallow: "/" }], host: origin };
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/cms",
          "/cms-api",
          "/cms-proof",
          "/cms-print",
          "/api",
          "/cart",
          "/checkout",
          "/account",
          "/order-confirmation",
          "/compare",
          // Faceted / filtered listing URLs – canonical category pages are indexed instead.
          "/*?*sort=",
          "/*?*brand=",
          "/*?*condition=",
          "/*?*min=",
          "/*?*max=",
          "/*?*stock=",
          "/*?*view=",
          "/*?*q=",
          "/*?*a_",
          "/*?*r_",
        ],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
