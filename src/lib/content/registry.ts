/**
 * Registry of storefront pages whose SEO (and optionally content) is editable in
 * /cms → Online store → Page texts. Client-safe (no server imports).
 *
 * `key` is the route path and doubles as the key in the `pageSeo` and `pages` settings.
 * Template keys contain a `{placeholder}` that is replaced per page (city / brand landing pages).
 * The defaults here are exactly what each page shipped with – empty admin fields fall back to them.
 */

export type PageGroup = "Main" | "Shopping" | "Content" | "Policies" | "Templates" | "Utility";

/** Editable content blocks a page supports (see `PageContent`). */
export type ContentField = "eyebrow" | "title" | "description" | "body" | "intro" | "seoCopy" | "updated";

export interface PageDef {
  key: string;
  label: string;
  group: PageGroup;
  title: string;
  description: string;
  /** Pages that should never be indexed by default (cart, compare…) */
  noindex?: boolean;
  /** Placeholder for template pages, e.g. "city" for /laptops-in-{city} */
  placeholder?: string;
  /** Example value for previews of template pages */
  example?: string;
  /** Editable content fields on this page */
  content?: ContentField[];
  /** Short help for the content editor */
  contentHelp?: string;
  /** False when the page lives outside this module and may not read overrides yet */
  managed?: boolean;
}

