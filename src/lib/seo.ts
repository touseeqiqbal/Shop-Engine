import type { Metadata } from "next";
import { absoluteUrl, site } from "./site";
import { DEFAULT_SITE_INFO, socialLinks, type SiteInfo } from "./site-info";
import type { BlogPost, CatalogProduct, FaqItem, Review } from "./types";
import { effectivePrice } from "./utils";
import { paymentEnabled } from "@/lib/cities";
import type { StoreSettings } from "@/lib/types";

/**
 * Uploaded photos are WebP; WhatsApp, Facebook and the Meta / TikTok catalogues handle JPEG best – link the JPEG copy
 * (/feed-image/…) of an uploaded photo. Other images are used as they are.
 */
export const jpegImageUrl = (src: string) => absoluteUrl(src.startsWith("/media/") ? `/feed-image/${src.slice("/media/".length)}` : src);

interface PageMetaInput {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: "website" | "article";
  noindex?: boolean;
  /** Set in /cms (SEO → Canonical URL) when this page duplicates another one */
  canonical?: string;
  publishedTime?: string;
  modifiedTime?: string;
}

/** Should this page be in the sitemap? Not when hidden from search engines or pointing at another original. */
export const indexable = (s: { seoNoindex?: boolean; seoCanonical?: string }) => !s.seoNoindex && !s.seoCanonical;

/**
 * Builds unique metadata with canonical URL, Open Graph & Twitter cards.
 * `title` is used as-is (the root layout template appends the brand only when a plain string is passed).
 */
export function pageMetadata({ title, description, path, image, type = "website", noindex, canonical, publishedTime, modifiedTime }: PageMetaInput): Metadata {
  // relative links: Next.js resolves them against the store's own address (metadataBase in the root layout)
  const rel = (p: string) => (p.startsWith("/") ? p : `/${p}`);
  const url = rel(path);
  const canonicalUrl = canonical ? (/^https?:\/\//.test(canonical) ? canonical : rel(canonical)) : url;
  // a page's own photo has its own size (product photos are square); only the brand image is 1200×630
  const images = image
    ? [{ url: /^https?:\/\//.test(image) ? image : image.startsWith("/media/") ? `/feed-image/${image.slice("/media/".length)}` : rel(image), alt: title }]
    : [{ url: "/opengraph-image", width: 1200, height: 630, alt: title }];
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type,
      url,
      title,
      description,
      locale: "en_PK",
      images,
      ...(type === "article" ? { publishedTime, modifiedTime } : {}),
    },
    twitter: { card: "summary_large_image", title, description, images: images.map((i) => i.url) },
    robots: noindex ? { index: false, follow: true } : undefined,
  };
}

// ───────────────────────────── JSON-LD builders ─────────────────────────────

export const ORG_ID = `${site.url}/#organization`;
export const STORE_ID = `${site.url}/#store`;

/** `info` = live business profile from `getSiteInfo()` (defaults to the built-in `site` details). */
/** A logo / image path or URL as an absolute URL. */
const abs = (src: string) => (/^https?:\/\//.test(src) ? src : absoluteUrl(src));

export function organizationJsonLd(info: SiteInfo = DEFAULT_SITE_INFO, logo = "/icon.svg") {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID,
    name: info.name,
    url: site.url,
    logo: abs(logo),
    email: info.email,
    contactPoint: info.phones.map((p) => ({
      "@type": "ContactPoint",
      telephone: p.tel,
      contactType: "sales",
      areaServed: "PK",
      availableLanguage: ["English", "Urdu"],
    })),
    sameAs: socialLinks(info).map((l) => l.href),
  };
}

/** Payment methods switched on in /cms → Delivery & payments → Payment methods, in words for Google. */
export function paymentsAcceptedText(settings?: StoreSettings | null) {
  if (!settings) return "Cash on Delivery, JazzCash, EasyPaisa, Bank Transfer";
  const names: [Parameters<typeof paymentEnabled>[0], string][] = [["cod", "Cash on Delivery"], ["jazzcash", "JazzCash"], ["easypaisa", "EasyPaisa"], ["bank", "Bank Transfer"]];
  return names.filter(([m]) => paymentEnabled(m, settings)).map(([, n]) => n).join(", ") || "Cash";
}

export function localBusinessJsonLd(info: SiteInfo = DEFAULT_SITE_INFO, settings?: StoreSettings | null, logo = "/icon.svg") {
  return {
    "@context": "https://schema.org",
    "@type": ["ElectronicsStore", "LocalBusiness"],
    "@id": STORE_ID,
    name: info.name,
    description: info.description,
    url: site.url,
    image: absoluteUrl("/opengraph-image"),
    logo: abs(logo),
    email: info.email,
    telephone: info.phones[0]?.tel,
    priceRange: "Rs",
    currenciesAccepted: "PKR",
    paymentAccepted: paymentsAcceptedText(settings),
    address: {
      "@type": "PostalAddress",
      streetAddress: info.address.street,
      addressLocality: `${info.address.area}, ${info.address.city}`,
      addressRegion: info.address.region,
      postalCode: info.address.postalCode,
      addressCountry: info.address.countryCode,
    },
    geo: { "@type": "GeoCoordinates", latitude: info.geo.lat, longitude: info.geo.lng },
    hasMap: info.mapLink,
    openingHoursSpecification: info.hours.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: h.days,
      opens: h.opens,
      closes: h.closes,
    })),
    contactPoint: info.phones.map((p) => ({ "@type": "ContactPoint", telephone: p.tel, contactType: "customer service" })),
    areaServed: { "@type": "Country", name: "Pakistan" },
    parentOrganization: { "@id": ORG_ID },
  };
}

