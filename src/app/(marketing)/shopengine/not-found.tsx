import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE } from "@/lib/marketing/content";
import { HeroBackdrop } from "@/components/marketing/sections";

export const metadata: Metadata = { title: { absolute: "Page not found | ShopEngine" }, robots: { index: false, follow: true } };

const POPULAR = [
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "How it works", href: "/how-it-works" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact", href: "/contact" },
];

export default function MarketingNotFound() {
  return (
    <section className="relative isolate overflow-hidden">
      <HeroBackdrop tall />
      <div className="mk-container relative pb-28 pt-36 text-center sm:pb-36 sm:pt-48">
        <p aria-hidden="true" className="mx-auto bg-gradient-to-b from-white/25 to-white/0 bg-clip-text text-[clamp(6rem,22vw,13rem)] font-semibold leading-none tracking-[-0.06em] text-transparent">404</p>
        <h1 className="mk-h1 mx-auto -mt-4 max-w-3xl text-[clamp(2.2rem,5vw,4rem)]">This page isn’t part of the engine.</h1>
        <p className="mk-lead mx-auto mt-5 max-w-xl">The address may be mistyped, or the page has moved. Here are some places to start instead.</p>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/" className="mk-btn mk-btn-primary mk-btn-lg">
            Back to the homepage
          </Link>
          <Link href={SITE.signIn} className="mk-btn mk-btn-secondary mk-btn-lg">
            Sign in to your stores
          </Link>
        </div>
        <nav aria-label="Popular pages" className="mt-12">
          <ul className="flex flex-wrap justify-center gap-2">
            {POPULAR.map((p) => (
              <li key={p.href}>
                <Link href={p.href} className="mk-chip px-3.5 py-1.5 text-sm transition-colors hover:border-white/20 hover:text-white">
                  {p.label} <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </section>
  );
}
