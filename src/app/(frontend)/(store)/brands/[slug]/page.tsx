import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBrand, getBrands } from "@/lib/repo/catalog";
import { getPageMeta } from "@/lib/page-seo";
import { PageHero } from "@/components/shop/page-hero";
import { ProductListing } from "@/components/shop/product-listing";
import { getBrandCounts } from "@/components/shop/data";
import { shouldNoindex, type RawSearchParams } from "@/components/shop/params";

/* Brand listing – same URL filter scheme as categories (components/shop/params.ts); `brand` is locked to the page's brand. */

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<RawSearchParams> };

const LAPTOP_BRANDS = new Set(["hp", "dell", "lenovo", "apple", "asus", "acer", "msi"]);

export async function generateStaticParams() {
  return (await getBrands()).map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const brand = await getBrand(slug);
  if (!brand) return { title: "Brand not found", robots: { index: false } };
  const what = LAPTOP_BRANDS.has(brand.slug) ? "Laptops & Accessories" : "Accessories";
  // /cms → Online store → Page texts → "Brand pages" can override these with a {brand} template.
  return getPageMeta("/brands/{brand}", {
    vars: { brand: brand.name },
    title: `${brand.name} ${what} Price in Pakistan | Urko Tech Store`,
    description: `Buy genuine ${brand.name} ${what.toLowerCase()} at the best price in Pakistan. New, used & refurbished stock with warranty, Cash on Delivery and fast delivery from Karachi to all cities.`,
    path: `/brands/${brand.slug}`,
    image: brand.logo,
    noindex: shouldNoindex(sp),
  });
}

export default async function BrandPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const brand = await getBrand(slug);
  if (!brand) notFound();
  const counts = await getBrandCounts();
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
            Shop {brand.name} {laptops ? "laptops, chargers, batteries and parts" : "accessories"} at the best price in Pakistan – checked & tested
            with warranty, Cash on Delivery and delivery to every city.
          </p>
        }
        icon={<span className="font-display text-lg font-bold">{brand.name.slice(0, 2)}</span>}
      />
      <ProductListing
        basePath={`/brands/${brand.slug}`}
        searchParams={sp}
        base={{ brand: [brand.slug] }}
        listName={`${brand.name} products – Urko Tech Store`}
      />
    </div>
  );
}
