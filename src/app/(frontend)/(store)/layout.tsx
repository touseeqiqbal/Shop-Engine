import { TopBar } from "@/components/layout/top-bar";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { BottomNav } from "@/components/layout/bottom-nav";
import { CartDrawer } from "@/components/layout/cart-drawer";
import { deliveryInfo } from "@/lib/cities";
import { SearchDialog } from "@/components/layout/search-dialog";
import { WhatsAppFloat } from "@/components/layout/whatsapp-float";
import { Toaster } from "@/components/layout/toaster";
import { CartPersistence } from "@/components/layout/cart-persistence";
import { JsonLd } from "@/components/ui/json-ld";
import { getStoreSettings, getTopCategories } from "@/lib/repo/catalog";
import { defaultMainMenu, getChrome } from "@/lib/cms/chrome";
import { localBusinessJsonLd, organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import { getSiteInfo } from "@/lib/repo/site-content";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentAvailability, isPlatformRequest } from "@/lib/tenant";
import { PlatformShell } from "@/components/marketing/platform-shell";
import { getStoreLocale } from "@/lib/store-locale";

const CLOSED: Record<string, { title: string; text: string }> = {
  "setting-up": { title: "Opening soon", text: "This shop is getting ready. Please check back soon." },
  suspended: { title: "Temporarily unavailable", text: "This shop isn't taking orders right now. Please check back later." },
  "plan-ended": { title: "Temporarily unavailable", text: "This shop isn't taking orders right now. Please check back later." },
  closed: { title: "This shop has closed", text: "Thank you for shopping with us." },
};

/** A shop that isn't open (draft, suspended, closed, plan ended) is never indexed. */
export async function generateMetadata(): Promise<Metadata> {
  const { availability } = await currentAvailability();
  return availability.open ? {} : { robots: { index: false, follow: false } };
}

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  // which shop this address belongs to, and whether it is open (unknown sub-domain → 404)
  const { store, availability } = await currentAvailability();
  if (!availability.open) {
    // ShopEngine's own address: the merchant account pages (sign-up, sign-in, Stores) in ShopEngine's frame
    if (availability.reason === "missing" && (await isPlatformRequest())) return <PlatformShell>{children}</PlatformShell>;
    if (availability.reason === "missing") notFound();
    const c = CLOSED[availability.reason] ?? CLOSED.closed;
    return (
      <main id="main" className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center gap-3 px-4 text-center">
        {store?.name ? <p className="text-sm text-muted">{store.name}</p> : null}
        <h1 className="font-display text-3xl font-bold">{c.title}</h1>
        <p className="text-muted">{c.text}</p>
      </main>
    );
  }
  const [topCategories, settings, info, chrome, loc] = await Promise.all([getTopCategories(), getStoreSettings(), getSiteInfo(), getChrome(), getStoreLocale()]);
  // Header menu from /cms → Online store → Header; built-in category mega menu until one is assigned.
  const menu = chrome.header.menu ?? (await defaultMainMenu());
  // the store's own logo for Google (the original shop's mark only on the original shop)
  const logo = chrome.theme.logoLight || chrome.theme.logoDark || chrome.theme.favicon || (!store || store.isDefault ? "/icon.svg" : "/brand/store-icon.svg");

  return (
    <>
      <JsonLd data={[organizationJsonLd(info, logo, loc), localBusinessJsonLd(info, settings, logo, loc), websiteJsonLd(info, loc)]} />
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
      <CartPersistence />
    </>
  );
}
