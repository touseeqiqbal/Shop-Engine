import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, CircleDashed } from "lucide-react";
import { FEATURE_PICTURES } from "@/components/marketing/bento";
import { CtaBand, FeatureIcon, PageHero } from "@/components/marketing/sections";
import { FEATURES, PLANNED, SITE } from "@/lib/marketing/content";
import { breadcrumbLd, ldJson, marketingOrigin, pageMeta } from "@/lib/marketing/seo";

const CRUMBS = [{ name: "Features", path: "/features" }];

export function generateMetadata(): Metadata {
  return pageMeta({
    title: "Features",
    description: "Every ShopEngine feature: multi-store management, storefronts, products and stock, orders, local and card payments, shipping zones, teams, point of sale, reports, billing and notifications.",
    path: "/features",
  });
}

export default async function FeaturesPage() {
  const origin = await marketingOrigin();
  return (
    <>
      <PageHero
        crumbs={CRUMBS}
        eyebrow="Features"
        title={
          <>
            The complete toolkit for <span className="mk-gradient-text">every store you run</span>
          </>
        }
        lead="Everything below is part of ShopEngine today. Features that depend on your plan – such as your own domain, card payments or the shop counter – are marked on the pricing page."
      >
        <nav aria-label="Jump to a feature" className="mt-10 flex flex-wrap gap-2">
          {FEATURES.map((f) => (
            <a key={f.id} href={`#${f.id}`} className="mk-chip px-3.5 py-1.5 transition-colors hover:border-white/20 hover:text-white">
              {f.title}
            </a>
          ))}
        </nav>
      </PageHero>

      <section className="pb-24">
        <div className="mk-container space-y-5">
          {FEATURES.map((f, i) => {
            const Picture = FEATURE_PICTURES[f.id];
            return (
              <article key={f.id} id={f.id} className="mk-card mk-spot mk-reveal grid scroll-mt-28 gap-8 p-6 sm:p-10 lg:grid-cols-2 lg:items-center lg:gap-14">
                <div className={i % 2 ? "lg:order-2" : ""}>
                  <div className="flex items-center gap-3">
                    <FeatureIcon name={f.icon} />
                    <span className="mk-kbd text-xs text-faint">{String(i + 1).padStart(2, "0")} / {FEATURES.length}</span>
                  </div>
                  <h2 className="mt-6 text-[clamp(1.6rem,2.6vw,2.1rem)] font-semibold leading-tight tracking-[-0.035em] text-ink">{f.title}</h2>
                  <p className="mk-text mt-3 max-w-xl">{f.text}</p>
                  <ul className="mt-6 space-y-3">
                    {f.points.map((p) => (
                      <li key={p} className="flex gap-3 text-[0.9375rem] text-ink-2">
                        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-100">
                          <Check className="size-3 text-brand-200" aria-hidden="true" />
                        </span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                {Picture && (
                  <div aria-hidden="true" className={`relative ${i % 2 ? "lg:order-1" : ""}`}>
                    <div className="absolute -inset-6 rounded-[32px] bg-[radial-gradient(50%_50%_at_50%_50%,rgba(116,102,255,0.18),transparent_70%)]" />
                    <div className="relative">
                      <Picture />
                    </div>
                  </div>
                )}
              </article>
            );
          })}
          <p className="pt-2 text-center text-xs text-faint">Pictures show example data.</p>
        </div>
      </section>

      <section className="pb-12" aria-labelledby="planned">
        <div className="mk-container">
          <div className="mk-reveal rounded-3xl border border-dashed border-white/[0.12] p-6 sm:p-10">
            <h2 id="planned" className="text-2xl font-semibold tracking-tight text-ink">
              On the roadmap
            </h2>
            <p className="mk-text mt-2 max-w-2xl">These are planned and not available yet. We list them so you can decide with the full picture.</p>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {PLANNED.map((p) => (
                <li key={p} className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 text-sm text-ink-2">
                  <CircleDashed className="mt-0.5 size-4 shrink-0 text-faint" aria-hidden="true" />
                  <span>
                    {p} <span className="ml-1 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-faint">Planned</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-10">
              <Link href={SITE.signUp} className="mk-btn mk-btn-primary">
                Start free trial <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </p>
          </div>
        </div>
      </section>

      <CtaBand />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(breadcrumbLd(origin, CRUMBS)) }} />
    </>
  );
}
