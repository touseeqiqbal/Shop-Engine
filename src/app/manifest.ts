import type { MetadataRoute } from "next";
import { getSiteInfo } from "@/lib/repo/site-content";
import { getCurrentStore } from "@/lib/tenant";
import { getChrome } from "@/lib/cms/chrome";
import { DEFAULT_LOCALE, storeLocale } from "@/lib/locale";

/** The installable-app details of the store on this address (the original shop keeps its own icons and shortcuts). */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const [site, store, chrome] = await Promise.all([getSiteInfo(), getCurrentStore().catch(() => null), getChrome().catch(() => null)]);
  const original = !store || store.isDefault;
  const favicon = chrome?.theme.favicon;
  // the store's language and country, e.g. "en-PK"
  const lang = (store ? storeLocale(store) : DEFAULT_LOCALE).locale;
  if (!original)
    return {
      id: "/",
      name: site.name,
      short_name: site.shortName || site.name,
      description: site.description,
      start_url: "/?source=pwa",
      scope: "/",
      display: "standalone",
      background_color: "#0A0A0F",
      theme_color: "#0A0A0F",
      lang,
      categories: ["shopping"],
      icons: favicon ? [{ src: favicon, sizes: "any" }] : [{ src: "/brand/store-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
      shortcuts: [
        { name: "Shop", url: "/shop" },
        { name: "Track order", url: "/track-order" },
      ],
    };
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
    lang,
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