export const PAGE_DEFS: PageDef[] = [
  {
    key: "/",
    label: "Home page",
    group: "Main",
    title: "Urko Tech Store – Laptop Shop in Karachi | Laptops & Accessories",
    description:
      "Laptop shop in Saddar, Karachi (Regal Chowk). Buy new, used & refurbished laptops, chargers, batteries, keyboards, mouse, SSD & RAM online with Cash on Delivery all over Pakistan.",
  },
  {
    key: "/shop",
    label: "Shop (all products)",
    group: "Shopping",
    title: "Shop Laptops & Tech Accessories Online in Pakistan | Urko Tech Store",
    description:
      "Shop all new, used & refurbished laptops, chargers, batteries, keyboards, mouse, SSDs and accessories at the best prices in Pakistan. Cash on Delivery & fast nationwide delivery.",
    content: ["intro", "seoCopy"],
    contentHelp: "Intro replaces the sentence under the H1 (not on search results). SEO copy appears below the product grid.",
  },
  {
    key: "/category",
    label: "Category index",
    group: "Shopping",
    title: "Shop All Categories – Laptops, Chargers, Batteries & Accessories | Urko Tech Store",
    description:
      "Browse every category at Urko Tech Store: new & used laptops, laptop chargers, batteries, keyboards, mouse, SSD, RAM, audio, cables and more. Cash on Delivery all over Pakistan.",
    content: ["intro", "seoCopy"],
  },
  {
    key: "/deals",
    label: "Hot deals",
    group: "Shopping",
    title: "Hot Deals on Laptops & Accessories in Pakistan | Urko Tech Store",
    description:
      "Limited-time discounts on new & used laptops, chargers, keyboards, mouse, SSDs and accessories. Flash sale prices with Cash on Delivery all over Pakistan.",
    content: ["intro", "seoCopy"],
  },
  {
    key: "/find-parts",
    label: "Find parts",
    group: "Shopping",
    title: "Find Laptop Chargers, Batteries & Parts by Model | Urko Tech Store",
    description:
      "Select your laptop brand and model to see compatible chargers, batteries, replacement keyboards, RAM and SSDs. HP, Dell, Lenovo, Apple & more – Cash on Delivery all over Pakistan.",
    content: ["intro", "seoCopy"],
  },
  {
    key: "/brands",
    label: "Brands index",
    group: "Shopping",
    title: "Shop by Brand – HP, Dell, Lenovo, Apple, Logitech & More | Urko Tech Store",
    description:
      "Browse laptops and accessories by brand: HP, Dell, Lenovo, Apple, Asus, Acer, MSI, Logitech, Razer, Redragon, Samsung, Kingston and more – genuine products, best prices in Pakistan.",
    content: ["intro", "seoCopy"],
  },
  {
    key: "/wholesale",
    label: "Wholesale",
    group: "Shopping",
    title: "Wholesale Laptops & Accessories in Pakistan | Urko Tech Store",
    description: "Bulk and wholesale prices on laptops, chargers, batteries and accessories for shops, offices and resellers across Pakistan.",
    managed: false,
  },
  {
    key: "/blog",
    label: "Blog index",
    group: "Content",
    title: "Tech Blog & Laptop Buying Guides Pakistan | Urko Tech Store",
    description:
      "Laptop buying guides, price comparisons and tech tips for Pakistan from the Urko Tech Store team in Saddar, Karachi – used vs new laptops, chargers, gaming gear and more.",
    content: ["intro", "seoCopy"],
  },
  {
    key: "/about",
    label: "About us",
    group: "Content",
    title: "About Urko Tech Store – Trusted Laptop Shop in Saddar, Karachi",
    description:
      "Urko Tech Store is a laptop shop at Regal Trade Square, Regal Chowk, Saddar Karachi selling new, used & refurbished laptops and accessories – checked & tested, with delivery all over Pakistan.",
    content: ["eyebrow", "title", "description", "body"],
    contentHelp: "Body replaces the “Built on honest advice” story. Stats, product grid, testing process and map stay as designed.",
  },
  {
    key: "/contact",
    label: "Contact",
    group: "Content",
    title: "Contact Urko Tech Store – Laptop Shop in Saddar, Karachi | WhatsApp & Phone",
    description:
      "Contact Urko Tech Store at Regal Trade Square, Regal Chowk, Saddar, Karachi. Call or WhatsApp +92 342 6693115 / +92 343 5867409, email info@urkotechstore.com. Delivery all over Pakistan.",
  },
  {
    key: "/faqs",
    label: "FAQs",
    group: "Content",
    title: "FAQs – Cash on Delivery, Delivery Times, Warranty & Returns | Urko Tech Store",
    description:
      "Answers to common questions about buying laptops online in Pakistan from Urko Tech Store: Cash on Delivery, delivery times, used laptop grades, warranty, returns and our Saddar, Karachi shop.",
  },
  {
    key: "/track-order",
    label: "Track order",
    group: "Utility",
    title: "Track Your Order | Urko Tech Store",
    description:
      "Track your Urko Tech Store order with your order number and phone. Live status from confirmation to delivery, with TCS, Leopards, M&P, Trax, PostEx & Call Courier tracking.",
  },
  {
    key: "/shipping-policy",
    label: "Shipping policy",
    group: "Policies",
    title: "Shipping Policy – Delivery All Over Pakistan with COD | Urko Tech Store",
    description:
      "Delivery times and charges for Urko Tech Store: Karachi same/next day, major cities 1–3 days, other areas 3–5 days. Cash on Delivery via TCS, Leopards, M&P, Trax, PostEx & Call Courier.",
    content: ["eyebrow", "title", "description", "body", "updated"],
    contentHelp: "Body replaces the policy text below the delivery table. The table and courier logos stay automatic.",
  },
  {
    key: "/warranty-returns",
    label: "Warranty & returns",
    group: "Policies",
    title: "Warranty & Return Policy – Used, Refurbished & New Laptops | Urko Tech Store",
    description:
      "Warranty and return policy of Urko Tech Store, Karachi: checking warranty on used laptops, up to 6 months on refurbished, brand warranty on new, and 3-day replacement for faulty or wrong items.",
    content: ["eyebrow", "title", "description", "body", "updated"],
    contentHelp: "Body replaces the policy text below the warranty table.",
  },
  {
    key: "/privacy-policy",
    label: "Privacy policy",
    group: "Policies",
    title: "Privacy Policy | Urko Tech Store Pakistan",
    description:
      "How Urko Tech Store collects, uses and protects your personal information when you shop online or visit our Saddar, Karachi store – orders, delivery, WhatsApp, cookies and your rights.",
    content: ["eyebrow", "title", "description", "body", "updated"],
  },
  {
    key: "/terms",
    label: "Terms & conditions",
    group: "Policies",
    title: "Terms & Conditions | Urko Tech Store – Laptops & Accessories Pakistan",
    description:
      "Terms and conditions for buying from Urko Tech Store online or at our Regal Chowk, Saddar, Karachi shop: orders, pricing, payment, Cash on Delivery, delivery, warranty and liability.",
    content: ["eyebrow", "title", "description", "body", "updated"],
  },
  {
    key: "/installments",
    label: "Installment plans",
    group: "Policies",
    title: "Laptop on Installments in Pakistan – Easy Monthly Plans | Urko Tech Store",
    description:
      "Buy a laptop on easy monthly installments in Pakistan with Urko Tech Store – bank credit-card plans and current options. Ask us on WhatsApp.",
    content: ["eyebrow", "title", "description", "body", "updated"],
    contentHelp: "Body is an extra Markdown section shown after “How it will work” (empty by default). FAQs keep their structured data.",
  },
  {
    key: "/returns",
    label: "Returns & warranty claims",
    group: "Utility",
    title: "Return an Item or Claim Warranty | Urko Tech Store",
    description: "Start a return or a warranty claim online with your order number and phone – add photos and we'll get back to you within 1 working day.",
  },
  {
    key: "/sell-your-laptop",
    label: "Sell your laptop (trade-in)",
    group: "Utility",
    title: "Sell or Trade In Your Laptop in Pakistan | Urko Tech Store",
    description: "Get a cash offer for your used laptop or trade it in for a new one. Send the model, specs, condition and photos – we reply the same day.",
  },
  {
    key: "/compare",
    label: "Compare",
    group: "Utility",
    title: "Compare Products | Urko Tech Store",
    description: "Compare laptops and accessories side by side – price, condition, specs, warranty and availability.",
    noindex: true,
  },
  {
    key: "/cart",
    label: "Cart",
    group: "Utility",
    title: "Your Cart | Urko Tech Store",
    description: "Review the laptops and accessories in your cart, apply a coupon and check delivery charges for your city.",
    noindex: true,
  },
  {
    key: "/laptops-in-{city}",
    label: "City landing pages",
    group: "Templates",
    placeholder: "city",
    example: "Lahore",
    title: "Laptops in {city} – Price in Pakistan with Cash on Delivery | Urko Tech Store",
    description:
      "Buy new, used & refurbished laptops in {city} online. Delivered with Cash on Delivery, warranty and checked & tested quality from Urko Tech Store.",
  },
  {
    key: "/brands/{brand}",
    label: "Brand pages",
    group: "Templates",
    placeholder: "brand",
    example: "HP",
    title: "{brand} Laptops & Accessories Price in Pakistan | Urko Tech Store",
    description:
      "Buy genuine {brand} products at the best price in Pakistan. New, used & refurbished stock with warranty, Cash on Delivery and fast delivery from Karachi to all cities.",
  },
];

