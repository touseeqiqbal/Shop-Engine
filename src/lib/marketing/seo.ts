import "server-only";
import type { Metadata } from "next";
import { platformOrigin } from "@/lib/tenant";
import { marketingHosts } from "./hosts";
import { SITE } from "./content";

/**
 * Addresses, metadata and structured data of the marketing site. Canonical links always use one address
 * (MARKETING_SITE_URL, else the first of MARKETING_HOSTS over https) so apex / www never count as two sites.
 */
export async function marketingOrigin(): Promise<string> {
  const env = (process.env.MARKETING_SITE_URL ?? "").trim().replace(/\/+$/, "");
  if (env) return env;
  const first = [...marketingHosts()][0];
  if (process.env.NODE_ENV === "production" && first) return `https://${first}`;
  // local development: the address in use (e.g. http://localtest.me:3100)
  return platformOrigin();
}

export const SOCIAL_IMAGE = { url: "/brand/shopengine/social-card.png", width: 1200, height: 630, alt: "ShopEngine – one platform, every store" };

/** A marketing page's metadata: title, description, canonical URL, Open Graph / Twitter cards. */
export function pageMeta({ title, description, path, type = "website", noindex = false, publishedTime }: { title: string; description: string; path: string; type?: "website" | "article"; noindex?: boolean; publishedTime?: string }): Metadata {
  const fullTitle = path === "/" ? title : `${title} | ${SITE.name}`;
  return {
    title: { absolute: fullTitle },
    description,
    alternates: { canonical: path },
    openGraph: { title: fullTitle, description, url: path, siteName: SITE.name, type, locale: "en_US", images: [SOCIAL_IMAGE], ...(publishedTime ? { publishedTime } : {}) },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [SOCIAL_IMAGE.url] },
    robots: noindex || process.env.STAGING === "true" ? { index: false, follow: false } : { index: true, follow: true },
  };
}

/* ───────────── structured data (schema.org JSON-LD) – nothing invented: no ratings, reviews or prices ───────────── */

export function organizationLd(origin: string) {
  return { "@context": "https://schema.org", "@type": "Organization", "@id": `${origin}/#organization`, name: SITE.name, url: origin, logo: `${origin}/brand/shopengine/app-icon-512.png`, slogan: SITE.tagline };
}

export function websiteLd(origin: string) {
  return { "@context": "https://schema.org", "@type": "WebSite", "@id": `${origin}/#website`, name: SITE.name, url: origin, publisher: { "@id": `${origin}/#organization` } };
}

export function softwareLd(origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE.name,
    url: origin,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Ecommerce platform",
    operatingSystem: "Web browser",
    description: SITE.description,
    publisher: { "@id": `${origin}/#organization` },
  };
}

export function breadcrumbLd(origin: string, items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Home", path: "/" }, ...items].map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${origin}${it.path === "/" ? "" : it.path}` })),
  };
}

export function articleLd(origin: string, a: { slug: string; title: string; description: string; date: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.description,
    datePublished: a.date,
    dateModified: a.date,
    url: `${origin}/blog/${a.slug}`,
    mainEntityOfPage: `${origin}/blog/${a.slug}`,
    image: `${origin}${SOCIAL_IMAGE.url}`,
    author: { "@type": "Organization", name: SITE.name, url: origin },
    publisher: { "@id": `${origin}/#organization` },
  };
}

export function faqLd(items: { q: string; a: string }[]) {
  return { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
}

/** JSON for a <script type="application/ld+json"> (`<` escaped so text can't close the tag). */
export const ldJson = (data: object | object[]) => JSON.stringify(data).replace(/</g, "\\u003c");
