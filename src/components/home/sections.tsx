import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, BadgeCheck, CreditCard, MapPin, Navigation, Quote, RotateCcw, ShieldCheck, Truck, Wallet } from "lucide-react";
import type { Brand, Category, Testimonial } from "@/lib/types";
import { CategoryIcon } from "@/components/ui/category-icon";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { Stars } from "@/components/ui/stars";
import { WhatsAppIcon } from "@/components/layout/whatsapp-icon";
import { waLink } from "@/lib/site";
import { getSiteInfo } from "@/lib/repo/site-content";
import { primaryPhone, SOCIAL_NETWORKS } from "@/lib/site-info";
import { InlineText } from "@/components/content/inline-text";
import type { TrustBadgeText } from "@/lib/content/home";
import { cn } from "@/lib/utils";

export const TRUST_BADGES = [
  { icon: Wallet, title: "Cash on Delivery", text: "Pay when you receive", tone: "text-emerald-400" },
  { icon: Truck, title: "Delivery All Over Pakistan", text: "Karachi same / next day", tone: "text-sky-400" },
  { icon: ShieldCheck, title: "Warranty", text: "On every laptop & part", tone: "text-violet-400" },
  { icon: BadgeCheck, title: "Checked & Tested", text: "30+ point inspection", tone: "text-amber-400" },
  { icon: RotateCcw, title: "Easy Returns", text: "3-day replacement", tone: "text-rose-400" },
];

/** `items` overrides the badge texts (/cms → Online store → Home page); icons stay fixed per position. */
export function TrustBadges({ className, items }: { className?: string; items?: TrustBadgeText[] }) {
  const badges = TRUST_BADGES.map((b, i) => ({ ...b, title: items?.[i]?.title || b.title, text: items?.[i]?.text || b.text }));
  return (
    <ul className={cn("snap-row -mx-4 scroll-px-4 gap-3 px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-5", className)} aria-label="Why shop with us">
      {badges.map((b, i) => (
        <Reveal as="li" key={b.title} delay={i * 0.05} className="card flex w-[68%] items-center gap-3 p-3.5 sm:w-auto sm:p-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface-strong">
            <b.icon className={cn("size-5", b.tone)} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold leading-tight text-fg">{b.title}</span>
            <span className="block text-xs text-muted">{b.text}</span>
          </span>
        </Reveal>
      ))}
    </ul>
  );
}

/** Bento grid: the first two categories get large tiles, the rest fill in. */
export function CategoryBento({ categories, counts }: { categories: Category[]; counts: Record<string, number> }) {
  const tiles = categories.slice(0, 13);
  const layout = (i: number) =>
    i === 0 ? "col-span-2 row-span-2" : i === 1 ? "col-span-1 sm:col-span-2" : i === 2 ? "col-span-1 lg:row-span-2" : "col-span-1";
  const glows = ["from-blue-500/30", "from-violet-500/30", "from-cyan-500/25", "from-fuchsia-500/25", "from-emerald-500/20", "from-amber-500/20"];
  return (
    <div className="grid auto-rows-[7.25rem] grid-cols-3 gap-2.5 sm:auto-rows-[10.5rem] sm:gap-3 sm:grid-cols-4 lg:grid-cols-6 lg:gap-4">
      {tiles.map((c, i) => (
        <Reveal key={c.id} delay={(i % 6) * 0.04} className={layout(i)}>
          <Link
            href={`/category/${c.slug}`}
            className="group glow-hover card relative flex h-full flex-col justify-between overflow-hidden p-3 transition-transform duration-300 hover:-translate-y-1 sm:p-5"
          >
            <div className={cn("pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-gradient-to-br to-transparent blur-2xl transition-opacity duration-500 group-hover:opacity-100", glows[i % glows.length], i < 2 ? "opacity-80" : "opacity-40")} aria-hidden="true" />
            {/* Big tile: the category's own picture (/cms → Products → Categories → Image), else the built-in drawing. */}
            {i === 0 && (
              <Image
                src={c.image || "/images/hero/hero-business-laptops.svg"}
                alt=""
                width={360}
                height={360}
                sizes="(min-width: 1024px) 22rem, 60vw"
                className={cn(
                  "pointer-events-none absolute -right-10 top-2 w-[62%] max-w-[22rem] opacity-90 transition-transform duration-700 group-hover:-translate-y-2 group-hover:scale-105 sm:-right-6",
                  c.image && "max-h-[70%] rounded-2xl object-contain"
                )}
              />
            )}
            <span className={cn("relative grid place-items-center rounded-2xl bg-surface-strong text-fg transition-colors group-hover:bg-brand-gradient group-hover:text-white", i === 0 ? "size-14 sm:size-16" : "size-10 sm:size-12")}>
              <CategoryIcon name={c.icon} className={i === 0 ? "size-7 sm:size-8" : "size-5 sm:size-6"} />
            </span>
            <span className="relative">
              <span className={cn("block font-display font-bold leading-tight text-fg", i === 0 ? "text-xl sm:text-3xl" : "text-[0.8rem] sm:text-lg")}>{c.name}</span>
              {i < 3 && <span className={cn("mt-1 line-clamp-2 text-xs text-muted sm:text-sm", i === 0 ? "block" : "hidden sm:block")}>{c.shortDescription}</span>}
              <span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-muted sm:mt-1.5 sm:text-xs">
                {counts[c.id] ?? 0} {counts[c.id] === 1 ? "product" : "products"}
                <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </span>
          </Link>
        </Reveal>
      ))}
    </div>
  );
}

