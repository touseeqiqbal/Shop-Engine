import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { getBrands } from "@/lib/repo/catalog";
import { InlineText } from "@/components/content/inline-text";
import { Markdown } from "@/components/ui/markdown";
import { getPageMeta } from "@/lib/page-seo";
import { getResolvedPageContent } from "@/lib/repo/site-content";
import { Reveal } from "@/components/ui/reveal";
import { PageHero } from "@/components/shop/page-hero";
import { getBrandCounts } from "@/components/shop/data";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return getPageMeta("/brands");
}

export default async function BrandsPage() {
  const [brands, counts, c] = await Promise.all([getBrands(), getBrandCounts(), getResolvedPageContent("/brands")]);
  const list = [...brands].filter((b) => (counts[b.slug] ?? 0) > 0).sort((a, b) => (counts[b.slug] ?? 0) - (counts[a.slug] ?? 0) || a.name.localeCompare(b.name));

  return (
    <div className="container-x pb-16">
      <PageHero
        crumbs={[{ name: "Brands", href: "/brands" }]}
        eyebrow={`${list.length} brands`}
        title={
          <>
            Shop by <span className="gradient-text">brand</span>
          </>
        }
        description={
          <p>
            <InlineText text={c.intro} />
          </p>
        }
      />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
        {list.map((b, i) => (
          <Reveal as="li" key={b.slug} delay={(i % 8) * 0.03}>
            <Link
              href={`/brands/${b.slug}`}
              className="group glow-hover card relative flex h-full min-h-36 flex-col justify-between overflow-hidden p-5 transition-transform duration-300 hover:-translate-y-1"
            >
              <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-gradient-to-br from-violet-500/25 to-transparent opacity-40 blur-2xl transition-opacity group-hover:opacity-100" aria-hidden="true" />
              {b.logo ? (
                <Image src={b.logo} alt={`${b.name} logo`} width={120} height={40} className="relative h-10 w-auto object-contain" />
              ) : (
                <span className="relative font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl">{b.name}</span>
              )}
              <span className="relative mt-4 flex items-center justify-between text-xs font-medium text-muted">
                {counts[b.slug] ?? 0} products
                <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
          </Reveal>
        ))}
      </ul>
      {c.seoCopy.trim() && (
        <section aria-label="More information" className="card mt-12 p-6 sm:p-10">
          <Markdown content={c.seoCopy} className="max-w-4xl text-sm sm:text-base" />
        </section>
      )}
    </div>
  );
}
