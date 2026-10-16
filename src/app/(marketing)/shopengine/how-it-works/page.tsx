import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { CtaBand, PageHero } from "@/components/marketing/sections";
import { SITE } from "@/lib/marketing/content";
import { breadcrumbLd, ldJson, marketingOrigin, pageMeta } from "@/lib/marketing/seo";

const CRUMBS = [{ name: "How it works", path: "/how-it-works" }];

export function generateMetadata(): Metadata {
  return pageMeta({
    title: "How it works",
    description: "From sign-up to your first order: create a ShopEngine account, launch a store, set up products, payments and delivery, then publish and grow.",
    path: "/how-it-works",
  });
}

const STAGES = [
  {
    title: "Create your account",
    text: "Sign up with your name, email address and a password, then confirm your email from the message we send. One account is all you need for every store you run or work on.",
    points: ["Email confirmation before a store can be opened", "Sign in again any time under “Your stores”"],
    cta: { label: "Create an account", href: SITE.signUp },
  },
  {
    title: "Launch your store",
    text: "Under “Your stores”, give the store a name and a web address, choose its country and pick a plan. The country sets the store's currency, time zone and the address form at checkout.",
    points: ["A web address on the ShopEngine domain straight away", "A free trial on plans that offer one", "The store starts as a draft, hidden from shoppers"],
  },
  {
    title: "Configure your business",
    text: "Open the store's admin to add products and photos, set delivery zones and fees, choose payment methods, apply your logo and colours, write your pages and invite your team.",
    points: ["Payment methods suggested for your country", "Fee tester to check delivery charges for any address", "Your own domain and card payments on plans that include them"],
  },
  {
    title: "Publish and grow",
    text: "When everything looks right, publish the store. Take orders online and, on plans with the shop counter, in person – then follow sales, profit and stock in your reports.",
    points: ["Order, shipping and delivery messages to customers", "Abandoned-cart reminders on plans that include them", "Add another store whenever you're ready"],
  },
];

const AFTER_TRIAL = [
  { title: "Trial", text: "The store works in full while the trial runs." },
  { title: "Paid", text: "Pay the plan and the store keeps running – monthly or yearly." },
  { title: "Grace period", text: "If a payment fails, the store keeps running for a grace period (seven days by default)." },
  { title: "Paused", text: "After the grace period the store goes offline and its admin becomes read-only. Nothing is deleted – paying brings it back." },
];

export default async function HowItWorksPage() {
  const origin = await marketingOrigin();
  return (
    <>
      <PageHero crumbs={CRUMBS} eyebrow="How it works" title="From sign-up to your first order" lead="ShopEngine runs the servers, security and updates. You bring the products and the customers – here's what the journey looks like." />

      <section className="mk-section">
        <div className="mk-container">
          <ol className="relative space-y-6 before:absolute before:bottom-6 before:left-6 before:top-6 before:w-px before:bg-gradient-to-b before:from-[#3d86ff] before:via-[#7466ff]/50 before:to-transparent sm:before:left-7">
            {STAGES.map((s, i) => (
              <li key={s.title} className="relative grid gap-5 pl-16 sm:pl-20">
                <span className="absolute left-0 top-0 grid size-12 place-items-center rounded-full bg-gradient-to-br from-[#3d86ff] via-[#5b48f6] to-[#a173ff] text-lg font-semibold text-white shadow-[0_0_30px_-4px_rgba(116,102,255,0.9)] sm:size-14">{i + 1}</span>
                <div className="mk-card p-6 sm:p-8">
                  <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{s.title}</h2>
                  <p className="mk-text mt-3 max-w-3xl">{s.text}</p>
                  <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
                    {s.points.map((p) => (
                      <li key={p} className="flex gap-2.5 text-[0.9375rem] text-ink-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-brand-200" aria-hidden="true" />
                        {p}
                      </li>
                    ))}
                  </ul>
                  {s.cta && (
                    <Link href={s.cta.href} className="mk-btn mk-btn-primary mt-6">
                      {s.cta.label} <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mk-section border-y border-white/[0.06] bg-canvas/60" aria-labelledby="after-trial">
        <div className="mk-container">
          <h2 id="after-trial" className="mk-h2 text-[clamp(1.9rem,3.4vw,2.75rem)]">
            What happens after the trial
          </h2>
          <p className="mk-text mt-3 max-w-2xl">Each store’s plan is handled on its own, so one store’s billing never affects another.</p>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {AFTER_TRIAL.map((a, i) => (
              <li key={a.title} className="mk-card p-5">
                <span className="text-xs font-semibold text-faint">Stage {i + 1}</span>
                <h3 className="mt-2 font-semibold text-ink">{a.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-body">{a.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <CtaBand />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(breadcrumbLd(origin, CRUMBS)) }} />
    </>
  );
}
