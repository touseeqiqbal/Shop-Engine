import type { Metadata } from "next";
import { Inter, Montserrat, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Logo } from "@/components/layout/logo";
import { NotFoundContent } from "@/components/content/not-found-content";
import { SiteInfoProvider } from "@/components/providers/site-info";
import { getSiteInfo } from "@/lib/repo/site-content";
import { site } from "@/lib/site";

/**
 * 404 for URLs that match no route group at all (the app has two root layouts: the storefront
 * `(frontend)` and the Payload admin `(payload)`, so there is no single layout to render a 404 in).
 */
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap", weight: ["800"] });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", display: "swap", weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: "Page not found | Urko Tech Store",
  robots: { index: false, follow: true },
};

export default async function GlobalNotFound() {
  const info = await getSiteInfo();
  return (
    <html lang="en" data-theme="dark" className={`${inter.variable} ${grotesk.variable} ${montserrat.variable}`}>
      <body className="min-h-dvh overflow-x-hidden">
        <SiteInfoProvider info={info}>
          <div className="flex min-h-dvh flex-col">
            <header className="border-b border-border">
              <div className="container-x flex h-16 items-center">
                <Logo />
              </div>
            </header>
            <main id="main" className="flex-1">
              <NotFoundContent />
            </main>
            <footer className="border-t border-border py-6 text-center text-xs text-muted">
              {info.name} · {info.address.full} · {info.phones.map((p) => p.display).join(" · ")}
            </footer>
          </div>
        </SiteInfoProvider>
      </body>
    </html>
  );
}
