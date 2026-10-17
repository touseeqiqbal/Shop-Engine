import "server-only";
import { unstable_cache } from "next/cache";
import { isCmsConfigured } from "@/lib/db/config";
import { getCategoryTree, getProductBySlug } from "@/lib/repo/catalog";
import { CHROME_TAG } from "@/payload/revalidate";
import { DEFAULT_CHROME, toWaNumber, type Chrome, type NavLink } from "./chrome-types";
import { currentStoreId, getCurrentStore, runInStore } from "@/lib/tenant";
import { log } from "@/lib/log";

/**
 * Loads the "online store" settings (theme, announcement, header, footer, menus, WhatsApp button) from Payload.
 * Anything not configured falls back to DEFAULT_CHROME, which reproduces the original storefront.
 * Cached under CHROME_TAG; Payload hooks revalidate it the moment an admin saves.
 */

type Rel<T> = T | number | string | null | undefined;
type MediaDoc = { url?: string | null; alt?: string | null };
type LinkRow = {
  type?: string | null;
  label?: string | null;
  url?: string | null;
  newTab?: boolean | null;
  category?: Rel<{ slug?: string; name?: string; nameUr?: string | null; icon?: string | null }>;
  product?: Rel<{ slug?: string; title?: string }>;
  post?: Rel<{ slug?: string; title?: string }>;
  megaMenu?: boolean | null;
  icon?: string | null;
  featuredImage?: Rel<MediaDoc>;
  children?: LinkRow[] | null; // sub-items
  links?: LinkRow[] | null; // third level (under a sub-item)
};
type MenuDoc = { items?: LinkRow[] | null } | null;

const obj = <T,>(v: Rel<T>): T | null => (v && typeof v === "object" ? v : null);
const str = (v: unknown, fallback = "") => (typeof v === "string" && v.trim() ? v.trim() : fallback);
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

async function resolveLink(row: LinkRow): Promise<NavLink | null> {
  let href = "";
  let label = str(row.label);
  let labelUr: string | undefined;
  let icon = str(row.icon) || undefined;
  switch (row.type) {
    case "category": {
      const c = obj(row.category);
      if (!c?.slug) return null;
      href = `/category/${c.slug}`;
      label ||= c.name ?? c.slug;
      labelUr = c.nameUr ?? undefined;
      icon ||= c.icon ?? undefined;
      break;
    }
    case "product": {
      const p = obj(row.product);
      if (!p?.slug) return null;
      href = (await getProductBySlug(p.slug))?.url ?? `/shop?q=${encodeURIComponent(p.title ?? p.slug)}`;
      label ||= p.title ?? p.slug;
      break;
    }
    case "post": {
      const p = obj(row.post);
      if (!p?.slug) return null;
      href = `/blog/${p.slug}`;
      label ||= p.title ?? p.slug;
      break;
    }
    default:
      href = str(row.url);
      if (!href) return null;
      label ||= href;
  }
  const children = (await Promise.all((row.children ?? row.links ?? []).map(resolveLink))).filter((x): x is NavLink => Boolean(x));
  return {
    label,
    labelUr,
    href,
    newTab: Boolean(row.newTab),
    icon,
    mega: Boolean(row.megaMenu),
    image: obj(row.featuredImage)?.url ?? null,
    children,
  };
}

async function resolveMenu(menu: Rel<MenuDoc>): Promise<NavLink[] | null> {
  const m = obj(menu);
  if (!m?.items?.length) return null;
  return (await Promise.all(m.items.map(resolveLink))).filter((x): x is NavLink => Boolean(x));
}

