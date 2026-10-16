import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Info } from "lucide-react";
import { CtaBand, FeatureIcon, PageHero } from "@/components/marketing/sections";
import { FEATURES, SITE } from "@/lib/marketing/content";
import { SOLUTIONS, solutionBySlug } from "@/lib/marketing/solutions";
import { breadcrumbLd, ldJson, marketingOrigin, pageMeta } from "@/lib/marketing/seo";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;
export const generateStaticParams = () => SOLUTIONS.map((s) => ({ slug: s.slug }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = solutionBySlug((await params).slug);
  if (!s) return {};
  return pageMeta({ title: s.name, description: s.description, path: `/solutions/${s.slug}` });
}

export default async function SolutionPage({ params }: Props) {
  const s = solutionBySlug((await params).slug);
  if (!s) notFound();
  const origin = await marketingOrigin();
  const crumbs = [{ name: s.name, path: `/solutions/${s.slug}` }];
  const related = s.features.map((id) => FEATURES.find((f) => f.id === id)).filter((f) => f !== undefined);
  const others = SOLUTIONS.filter((o) => o.slug !== s.slug);
  return (
    <>
      <PageHero crumbs={crumbs} eyebrow={s.eyebrow} title={s.title} lead={s.lead}>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href={SITE.signUp} className="mk-btn mk-btn-primary mk-btn-lg">
            Start free trial <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <Link href="/contact" className="mk-btn mk-btn-secondary mk-btn-lg">
            Talk to us
          </Link>
        </div>
      </PageHero>

      <section className="mk-section">
        <div className="mk-container grid gap-5 md:grid-cols-2">
          {s.blocks.map((b, i) => (
            <article key={b.title} className="mk-card p-6 sm:p-8">
              <span className="mk-kbd text-xs text-brand-200">{String(i + 1).padStart(2, "0")}</span>
              <h2 className="mt-3 text-xl font-semibold tracking-tight text-ink sm:text-2xl">{b.title}</h2>
              <p className="mk-text mt-3">{b.text}</p>
              <ul className="mt-5 space-y-2.5">
                {b.points.map((p) => (
                  <li key={p} className="flex gap-2.5 text-[0.9375rem] text-ink-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand-200" aria-hidden="true" />
                    {p}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <div className="mk-container mt-6">
          <p className="flex items-start gap-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-body">
            <Info className="mt-0.5 size-4 shrink-0 text-faint" aria-hidden="true" />
            {s.note}
          </p>
        </div>
      </section>

      <section className="mk-section border-y border-white/[0.06] bg-canvas/60" aria-labelledby="related">
        <div className="mk-container">
          <h2 id="related" className="mk-h2 text-[clamp(1.9rem,3.4vw,2.75rem)]">
            The features behind it
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((f) => (
              <Link key={f.id} href={`/features#${f.id}`} className="mk-card mk-spot group block p-6">
                <FeatureIcon name={f.icon} />
                <h3 className="mk-h3 mt-4 group-hover:text-brand-200">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-body">{f.text}</p>
              </Link>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="font-semibold text-ink">Other solutions:</span>
            {others.map((o) => (
              <Link key={o.slug} href={`/solutions/${o.slug}`} className="mk-link">
                {o.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <CtaBand />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(breadcrumbLd(origin, crumbs)) }} />
    </>
  );
}
