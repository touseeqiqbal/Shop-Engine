import type { Metadata } from "next";
import Link from "next/link";
import {
  BatteryCharging,
  Cpu,
  Keyboard,
  Laptop,
  MonitorCheck,
  PackageCheck,
  PlugZap,
  ScanSearch,
  ShieldCheck,
  Thermometer,
  Truck,
  Wifi,
} from "lucide-react";
import { PageHero } from "@/components/content/page-hero";
import { WhatsAppCta } from "@/components/content/whatsapp-cta";
import { StoreLocation, TrustBadges } from "@/components/home/sections";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { InlineText } from "@/components/content/inline-text";
import { Markdown } from "@/components/ui/markdown";
import { getPageMeta } from "@/lib/page-seo";
import { getResolvedPageContent } from "@/lib/repo/site-content";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return getPageMeta("/about");
}

const STATS = [
  { value: "30+", label: "point inspection on every used laptop" },
  { value: "1–5 days", label: "delivery to any city in Pakistan" },
  { value: "Warranty", label: "on every laptop and part" },
  { value: "COD", label: "Cash on Delivery nationwide" },
];

const WHAT_WE_SELL = [
  { icon: Laptop, title: "New, used & refurbished laptops", text: "HP EliteBook & ProBook, Dell Latitude & XPS, Lenovo ThinkPad, MacBook Air and gaming laptops from Asus & MSI.", href: "/category/laptops" },
  { icon: PlugZap, title: "Chargers & adapters", text: "Original-quality chargers for HP, Dell and Lenovo, USB-C PD adapters and universal multi-tip chargers.", href: "/category/chargers" },
  { icon: BatteryCharging, title: "Laptop batteries", text: "Replacement batteries for popular models – installed free at our Saddar shop.", href: "/category/batteries" },
  { icon: Keyboard, title: "Keyboards & mouse", text: "Mechanical gaming keyboards, wireless office sets, gaming mouse and laptop replacement keyboards.", href: "/category/keyboards" },
  { icon: Cpu, title: "SSD & RAM upgrades", text: "NVMe & SATA SSDs and DDR4 / DDR5 laptop RAM – the fastest way to make an old laptop feel new.", href: "/category/storage" },
  { icon: Wifi, title: "Networking & accessories", text: "Routers, Wi-Fi adapters, USB-C hubs, monitors, webcams, headsets, bags and cooling pads.", href: "/category/laptop-accessories" },
];

const PROCESS = [
  { icon: ScanSearch, title: "Inspect", text: "Body, hinges, screen and ports are inspected and graded honestly as Used A+, Used A or Refurbished." },
  { icon: BatteryCharging, title: "Battery report", text: "We record the real battery health percentage and replace weak batteries on refurbished units." },
  { icon: MonitorCheck, title: "Display & keyboard", text: "Dead-pixel, backlight and key-by-key tests, plus webcam, mic and speakers." },
  { icon: Thermometer, title: "Stress test", text: "CPU, SSD and thermals are load-tested so there are no surprises after delivery." },
  { icon: ShieldCheck, title: "Clean install", text: "Fresh Windows setup with drivers, then a final clean and quality check before listing." },
  { icon: PackageCheck, title: "Pack & ship", text: "Bubble-wrapped, boxed and dispatched with tracking via trusted couriers all over Pakistan." },
];

