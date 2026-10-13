/**
 * Page builder blocks (Payload → Pages), normalised for rendering. Client-safe.
 * Both sources map to this shape: Payload pages (src/lib/cms/pages.ts) and the legacy home-page config
 * (`legacyHomeToPage`), so the storefront has a single renderer (src/components/blocks/render-blocks.tsx).
 * Ids in here are always legacy (Prisma) ids – the storefront catalog is still served from Prisma.
 */
import { SECTION_DEFAULTS, SECTION_META, sectionText, type HomeConfig, type HomeSectionType, type TrustBadgeText } from "@/lib/content/home";

export interface BlockText {
  eyebrow: string;
  title: string;
  description: string;
  linkLabel: string;
  linkHref: string;
}

export interface HeroSlideData {
  id: string;
  eyebrow?: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  image: string;
  accent?: string;
}

export type ProductSource = "newArrivals" | "bestSellers" | "topAccessories" | "category" | "collection" | "manual";

export type PageBlock =
  | { type: "hero"; slides: HeroSlideData[] } // empty = slides from Marketing → Banners
  | { type: "trust"; badges: TrustBadgeText[] }
  | { type: "categories"; text: BlockText; categoryIds: string[] } // empty = all top-level categories
  | { type: "deals"; text: BlockText; source: "auto" | "manual"; productIds: string[]; limit?: number }
  | { type: "products"; text: BlockText; source: ProductSource; categoryId?: string; collectionSlug?: string; productIds: string[]; limit?: number }
  | { type: "finder"; text: BlockText }
  | { type: "brands"; text: BlockText }
  | { type: "installment"; text: BlockText }
  | { type: "testimonials"; text: BlockText }
  | { type: "social"; text: BlockText }
  | { type: "location"; text: BlockText }
  | { type: "richText"; html?: string; markdown?: string; boxed: boolean; width: "narrow" | "wide" }
  | { type: "imageBanner"; image: string; alt: string; eyebrow: string; heading: string; text: string; buttonLabel: string; buttonHref: string; align: "left" | "center"; height: "sm" | "md" | "lg" }
  | { type: "imageText"; image: string; alt: string; eyebrow: string; heading: string; html: string; buttonLabel: string; buttonHref: string; imageSide: "left" | "right" }
  | { type: "faq"; text: BlockText; items: { question: string; answer: string }[] }
  | { type: "cta"; heading: string; text: string; buttons: { label: string; href: string; style: "primary" | "secondary" | "whatsapp" }[] };

export type PageBlockType = PageBlock["type"];

export interface PageData {
  title: string;
  slug: string;
  h1Highlight: string;
  h1Text: string;
  blocks: PageBlock[];
  meta: { title?: string; description?: string; image?: string; noindex?: boolean; canonical?: string };
  /** true when the page comes from Payload (false = built-in / legacy config) */
  fromCms: boolean;
}

/** Product carousel sections of the legacy home builder → `products` block source. */
const LEGACY_PRODUCT_SOURCES: Partial<Record<HomeSectionType, ProductSource>> = {
  newArrivals: "newArrivals",
  bestSellers: "bestSellers",
  topAccessories: "topAccessories",
};

/** Text with the section defaults applied (empty = default), as the legacy builder did. */
export function textWithDefaults(type: HomeSectionType, t: Partial<BlockText> = {}): BlockText {
  return sectionText({ type, enabled: true, ...t });
}

export const emptyText = (): BlockText => ({ eyebrow: "", title: "", description: "", linkLabel: "", linkHref: "" });

/** Legacy home config (old admin → Content & SEO → Home page) → page data. Output renders identically. */
export function legacyHomeToPage(config: HomeConfig): PageData {
  const blocks: PageBlock[] = [];
  for (const s of config.sections) {
    if (!s.enabled) continue;
    const text = sectionText(s);
    const products = { productIds: s.source === "manual" ? s.productIds ?? [] : [], limit: s.limit };
    switch (s.type) {
      case "hero":
        blocks.push({ type: "hero", slides: [] });
        break;
      case "trust":
        blocks.push({ type: "trust", badges: config.trustBadges });
        break;
      case "categories":
        blocks.push({ type: "categories", text, categoryIds: config.featuredCategoryIds });
        break;
      case "deals":
        blocks.push({ type: "deals", text, source: s.source === "manual" ? "manual" : "auto", ...products });
        break;
      case "newArrivals":
      case "bestSellers":
      case "topAccessories":
        blocks.push({ type: "products", text, source: s.source === "manual" && s.productIds?.length ? "manual" : LEGACY_PRODUCT_SOURCES[s.type]!, ...products });
        break;
      case "seoCopy":
        if (config.seoCopy.trim()) blocks.push({ type: "richText", markdown: config.seoCopy, boxed: true, width: "wide" });
        break;
      default:
        blocks.push({ type: s.type, text });
    }
  }
  return { title: "Home", slug: "home", h1Highlight: config.h1Highlight, h1Text: config.h1Text, blocks, meta: {}, fromCms: false };
}

/** Default number of products for automatic carousels. */
export const AUTO_LIMIT: Record<ProductSource | "deals", number> = {
  deals: SECTION_META.deals.autoLimit!,
  newArrivals: SECTION_META.newArrivals.autoLimit!,
  bestSellers: SECTION_META.bestSellers.autoLimit!,
  topAccessories: SECTION_META.topAccessories.autoLimit!,
  category: 10,
  collection: 12,
  manual: 48,
};

export { SECTION_DEFAULTS };
