import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBrand } from "@/lib/repo/catalog";
import { getPageMeta } from "@/lib/page-seo";
import { getSiteInfo } from "@/lib/repo/site-content";
import { PageHero } from "@/components/shop/page-hero";
import { ProductListing } from "@/components/shop/product-listing";
import { getBrandCounts } from "@/components/shop/data";
import { shouldNoindex, type RawSearchParams } from "@/components/shop/params";
import { getStoreLocale } from "@/lib/store-locale";
import { countryInText } from "@/lib/locale";

/* Brand listing – same URL filter scheme as categories (components/shop/params.ts); `brand` is locked to the page's brand. */

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<RawSearchParams> };

const LAPTOP_BRANDS = new Set(["hp", "dell", "lenovo", "apple", "asus", "acer", "msi"]);

// Rendered per request (the store comes from the address – a cached page must never reach another store's visitors);
// the data behind it stays cached per store. No build-time list: products, brands and posts added later work at once.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const [brand, site, { country }] = await Promise.all([getBrand(slug), getSiteInfo(), getStoreLocale()]);
  if (!brand) return { title: "Brand not found", robots: { index: false } };
  const where = countryInText(country);
  const what = LAPTOP_BRANDS.has(brand.slug) ? "Laptops & Accessories" : "Accessories";
  const from = site.address.city ? ` from ${site.address.city}` : "";
  // /cms → Online store → Page texts → "Brand pages" can override these with a {brand} template.
  return getPageMeta("/brands/{brand}", {
    vars: { brand: brand.name },
    title: `${brand.name} ${what} Price in ${where} | ${site.name}`,
    description: `Buy genuine ${brand.name} ${what.toLowerCase()} at the best price in ${where}. New, used & refurbished stock with warranty, Cash on Delivery and fast delivery${from} to all cities.`,
    path: `/brands/${brand.slug}`,
    image: brand.logo,
    noindex: shouldNoindex(sp),
  });
}

export default async function BrandPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const brand = await getBrand(slug);
  if (!brand) notFound();
  const [counts, site, { country }] = await Promise.all([getBrandCounts(), getSiteInfo(), getStoreLocale()]);
  const laptops = LAPTOP_BRANDS.has(brand.slug);

  return (
    <div className="container-x pb-16">
      <PageHero
        crumbs={[
          { name: "Brands", href: "/brands" },
          { name: brand.name, href: `/brands/${brand.slug}` },
        ]}
        eyebrow={`${counts[brand.slug] ?? 0} products · Genuine ${brand.name}`}
        title={
          <>
            {brand.name} {laptops ? "laptops & accessories" : "products"}
          </>
        }
        description={
          <p>
            Shop {brand.name} {laptops ? "laptops, chargers, batteries and parts" : "accessories"} at the best price in {countryInText(country)} – checked & tested
            with warranty, Cash on Delivery and delivery to every city.
          </p>
        }
        icon={<span className="font-display text-lg font-bold">{brand.name.slice(0, 2)}</span>}
      />
      <ProductListing
        basePath={`/brands/${brand.slug}`}
        searchParams={sp}
        base={{ brand: [brand.slug] }}
        listName={`${brand.name} products – ${site.name}`}
      />
    </div>
  );
}