export default async function AboutPage() {
  // Hero + story are editable in /cms → Online store → Page texts.
  const c = await getResolvedPageContent("/about");
  return (
    <div className="pb-16">
      <PageHero
        crumbs={[{ name: "About us", href: "/about" }]}
        eyebrow={c.eyebrow || undefined}
        title={<InlineText text={c.title} />}
        description={
          <p>
            <InlineText text={c.description} />
          </p>
        }
      >
        <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="card p-4">
              <dt className="sr-only">{s.label}</dt>
              <dd>
                <span className="block font-display text-2xl font-bold text-fg sm:text-3xl">{s.value}</span>
                <span className="mt-1 block text-xs text-muted">{s.label}</span>
              </dd>
            </div>
          ))}
        </dl>
      </PageHero>

      <div className="container-x mt-12 space-y-16 sm:mt-16 sm:space-y-24">
        {/* Story */}
        <section className="grid gap-8 lg:grid-cols-2 lg:gap-14" aria-labelledby="story-heading">
          <div>
            <SectionHeading eyebrow="From Regal Chowk to your doorstep" title={<span id="story-heading">Built on honest advice</span>} className="!mb-4" />
            <Markdown content={c.body} />
          </div>
          <Reveal className="relative overflow-hidden rounded-[1.75rem] border border-border bg-bg-elevated p-6 sm:p-10">
            <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-cyan-500/20 blur-3xl" aria-hidden="true" />
            <h3 className="relative text-xl font-bold text-fg">Why customers choose us</h3>
            <ul className="relative mt-5 space-y-4 text-sm text-muted">
              {[
                ["Honest grading", "Used A+, Used A, Refurbished and New – clearly labelled with real photos and notes."],
                ["Right part, first time", "Our Find Parts tool and WhatsApp support match chargers, batteries and RAM to your exact model."],
                ["Fair laptop prices in Pakistan", "Prices are updated daily to stay in line with the market."],
                ["Free installation", "SSD, RAM and battery installation free at our Saddar shop when you buy from us."],
                ["Real after-sales", "A physical shop you can walk into – not just a page on social media."],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-3">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-400" aria-hidden="true" />
                  <span>
                    <strong className="text-fg">{t}.</strong> {d}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        </section>

        {/* What we sell */}
        <section aria-labelledby="sell-heading">
          <SectionHeading
            eyebrow="What we sell"
            title={<span id="sell-heading">Everything for your laptop, under one roof</span>}
            description="From a complete laptop to the smallest replacement part."
            href="/category"
            hrefLabel="All categories"
          />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WHAT_WE_SELL.map((w, i) => (
              <Reveal as="li" key={w.title} delay={(i % 3) * 0.05}>
                <Link href={w.href} className="glow-hover card group flex h-full flex-col gap-3 p-6 transition-transform hover:-translate-y-1">
                  <span className="grid size-12 place-items-center rounded-2xl bg-surface-strong transition-colors group-hover:bg-brand-gradient group-hover:text-white">
                    <w.icon className="size-6" aria-hidden="true" />
                  </span>
                  <h3 className="text-lg font-bold text-fg">{w.title}</h3>
                  <p className="text-sm text-muted">{w.text}</p>
                </Link>
              </Reveal>
            ))}
          </ul>
        </section>

        {/* Process */}
        <section aria-labelledby="process-heading" className="relative overflow-hidden rounded-[1.75rem] border border-border bg-bg-elevated p-6 sm:p-10">
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />
          <div className="relative">
            <SectionHeading
              eyebrow="Checked & tested"
              title={<span id="process-heading">Our 30+ point testing process</span>}
              description="Every used and refurbished laptop goes through the same checklist before it's listed – the results go into the product's condition notes."
            />
            <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PROCESS.map((p, i) => (
                <li key={p.title} className="card relative p-5">
                  <span className="absolute right-5 top-4 font-display text-3xl font-bold text-fg/10">{String(i + 1).padStart(2, "0")}</span>
                  <p.icon className="size-6 text-sky-400" aria-hidden="true" />
                  <h3 className="mt-3 font-bold text-fg">{p.title}</h3>
                  <p className="mt-1 text-sm text-muted">{p.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-label="Our promises">
          <TrustBadges />
        </section>

        <section className="grid gap-4 md:grid-cols-3" aria-label="Delivery and policies">
          {[
            { icon: Truck, title: "Delivery all over Pakistan", text: "Karachi same / next day; major cities 1–3 days; other areas 3–5 days.", href: "/shipping-policy", cta: "Shipping policy" },
            { icon: ShieldCheck, title: "Warranty you can use", text: "Checking warranty on used laptops, up to 6 months on refurbished, brand warranty on new.", href: "/warranty-returns", cta: "Warranty & returns" },
            { icon: PackageCheck, title: "Questions answered", text: "Payments, COD, delivery, grades and returns – all explained.", href: "/faqs", cta: "Read FAQs" },
          ].map((c) => (
            <Link key={c.title} href={c.href} className="glow-hover card group p-6">
              <c.icon className="size-6 text-violet-400" aria-hidden="true" />
              <h2 className="mt-3 text-lg font-bold text-fg">{c.title}</h2>
              <p className="mt-1 text-sm text-muted">{c.text}</p>
              <span className="mt-3 inline-block text-sm font-semibold text-fg group-hover:underline">{c.cta} →</span>
            </Link>
          ))}
        </section>

        <section aria-label="Store location">
          <StoreLocation />
        </section>

        <WhatsAppCta title="Visit us or message us on WhatsApp" message="Hi Urko Tech Store! I'd like to visit your Saddar shop." />
      </div>
    </div>
  );
}
