import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./marketing.css";
import { MarketingHeader } from "@/components/marketing/header";
import { MarketingFooter } from "@/components/marketing/footer";
import { Spotlight } from "@/components/marketing/spotlight";
import { SITE } from "@/lib/marketing/content";
import { ldJson, marketingOrigin, organizationLd, SOCIAL_IMAGE, websiteLd } from "@/lib/marketing/seo";

/**
 * ShopEngine's marketing website – its own root layout and design (the stores and /cms have theirs). Served only on
 * the addresses in MARKETING_HOSTS (see src/proxy.ts and src/lib/marketing/hosts.ts).
 */

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const origin = await marketingOrigin();
  return {
    metadataBase: new URL(origin),
    title: { default: "ShopEngine – Multi-store ecommerce platform", template: "%s | ShopEngine" },
    description: SITE.description,
    applicationName: SITE.name,
    icons: {
      icon: [
        { url: "/brand/shopengine/favicon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/brand/shopengine/favicon-48.png", sizes: "48x48", type: "image/png" },
        { url: "/brand/shopengine/favicon-16.png", sizes: "16x16", type: "image/png" },
      ],
      apple: "/brand/shopengine/apple-touch-icon.png",
    },
    openGraph: { siteName: SITE.name, type: "website", locale: "en_US", images: [SOCIAL_IMAGE] },
    twitter: { card: "summary_large_image", images: [SOCIAL_IMAGE.url] },
    formatDetection: { telephone: false, email: false, address: false },
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#03051a", colorScheme: "dark" };

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const origin = await marketingOrigin();
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="min-h-dvh overflow-x-hidden">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[100] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-[#050820]">
          Skip to content
        </a>
        <MarketingHeader />
        <main id="main">{children}</main>
        <MarketingFooter />
        <Spotlight />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([organizationLd(origin), websiteLd(origin)]) }} />
      </body>
    </html>
  );
}
