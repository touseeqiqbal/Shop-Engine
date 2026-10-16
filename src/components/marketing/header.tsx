import Link from "next/link";
import { SITE } from "@/lib/marketing/content";
import { ShopEngineLogo } from "./logo";
import { MobileMenu, NavDropdown } from "./nav-menus";
import { PRODUCT_MENU, RESOURCES_MENU } from "./nav-data";

const LINKS = [
  { label: "Features", href: "/features" },
  { label: "How it works", href: "/how-it-works" },
  { label: "Pricing", href: "/pricing" },
];

// the small-screen menu lists the top links first, so the groups leave them out
const MOBILE_GROUPS = [...PRODUCT_MENU, ...RESOURCES_MENU].map((g) => ({ ...g, items: g.items.filter((it) => !LINKS.some((l) => l.href === it.href)) }));

/** A floating glass bar over the page (every page starts with enough top space for it). */
export function MarketingHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mk-container pt-3">
        <div className="relative flex h-14 items-center gap-2 rounded-full border border-white/10 bg-[#070b22]/70 pl-4 pr-2 shadow-[0_12px_40px_-18px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl backdrop-saturate-150">
          <Link href="/" aria-label="ShopEngine home" className="shrink-0 rounded-full">
            <ShopEngineLogo size={28} onDark />
          </Link>
          <nav aria-label="Main" className="mx-auto hidden items-center lg:flex">
            <NavDropdown label="Product" groups={PRODUCT_MENU} footer={{ label: "See everything ShopEngine does", href: "/features" }} />
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-full px-3.5 py-2 text-sm font-medium text-ink-2 transition-colors hover:text-white">
                {l.label}
              </Link>
            ))}
            <NavDropdown label="Resources" groups={RESOURCES_MENU} footer={{ label: "Questions? Talk to the team", href: "/contact" }} />
          </nav>
          <div className="ml-auto hidden items-center gap-1.5 lg:ml-0 lg:flex">
            <Link href={SITE.signIn} className="mk-btn mk-btn-ghost mk-btn-sm">
              Sign in
            </Link>
            <Link href={SITE.signUp} className="mk-btn mk-btn-primary mk-btn-sm">
              Start free trial
            </Link>
          </div>
          <div className="ml-auto lg:hidden">
            <MobileMenu groups={MOBILE_GROUPS} links={LINKS} signIn={SITE.signIn} signUp={SITE.signUp} />
          </div>
        </div>
      </div>
    </header>
  );
}
