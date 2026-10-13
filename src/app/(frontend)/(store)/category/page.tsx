import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, Wrench } from "lucide-react";
import { getCategoryTree } from "@/lib/repo/catalog";
import { InlineText } from "@/components/content/inline-text";
import { Markdown } from "@/components/ui/markdown";
import { getPageMeta } from "@/lib/page-seo";
import { getResolvedPageContent } from "@/lib/repo/site-content";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/ui/category-icon";
import { Reveal } from "@/components/ui/reveal";
import { PageHero } from "@/components/shop/page-hero";
import { getCategoryCounts } from "@/components/shop/data";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return getPageMeta("/category");
}

const GLOWS = ["from-blue-500/30", "from-violet-500/30", "from-cyan-500/25", "from-fuchsia-500/25", "from-emerald-500/20", "from-amber-500/20"];

export default async function CategoryIndexPage() {
  const [tree, counts, content] = await Promise.all([getCategoryTree(), getCategoryCounts(), getResolvedPageContent("/category")]);
  const total = tree.reduce((s, c) => s + (counts[c.id] ?? 0), 0);

  return (
    <div className="container-x pb-16">
      <PageHero
        crumbs={[{ name: "Categories", href: "/category" }]}
        eyebrow={`${tree.length} categories · ${total} products`}
        title={
          <>
            Shop by <span className="gradient-text">category</span>
          </>
        }
        description={
          <p>
            <InlineText text={content.intro} />
          </p>
        }
        aside={
          <Link href="/find-parts" className="btn btn-secondary shrink-0 self-start lg:self-auto">
            <Wrench className="size-4" aria-hidden="true" /> Find parts by laptop model
          </Link>
        }
      />

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
        {tree.map((c, i) => {
          const feature = i === 0;
          return (
            <Reveal as="li" key={c.id} delay={(i % 6) * 0.04} className={cn(feature && "sm:col-span-2 lg:row-span-2")}>
              <article className="group glow-hover card relative flex h-full flex-col overflow-hidden p-5 sm:p-6">
                <div
                  className={cn(
                    "pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-gradient-to-br to-transparent opacity-50 blur-2xl transition-opacity duration-500 group-hover:opacity-100",
                    GLOWS[i % GLOWS.length]
                  )}
                  aria-hidden="true"
                />
                <div className="relative flex items-start justify-between gap-4">
                  <span
                    className={cn(
                      "grid place-items-center rounded-2xl bg-surface-strong text-fg transition-colors group-hover:bg-brand-gradient group-hover:text-white",
                      feature ? "size-16" : "size-12"
                    )}
                  >
                    <CategoryIcon name={c.icon} className={feature ? "size-8" : "size-6"} />
                  </span>
                  <span className="chip text-muted tabular-nums">{counts[c.id] ?? 0} products</span>
                </div>
                <h2 className={cn("mt-4 font-bold leading-tight text-fg", feature ? "text-2xl sm:text-3xl" : "text-lg sm:text-xl")}>
                  <Link href={`/category/${c.slug}`} className="after:absolute after:inset-0 after:content-['']">
                    {c.name}
                  </Link>
                </h2>
                <p className={cn("relative mt-1.5 text-sm text-muted", !feature && "line-clamp-2")}>{c.shortDescription}</p>

                {c.children.length > 0 && (
                  <ul className={cn("relative z-[2] mt-4 flex flex-wrap gap-1.5", feature && "sm:mt-6 sm:gap-2")} aria-label={`${c.name} sub-categories`}>
                    {c.children.map((s) => (
                      <li key={s.id}>
                        <Link
                          href={`/category/${s.slug}`}
                          className={cn(
                            "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-bg/40 px-3 text-xs font-medium text-fg/85 backdrop-blur transition-colors hover:border-violet-500/60 hover:text-fg",
                            feature && "sm:min-h-10 sm:px-4 sm:text-sm"
                          )}
                        >
                          {s.name}
                          <span className="tabular-nums text-subtle">{counts[s.id] ?? 0}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <span className="relative mt-auto flex items-center gap-1 pt-5 text-sm font-semibold text-fg/90">
                  Shop {c.name.toLowerCase()}
                  <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </article>
            </Reveal>
          );
        })}
      </ul>
      {content.seoCopy.trim() && (
        <section aria-label="More information" className="card mt-12 p-6 sm:p-10">
          <Markdown content={content.seoCopy} className="max-w-4xl text-sm sm:text-base" />
        </section>
      )}
    </div>
  );
}
