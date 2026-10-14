/**
 * Home page builder config (setting key `home`). Client-safe.
 * The defaults reproduce the hand-built home page exactly; `mergeHomeConfig()` fills any gaps
 * so new sections added in code show up for stores that saved an older config.
 */

export type HomeSectionType =
  | "hero"
  | "trust"
  | "categories"
  | "deals"
  | "finder"
  | "newArrivals"
  | "brands"
  | "bestSellers"
  | "topAccessories"
  | "installment"
  | "testimonials"
  | "social"
  | "location"
  | "seoCopy";

export interface HomeSection {
  type: HomeSectionType;
  enabled: boolean;
  eyebrow?: string;
  title?: string;
  description?: string;
  linkLabel?: string;
  linkHref?: string;
  /** Product carousels only */
  source?: "auto" | "manual";
  productIds?: string[];
  limit?: number;
}

export interface TrustBadgeText {
  title: string;
  text: string;
}

export interface HomeConfig {
  /** Gradient part of the H1, e.g. "Laptop shop in Karachi" */
  h1Highlight: string;
  /** Rest of the H1 after the “·” */
  h1Text: string;
  sections: HomeSection[];
  /** Ordered category ids for the bento grid; empty = all top-level categories */
  featuredCategoryIds: string[];
  trustBadges: TrustBadgeText[];
  /** Markdown */
  seoCopy: string;
}

export interface SectionMeta {
  type: HomeSectionType;
  label: string;
  help: string;
  /** Which text fields the section supports */
  fields: ("eyebrow" | "title" | "description" | "linkLabel" | "linkHref")[];
  products?: boolean;
  /** Default number of products for "auto" carousels */
  autoLimit?: number;
  /** Text shown when the eyebrow is empty and the value is dynamic */
  dynamicEyebrow?: string;
}

export const SECTION_META: Record<HomeSectionType, SectionMeta> = {
  hero: { type: "hero", label: "Hero slider", help: "Slides are managed in Marketing → Banners. The H1 line is rendered above the slider.", fields: [] },
  trust: { type: "trust", label: "Trust badges", help: "Cash on Delivery, delivery, warranty… Edit the badge texts below.", fields: [] },
  categories: { type: "categories", label: "Categories bento", help: "Large tiles linking to your categories. Choose which categories and their order below.", fields: ["eyebrow", "title", "description", "linkLabel", "linkHref"] },
  deals: { type: "deals", label: "Hot deals", help: "Auto = products of the running flash sale, otherwise products marked “Hot deal”.", fields: ["eyebrow", "title", "linkLabel", "linkHref"], products: true, autoLimit: 8, dynamicEyebrow: "Flash sale title or “Hot Deals”" },
  finder: { type: "finder", label: "Parts finder", help: "“Find parts for your laptop” compatibility tool.", fields: ["title", "description"] },
  newArrivals: { type: "newArrivals", label: "New arrivals", help: "Auto = newest products first.", fields: ["eyebrow", "title", "linkLabel", "linkHref"], products: true, autoLimit: 10 },
  brands: { type: "brands", label: "Brand strip", help: "Scrolling marquee of all brands.", fields: ["eyebrow", "title", "linkLabel", "linkHref"] },
  bestSellers: { type: "bestSellers", label: "Best sellers", help: "Auto = products marked “Best seller” or with 100+ sales.", fields: ["eyebrow", "title", "linkLabel", "linkHref"], products: true, autoLimit: 10 },
  topAccessories: { type: "topAccessories", label: "Top accessories", help: "Auto = most-sold non-laptop products.", fields: ["eyebrow", "title", "linkLabel", "linkHref"], products: true, autoLimit: 10 },
  installment: { type: "installment", label: "Installment banner", help: "Promo banner linking to /installments.", fields: ["eyebrow", "title", "description", "linkLabel", "linkHref"] },
  testimonials: { type: "testimonials", label: "Testimonials", help: "Reviews are managed in Store → Testimonials.", fields: ["eyebrow", "title"] },
  social: { type: "social", label: "Instagram & TikTok", help: "Links to your social profiles (Store info).", fields: ["eyebrow", "title", "description"] },
  location: { type: "location", label: "Store location & map", help: "Address, hours and Google Map from Store info.", fields: ["eyebrow", "title", "description"] },
  seoCopy: { type: "seoCopy", label: "SEO copy", help: "Long-form Markdown text at the bottom – great for local keywords.", fields: [] },
};

