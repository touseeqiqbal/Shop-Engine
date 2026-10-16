import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CtaBand, PageHero } from "@/components/marketing/sections";
import { ARTICLES, formatDate } from "@/lib/marketing/content";
import { breadcrumbLd, ldJson, marketingOrigin, pageMeta } from "@/lib/marketing/seo";

const CRUMBS = [{ name: "Blog", path: "/blog" }];

export function generateMetadata(): Metadata {
  return pageMeta({
    title: "Blog",
    description: "Practical guides for running online stores: managing several storefronts, choosing payment methods for your country, and selling online and in store.",
    path: "/blog",
  });
}

export default async function BlogPage() {
  const origin = await marketingOrigin();
  const articles = [...ARTICLES].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <PageHero crumbs={CRUMBS} eyebrow="Blog" title="Guides for running online stores" lead="Practical advice on storefronts, payments, delivery and growth – written by the ShopEngine team." />
      <section className="relative pb-24 pt-2">
        <div className="mk-container grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => (
            <article key={a.slug} className="mk-card mk-spot mk-reveal group relative flex flex-col p-7">
              <p className="text-xs text-faint">
                <time dateTime={a.date}>{formatDate(a.date)}</time> · {a.readMinutes} min read
              </p>
              <h2 className="mt-4 text-xl font-semibold leading-snug tracking-tight text-ink group-hover:text-brand-200">
                <Link href={`/blog/${a.slug}`} className="after:absolute after:inset-0 after:rounded-[20px]">
                  {a.title}
                </Link>
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-body">{a.description}</p>
              <span className="mk-link mt-5 inline-flex items-center gap-1 text-sm" aria-hidden="true">
                Read the guide <ArrowRight className="size-3.5" />
              </span>
            </article>
          ))}
        </div>
      </section>
      <CtaBand />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(breadcrumbLd(origin, CRUMBS)) }} />
    </>
  );
}
