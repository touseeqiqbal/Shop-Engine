import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SITE } from "@/lib/marketing/content";
import { ShopEngineLogo } from "./logo";
import { FOOTER_COLUMNS } from "./nav-data";

export function MarketingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative overflow-hidden border-t border-white/[0.07] bg-night">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/60 to-transparent" />
      <div className="mk-container grid grid-cols-2 gap-x-6 gap-y-10 pb-10 pt-16 md:grid-cols-[1.4fr_repeat(4,1fr)] md:gap-12">
        <div className="col-span-2 max-w-xs md:col-span-1">
          <Link href="/" aria-label="ShopEngine home" className="inline-block rounded-full">
            <ShopEngineLogo size={30} onDark />
          </Link>
          <p className="mt-5 text-sm leading-relaxed text-body">{SITE.tagline} Launch and run independent online stores from one place.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href={SITE.signUp} className="mk-btn mk-btn-primary mk-btn-sm">
              Start free trial
            </Link>
            <Link href="/contact" className="mk-btn mk-btn-secondary mk-btn-sm">
              Contact us
            </Link>
          </div>
        </div>
        {FOOTER_COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <p className="text-sm font-medium text-ink">{col.title}</p>
            <ul className="mt-4 space-y-3">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-faint transition-colors hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="mk-container">
        <div className="flex flex-col gap-3 border-t border-white/[0.07] py-6 text-xs text-faint sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} ShopEngine. All rights reserved.</p>
          <Link href={SITE.signIn} className="inline-flex items-center gap-1 transition-colors hover:text-white">
            Merchant sign in <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
      {/* the oversized wordmark fading into the page edge */}
      <div aria-hidden="true" className="pointer-events-none select-none overflow-hidden">
        <p className="mk-container -mb-[0.22em] whitespace-nowrap text-center text-[clamp(3.5rem,14vw,12.5rem)] font-semibold leading-none tracking-[-0.06em] text-transparent [background-clip:text] [-webkit-background-clip:text] bg-gradient-to-b from-white/[0.13] to-white/0">
          ShopEngine
        </p>
      </div>
    </footer>
  );
}