/** Default copy per section – identical to the original hand-built page. */
export const SECTION_DEFAULTS: Record<HomeSectionType, Omit<HomeSection, "type" | "enabled">> = {
  hero: {},
  trust: {},
  categories: {
    eyebrow: "Shop by category",
    title: "Everything tech, one store",
    description: "Laptops, chargers, batteries, peripherals and more – all checked, tested and ready to ship.",
    linkLabel: "All categories",
    linkHref: "/category",
  },
  deals: { eyebrow: "", title: "Hot deals – limited time", linkLabel: "See all deals →", linkHref: "/deals" },
  finder: { title: "Find parts for your laptop", description: "Select your laptop and instantly see compatible chargers, batteries, keyboards, RAM and SSDs." },
  newArrivals: { eyebrow: "Just landed", title: "New arrivals", linkLabel: "View all", linkHref: "/shop?sort=newest" },
  brands: { eyebrow: "Top brands", title: "Shop by brand", linkLabel: "All brands", linkHref: "/brands" },
  bestSellers: { eyebrow: "Customer favourites", title: "Best sellers", linkLabel: "View all", linkHref: "/shop?sort=popular" },
  topAccessories: { eyebrow: "Upgrade your setup", title: "Top accessories", linkLabel: "View all", linkHref: "/shop?sort=popular" },
  installment: {
    eyebrow: "Easy payments",
    title: "Easy installment plans",
    description: "Buy your next laptop on easy monthly installments with partner banks. Ask us on WhatsApp for current options.",
    linkLabel: "Installment plan details",
    linkHref: "/installments",
  },
  testimonials: { eyebrow: "Customer reviews", title: "What our customers say" },
  // eyebrow "" = the store's own social handle (from Store details)
  social: { eyebrow: "", title: "Follow us on Instagram & TikTok", description: "Unboxings, laptop tips and the latest arrivals from our Saddar store." },
  location: {
    eyebrow: "Visit our store",
    title: "Laptop shop in Saddar, Karachi",
    description:
      "Come check laptops in person at the heart of Karachi's **Regal Chowk laptop market**. Free SSD & RAM installation when you buy from us.",
  },
  seoCopy: {},
};

/**
 * Some defaults above (and the trust badges / H1 below) describe the original shop's Saddar store. Any other store shows
 * these plain texts instead wherever a section still has that built-in text (empty = the location section's wording
 * from the store's own address).
 */
export const NEUTRAL_SECTION_TEXT: Partial<Record<HomeSectionType, Partial<Record<"eyebrow" | "title" | "description", string>>>> = {
  social: { description: "Unboxings, tips and the latest arrivals." },
  location: { title: "", description: "" },
};
export const NEUTRAL_TRUST_TEXT: Record<string, string> = { "Karachi same / next day": "Fast, tracked delivery" };

export const DEFAULT_SECTION_ORDER: HomeSectionType[] = [
  "hero",
  "trust",
  "categories",
  "deals",
  "finder",
  "newArrivals",
  "brands",
  "bestSellers",
  "topAccessories",
  "installment",
  "testimonials",
  "social",
  "location",
  "seoCopy",
];

export const DEFAULT_TRUST_BADGES: TrustBadgeText[] = [
  { title: "Cash on Delivery", text: "Pay when you receive" },
  { title: "Delivery All Over Pakistan", text: "Karachi same / next day" },
  { title: "Warranty", text: "On every laptop & part" },
  { title: "Checked & Tested", text: "30+ point inspection" },
  { title: "Easy Returns", text: "3-day replacement" },
];