export function websiteJsonLd(info: SiteInfo = DEFAULT_SITE_INFO) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${site.url}/#website`,
    url: site.url,
    name: info.name,
    publisher: { "@id": ORG_ID },
    inLanguage: "en-PK",
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${site.url}/shop?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; href: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.href),
    })),
  };
}

const CONDITION_SCHEMA: Record<string, string> = {
  new: "https://schema.org/NewCondition",
  "open-box": "https://schema.org/NewCondition",
  refurbished: "https://schema.org/RefurbishedCondition",
  "used-a-plus": "https://schema.org/UsedCondition",
  "used-a": "https://schema.org/UsedCondition",
};

/** Shipping cost and return window for Google's merchant listings (from Delivery charges and Returns & warranty rules). */
export type OfferExtras = { shippingRate?: number; returnDays?: number; restockingFee?: boolean };

export function productJsonLd(p: CatalogProduct, reviews: Review[] = [], extras: OfferExtras = {}) {
  const priceValidUntil = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${absoluteUrl(p.url)}#product`,
    name: p.name,
    sku: p.sku,
    description: p.shortDescription,
    image: p.images.map((i) => absoluteUrl(i)),
    brand: { "@type": "Brand", name: p.brandName },
    category: p.categoryName,
    itemCondition: CONDITION_SCHEMA[p.condition ?? "new"],
    // Quote-only wholesale lots have no public price. Google rejects an Offer without `price`, so no Offer is emitted;
    // callers should only render this markup for such products when it has reviews/ratings (otherwise skip it).
    ...(p.priceOnRequest ? {} : p.variants?.length ? {
      // options (colour / size …): Google reads each variant as its own offer
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "PKR",
        lowPrice: Math.min(...p.variants.map(effectivePrice)),
        highPrice: Math.max(...p.variants.map(effectivePrice)),
        offerCount: p.variants.length,
        availability: p.variants.some((v) => v.stock > 0) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        offers: p.variants.map((v) => ({
          "@type": "Offer",
          sku: v.sku,
          name: v.name,
          url: absoluteUrl(v.url),
          priceCurrency: "PKR",
          price: effectivePrice(v),
          priceValidUntil,
          availability: v.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          itemCondition: CONDITION_SCHEMA[v.condition ?? p.condition ?? "new"],
          seller: { "@id": STORE_ID },
        })),
      },
    } : { offers: {
      "@type": "Offer",
      url: absoluteUrl(p.url),
      priceCurrency: "PKR",
      price: effectivePrice(p),
      priceValidUntil,
      availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: CONDITION_SCHEMA[p.condition ?? "new"],
      seller: { "@id": STORE_ID },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        ...(extras.shippingRate != null ? { shippingRate: { "@type": "MonetaryAmount", value: extras.shippingRate, currency: "PKR" } } : {}),
        shippingDestination: { "@type": "DefinedRegion", addressCountry: "PK" },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
          transitTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 5, unitCode: "DAY" },
        },
      },
      ...(extras.returnDays != null
        ? {
            hasMerchantReturnPolicy: {
              "@type": "MerchantReturnPolicy",
              applicableCountry: "PK",
              ...(extras.returnDays > 0
                ? {
                    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
                    merchantReturnDays: extras.returnDays,
                    returnMethod: "https://schema.org/ReturnByMail",
                    returnFees: extras.restockingFee ? "https://schema.org/RestockingFees" : "https://schema.org/FreeReturn",
                  }
                : { returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted" }),
            },
          }
        : {}),
    } }),
    // only real, approved reviews count (Google penalises ratings that don't match visible reviews)
    ...(reviews.length
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10,
            reviewCount: reviews.length,
            bestRating: 5,
          },
        }
      : {}),
    ...(reviews.length
      ? {
          review: reviews.slice(0, 5).map((r) => ({
            "@type": "Review",
            author: { "@type": "Person", name: r.name },
            datePublished: r.createdAt.slice(0, 10),
            reviewBody: r.body,
            reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
          })),
        }
      : {}),
  };
}

export function faqJsonLd(faqs: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

/** `storeName` = the current store's name (the author when the post names none). */
export function articleJsonLd(post: BlogPost, storeName: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    // no cover → no image (never pretend the home page is the article's picture)
    ...(post.cover ? { image: [absoluteUrl(post.cover)] } : {}),
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    author: { "@type": "Organization", name: post.author || storeName, url: site.url },
    publisher: { "@id": ORG_ID },
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
    keywords: post.tags.join(", "),
  };
}

export function itemListJsonLd(products: CatalogProduct[], name: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    itemListElement: products.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(p.url), name: p.name })),
  };
}
