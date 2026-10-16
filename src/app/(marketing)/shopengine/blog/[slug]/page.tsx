import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Breadcrumbs, CtaBand, HeroBackdrop } from "@/components/marketing/sections";
import { ARTICLES, formatDate, SITE } from "@/lib/marketing/content";
import { articleLd, breadcrumbLd, ldJson, marketingOrigin, pageMeta } from "@/lib/marketing/seo";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;
export const generateStaticParams = () => ARTICLES.map((a) => ({ slug: a.slug }));

const bySlug = (slug: string) => ARTICLES.find((a) => a.slug === slug);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = bySlug((await params).slug);
  if (!a) return {};
  return pageMeta({ title: a.title, description: a.description, path: `/blog/${a.slug}`, type: "article", publishedTime: a.date });
}

export default async function ArticlePage({ params }: Props) {
  const a = bySlug((await params).slug);
  if (!a) notFound();
  const origin = await marketingOrigin();
  const crumbs = [
    { name: "Blog", path: "/blog" },
    { name: a.title, path: `/blog/${a.slug}` },
  ];
  const more = ARTICLES.filter((x) => x.slug !== a.slug).slice(0, 2);
  return (
    <>
      <article>
        <header className="relative isolate overflow-hidden border-b border-white/[0.06]">
          <HeroBackdrop />
          <div className="mk-container relative max-w-3xl pb-14 pt-32 sm:pb-16 sm:pt-40">
            <Breadcrumbs items={crumbs} />
            <p className="mt-8 text-sm text-faint">
              <time dateTime={a.date}>{formatDate(a.date)}</time> · {a.readMinutes} min read · {SITE.name} team
            </p>
            <h1 className="mk-h1 mt-4 text-[clamp(2.2rem,4.6vw,3.6rem)]">{a.title}</h1>
            <p className="mk-lead mt-5">{a.description}</p>
          </div>
        </header>
        <div className="mk-container max-w-3xl py-12 sm:py-16">
          <div className="mk-prose">
            {a.sections.map((s) => (
              <section key={s.heading}>
                <h2>{s.heading}</h2>
                {s.paragraphs.map((p) => (
                  <p key={p.slice(0, 40)}>{p}</p>
                ))}
              </section>
            ))}
          </div>
          <div className="mk-card mk-glow-edge relative mt-14 overflow-hidden p-6 sm:p-8">
            <p className="text-xl font-semibold tracking-tight text-ink">Try it with your own store</p>
            <p className="mt-1.5 text-[0.9375rem] text-body">Start a free trial and set up your first store in minutes.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href={SITE.signUp} className="mk-btn mk-btn-primary">
                Start free trial
              </Link>
              <Link href="/features" className="mk-btn mk-btn-secondary">
                See the features
              </Link>
            </div>
          </div>
        </div>
      </article>

      {more.length > 0 && (
        <section className="border-t border-white/[0.06] py-16" aria-labelledby="more">
          <div className="mk-container max-w-5xl">
            <div className="flex items-center justify-between gap-4">
              <h2 id="more" className="text-xl font-semibold tracking-tight text-ink">
                More guides
              </h2>
              <Link href="/blog" className="mk-link inline-flex items-center gap-1 text-sm">
                <ArrowLeft className="size-3.5" aria-hidden="true" /> All guides
              </Link>
            </div>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {more.map((m) => (
                <Link key={m.slug} href={`/blog/${m.slug}`} className="mk-card mk-spot group block p-6">
                  <p className="text-xs text-faint">{m.readMinutes} min read</p>
                  <h3 className="mt-2 font-semibold leading-snug text-ink group-hover:text-brand-200">{m.title}</h3>
                  <span className="mk-link mt-3 inline-flex items-center gap-1 text-sm">
                    Read <ArrowRight className="size-3.5" aria-hidden="true" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <CtaBand />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([articleLd(origin, a), breadcrumbLd(origin, crumbs)]) }} />
    </>
  );
}