export function BrandStrip({ brands }: { brands: Brand[] }) {
  const list = brands.filter((b) => b.slug !== "urko");
  const row = [...list, ...list];
  return (
    <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]">
      <ul className="animate-marquee flex w-max gap-3 py-2 hover:[animation-play-state:paused]">
        {row.map((b, i) => (
          <li key={`${b.slug}-${i}`} aria-hidden={i >= list.length ? true : undefined}>
            <Link
              href={`/brands/${b.slug}`}
              tabIndex={i >= list.length ? -1 : undefined}
              className="card flex h-16 min-w-36 items-center justify-center px-6 font-display text-lg font-bold tracking-tight text-muted transition hover:border-violet-500/50 hover:text-fg"
            >
              {b.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Testimonials({ items }: { items: Testimonial[] }) {
  return (
    <div className="snap-row -mx-4 scroll-px-4 px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-4 lg:overflow-visible lg:px-0">
      {items.map((t, i) => (
        <Reveal key={t.name} delay={(i % 3) * 0.06} as="article" className="card relative w-[85%] p-6 sm:w-[60%] lg:w-auto">
          <Quote className="absolute right-5 top-5 size-8 text-violet-500/25" aria-hidden="true" />
          <Stars rating={t.rating} size="md" />
          <p className="mt-4 text-[0.95rem] leading-relaxed text-fg/90">“{t.text}”</p>
          <div className="mt-5 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-brand-gradient text-sm font-bold text-white" aria-hidden="true">
              {t.name
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)}
            </span>
            <span>
              <span className="block text-sm font-semibold text-fg">{t.name}</span>
              <span className="block text-xs text-muted">
                {t.city}
                {t.product ? ` · ${t.product}` : ""}
              </span>
            </span>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

/**
 * "Follow us" – one card per social profile set in /cms → Settings → Store details (no made-up posts).
 * Nothing is shown when no profile is filled in.
 */
export async function SocialFeed() {
  const site = await getSiteInfo();
  const tones = ["from-sky-500/40 to-violet-500/40", "from-violet-500/40 to-fuchsia-500/40", "from-fuchsia-500/40 to-orange-500/40", "from-emerald-500/40 to-sky-500/40"];
  const profiles = SOCIAL_NETWORKS.filter((n) => site.social[n.key]).map((n) => ({ ...n, url: site.social[n.key] as string, handle: handleOf(site.social[n.key] as string) }));
  if (!profiles.length) return null;
  return (
    <div className={cn("grid gap-3", profiles.length > 2 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2")}>
      {profiles.slice(0, 4).map((p, i) => (
        <Reveal key={p.key} delay={i * 0.04}>
          <a href={p.url} target="_blank" rel="noopener noreferrer" className="group relative block overflow-hidden rounded-2xl border border-border p-5 sm:p-6">
            <div className={cn("absolute inset-0 bg-gradient-to-br opacity-70 transition-transform duration-700 group-hover:scale-110", tones[i % tones.length])} aria-hidden="true" />
            <div className="relative">
              <p className="text-xs font-bold uppercase tracking-wider text-white/80">{p.label}</p>
              <p className="mt-1 font-display text-lg font-bold text-white">{p.handle}</p>
              <p className="mt-3 text-sm font-semibold text-white">Follow us →</p>
            </div>
          </a>
        </Reveal>
      ))}
    </div>
  );
}

const handleOf = (url: string) => {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, "").split("/").filter(Boolean).pop() ?? "";
    return path ? (path.startsWith("@") ? path : `@${path}`) : new URL(url).hostname;
  } catch {
    return url;
  }
};

export async function StoreLocation({
  eyebrow = "Visit our store",
  title = "Laptop shop in Saddar, Karachi",
  description,
}: { eyebrow?: string; title?: string; description?: string } = {}) {
  const site = await getSiteInfo(); // live business profile (/cms → Settings → Store details)
  const phone = primaryPhone(site);
  return (
    <div className="grid overflow-hidden rounded-[1.75rem] border border-border lg:grid-cols-5">
      <div className="relative bg-bg-elevated p-6 sm:p-10 lg:col-span-2">
        <div className="pointer-events-none absolute -left-20 -top-20 size-72 rounded-full bg-violet-600/20 blur-3xl" aria-hidden="true" />
        <SectionHeading eyebrow={eyebrow} title={title} className="relative !mb-4" />
        {description ? (
          <p className="relative text-muted">
            <InlineText text={description} />
          </p>
        ) : (
          <p className="relative text-muted">
            Come check laptops in person at the heart of Karachi&apos;s <strong className="text-fg">Regal Chowk laptop market</strong>. Free SSD & RAM
            installation when you buy from us.
          </p>
        )}
        <address className="relative mt-6 space-y-3 text-sm not-italic">
          <p className="flex gap-3">
            <MapPin className="mt-0.5 size-5 shrink-0 text-violet-400" aria-hidden="true" />
            <span className="text-fg">{site.address.full}</span>
          </p>
          <p className="pl-8 text-muted">{site.hoursDisplay}</p>
        </address>
        <div className="relative mt-6 flex flex-wrap gap-2">
          <a href={site.mapLink} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
            <Navigation className="size-4" aria-hidden="true" /> Get directions
          </a>
          <a href={waLink(phone.wa, "Hi! I want to visit your store. Is this laptop available?")} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp">
            <WhatsAppIcon className="size-4" /> Check availability
          </a>
        </div>
      </div>
      <div className="relative min-h-[18rem] lg:col-span-3">
        <iframe
          title={`${site.name} location on Google Maps – ${site.address.full}`}
          src={site.mapEmbed}
          className="absolute inset-0 size-full border-0 grayscale-[30%] invert-[0.9] hue-rotate-180 light:invert-0 light:hue-rotate-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
    </div>
  );
}

export function InstallmentBanner({
  eyebrow = "Easy payments",
  title = "Easy installment plans",
  description = "Buy your next laptop on easy monthly installments with partner banks. Ask us on WhatsApp for current options.",
  linkLabel = "Installment plan details",
  linkHref = "/installments",
}: { eyebrow?: string; title?: string; description?: string; linkLabel?: string; linkHref?: string } = {}) {
  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-border bg-gradient-to-br from-blue-600/20 via-violet-600/20 to-fuchsia-600/10 p-6 sm:p-10">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
      <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div className="flex items-start gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand-gradient text-white">
            <CreditCard className="size-7" aria-hidden="true" />
          </span>
          <div>
            {eyebrow && <p className="chip mb-2 text-amber-400">{eyebrow}</p>}
            <h2 className="text-2xl font-bold text-fg sm:text-3xl">{title}</h2>
            {description && <p className="mt-1 max-w-xl text-muted">{description}</p>}
          </div>
        </div>
        <Link href={linkHref} className="btn btn-secondary btn-lg shrink-0">
          {linkLabel}
        </Link>
      </div>
    </div>
  );
}
