import { TopBar } from "@/components/layout/top-bar";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { BottomNav } from "@/components/layout/bottom-nav";
import { CartDrawer } from "@/components/layout/cart-drawer";
import { deliveryInfo } from "@/lib/cities";
import { SearchDialog } from "@/components/layout/search-dialog";
import { WhatsAppFloat } from "@/components/layout/whatsapp-float";
import { Toaster } from "@/components/layout/toaster";
import { JsonLd } from "@/components/ui/json-ld";
import { getStoreSettings, getTopCategories } from "@/lib/repo/catalog";
import { defaultMainMenu, getChrome } from "@/lib/cms/chrome";
import { localBusinessJsonLd, organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import { getSiteInfo } from "@/lib/repo/site-content";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [topCategories, settings, info, chrome] = await Promise.all([getTopCategories(), getStoreSettings(), getSiteInfo(), getChrome()]);
  // Header menu from /cms → Online store → Header; built-in category mega menu until one is assigned.
  const menu = chrome.header.menu ?? (await defaultMainMenu());

  return (
    <>
      <JsonLd data={[organizationJsonLd(info), localBusinessJsonLd(info, settings), websiteJsonLd(info)]} />
      <TopBar announcement={chrome.announcement} legacyText={settings.announcement} />
      <Navbar menu={menu} mobileMenu={chrome.header.mobileMenu} />
      <main id="main" className="min-h-[60vh]">
        {children}
      </main>
      <Footer categories={topCategories} settings={chrome.footer} />
      <BottomNav />
      <WhatsAppFloat />
      <CartDrawer delivery={deliveryInfo(settings)} />
      <SearchDialog />
      <Toaster />
    </>
  );
}
