import Link from "next/link";
import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { LivePreview } from "@/components/blocks/live-preview";
import { Barcode } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { JsonLd } from "@/components/ui/json-ld";
import { Markdown } from "@/components/ui/markdown";
import { Stars } from "@/components/ui/stars";
import { SectionHeading } from "@/components/ui/section-heading";
import { ProductCarousel } from "@/components/product/product-carousel";
import { ProductGallery } from "@/components/product-detail/gallery";
import { BuyBox } from "@/components/product-detail/buy-box";
import { deliveryInfo } from "@/lib/cities";
import { BulkQuoteNotice, QuoteOnlyBox } from "@/components/product-detail/wholesale-box";
import { ProductTabs, type TabSection } from "@/components/product-detail/product-tabs";
import { BoughtTogether } from "@/components/product-detail/bought-together";
import { ReviewsSection, reviewStats } from "@/components/product-detail/reviews";
import { RecentlyViewed } from "@/components/product-detail/recently-viewed";
import {
  CompatibilityList, ConditionPanel, SpecsTable, TrustStrip, WarrantyDelivery,
} from "@/components/product-detail/sections";
import {
  getApprovedReviews,
  getBrands,
  getCategories,
  getCategoryLineage,
  getLaptopModels,
  getPreviewProductBySlug,
  getProductBySlug,
  getProductsByIds,
  getRelatedProducts,
  getStoreSettings,
} from "@/lib/repo/catalog";
import { pageMetadata, productJsonLd } from "@/lib/seo";
import { getSiteInfo } from "@/lib/repo/site-content";
import { storePlace, type SiteInfo } from "@/lib/site-info";
import { getReturnsPolicy } from "@/lib/cms/aftersales";
import { getConversionSettings, getProductQuestions } from "@/lib/cms/engagement";
import { EmiBlock, ProductQuestions, StockPriceAlert } from "@/components/product-detail/product-extras";
import { conditionMeta, effectivePrice, truncate } from "@/lib/utils";
import { isWholesaleAvailable } from "@/lib/wholesale";
import type { CatalogProduct } from "@/lib/types";
import { countryInText, type StoreLocale } from "@/lib/locale";
import { formatMoney } from "@/lib/money";
import { getStoreLocale } from "@/lib/store-locale";

// Rendered per request (the store comes from the address – a cached page must never reach another store's visitors);
// the data behind it stays cached per store. No build-time list: products, brands and posts added later work at once.
export const dynamic = "force-dynamic";

type Params = Promise<{ category: string; product: string }>;

/** Resolves the product for this URL; redirects mismatched categories, 404s unknown slugs. */
async function resolveProduct(params: Params): Promise<CatalogProduct> {
  const { category, product: slug } = await params;
  // staff preview (Draft Mode): the latest draft instead of the published product
  const preview = (await draftMode()).isEnabled ? await getPreviewProductBySlug(slug) : null;
  const product = preview ?? (await getProductBySlug(slug));
  if (!product) notFound();
  if (product.topCategorySlug !== category) permanentRedirect(product.url);
  return product;
}

/**
 * Search results show ~60 characters: the name and "Price in <country>" come first; condition and store name only if they fit.
 * `loc` = the store's country and currency (`getStoreLocale()`).
 */
function metaTitle(p: CatalogProduct, site: SiteInfo, loc: StoreLocale) {
  if (p.seoTitle) return p.seoTitle;
  const SUFFIX = ` | ${site.name}`;
  const fit = (base: string, ...extra: string[]) => extra.reduce((t, part) => ((t + part).length <= 65 ? t + part : t), base);
  if (p.priceOnRequest) return fit(p.name, " – Wholesale Price on Request", SUFFIX);
  const cond = p.condition ? ` – ${conditionMeta[p.condition].label}` : "";
  return fit(`${p.name} Price in ${countryInText(loc.country)}`, cond, SUFFIX);
}

