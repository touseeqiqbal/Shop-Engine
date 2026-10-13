import type { MetadataRoute } from "next";
import { absoluteUrl, site } from "@/lib/site";
import { getSeoSettings } from "@/lib/repo/site-content";

export const revalidate = 300;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const seo = await getSeoSettings();
  // Staging switch in /cms → Settings → Google & SEO: block every crawler.
  if (seo.discourageIndexing || process.env.STAGING === "true") return { rules: [{ userAgent: "*", disallow: "/" }], host: site.url };
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
    sitemap: absoluteUrl("/sitemap.xml"),
    host: site.url,
  };
}