export const PAGE_DEF_BY_KEY: Record<string, PageDef> = Object.fromEntries(PAGE_DEFS.map((p) => [p.key, p]));

/** URL-safe id for admin routes: "/" → "home", "/laptops-in-{city}" → "laptops-in-city". */
export function pageSlug(key: string) {
  return key === "/" ? "home" : key.replace(/^\//, "").replace(/[{}]/g, "").replace(/\//g, "--");
}
export function pageBySlug(slug: string) {
  return PAGE_DEFS.find((p) => pageSlug(p.key) === slug) ?? null;
}

/** Replace `{placeholder}` tokens. */
export function fillPlaceholders(s: string, vars: Record<string, string> = {}) {
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}

// ───────────────────────────── saved shapes ─────────────────────────────

export interface PageSeoEntry {
  title?: string;
  description?: string;
  ogImage?: string;
  /** undefined = page default */
  noindex?: boolean;
  focusKeyword?: string;
}
export type PageSeoMap = Record<string, PageSeoEntry>;

export interface PageContent {
  eyebrow?: string;
  /** Plain text; wrap words in *asterisks* to give them the brand gradient */
  title?: string;
  description?: string;
  /** Markdown */
  body?: string;
  /** Markdown/plain intro under the H1 */
  intro?: string;
  /** Markdown SEO copy at the bottom of the page */
  seoCopy?: string;
  /** ISO date (yyyy-mm-dd) for “Last updated” */
  updated?: string;
}
export type PagesContentMap = Record<string, PageContent>;

export interface SeoSettings {
  /** e.g. "%s | Urko Tech Store" */
  titleTemplate: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultOgImage: string;
  keywords: string[];
  googleVerification: string;
  bingVerification: string;
  facebookVerification: string;
  ga4Id: string;
  metaPixelId: string;
  /** Staging switch: noindex everywhere + robots.txt Disallow: / */
  discourageIndexing: boolean;
}

export const DEFAULT_SEO_SETTINGS: SeoSettings = {
  titleTemplate: "%s | Urko Tech Store",
  defaultTitle: "Urko Tech Store – Laptop Shop in Karachi | Laptops & Accessories Pakistan",
  defaultDescription: "",
  defaultOgImage: "",
  keywords: [
    "laptop shop in Karachi",
    "used laptops in Karachi",
    "laptops in Saddar Karachi",
    "Regal Chowk laptop market",
    "laptop price in Pakistan",
    "buy laptop online Pakistan",
    "laptop charger price in Pakistan",
    "laptop battery Karachi",
    "gaming mouse price in Pakistan",
    "mechanical keyboard Pakistan",
  ],
  googleVerification: "",
  bingVerification: "",
  facebookVerification: "",
  ga4Id: "",
  metaPixelId: "",
  discourageIndexing: false,
};

export function mergeSeoSettings(saved: Partial<SeoSettings> | null | undefined): SeoSettings {
  const d = DEFAULT_SEO_SETTINGS;
  if (!saved || typeof saved !== "object") return { ...d, keywords: [...d.keywords] };
  const s = (v: unknown, f: string) => (typeof v === "string" && v.trim() ? v.trim() : f);
  return {
    titleTemplate: s(saved.titleTemplate, d.titleTemplate).includes("%s") ? s(saved.titleTemplate, d.titleTemplate) : d.titleTemplate,
    defaultTitle: s(saved.defaultTitle, d.defaultTitle),
    defaultDescription: s(saved.defaultDescription, d.defaultDescription),
    defaultOgImage: s(saved.defaultOgImage, d.defaultOgImage),
    keywords: Array.isArray(saved.keywords) && saved.keywords.length ? saved.keywords.filter((k) => typeof k === "string" && k.trim()) : [...d.keywords],
    googleVerification: s(saved.googleVerification, ""),
    bingVerification: s(saved.bingVerification, ""),
    facebookVerification: s(saved.facebookVerification, ""),
    ga4Id: s(saved.ga4Id, ""),
    metaPixelId: s(saved.metaPixelId, ""),
    discourageIndexing: saved.discourageIndexing === true,
  };
}