function metaDescription(p: CatalogProduct, site: SiteInfo, loc: StoreLocale) {
  if (p.seoDescription) return p.seoDescription;
  // "<store name>, <area> <city>" – the store's own name and place (Settings → Store details)
  const from = [site.name, storePlace(site, " ")].filter(Boolean).join(", ");
  const cond = p.condition && p.condition !== "new" ? ` (${conditionMeta[p.condition].label})` : "";
  const allOver = loc.country === "PK" ? "all over Pakistan" : "nationwide";
  const lead = p.priceOnRequest
    ? `${p.name}${cond} – wholesale price on request.`
    : `Buy ${p.name}${cond} at ${formatMoney(effectivePrice(p), loc)} in ${countryInText(loc.country)}.`;
  const tail = p.priceOnRequest
    ? ` Request a bulk quote from ${from} – delivery ${allOver}.`
    : ` Cash on Delivery & delivery ${allOver} from ${from}.`;
  const budget = 300 - lead.length - tail.length;
  const mid = budget > 40 ? ` ${truncate(p.shortDescription, budget)}` : "";
  return `${lead}${mid}${tail}`;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { product: slug } = await params;
  const [p, site, loc] = await Promise.all([getProductBySlug(slug), getSiteInfo(), getStoreLocale()]);
  if (!p) return { title: { absolute: `Product not found | ${site.name}` }, robots: { index: false, follow: true } };
  return pageMetadata({ title: metaTitle(p, site, loc), description: metaDescription(p, site, loc), path: p.url, image: p.images[0], noindex: p.seoNoindex, canonical: p.seoCanonical, locale: loc });
}

