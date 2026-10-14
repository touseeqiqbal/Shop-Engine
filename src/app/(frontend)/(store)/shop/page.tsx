import Link from "next/link";
import type { Metadata } from "next";
import { Search } from "lucide-react";
import { getTopCategories } from "@/lib/repo/catalog";
import { pageMetadata } from "@/lib/seo";
import { InlineText } from "@/components/content/inline-text";
import { Markdown } from "@/components/ui/markdown";
import { getPageMeta } from "@/lib/page-seo";
import { getResolvedPageContent, getSiteInfo } from "@/lib/repo/site-content";
import { PageHero } from "@/components/shop/page-hero";
import { ProductListing } from "@/components/shop/product-listing";
import { shouldNoindex, type RawSearchParams } from "@/components/shop/params";

/*
 * All products + search results (?q=). Same URL filter scheme as category pages (see components/shop/params.ts);
 * category attribute filters don't apply here. Canonical is always /shop; q / filters / sort / page → noindex,follow.
 */

type Props = { searchParams: Promise<RawSearchParams> };

function getQ(sp: RawSearchParams) {
  const q = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  return q?.trim().slice(0, 80) || "";
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const q = getQ(sp);
  if (!q) return getPageMeta("/shop", { noindex: shouldNoindex(sp) });
  const { name } = await getSiteInfo();
  return pageMetadata({
    title: `Search results for "${q}" | ${name}`,
    description: `Products matching "${q}" at ${name} – laptops, chargers, batteries & accessories with Cash on Delivery all over Pakistan.`,
    path: "/shop",
    noindex: shouldNoindex(sp),
  });
}

export default async function ShopPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = getQ(sp);
  const [categories, c] = await Promise.all([q ? [] : getTopCategories(), getResolvedPageContent("/shop")]);

  return (
    <div className="container-x pb-16">
      <PageHero
        crumbs={q ? [{ name: "Shop", href: "/shop" }, { name: "Search", href: `/shop?q=${encodeURIComponent(q)}` }] : [{ name: "Shop", href: "/shop" }]}
        eyebrow={q ? "Search" : "Laptops & tech accessories"}
        title={
          q ? (
            <>
              Search results for <span className="gradient-text">&ldquo;{q}&rdquo;</span>
            </>
          ) : (
            <>
              Shop <span className="gradient-text">everything</span>
            </>
          )
        }
        description={
          q ? (
            <p>
              Can&apos;t find it? Try a model number (e.g. &ldquo;840 G5&rdquo;) or{" "}
              <Link href="/find-parts" className="font-semibold text-violet-400 hover:text-violet-300">
                find parts by laptop model
              </Link>
              .
            </p>
          ) : (
            <p>
              <InlineText text={c.intro} />
            </p>
          )
        }
        icon={q ? <Search className="size-7" aria-hidden="true" /> : undefined}
      >
        {categories.length > 0 && (
          <nav aria-label="Categories" className="mt-5">
            <ul className="snap-row -mx-4 !gap-2 px-4 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-wrap lg:px-0">
              {categories.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/category/${c.slug}`}
                    className="inline-flex min-h-10 items-center whitespace-nowrap rounded-full border border-border-strong bg-surface px-4 text-sm font-medium text-fg/85 transition-colors hover:border-violet-500/50 hover:text-fg"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </PageHero>

      <ProductListing
        basePath="/shop"
        searchParams={sp}
        listName={q ? `Search results for ${q}` : `All products – ${c.info.name}`}
        keepParams={["q"]}
      />
      {!q && c.seoCopy.trim() && (
        <section aria-label="More information" className="card mt-12 p-6 sm:p-10">
          <Markdown content={c.seoCopy} className="max-w-4xl text-sm sm:text-base" />
        </section>
      )}
    </div>
  );
}
