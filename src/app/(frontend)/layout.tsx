import type { Metadata, Viewport } from "next";
import { Inter, Montserrat, Poppins, Space_Grotesk } from "next/font/google";
import "../globals.css";
import { currentAvailability, currentOrigin, getCurrentStore, isPlatformRequest } from "@/lib/tenant";
import { getSeoSettings, getSiteInfo } from "@/lib/repo/site-content";
import { blankSiteInfo } from "@/lib/site-info";
import { SiteInfoProvider } from "@/components/providers/site-info";
import { PreferencesProvider } from "@/components/providers/preferences";
import { themeInitScript } from "@/lib/theme-init";
import { RuntimeAnalytics } from "@/components/runtime-analytics";
import { ChromeProvider } from "@/components/providers/chrome";
import { MotionProvider } from "@/components/providers/motion";
import { getChrome } from "@/lib/cms/chrome";
import { DEFAULT_CHROME, themeCss } from "@/lib/cms/chrome-types";
import { LocaleProvider } from "@/components/providers/locale";
import { DEFAULT_LOCALE, ogLocale, storeLocale } from "@/lib/locale";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap", weight: ["800"] });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", display: "swap", weight: ["500", "600", "700"] });
// Only downloaded when chosen in Online store → Theme settings
const poppins = Poppins({ subsets: ["latin"], variable: "--font-poppins", display: "swap", weight: ["400", "600", "700"], preload: false });

/** An address no store owns (unknown sub-domain): the platform's own plain pages, never the original shop's profile. */
const PLATFORM_NAME = "ShopEngine";
const SHOPENGINE_ICONS: Metadata["icons"] = {
  icon: [
    { url: "/brand/shopengine/favicon-32.png", sizes: "32x32", type: "image/png" },
    { url: "/brand/shopengine/favicon-16.png", sizes: "16x16", type: "image/png" },
  ],
  apple: "/brand/shopengine/apple-touch-icon.png",
};
async function isUnknownStore() {
  const { availability } = await currentAvailability();
  return !availability.open && availability.reason === "missing";
}

/** Global defaults – editable in /cms → Settings → Google & SEO (env vars remain as fallbacks). */
export async function generateMetadata(): Promise<Metadata> {
  const [seo, info, chrome, origin, unknown, store] = await Promise.all([getSeoSettings(), getSiteInfo(), getChrome(), currentOrigin(), isUnknownStore(), getCurrentStore()]);
  // the store's own favicon (Theme settings); the original shop's icon only on the original shop
  const icon = chrome.theme.favicon || (!store || store.isDefault ? "/icon.svg" : "/brand/store-icon.svg");
  const icons = { icon, apple: chrome.theme.favicon || (!store || store.isDefault ? "/apple-icon.png" : "/brand/store-icon.svg") };
  if (unknown) return { metadataBase: new URL(origin), title: { default: PLATFORM_NAME, template: `%s | ${PLATFORM_NAME}` }, robots: { index: false, follow: false }, icons: SHOPENGINE_ICONS };
  const google = seo.googleVerification || process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined;
  const bing = seo.bingVerification || process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION || "";
  const fb = seo.facebookVerification || process.env.NEXT_PUBLIC_FB_DOMAIN_VERIFICATION || "";
  const other: Record<string, string> = {};
  if (fb) other["facebook-domain-verification"] = fb;
  if (bing) other["msvalidate.01"] = bing;
  const index = !seo.discourageIndexing;
  return {
    // each store's own address: relative canonical / social links resolve against it
    metadataBase: new URL(origin),
    title: {
      default: seo.defaultTitle,
      template: seo.titleTemplate,
    },
    description: seo.defaultDescription || info.description,
    applicationName: info.name,
    keywords: seo.keywords,
    authors: [{ name: info.name, url: origin }],
    creator: info.name,
    formatDetection: { telephone: true, email: true, address: true },
    openGraph: {
      siteName: info.name,
      locale: ogLocale(store ? storeLocale(store) : DEFAULT_LOCALE),
      type: "website",
      ...(seo.defaultOgImage ? { images: [{ url: seo.defaultOgImage, width: 1200, height: 630 }] } : {}),
    },
    twitter: { card: "summary_large_image" },
    robots: index
      ? { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } }
      : { index: false, follow: false, googleBot: { index: false, follow: false } },
    verification: {
      google,
      other: Object.keys(other).length ? other : undefined,
    },
    category: "shopping",
    icons,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0f" },
    { media: "(prefers-color-scheme: light)", color: "#f5f6fa" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [storeInfo, storeChrome, origin, { store, availability }] = await Promise.all([getSiteInfo(), getChrome(), currentOrigin(), currentAvailability()]);
  const unknown = !availability.open && availability.reason === "missing";
  const info = unknown ? blankSiteInfo(PLATFORM_NAME, origin) : storeInfo;
  const chrome = unknown ? DEFAULT_CHROME : storeChrome;
  // ShopEngine's own address (sign-up, sign-in, Stores) is dark like its website; an address no store owns stays light
  const mode = unknown ? ((await isPlatformRequest()) ? "dark" : "light") : chrome.theme.defaultMode;
  // the store's currency, time zone and country for prices, dates and checkout (the original shop: PKR / Pakistan)
  const locale = store && !unknown ? storeLocale(store) : DEFAULT_LOCALE;
  return (
    <html lang={store?.language || "en"} data-theme={mode} className={`${inter.variable} ${grotesk.variable} ${montserrat.variable} ${poppins.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript(chrome.theme.allowModeToggle) }} />
        <style dangerouslySetInnerHTML={{ __html: themeCss(chrome.theme) }} />
      </head>
      <body className="min-h-dvh overflow-x-hidden">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-violet-600 focus:px-4 focus:py-2 focus:text-white">
          Skip to content
        </a>
        <PreferencesProvider defaultTheme={mode}>
          <SiteInfoProvider info={info} original={!unknown && (!store || store.isDefault)}>
            <ChromeProvider chrome={chrome}>
              <LocaleProvider locale={locale}>
                <MotionProvider>{children}</MotionProvider>
              </LocaleProvider>
            </ChromeProvider>
          </SiteInfoProvider>
        </PreferencesProvider>
        <RuntimeAnalytics />
      </body>
    </html>
  );
}