async function loadFromPayload(storeId: number | null): Promise<Chrome> {
  const [{ getPayload }, { default: config }, { getStoreSettings }] = await Promise.all([import("payload"), import("@payload-config"), import("@/payload/store-settings")]);
  const payload = await getPayload({ config });
  // the store's own theme, header, footer … (the default store falls back to the original globals)
  const g = (slug: string) => getStoreSettings<Record<string, unknown>>(payload, slug as never, storeId, { depth: 3 });
  const [theme, ann, header, footer, wa] = await Promise.all([g("theme-settings"), g("announcement-bar"), g("header"), g("footer"), g("whatsapp-button")]);
  const d = DEFAULT_CHROME;
  const media = (v: unknown) => obj(v as Rel<MediaDoc>);

  const now = Date.now();
  const startsAt = ann.startsAt ? Date.parse(String(ann.startsAt)) : null;
  const endsAt = ann.endsAt ? Date.parse(String(ann.endsAt)) : null;
  const inWindow = (!startsAt || startsAt <= now) && (!endsAt || endsAt > now);

  const columns = Array.isArray(footer.columns) && footer.columns.length
    ? await Promise.all((footer.columns as { title?: string; menu?: Rel<MenuDoc> }[]).map(async (c) => ({ title: str(c.title), links: (await resolveMenu(c.menu)) ?? [] })))
    : null;
  const numbers = Array.isArray(wa.contacts)
    ? (wa.contacts as { label?: string; phone?: string }[]).filter((n) => n.phone).map((n) => ({ label: str(n.label, "WhatsApp"), display: str(n.phone), wa: toWaNumber(String(n.phone)) }))
    : [];

  return {
    theme: {
      logoDark: media(theme.logoDark)?.url ?? null,
      logoLight: media(theme.logoLight)?.url ?? media(theme.logoDark)?.url ?? null,
      logoAlt: media(theme.logoDark)?.alt || d.theme.logoAlt,
      logoHeight: Number(theme.logoHeight) || d.theme.logoHeight,
      favicon: media(theme.favicon)?.url ?? null,
      background: str(theme.background, d.theme.background),
      backgroundLight: str(theme.backgroundLight, d.theme.backgroundLight),
      accent: str(theme.accent, d.theme.accent),
      gradientFrom: str(theme.gradientFrom, d.theme.gradientFrom),
      gradientVia: str(theme.gradientVia, d.theme.gradientVia),
      gradientTo: str(theme.gradientTo, d.theme.gradientTo),
      bodyFont: (str(theme.bodyFont, d.theme.bodyFont) as Chrome["theme"]["bodyFont"]),
      headingFont: (str(theme.headingFont, d.theme.headingFont) as Chrome["theme"]["headingFont"]),
      buttonStyle: (str(theme.buttonStyle, d.theme.buttonStyle) as Chrome["theme"]["buttonStyle"]),
      cardRadius: (str(theme.cardRadius, d.theme.cardRadius) as Chrome["theme"]["cardRadius"]),
      defaultMode: theme.defaultMode === "light" ? "light" : "dark",
      allowModeToggle: bool(theme.allowModeToggle, true),
    },
    announcement: {
      enabled: bool(ann.enabled, true) && inWindow,
      text: str(ann.text),
      linkUrl: str(ann.linkUrl),
      linkLabel: str(ann.linkLabel),
      backgroundColor: str(ann.backgroundColor),
      textColor: str(ann.textColor),
      showContactLinks: bool(ann.showContactLinks, true),
    },
    header: {
      sticky: bool(header.sticky, true),
      showSearch: bool(header.showSearch, true),
      showLanguageToggle: bool(header.showLanguageToggle, true),
      showAccountLinks: bool(header.showAccountLinks, true),
      menu: await resolveMenu(header.mainMenu as Rel<MenuDoc>),
      mobileMenu: await resolveMenu(header.mobileMenu as Rel<MenuDoc>),
    },
    footer: {
      about: str(footer.about, d.footer.about),
      columns,
      showContactInfo: bool(footer.showContactInfo, true),
      showSocialLinks: bool(footer.showSocialLinks, true),
      showCityLinks: bool(footer.showCityLinks, true),
      paymentBadges: Array.isArray(footer.paymentBadges) && footer.paymentBadges.length ? (footer.paymentBadges as string[]) : d.footer.paymentBadges,
      copyright: str(footer.copyright, d.footer.copyright),
    },
    whatsapp: {
      enabled: bool(wa.enabled, true),
      numbers,
      message: str(wa.message, d.whatsapp.message),
      note: str(wa.note),
      position: wa.position === "left" ? "left" : "right",
    },
  };
}

const chromeCached = unstable_cache(
  async (storeId: number | null): Promise<Chrome> => {
    if (!isCmsConfigured) return DEFAULT_CHROME;
    try {
      // links to products resolve within this store
      return await runInStore(storeId, () => loadFromPayload(storeId));
    } catch (e) {
      // Never break the storefront because the CMS is unavailable – fall back to the built-in design.
      log.error("chrome.cms_unavailable_using_defaults", e);
      return DEFAULT_CHROME;
    }
  },
  ["cms-chrome-v2"],
  { tags: [CHROME_TAG], revalidate: 300 }
);
/** Theme, header, footer, announcement and WhatsApp button of the current store. */
export const getChrome = async () => chromeCached(await currentStoreId());

/** Built-in main menu (used until a menu is assigned in Online store → Header): categories mega menu + key links. */
export async function defaultMainMenu(): Promise<NavLink[]> {
  const tree = await getCategoryTree();
  const store = await getCurrentStore();
  const categories: NavLink = {
    label: "Categories",
    labelUr: "کیٹیگریز",
    href: "/category",
    icon: "LayoutGrid",
    mega: true,
    children: tree.map((c) => ({
      label: c.name,
      labelUr: c.nameUr,
      href: `/category/${c.slug}`,
      icon: c.icon,
      children: c.children.map((s) => ({ label: s.name, href: `/category/${s.slug}`, children: [] })),
    })),
  };
  // a new store: just its own categories and the basics (the original shop keeps its laptop links)
  if (store && !store.isDefault)
    return [
      categories,
      { label: "Shop", href: "/shop", children: [] },
      { label: "Deals", href: "/deals", children: [] },
      { label: "Blog", href: "/blog", children: [] },
    ];
  return [
    categories,
    { label: "Laptops", labelUr: "لیپ ٹاپ", href: "/category/laptops", children: [] },
    { label: "Hot Deals", labelUr: "ہاٹ ڈیلز", href: "/deals", children: [] },
    { label: "Find Parts", labelUr: "پارٹس تلاش کریں", href: "/find-parts", children: [] },
    { label: "Wholesale", labelUr: "ہول سیل", href: "/wholesale", children: [] },
    { label: "Blog", labelUr: "بلاگ", href: "/blog", children: [] },
  ];
}
