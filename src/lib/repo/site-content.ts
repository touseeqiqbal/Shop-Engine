import "server-only";
import { unstable_cache } from "next/cache";
import { getSetting } from "./db";
import { TAGS, getStoreSettings } from "./catalog";
import { mergeSiteInfo, type SiteInfo, type SiteInfoOverrides } from "@/lib/site-info";
import { mergeSeoSettings, type PageSeoMap, type PagesContentMap, type SeoSettings } from "@/lib/content/registry";
import { mergeHomeConfig, type HomeConfig } from "@/lib/content/home";
import { fillTokens, resolvePageContent, tokenValues } from "@/lib/content/page-defaults";
import { cmsPageTexts, cmsSeo, cmsSiteInfo } from "@/lib/cms/site";

/**
 * Admin-editable site content & SEO (key/value settings). Every getter is cached with the
 * `settings` tag plus its own tag, so `invalidate("settings")` (or `updateTag(SITE_TAGS.x)`)
 * refreshes the whole storefront immediately.
 */

export const SETTING_KEYS = {
  business: "business",
  seo: "seo",
  pageSeo: "pageSeo",
  pages: "pages",
  home: "home",
  focusKeywords: "focusKeywords",
} as const;

export const SITE_TAGS = {
  business: "site-business",
  seo: "site-seo",
  pageSeo: "site-page-seo",
  pages: "site-pages",
  home: "site-home",
  focusKeywords: "site-focus-keywords",
} as const;

const REVALIDATE = 300;
const opts = (tag: string) => ({ tags: [TAGS.settings, tag], revalidate: REVALIDATE });

/** Business profile (NAP, hours, socials) – saved overrides merged onto `src/lib/site.ts`. */
export const getSiteInfo = unstable_cache(
  async (): Promise<SiteInfo> => mergeSiteInfo((await cmsSiteInfo()) ?? (await getSetting<SiteInfoOverrides | null>(SETTING_KEYS.business, null))),
  ["site-business-v2"],
  opts(SITE_TAGS.business)
);

export const getSeoSettings = unstable_cache(
  async (): Promise<SeoSettings> => mergeSeoSettings((await cmsSeo())?.settings ?? (await getSetting<Partial<SeoSettings> | null>(SETTING_KEYS.seo, null))),
  ["site-seo-v2"],
  opts(SITE_TAGS.seo)
);

export const getPageSeoMap = unstable_cache(
  async (): Promise<PageSeoMap> => (await cmsSeo())?.pages ?? (await getSetting<PageSeoMap | null>(SETTING_KEYS.pageSeo, null)) ?? {},
  ["site-page-seo-v2"],
  opts(SITE_TAGS.pageSeo)
);

export const getPagesContent = unstable_cache(
  async (): Promise<PagesContentMap> => (await cmsPageTexts()) ?? (await getSetting<PagesContentMap | null>(SETTING_KEYS.pages, null)) ?? {},
  ["site-pages-v2"],
  opts(SITE_TAGS.pages)
);

export const getHomeConfig = unstable_cache(
  async (): Promise<HomeConfig> => mergeHomeConfig(await getSetting<Partial<HomeConfig> | null>(SETTING_KEYS.home, null)),
  ["site-home-v1"],
  opts(SITE_TAGS.home)
);

/** Saved content for one page (empty object when nothing saved). */
export async function getPageContent(key: string) {
  return (await getPagesContent())[key] ?? {};
}

/**
 * Saved content for `key` over the built-in defaults, with {{tokens}} (phones, address, delivery
 * charges…) filled from the live Store info / Delivery settings. Also returns those for convenience.
 */
export async function getResolvedPageContent(key: string) {
  const [saved, info, settings] = await Promise.all([getPageContent(key), getSiteInfo(), getStoreSettings()]);
  const c = resolvePageContent(key, saved);
  const values = tokenValues(info, settings);
  const fill = (s: string) => fillTokens(s, values);
  return {
    eyebrow: fill(c.eyebrow),
    title: fill(c.title),
    description: fill(c.description),
    body: fill(c.body),
    intro: fill(c.intro),
    seoCopy: fill(c.seoCopy),
    updated: c.updated,
    info,
    settings,
  };
}
