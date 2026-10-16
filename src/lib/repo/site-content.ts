import "server-only";
import { unstable_cache } from "next/cache";
import { getSetting } from "./db";
import { TAGS, getStoreSettings } from "./catalog";
import { blankSiteInfo, mergeSiteInfo, type SiteInfo, type SiteInfoOverrides } from "@/lib/site-info";
import { mergeSeoSettings, type PageSeoMap, type PagesContentMap, type SeoSettings } from "@/lib/content/registry";
import { mergeHomeConfig, type HomeConfig } from "@/lib/content/home";
import { fillTokens, resolvePageContent, tokenValues } from "@/lib/content/page-defaults";
import { cmsPageTexts, cmsSeo, cmsSiteInfo } from "@/lib/cms/site";
import { currentStoreId, isPlatformRequest, platformOrigin, storeDirectory, storeOrigin } from "@/lib/tenant";
import { getMoney } from "@/lib/store-locale";

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

/**
 * Business profile (NAP, hours, socials) – saved overrides merged onto the defaults. The default store keeps the built-in
 * profile from `src/lib/site.ts`; every other store starts blank (its own name and address only – never another
 * business's phone numbers or address).
 */
const siteInfoCached = unstable_cache(
  async (storeId: number | null): Promise<SiteInfo> => {
    const store = storeId == null ? null : (await storeDirectory()).find((s) => s.id === storeId) ?? null;
    const saved = (await cmsSiteInfo(storeId)) ?? (store && !store.isDefault ? null : await getSetting<SiteInfoOverrides | null>(SETTING_KEYS.business, null));
    return mergeSiteInfo(saved, store && !store.isDefault ? blankSiteInfo(store.name, storeOrigin(store), store.country) : undefined);
  },
  ["site-business-v3"],
  opts(SITE_TAGS.business)
);
export const getSiteInfo = async (storeId?: number | null): Promise<SiteInfo> => {
  // ShopEngine's own address (merchant sign-up and sign-in): ShopEngine's name, never a store's
  if (storeId === undefined && (await isPlatformRequest())) return { ...blankSiteInfo("ShopEngine", await platformOrigin()), tagline: "The engine that powers shops", description: "One platform to launch and run independent online stores." };
  return siteInfoCached(storeId === undefined ? await currentStoreId() : storeId);
};

/** The store, when it isn't the original shop (whose built-in texts are its own). */
async function otherStore(storeId: number | null) {
  const store = storeId == null ? null : ((await storeDirectory()).find((s) => s.id === storeId) ?? null);
  return store && !store.isDefault ? store : null;
}

/** Saved values that are actually filled in (empty ones fall back to the defaults). */
const filled = <T extends object>(v: T | null | undefined): Partial<T> =>
  Object.fromEntries(Object.entries(v ?? {}).filter(([, x]) => x != null && x !== "" && !(Array.isArray(x) && !x.length))) as Partial<T>;

/** A store without its own SEO settings starts from its own name – never another shop's titles or keywords. */
const storeSeoDefaults = (name: string): Partial<SeoSettings> => ({ titleTemplate: `%s | ${name}`, defaultTitle: name, defaultDescription: `Shop online at ${name}.`, keywords: [name] });

const seoSettingsCached = unstable_cache(
  async (storeId: number | null): Promise<SeoSettings> => {
    const saved = (await cmsSeo(storeId))?.settings;
    const store = await otherStore(storeId);
    if (store) return mergeSeoSettings({ ...storeSeoDefaults(store.name), ...filled(saved) });
    return mergeSeoSettings(saved ?? (await getSetting<Partial<SeoSettings> | null>(SETTING_KEYS.seo, null)));
  },
  ["site-seo-v4"],
  opts(SITE_TAGS.seo)
);
export const getSeoSettings = async () => seoSettingsCached(await currentStoreId());

const pageSeoMapCached = unstable_cache(
  async (storeId: number | null): Promise<PageSeoMap> => (await cmsSeo(storeId))?.pages ?? ((await otherStore(storeId)) ? null : await getSetting<PageSeoMap | null>(SETTING_KEYS.pageSeo, null)) ?? {},
  ["site-page-seo-v4"],
  opts(SITE_TAGS.pageSeo)
);
export const getPageSeoMap = async () => pageSeoMapCached(await currentStoreId());

const pagesContentCached = unstable_cache(
  async (storeId: number | null): Promise<PagesContentMap> => (await cmsPageTexts(storeId)) ?? ((await otherStore(storeId)) ? null : await getSetting<PagesContentMap | null>(SETTING_KEYS.pages, null)) ?? {},
  ["site-pages-v4"],
  opts(SITE_TAGS.pages)
);
export const getPagesContent = async () => pagesContentCached(await currentStoreId());

/** A new store's home page until it builds its own: the standard sections with plain wording (no laptop shop texts). */
const plainHome = (): HomeConfig => ({ ...mergeHomeConfig(null), h1Highlight: "", h1Text: "Shop our latest products – delivered to your door", seoCopy: "" });

const homeConfigCached = unstable_cache(
  async (storeId: number | null): Promise<HomeConfig> => ((await otherStore(storeId)) ? plainHome() : mergeHomeConfig(await getSetting<Partial<HomeConfig> | null>(SETTING_KEYS.home, null))),
  ["site-home-v3"],
  opts(SITE_TAGS.home)
);
/** The legacy home-page layout (until the store builds its own "home" page): the original shop's saved one, else the defaults. */
export const getHomeConfig = async () => homeConfigCached(await currentStoreId());

/** Saved content for one page (empty object when nothing saved). */
export async function getPageContent(key: string) {
  return (await getPagesContent())[key] ?? {};
}

/**
 * Saved content for `key` over the built-in defaults, with {{tokens}} (phones, address, delivery
 * charges…) filled from the live Store info / Delivery settings. Also returns those for convenience.
 */
export async function getResolvedPageContent(key: string) {
  const [saved, info, settings, storeId, money] = await Promise.all([getPageContent(key), getSiteInfo(), getStoreSettings(), currentStoreId(), getMoney()]);
  const c = resolvePageContent(key, saved, { original: !(await otherStore(storeId)) });
  // amounts in the store's own currency
  const values = tokenValues(info, settings, money);
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