export default async function ProductPage({ params }: { params: Params }) {
  const product = await resolveProduct(params);

  const [categories, reviews, related, addons, settings, models, brands, returnsPolicy, conversion, questions, loc] = await Promise.all([
    getCategories(),
    getApprovedReviews(product.id),
    getRelatedProducts(product, 10),
    getProductsByIds(product.boughtTogether.filter((id) => id !== product.id)),
    getStoreSettings(),
    product.compatibility.length ? getLaptopModels() : Promise.resolve([]),
    getBrands(),
    getReturnsPolicy(),
    getConversionSettings(),
    getProductQuestions(product.id).catch(() => []),
    getStoreLocale(),
  ]);

  const delivery = deliveryInfo(settings);
  const leaf = categories.find((c) => c.id === product.categoryId);
  const lineage = leaf ? await getCategoryLineage(leaf) : [];
  const crumbs = [...lineage.map((c) => ({ name: c.name, href: `/category/${c.slug}` })), { name: product.name, href: product.url }];
  const { average, count } = reviewStats(product, reviews);
  const bundle = product.priceOnRequest ? [] : addons.filter((a) => !a.priceOnRequest).slice(0, 3);

  const sections: TabSection[] = [
    {
      id: "description",
      label: "Description",
      content: <Markdown content={product.description || product.shortDescription} className="max-w-3xl" />,
    },
    { id: "specs", label: "Specifications", content: <SpecsTable specs={product.specs} /> },
    ...(product.compatibility.length
      ? [{ id: "compatibility", label: "Compatibility", content: <CompatibilityList product={product} models={models} brands={brands} /> }]
      : []),
    { id: "warranty", label: "Warranty & Delivery", content: <WarrantyDelivery product={product} returnDays={returnsPolicy.returnDays} delivery={delivery} /> },
  ];

  return (
    <>
      {/* Quote-only lots have no Offer; Product markup without offers/ratings isn't valid for Google, so skip it then. */}
      {(!product.priceOnRequest || count > 0) && (
        <JsonLd
          data={productJsonLd(product, reviews, {
            shippingRate: settings.freeDeliveryThreshold > 0 && effectivePrice(product) >= settings.freeDeliveryThreshold ? 0 : settings.defaultDeliveryCharge,
            returnDays: returnsPolicy.returnDays,
            restockingFee: returnsPolicy.restockingFeePercent > 0,
          }, loc)}
        />
      )}

      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[38rem] overflow-hidden" aria-hidden="true">
          <div className="absolute left-1/2 top-[-12rem] h-[30rem] w-[60rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-600/15 via-violet-600/15 to-fuchsia-600/10 blur-3xl" />
        </div>

        <div className="container-x pt-4 sm:pt-6">
          <Breadcrumbs items={crumbs} className="mb-4 sm:mb-6" />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:gap-10 xl:gap-14">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <ProductGallery images={product.images} alts={(product as CatalogProduct & { imageAlts?: string[] }).imageAlts} name={product.name} video={product.video} />
            </div>

            <div className="min-w-0 space-y-5">
              <header className="space-y-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <Link
                    href={`/brands/${product.brand}`}
                    className="gradient-text font-semibold uppercase tracking-[0.16em] hover:opacity-80"
                  >
                    {product.brandName}
                  </Link>
                  <span className="text-subtle" aria-hidden="true">
                    •
                  </span>
                  <Link href={`/category/${product.categorySlug}`} className="text-muted hover:text-fg">
                    {product.categoryName}
                  </Link>
                </div>
                <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-fg sm:text-3xl xl:text-[2.4rem]">{product.name}</h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <a href="#reviews" className="inline-flex items-center gap-2 rounded-full transition hover:opacity-80">
                    <Stars rating={count ? average : 0} size="md" />
                    <span className="text-muted">
                      {count ? (
                        <>
                          <span className="font-semibold text-fg">{average.toFixed(1)}</span> · {count} review{count === 1 ? "" : "s"}
                        </>
                      ) : (
                        "Be the first to review"
                      )}
                    </span>
                  </a>
                  {/* with options, each option has its own SKU – shown next to the option picker */}
                  {!product.variants?.length && (
                    <span className="inline-flex items-center gap-1.5 text-muted">
                      <Barcode className="size-4" aria-hidden="true" /> SKU: <span className="font-mono text-fg/90">{product.sku}</span>
                    </span>
                  )}
                  {product.soldCount > 10 && <span className="text-muted">{product.soldCount}+ sold</span>}
                </div>
                {product.shortDescription && <p className="text-[0.95rem] leading-relaxed text-muted">{product.shortDescription}</p>}
              </header>

              <ConditionPanel product={product} />

              {product.priceOnRequest ? (
                <QuoteOnlyBox product={product} />
              ) : (
                <>
                  <BuyBox product={product} delivery={delivery} />
                  {conversion.emiEnabled && effectivePrice(product) >= conversion.emiMinPrice && (
                    <EmiBlock price={effectivePrice(product)} heading={conversion.emiHeading} note={conversion.emiNote} plans={conversion.emiPlans} />
                  )}
                  {conversion.alertsEnabled && <StockPriceAlert productId={product.id} inStock={product.stock > 0} />}
                  {isWholesaleAvailable(product) && <BulkQuoteNotice product={product} />}
                </>
              )}
            </div>
          </div>

          <TrustStrip className="mt-10 sm:mt-14" returnDays={returnsPolicy.returnDays} cod={delivery.cod.enabled} />
        </div>
      </div>

      <div className="space-y-16 pb-12 pt-14 sm:space-y-20 sm:pt-20">
        {bundle.length > 0 && (
          <section className="container-x" aria-labelledby="bundle-heading">
            <SectionHeading
              eyebrow="Complete your setup"
              title={<span id="bundle-heading">Frequently bought together</span>}
              className="!mb-5"
            />
            <BoughtTogether product={product} addons={bundle} discountPercent={product.bundleDiscountPercent ?? 0} />
          </section>
        )}

        <section className="container-x" aria-label="Product details">
          <ProductTabs sections={sections} />
        </section>

        <section id="reviews" className="container-x scroll-mt-28" aria-labelledby="reviews-heading">
          <SectionHeading eyebrow="Reviews" title={<span id="reviews-heading">Customer reviews</span>} className="!mb-6" />
          <ReviewsSection product={product} reviews={reviews} />
        </section>

        <section id="questions" className="container-x scroll-mt-28" aria-labelledby="questions-heading">
          <SectionHeading eyebrow="Questions" title={<span id="questions-heading">Questions & answers</span>} className="!mb-6" />
          <ProductQuestions productId={product.id} questions={questions} />
        </section>

        {related.length > 0 && (
          <section className="container-x" aria-labelledby="related-heading">
            <SectionHeading
              eyebrow="You may also like"
              title={<span id="related-heading">Related products</span>}
              href={`/category/${product.categorySlug}`}
              hrefLabel={`More ${product.categoryName}`}
            />
            <ProductCarousel products={related} label="Related products" />
          </section>
        )}

        <RecentlyViewed product={product} />
      </div>
      {(await draftMode()).isEnabled && <LivePreview />}
    </>
  );
}
