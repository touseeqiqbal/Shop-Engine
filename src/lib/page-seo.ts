import "server-only";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { PAGE_DEF_BY_KEY, fillPlaceholders } from "@/lib/content/registry";
import { getPageSeoMap, getSeoSettings } from "@/lib/repo/site-content";

interface PageMetaOptions {
  /** Computed defaults (fall back to the registry entry for `key`) */
  title?: string;
  description?: string;
  image?: string;
  /** Actual URL path – required for template keys like `/laptops-in-{city}` */
  path?: string;
  /** Values for `{placeholder}` tokens in saved template titles/descriptions */
  vars?: Record<string, string>;
  /** Force noindex (e.g. filtered/search URLs) regardless of saved settings */
  noindex?: boolean;
  type?: "website" | "article";
  /** Values set in /cms (page builder → SEO tab); win over everything else when present */
  cms?: { title?: string; description?: string; image?: string; noindex?: boolean; canonical?: string };
}

/**
 * Page metadata with admin overrides from Content & SEO → Pages & SEO (setting `pageSeo`).
 * Empty saved fields fall back to the page's built-in defaults, so output is unchanged until edited.
 */
export async function getPageMeta(key: string, o: PageMetaOptions = {}): Promise<Metadata> {
  const def = PAGE_DEF_BY_KEY[key];
  const [map, seo] = await Promise.all([getPageSeoMap(), getSeoSettings()]);
  const saved = map[key] ?? {};
  const vars = o.vars ?? {};
  const pick = (v: string | undefined) => (v && v.trim() ? fillPlaceholders(v.trim(), vars) : "");
  // the SEO plugin's "generate" button makes "Home | Urko Tech Store" for the home page – not a real title
  const cmsTitle = o.cms?.title?.trim() && !(key === "/" && /^home\s*[|–-]/i.test(o.cms.title.trim())) ? o.cms.title.trim() : "";
  const title = cmsTitle || pick(saved.title) || o.title || fillPlaceholders(def?.title ?? "", vars);
  const description = o.cms?.description?.trim() || pick(saved.description) || o.description || fillPlaceholders(def?.description ?? "", vars);
  const image = o.cms?.image || saved.ogImage?.trim() || o.image || seo.defaultOgImage || undefined;
  const noindex = Boolean(o.noindex) || Boolean(o.cms?.noindex) || (saved.noindex ?? def?.noindex ?? false);
  return pageMetadata({ title, description, path: o.path ?? key, image, noindex, canonical: o.cms?.canonical, type: o.type });
}
