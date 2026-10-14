import type { Metadata } from "next";
import { Inter, Montserrat, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { NotFoundContent } from "@/components/content/not-found-content";
import { SiteInfoProvider } from "@/components/providers/site-info";
import { blankSiteInfo } from "@/lib/site-info";
import { site } from "@/lib/site";

/**
 * 404 for URLs that match no route group at all (the app has two root layouts: the storefront
 * `(frontend)` and the Payload admin `(payload)`, so there is no single layout to render a 404 in).
 * Which store the address belongs to isn't guaranteed here, so it names no store and shows no logo or contact details.
 */
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap", weight: ["800"] });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", display: "swap", weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default function GlobalNotFound() {
  const info = blankSiteInfo("", site.url);
  return (
    <html lang="en" data-theme="dark" className={`${inter.variable} ${grotesk.variable} ${montserrat.variable}`}>
      <body className="min-h-dvh overflow-x-hidden">
        <SiteInfoProvider info={info} original={false}>
          <div className="flex min-h-dvh flex-col">
            <main id="main" className="flex-1">
              <NotFoundContent />
            </main>
          </div>
        </SiteInfoProvider>
      </body>
    </html>
  );
}
