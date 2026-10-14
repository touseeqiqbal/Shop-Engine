import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategories, getCategoryBySlug, getCategoryLineage, getSubcategories } from "@/lib/repo/catalog";
import { getSiteInfo } from "@/lib/repo/site-content";
import { pageMetadata } from "@/lib/seo";
import { storePlace } from "@/lib/site-info";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/ui/category-icon";
import { Markdown } from "@/components/ui/markdown";
import { PageHero } from "@/components/shop/page-hero";
import { ProductListing } from "@/components/shop/product-listing";
import { FinderPanel } from "@/components/shop/finder-panel";
import { getCategoryCounts } from "@/components/shop/data";
import { shouldNoindex, type RawSearchParams } from "@/components/shop/params";

/*
 * Category / sub-category listing. Filters live in the URL – see src/components/shop/params.ts for the scheme:
 *   brand=hp,dell · condition=used-a-plus · min / max (PKR) · stock=1 · sort · page · view=list
 *   a_{key}=v1,v2 (select / boolean attributes) · r_{key}=min-max (range attributes)
 * Canonical is always the clean /category/{slug}; any filter / sort / page param adds robots noindex,follow.
 */

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<RawSearchParams> };

export async function generateStaticParams() {
  return (await getCategories()).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const [category, site] = await Promise.all([getCategoryBySlug(slug), getSiteInfo()]);
  if (!category) return { title: "Category not found", robots: { index: false } };
  const place = storePlace(site);
  return pageMetadata({
    title: category.seoTitle || `${category.name} Price in Pakistan | ${site.name}`,
    description:
      category.seoDescription ||
      `Buy ${category.name.toLowerCase()} online at the best price in Pakistan. ${category.shortDescription} Cash on Delivery, warranty & fast delivery${place ? ` from ${place}` : ""} to all cities.`,
    path: `/category/${category.slug}`,
    image: category.image,
    noindex: shouldNoindex(sp) || category.seoNoindex,
    canonical: category.seoCanonical,
  });
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const lineage = await getCategoryLineage(category);
  const parent = lineage.length > 1 ? lineage[lineage.length - 2] : null;
  const [children, siblings, counts, site] = await Promise.all([
    getSubcategories(category.id),
    parent ? getSubcategories(parent.id) : Promise.resolve([]),
    getCategoryCounts(),
    getSiteInfo(),
  ]);
  const showFinder = lineage.some((c) => c.compatibility) && category.compatibility !== false;
  // Sub-categories: own children, or siblings (with a link back to the parent) when this is a leaf.
  const chips = children.length ? children : siblings;
  const chipParent = children.length ? category : parent;
  const icon = lineage.find((c) => c.icon)?.icon;

  return (
    <div className="container-x pb-16">
      <PageHero
        crumbs={[{ name: "Categories", href: "/category" }, ...lineage.map((c) => ({ name: c.name, href: `/category/${c.slug}` }))]}
        eyebrow={`${counts[category.id] ?? 0} products · Delivery all over Pakistan`}
        title={category.name}
        description={<p>{category.shortDescription}</p>}
        icon={<CategoryIcon name={icon} className="size-7" />}
      >
        {chips.length > 0 && chipParent && (
          <nav aria-label={`${chipParent.name} sub-categories`} className="mt-5">
            <ul className="snap-row -mx-4 !gap-2 px-4 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-wrap lg:px-0">
              <li>
                <Link
                  href={`/category/${chipParent.slug}`}
                  aria-current={chipParent.id === category.id ? "page" : undefined}
                  className={cn(chipClass, chipParent.id === category.id && chipActive)}
                >
                  All {chipParent.name}
                  <span className="text-[11px] tabular-nums opacity-70">{counts[chipParent.id] ?? 0}</span>
                </Link>
              </li>
              {chips.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/category/${c.slug}`}
                    aria-current={c.id === category.id ? "page" : undefined}
                    className={cn(chipClass, c.id === category.id && chipActive)}
                  >
                    {c.name}
                    <span className="text-[11px] tabular-nums opacity-70">{counts[c.id] ?? 0}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </PageHero>

      {showFinder && <FinderPanel category={category} className="mb-8" />}

      <ProductListing
        basePath={`/category/${category.slug}`}
        searchParams={sp}
        base={{ categorySlug: category.slug }}
        listName={`${category.name} – ${site.name}`}
      />

      {category.seoContent && (
        <section aria-label={`About ${category.name}`} className="card mt-16 p-6 sm:p-10">
          <Markdown content={category.seoContent} className="max-w-4xl text-sm sm:text-base" />
        </section>
      )}
    </div>
  );
}

const chipClass =
  "inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-full border border-border-strong bg-surface px-4 text-sm font-medium text-fg/85 transition-colors hover:border-violet-500/50 hover:text-fg";
const chipActive = "!border-transparent bg-brand-gradient !text-white shadow-[0_8px_24px_-10px_rgba(139,92,246,0.8)]";
