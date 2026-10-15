import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { getCollection } from "@/lib/cms/collections";
import { itemListJsonLd, pageMetadata } from "@/lib/seo";
import { InlineText } from "@/components/content/inline-text";
import { JsonLd } from "@/components/ui/json-ld";
import { ProductGrid } from "@/components/product/product-grid";
import { PageHero } from "@/components/shop/page-hero";
import { EmptyState } from "@/components/shop/product-listing";
import { getSiteInfo } from "@/lib/repo/site-content";
import { getStoreLocale } from "@/lib/store-locale";
import { countryInText, deliveryArea } from "@/lib/locale";

/** Product collections from /cms → Catalog → Collections. */

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [c, site] = await Promise.all([getCollection(slug), getSiteInfo()]);
  if (!c) return {};
  const locale = await getStoreLocale();
  return pageMetadata({
    locale,
    title: c.seoTitle || `${c.title} – Buy Online in ${countryInText(locale.country)} | ${site.name}`,
    description: c.seoDescription || c.description.replace(/\*\*/g, "").slice(0, 160) || `${c.title} at ${site.name} – delivery ${deliveryArea(locale.country)}.`,
    image: c.seoImage ?? c.image ?? c.products[0]?.images[0],
    path: `/collections/${slug}`,
    noindex: c.seoNoindex,
    canonical: c.seoCanonical,
  });
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;
  const [c, site] = await Promise.all([getCollection(slug), getSiteInfo()]);
  if (!c) notFound();
  return (
    <div className="container-x pb-16">
      <PageHero
        crumbs={[{ name: c.title, href: `/collections/${slug}` }]}
        eyebrow={`${c.products.length} product${c.products.length === 1 ? "" : "s"}`}
        title={c.title}
        description={
          c.description ? (
            <p>
              <InlineText text={c.description} />
            </p>
          ) : undefined
        }
        icon={<LayoutGrid className="size-7" aria-hidden="true" />}
      />
      {c.products.length > 0 ? (
        <>
          <JsonLd data={itemListJsonLd(c.products, `${c.title} – ${site.name}`)} />
          <ProductGrid products={c.products} priorityCount={4} />
        </>
      ) : (
        <EmptyState filtered={false} clearHref="/shop" />
      )}
    </div>
  );
}
