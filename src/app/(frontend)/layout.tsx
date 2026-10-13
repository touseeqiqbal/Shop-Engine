import type { Metadata, Viewport } from "next";
import { Inter, Montserrat, Poppins, Space_Grotesk } from "next/font/google";
import "../globals.css";
import { absoluteUrl, site } from "@/lib/site";
import { getSeoSettings, getSiteInfo } from "@/lib/repo/site-content";
import { SiteInfoProvider } from "@/components/providers/site-info";
import { PreferencesProvider } from "@/components/providers/preferences";
import { themeInitScript } from "@/lib/theme-init";
import { RuntimeAnalytics } from "@/components/runtime-analytics";
import { ChromeProvider } from "@/components/providers/chrome";
import { MotionProvider } from "@/components/providers/motion";
import { getChrome } from "@/lib/cms/chrome";
import { themeCss } from "@/lib/cms/chrome-types";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap", weight: ["800"] });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", display: "swap", weight: ["500", "600", "700"] });
// Only downloaded when chosen in Online store → Theme settings
const poppins = Poppins({ subsets: ["latin"], variable: "--font-poppins", display: "swap", weight: ["400", "600", "700"], preload: false });

/** Global defaults – editable in /cms → Settings → Google & SEO (env vars remain as fallbacks). */
export async function generateMetadata(): Promise<Metadata> {
  const [seo, info, chrome] = await Promise.all([getSeoSettings(), getSiteInfo(), getChrome()]);
  const google = seo.googleVerification || process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined;
  const bing = seo.bingVerification || process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION || "";
  const fb = seo.facebookVerification || process.env.NEXT_PUBLIC_FB_DOMAIN_VERIFICATION || "";
  const other: Record<string, string> = {};
  if (fb) other["facebook-domain-verification"] = fb;
  if (bing) other["msvalidate.01"] = bing;
  const index = !seo.discourageIndexing;
  return {
    metadataBase: new URL(site.url),
    title: {
      default: seo.defaultTitle,
      template: seo.titleTemplate,
    },
    description: seo.defaultDescription || info.description,
    applicationName: info.name,
    keywords: seo.keywords,
    authors: [{ name: info.name, url: site.url }],
    creator: info.name,
    formatDetection: { telephone: true, email: true, address: true },
    openGraph: {
      siteName: info.name,
      locale: "en_PK",
      type: "website",
      ...(seo.defaultOgImage ? { images: [{ url: /^https?:\/\//.test(seo.defaultOgImage) ? seo.defaultOgImage : absoluteUrl(seo.defaultOgImage), width: 1200, height: 630 }] } : {}),
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
    ...(chrome.theme.favicon ? { icons: { icon: chrome.theme.favicon, apple: chrome.theme.favicon } } : {}),
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
  const [info, chrome] = await Promise.all([getSiteInfo(), getChrome()]);
  const mode = chrome.theme.defaultMode;
  return (
    <html lang="en" data-theme={mode} className={`${inter.variable} ${grotesk.variable} ${montserrat.variable} ${poppins.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript(chrome.theme.allowModeToggle) }} />
        <style dangerouslySetInnerHTML={{ __html: themeCss(chrome.theme) }} />
      </head>
      <body className="min-h-dvh overflow-x-hidden">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-violet-600 focus:px-4 focus:py-2 focus:text-white">
          Skip to content
        </a>
        <PreferencesProvider defaultTheme={mode}>
          <SiteInfoProvider info={info}>
            <ChromeProvider chrome={chrome}>
              <MotionProvider>{children}</MotionProvider>
            </ChromeProvider>
          </SiteInfoProvider>
        </PreferencesProvider>
        <RuntimeAnalytics />
      </body>
    </html>
  );
}
