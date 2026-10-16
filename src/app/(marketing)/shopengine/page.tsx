import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, CircleDashed, MessageCircleQuestion } from "lucide-react";
import { DashboardMockup } from "@/components/marketing/dashboard-mockup";
import { BentoFeatures, PaymentsMarquee } from "@/components/marketing/bento";
import { PricingCards } from "@/components/marketing/pricing";
import { Audiences, Comparison, CtaBand, FaqList, HeroBackdrop, MultiStoreDiagram, SectionHeader, SecurityVisual, Steps } from "@/components/marketing/sections";
import { FAQS, FEATURES, PLANNED, SECURITY_POINTS, SITE } from "@/lib/marketing/content";
import { pricingPlans } from "@/lib/marketing/plans";
import { ldJson, marketingOrigin, pageMeta, softwareLd } from "@/lib/marketing/seo";
import { COUNTRY_CODES } from "@/lib/locale";

export const revalidate = 300;

export function generateMetadata(): Metadata {
  return pageMeta({
    title: "ShopEngine – Multi-store ecommerce platform",
    description: "Launch, manage and grow multiple online stores from one platform. Products, orders, payments, teams, point of sale and billing – each store fully independent.",
    path: "/",
  });
}

// real figures only: counted from the code, never invented
const countries = Math.floor(COUNTRY_CODES.length / 10) * 10;
const FACTS = [
  { v: String(FEATURES.length), l: "features built in, from storefront to point of sale" },
  { v: `${countries}+`, l: "countries – currency, time zone and phone format set for you" },
  { v: "1", l: "sign-in for every store you run or work on" },
  { v: "0", l: "servers to set up and no code to write" },
];

