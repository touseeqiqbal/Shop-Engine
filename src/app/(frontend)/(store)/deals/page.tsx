import Link from "next/link";
import type { Metadata } from "next";
import { Flame, Timer } from "lucide-react";
import { getActiveFlashSale, getAllProducts } from "@/lib/repo/catalog";
import { itemListJsonLd } from "@/lib/seo";
import { InlineText } from "@/components/content/inline-text";
import { Markdown } from "@/components/ui/markdown";
import { getPageMeta } from "@/lib/page-seo";
import { getResolvedPageContent } from "@/lib/repo/site-content";
import { discountPercent } from "@/lib/utils";
import { Countdown } from "@/components/ui/countdown";
import { JsonLd } from "@/components/ui/json-ld";
import { Reveal } from "@/components/ui/reveal";
import { ProductGrid } from "@/components/product/product-grid";
import { PageHero } from "@/components/shop/page-hero";
import { EmptyState } from "@/components/shop/product-listing";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  return getPageMeta("/deals");
}

export default async function DealsPage() {
  const [all, sale, c] = await Promise.all([getAllProducts(), getActiveFlashSale(), getResolvedPageContent("/deals")]);
  const saleIds = new Set(sale?.productIds ?? []);
  const deals = all
    .filter((p) => saleIds.has(p.id) || p.hotDeal || (p.salePrice != null && p.salePrice < p.price))
    .sort((a, b) => Number(saleIds.has(b.id)) - Number(saleIds.has(a.id)) || discountPercent(b) - discountPercent(a) || b.soldCount - a.soldCount);
  const flash = deals.filter((p) => saleIds.has(p.id));
  const rest = deals.filter((p) => !saleIds.has(p.id));
  const best = deals.reduce((m, p) => Math.max(m, discountPercent(p)), 0);

  return (
    <div className="container-x pb-16">
      <PageHero
        crumbs={[{ name: "Hot Deals", href: "/deals" }]}
        eyebrow={best > 0 ? `Save up to ${best}% · Limited stock` : "Limited stock"}
        title={
          <>
            Hot <span className="gradient-text">deals</span>
          </>
        }
        description={
          <p>
            <InlineText text={c.intro} />
          </p>
        }
        icon={<Flame className="size-7" aria-hidden="true" />}
      />
      {deals.length > 0 && <JsonLd data={itemListJsonLd(deals, "Hot deals – Urko Tech Store")} />}

      {sale && flash.length > 0 && (
        <Reveal as="section" className="relative mb-12 overflow-hidden rounded-[1.75rem] border border-orange-500/25 bg-gradient-to-br from-orange-500/15 via-rose-500/5 to-violet-500/10 p-4 sm:p-8">
          <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-orange-500/20 blur-3xl" aria-hidden="true" />
          <div className="relative mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="chip mb-2 border-orange-500/40 bg-orange-500/10 text-orange-400">
                <Timer className="size-3.5" aria-hidden="true" /> Flash sale
              </p>
              <h2 className="text-2xl font-bold text-fg sm:text-3xl">{sale.title}</h2>
              <p className="mt-1 text-sm text-muted">Prices go back up when the timer hits zero.</p>
            </div>
            <Countdown endsAt={sale.endsAt} />
          </div>
          <ProductGrid products={flash} priorityCount={4} className="relative" />
        </Reveal>
      )}

      {rest.length > 0 ? (
        <section aria-labelledby="all-deals-heading">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <h2 id="all-deals-heading" className="text-xl font-bold text-fg sm:text-2xl">
              {flash.length ? "More deals" : "All deals"} <span className="text-base font-medium text-muted">({rest.length})</span>
            </h2>
            <p className="text-sm text-muted">Sorted by biggest discount</p>
          </div>
          <ProductGrid products={rest} priorityCount={flash.length ? 0 : 4} />
        </section>
      ) : (
        deals.length === 0 && <EmptyState filtered={false} clearHref="/shop" />
      )}

      {c.seoCopy.trim() && (
        <section aria-label="More information" className="card mt-12 p-6 sm:p-10">
          <Markdown content={c.seoCopy} className="max-w-4xl text-sm sm:text-base" />
        </section>
      )}

      <p className="mt-12 text-center text-sm text-muted">
        Looking for something specific?{" "}
        <Link href="/shop" className="font-semibold text-violet-400 hover:text-violet-300">
          Browse all products
        </Link>
      </p>
    </div>
  );
}
