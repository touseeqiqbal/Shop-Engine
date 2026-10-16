import type { Metadata } from "next";
import { ShopEngineLogo } from "@/components/marketing/logo";
import { CtaBand, PageHero } from "@/components/marketing/sections";
import { breadcrumbLd, ldJson, marketingOrigin, pageMeta } from "@/lib/marketing/seo";

const CRUMBS = [{ name: "About", path: "/about" }];

export function generateMetadata(): Metadata {
  return pageMeta({
    title: "About",
    description: "ShopEngine is the engine that powers shops: one platform for launching and running independent online stores, built around how merchants actually sell.",
    path: "/about",
  });
}

const PRINCIPLES = [
  { title: "Every store is its own business", text: "Separate data, settings, teams and billing for each store – sharing only what makes the work lighter." },
  { title: "Sell the way your customers pay", text: "Cash on delivery, transfers and local wallets are first-class, not an afterthought behind cards." },
  { title: "Honest by default", text: "We show what the platform does today and label what's planned. No invented numbers, no surprises." },
  { title: "Safe at the core", text: "Isolation, role checks and server-verified payments are part of the engine, not optional extras." },
];

export default async function AboutPage() {
  const origin = await marketingOrigin();
  return (
    <>
      <PageHero crumbs={CRUMBS} eyebrow="About ShopEngine" title="The engine that powers shops" lead="ShopEngine is one platform for launching and running independent online stores – so merchants can spend their time on products and customers instead of on software." />

      <section className="mk-section">
        <div className="mk-container grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div className="mk-prose max-w-none">
            <h2 className="!mt-0">Why we built it</h2>
            <p>Running an online store means much more than a nice storefront. There are orders to confirm, parcels to ship, payments to check, staff to manage and stock to keep right – and the work multiplies with every new brand or market.</p>
            <p>ShopEngine grew out of that day-to-day work. It puts the storefront, the back office and the shop counter in one place, and lets the same account run several stores without mixing them up.</p>
            <h2>What ShopEngine is today</h2>
            <p>A multi-store ecommerce platform with storefronts, products and stock, orders and returns, local and card payments, delivery zones, team roles, a point of sale, reports, notifications and subscription billing – with each store in its own currency and time zone.</p>
          </div>
          <div className="mk-card relative grid place-items-center overflow-hidden p-12 sm:p-16">
            <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_50%,rgba(116,102,255,0.3),transparent_70%)]" />
            <div aria-hidden="true" className="mk-dots-bg absolute inset-0" />
            <ShopEngineLogo size={64} onDark className="relative" />
            <p className="relative mt-4 text-sm text-faint">The engine that powers shops</p>
          </div>
        </div>
      </section>

      <section className="mk-section border-y border-white/[0.06] bg-canvas/60" aria-labelledby="principles">
        <div className="mk-container">
          <h2 id="principles" className="mk-h2 text-[clamp(1.9rem,3.4vw,2.75rem)]">
            What we believe
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {PRINCIPLES.map((p) => (
              <article key={p.title} className="mk-card p-6">
                <h3 className="mk-h3">{p.title}</h3>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-body">{p.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <CtaBand />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(breadcrumbLd(origin, CRUMBS)) }} />
    </>
  );
}
