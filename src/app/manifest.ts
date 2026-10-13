import type { MetadataRoute } from "next";
import { getSiteInfo } from "@/lib/repo/site-content";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const site = await getSiteInfo();
  return {
    id: "/",
    name: site.name,
    short_name: site.shortName,
    description: site.description,
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0A0A0F",
    theme_color: "#0A0A0F",
    lang: "en-PK",
    categories: ["shopping", "electronics"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // full-bleed version for Android's round / squircle masks (logo inside the safe zone)
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcuts: [
      { name: "Laptops", url: "/category/laptops" },
      { name: "Find parts for my laptop", url: "/find-parts" },
      { name: "Hot deals", url: "/deals" },
      { name: "Track order", url: "/track-order" },
    ],
  };
}