export const DEFAULT_HOME_SEO_COPY = `## Your trusted laptop shop in Karachi – delivering all over Pakistan

**{{storeName}}** is a laptop and computer accessories shop located at **Regal Trade Square, Regal Chowk, Saddar, Karachi** – the city's most famous laptop market. Whether you are looking for **used laptops in Karachi**, a brand new gaming laptop, or a replacement charger for your old HP, we make it easy to **buy laptops online in Pakistan** with Cash on Delivery.

### New, used & refurbished laptops at the best laptop price in Pakistan
We stock HP EliteBook and ProBook, Dell Latitude and XPS, Lenovo ThinkPad, Apple MacBook Air and MacBook Pro, Asus TUF and MSI gaming laptops. Every used laptop is graded (Used A+ or Used A), and every refurbished machine is checked & tested on 30+ points – battery health, display, keyboard, ports, Wi-Fi and thermals – so you know exactly what you are getting. Our **laptop prices in Pakistan** are updated daily.

### Laptop chargers, batteries & parts that fit
Searching for the right **laptop charger price in Pakistan** or a **laptop battery in Karachi**? Use our "Find Parts for Your Laptop" tool to see chargers, batteries, keyboards and RAM that are compatible with your exact laptop model.

### Gaming accessories & computer peripherals
From the best **gaming mouse price in Pakistan** to a clicky **mechanical keyboard in Pakistan**, headsets, SSDs, RAM, USB-C hubs, routers, monitors and webcams – everything you need for work, study and gaming is in one place.

### Fast delivery all over Pakistan
Karachi orders arrive the same or next day. We deliver to Lahore, Islamabad, Rawalpindi, Faisalabad, Multan, Peshawar, Quetta, Hyderabad, Sialkot and every other city through TCS, Leopards, M&P, Trax, PostEx and Call Courier – usually within 1–5 working days.`;

export const DEFAULT_HOME: HomeConfig = {
  h1Highlight: "Laptop shop in Karachi",
  h1Text: "New, used & refurbished laptops and accessories – delivered all over Pakistan",
  sections: DEFAULT_SECTION_ORDER.map((type) => ({ type, enabled: true, source: SECTION_META[type].products ? "auto" : undefined })),
  featuredCategoryIds: [],
  trustBadges: DEFAULT_TRUST_BADGES,
  seoCopy: DEFAULT_HOME_SEO_COPY,
};

const str = (v: unknown) => (typeof v === "string" ? v : undefined);

/** Normalise a saved config: unknown sections dropped, missing ones appended (disabled = false → enabled). */
export function mergeHomeConfig(saved: Partial<HomeConfig> | null | undefined): HomeConfig {
  if (!saved || typeof saved !== "object") return structuredClone(DEFAULT_HOME);
  const seen = new Set<HomeSectionType>();
  const sections: HomeSection[] = [];
  for (const s of Array.isArray(saved.sections) ? saved.sections : []) {
    if (!s || !(s.type in SECTION_META) || seen.has(s.type)) continue;
    seen.add(s.type);
    const meta = SECTION_META[s.type];
    sections.push({
      type: s.type,
      enabled: s.enabled !== false,
      eyebrow: str(s.eyebrow),
      title: str(s.title),
      description: str(s.description),
      linkLabel: str(s.linkLabel),
      linkHref: str(s.linkHref),
      source: meta.products ? (s.source === "manual" ? "manual" : "auto") : undefined,
      productIds: meta.products && Array.isArray(s.productIds) ? s.productIds.filter((x) => typeof x === "string") : undefined,
      limit: meta.products && Number.isFinite(Number(s.limit)) && Number(s.limit) > 0 ? Math.min(48, Math.round(Number(s.limit))) : undefined,
    });
  }
  for (const type of DEFAULT_SECTION_ORDER) if (!seen.has(type)) sections.push({ type, enabled: true, source: SECTION_META[type].products ? "auto" : undefined });
  const badges = Array.isArray(saved.trustBadges) ? saved.trustBadges : [];
  return {
    h1Highlight: str(saved.h1Highlight) ?? DEFAULT_HOME.h1Highlight,
    h1Text: str(saved.h1Text) ?? DEFAULT_HOME.h1Text,
    sections,
    featuredCategoryIds: Array.isArray(saved.featuredCategoryIds) ? saved.featuredCategoryIds.filter((x) => typeof x === "string") : [],
    trustBadges: DEFAULT_TRUST_BADGES.map((d, i) => ({ title: badges[i]?.title?.trim() || d.title, text: badges[i]?.text?.trim() || d.text })),
    seoCopy: typeof saved.seoCopy === "string" && saved.seoCopy.trim() ? saved.seoCopy : DEFAULT_HOME_SEO_COPY,
  };
}

/** Section text with defaults applied (empty string = use default). */
export function sectionText(s: HomeSection) {
  const d = SECTION_DEFAULTS[s.type];
  const pick = (k: "eyebrow" | "title" | "description" | "linkLabel" | "linkHref") => (s[k]?.trim() ? s[k]!.trim() : d[k] ?? "");
  return { eyebrow: pick("eyebrow"), title: pick("title"), description: pick("description"), linkLabel: pick("linkLabel"), linkHref: pick("linkHref") };
}
