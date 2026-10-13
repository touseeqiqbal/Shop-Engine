import Link from "next/link";
import { ArrowRight, BatteryCharging, HardDrive, Home, Keyboard, Laptop, Mouse, PlugZap, Search, Wrench } from "lucide-react";
import { WhatsAppIcon } from "@/components/layout/whatsapp-icon";
import { WhatsAppLink } from "@/components/content/whatsapp-link";

const POPULAR = [
  { href: "/category/laptops", label: "Laptops", icon: Laptop },
  { href: "/category/chargers", label: "Chargers", icon: PlugZap },
  { href: "/category/batteries", label: "Batteries", icon: BatteryCharging },
  { href: "/category/mouse", label: "Mouse", icon: Mouse },
  { href: "/category/keyboards", label: "Keyboards", icon: Keyboard },
  { href: "/category/storage", label: "SSD & Storage", icon: HardDrive },
];

/** Premium 404 body: big gradient code, search box, popular categories and helpful links. */
export function NotFoundContent() {
  return (
    <div className="container-x relative py-14 sm:py-20">
      <div className="pointer-events-none absolute left-1/2 top-0 size-[32rem] -translate-x-1/2 rounded-full bg-violet-600/15 blur-3xl" aria-hidden="true" />
      <div className="relative mx-auto max-w-2xl text-center">
        <p className="font-display text-[6rem] font-bold leading-none tracking-tighter sm:text-[9rem]">
          <span className="gradient-text">404</span>
        </p>
        <h1 className="mt-2 text-2xl font-bold text-fg sm:text-4xl">This page went offline</h1>
        <p className="mt-3 text-muted">
          The page you&apos;re looking for doesn&apos;t exist or has moved. Try searching for a laptop, charger or part – or jump into a popular category.
        </p>

        <form action="/shop" method="get" role="search" className="mx-auto mt-8 flex max-w-lg gap-2">
          <label htmlFor="nf-search" className="sr-only">
            Search products
          </label>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
            <input id="nf-search" name="q" type="search" placeholder="Search e.g. EliteBook, HP charger…" className="input !rounded-full pl-11" />
          </div>
          <button type="submit" className="btn btn-primary">
            Search
          </button>
        </form>
      </div>

      <nav aria-label="Popular categories" className="relative mx-auto mt-12 max-w-4xl">
        <h2 className="mb-4 text-center text-sm font-semibold uppercase tracking-[0.18em] text-muted">Popular categories</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {POPULAR.map((c) => (
            <li key={c.href}>
              <Link href={c.href} className="glow-hover card group flex flex-col items-center gap-2 p-4 text-center transition-transform hover:-translate-y-1">
                <span className="grid size-11 place-items-center rounded-2xl bg-surface-strong transition-colors group-hover:bg-brand-gradient group-hover:text-white">
                  <c.icon className="size-5" aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold text-fg">{c.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="relative mt-10 flex flex-wrap justify-center gap-2">
        <Link href="/" className="btn btn-secondary">
          <Home className="size-4" aria-hidden="true" /> Home
        </Link>
        <Link href="/find-parts" className="btn btn-secondary">
          <Wrench className="size-4" aria-hidden="true" /> Find parts for your laptop
        </Link>
        <WhatsAppLink message="Hi! I couldn't find a page on your website. Can you help?" className="btn btn-whatsapp">
          <WhatsAppIcon className="size-4" /> Ask on WhatsApp
        </WhatsAppLink>
      </div>
      <p className="relative mt-8 text-center text-sm text-muted">
        Or read our{" "}
        <Link href="/blog" className="inline-flex items-center gap-1 font-semibold text-fg hover:underline">
          laptop buying guides <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </p>
    </div>
  );
}