export default async function HomePage() {
  const [plans, origin] = await Promise.all([pricingPlans(), marketingOrigin()]);
  return (
    <>
      {/* ───────────── hero ───────────── */}
      <section className="relative isolate overflow-hidden">
        <HeroBackdrop tall />
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 bg-[radial-gradient(closest-side,rgba(116,102,255,0.35),transparent)]" />
        <div className="mk-container relative pb-24 pt-32 sm:pt-44 lg:pb-32">
          <div className="mx-auto max-w-6xl text-center">
            <Link href="/features#payments" className="group inline-flex animate-rise items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-3 text-[13px] text-ink-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:border-white/20 hover:text-white">
              <span className="rounded-full bg-gradient-to-r from-[#3d86ff] to-[#a173ff] px-2 py-0.5 text-[11px] font-semibold text-white">New</span>
              Sell in any currency, in {countries}+ countries
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
            <h1 className="mk-h1 mt-8 animate-rise [animation-delay:80ms]">
              Every store you need.
              <br />
              <span className="mk-gradient-text mk-shine">One platform to run them all.</span>
            </h1>
            <p className="mk-lead mx-auto mt-7 max-w-2xl animate-rise [animation-delay:160ms]">
              ShopEngine helps you launch, manage and grow multiple online stores from one place – products, orders, payments, teams and subscriptions – while every store keeps its own brand, domain and settings.
            </p>
            <div className="mt-10 flex animate-rise flex-col items-center justify-center gap-3 [animation-delay:240ms] sm:flex-row">
              <Link href={SITE.signUp} className="mk-btn mk-btn-primary mk-btn-lg w-full sm:w-auto">
                Start free trial <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link href="/features" className="mk-btn mk-btn-secondary mk-btn-lg w-full sm:w-auto">
                Explore the platform
              </Link>
            </div>
            <ul className="mt-8 flex animate-rise flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-faint [animation-delay:320ms]">
              {["Nothing to install or host", "Your own store address from day one", "Online and in-store, one stock count"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="size-4 text-ok" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative mx-auto mt-20 max-w-6xl animate-rise [animation-delay:380ms]">
            <DashboardMockup />
          </div>
        </div>
      </section>

      {/* ───────────── payments & currencies ───────────── */}
      <section aria-labelledby="markets" className="relative border-y border-white/[0.06] bg-canvas/60 py-14">
        <div className="mk-container">
          <p id="markets" className="text-center text-sm text-faint">
            Get paid the way your customers pay – <span className="text-ink-2">in their own currency</span>
          </p>
        </div>
        <div className="mt-8">
          <PaymentsMarquee />
        </div>
      </section>

      {/* ───────────── real figures ───────────── */}
      <section aria-label="ShopEngine in numbers" className="mk-container pt-20">
        <dl className="mk-reveal grid overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.02] sm:grid-cols-2 lg:grid-cols-4">
          {FACTS.map((f, i) => (
            <div key={f.l} className={`p-7 ${i > 0 ? "border-t border-white/[0.08] sm:border-t-0" : ""} ${i % 2 === 1 ? "sm:border-l sm:border-white/[0.08]" : ""} ${i >= 2 ? "sm:border-t lg:border-t-0" : ""} ${i > 0 ? "lg:border-l lg:border-white/[0.08]" : ""}`}>
              <dt className="sr-only">{f.l}</dt>
              <dd>
                <span className="block bg-gradient-to-b from-white to-white/60 bg-clip-text text-5xl font-semibold tracking-[-0.05em] text-transparent">{f.v}</span>
                <span className="mt-3 block text-sm leading-relaxed text-body">{f.l}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ───────────── the problem ───────────── */}
      <section className="mk-section" aria-labelledby="problem">
        <div className="mk-container grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="mk-reveal">
            <p className="mk-eyebrow">Why ShopEngine</p>
            <h2 id="problem" className="mk-h2 mt-5">
              Less complexity.
              <br />
              <span className="mk-gradient-text">More commerce.</span>
            </h2>
            <p className="mk-lead mt-6">
              Managing several stores often means separate dashboards, repeated setup, disconnected data and inconsistent operations. ShopEngine brings everything into one place, so you can focus on growing your business instead of managing your tools.
            </p>
            <Link href="/how-it-works" className="mk-link mt-8 inline-flex items-center gap-1.5">
              See how it works <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <Comparison />
        </div>
      </section>

      {/* ───────────── features ───────────── */}
      <section className="mk-section pt-0" aria-labelledby="features">
        <div className="mk-container">
          <SectionHeader
            id="features"
            eyebrow="The platform"
            title={
              <>
                Everything a store needs.
                <br className="hidden sm:block" /> <span className="mk-gradient-text">Built in.</span>
              </>
            }
            lead="From the first product to the thousandth order – the tools to sell online and in person, for every store you run."
          />
          <BentoFeatures />
          <p className="mt-12 text-center">
            <Link href="/features" className="mk-btn mk-btn-secondary">
              See every feature <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </p>
        </div>
      </section>

      {/* ───────────── one engine, independent stores ───────────── */}
      <section className="mk-section overflow-hidden" aria-labelledby="multi-store">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_40%_at_50%_60%,rgba(91,72,246,0.16),transparent_70%)]" />
        <div className="mk-container relative">
          <SectionHeader
            id="multi-store"
            eyebrow="Multi-store"
            title={
              <>
                One engine.
                <br className="hidden sm:block" /> <span className="mk-gradient-text">Independent businesses.</span>
              </>
            }
            lead="Launch stores with their own brand, address, catalogue, currency, customers, payment methods, team and settings – while you keep one account and one place to manage them."
          />
          <MultiStoreDiagram />
          <p className="mt-6 text-center text-xs text-faint">Example stores for illustration.</p>
        </div>
      </section>

      {/* ───────────── how it works ───────────── */}
      <section className="mk-section pt-0" aria-labelledby="how">
        <div className="mk-container">
          <SectionHeader id="how" eyebrow="How it works" title="From sign-up to first order in four steps" lead="No servers to set up and no code to write." />
          <Steps />
          <p className="mt-12 text-center">
            <Link href={SITE.signUp} className="mk-btn mk-btn-primary">
              Create your account <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </p>
        </div>
      </section>

      {/* ───────────── who it's for ───────────── */}
      <section className="mk-section pt-0" aria-labelledby="who">
        <div className="mk-container">
          <SectionHeader id="who" eyebrow="Who it’s for" title="Built for the way you sell" lead="Whether it’s your first store or your fifth, one shop or a counter and a website." />
          <Audiences />
        </div>
      </section>

      {/* ───────────── security ───────────── */}
      <section className="mk-section border-y border-white/[0.06] bg-canvas/60" aria-labelledby="security">
        <div className="mk-container grid items-center gap-14 lg:grid-cols-2">
          <div className="mk-reveal">
            <p className="mk-eyebrow">Security & reliability</p>
            <h2 id="security" className="mk-h2 mt-5">
              Every store separate.
              <br />
              <span className="mk-gradient-text">Every store secure.</span>
            </h2>
            <p className="mk-lead mt-6">Each store’s data is isolated, every action is checked against the person’s role, and payments are only marked paid when the provider confirms them.</p>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {SECURITY_POINTS.map((p) => (
                <li key={p.title} className="flex items-center gap-2.5 text-sm text-ink-2">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-ok-50">
                    <Check className="size-3 text-ok" aria-hidden="true" />
                  </span>
                  {p.title}
                </li>
              ))}
            </ul>
            <Link href="/security" className="mk-link mt-9 inline-flex items-center gap-1.5">
              How ShopEngine protects stores <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mk-reveal">
            <SecurityVisual />
          </div>
        </div>
      </section>

      {/* ───────────── pricing ───────────── */}
      <section className="mk-section" aria-labelledby="pricing">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/3 h-[500px] bg-[radial-gradient(40%_50%_at_50%_50%,rgba(91,72,246,0.18),transparent_70%)]" />
        <div className="mk-container relative">
          <SectionHeader id="pricing" eyebrow="Pricing" title="Plans that grow with you" lead="Every store is on its own plan, with its trial, limits and features shown on the plan. Change plans as you grow." />
          <PricingCards plans={plans} />
          <p className="mt-12 text-center">
            <Link href="/pricing" className="mk-link inline-flex items-center gap-1.5">
              Compare plans in detail <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </p>
        </div>
      </section>

      {/* ───────────── planned (honest roadmap) ───────────── */}
      <section className="pb-8" aria-labelledby="planned">
        <div className="mk-container">
          <div className="mk-reveal flex flex-col gap-5 rounded-3xl border border-dashed border-white/[0.12] p-6 sm:p-8 lg:flex-row lg:items-center">
            <div className="lg:w-64 lg:shrink-0">
              <h2 id="planned" className="text-lg font-semibold tracking-tight text-ink">
                On the roadmap
              </h2>
              <p className="mt-1 text-sm text-faint">Planned, not available yet – so you know exactly what you get today.</p>
            </div>
            <ul className="flex flex-wrap gap-2">
              {PLANNED.map((p) => (
                <li key={p} className="mk-chip py-1.5">
                  <CircleDashed className="size-3.5 text-faint" aria-hidden="true" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ───────────── FAQ ───────────── */}
      <section className="mk-section" aria-labelledby="faq">
        <div className="mk-container grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="mk-reveal lg:sticky lg:top-28 lg:self-start">
            <p className="mk-eyebrow">FAQ</p>
            <h2 id="faq" className="mk-h2 mt-5">
              Questions,
              <br />
              answered.
            </h2>
            <p className="mk-lead mt-6">Everything about stores, payments, plans and trials. Can’t find it?</p>
            <div className="mk-card mt-8 flex items-center gap-4 p-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-200">
                <MessageCircleQuestion className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-medium text-ink">Talk to the ShopEngine team</p>
                <Link href="/contact" className="mk-link mt-0.5 inline-flex items-center gap-1 text-sm">
                  Send a message <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
          <FaqList items={FAQS} className="mk-reveal" />
        </div>
      </section>

      {/* ───────────── final call to action ───────────── */}
      <CtaBand />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(softwareLd(origin)) }} />
    </>
  );
}
