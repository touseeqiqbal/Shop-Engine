/** Storefront "chrome" (theme, header, footer, menus…) resolved from Payload – client-safe types + defaults. */

export interface NavLink {
  label: string;
  labelUr?: string;
  href: string;
  newTab?: boolean;
  icon?: string;
  mega?: boolean;
  image?: string | null;
  children: NavLink[];
}

export type FontKey = "inter" | "space-grotesk" | "montserrat" | "poppins";

export interface ThemeChrome {
  logoDark: string | null;
  logoLight: string | null;
  logoAlt: string;
  logoHeight: number;
  favicon: string | null;
  background: string;
  backgroundLight: string;
  accent: string;
  gradientFrom: string;
  gradientVia: string;
  gradientTo: string;
  bodyFont: FontKey;
  headingFont: FontKey;
  buttonStyle: "pill" | "rounded" | "square";
  cardRadius: "sm" | "md" | "xl" | "2xl";
  defaultMode: "dark" | "light";
  allowModeToggle: boolean;
}

export interface Chrome {
  theme: ThemeChrome;
  announcement: { enabled: boolean; text: string; linkUrl: string; linkLabel: string; backgroundColor: string; textColor: string; showContactLinks: boolean };
  header: { sticky: boolean; showSearch: boolean; showLanguageToggle: boolean; showAccountLinks: boolean; menu: NavLink[] | null; mobileMenu: NavLink[] | null };
  footer: {
    about: string;
    columns: { title: string; links: NavLink[] }[] | null;
    showContactInfo: boolean;
    showSocialLinks: boolean;
    showCityLinks: boolean;
    paymentBadges: string[];
    copyright: string;
  };
  whatsapp: { enabled: boolean; numbers: { label: string; display: string; wa: string }[]; message: string; note: string; position: "right" | "left" };
}

export const DEFAULT_THEME: ThemeChrome = {
  logoDark: null,
  logoLight: null,
  logoAlt: "", // empty = the store's name
  logoHeight: 36,
  favicon: null,
  background: "#0a0a0f",
  backgroundLight: "#f5f6fa",
  accent: "#00d4ff",
  gradientFrom: "#00b4f0",
  gradientVia: "#3b82f6",
  gradientTo: "#8b5cf6",
  bodyFont: "inter",
  headingFont: "space-grotesk",
  buttonStyle: "pill",
  cardRadius: "xl",
  defaultMode: "dark",
  allowModeToggle: true,
};

export const DEFAULT_CHROME: Chrome = {
  theme: DEFAULT_THEME,
  announcement: { enabled: true, text: "", linkUrl: "", linkLabel: "", backgroundColor: "", textColor: "", showContactLinks: true },
  header: { sticky: true, showSearch: true, showLanguageToggle: true, showAccountLinks: true, menu: null, mobileMenu: null },
  footer: {
    about: "Laptops & Tech Accessories – Delivered All Over Pakistan. New, used & refurbished laptops and computer accessories from Saddar, Karachi.",
    columns: null,
    showContactInfo: true,
    showSocialLinks: true,
    showCityLinks: true,
    paymentBadges: ["Cash on Delivery", "JazzCash", "EasyPaisa", "Bank Transfer", "TCS", "Leopards", "M&P", "Trax", "PostEx", "Call Courier"],
    copyright: "© {year} {store}. All rights reserved.",
  },
  whatsapp: {
    enabled: true,
    numbers: [], // empty = use Store info phones
    message: "", // empty = "Hi <store name>! I need help with an order."
    note: "", // empty = Store info note
    position: "right",
  },
};

/** Built-in footer columns (used until footer columns are set in /cms; also seeded as menus). */
export const SERVICE_LINKS: [string, string][] = [
  ["/track-order", "Track Your Order"],
  ["/faqs", "FAQs"],
  ["/shipping-policy", "Shipping Policy"],
  ["/warranty-returns", "Warranty & Return Policy"],
  ["/installments", "Installment Plans"],
  ["/privacy-policy", "Privacy Policy"],
  ["/terms", "Terms & Conditions"],
];
export const COMPANY_LINKS: [string, string][] = [
  ["/about", "About {store}"], // {store} = the store's name
  ["/contact", "Contact Us"],
  ["/wholesale", "Wholesale & Bulk Orders"],
  ["/blog", "Tech Blog & Buying Guides"],
  ["/find-parts", "Find Parts for Your Laptop"],
  ["/compare", "Compare Products"],
  ["/brands", "Shop by Brand"],
];

/** "+92 342 6693115" → "923426693115" (wa.me format). */
export const toWaNumber = (n: string) => n.replace(/\D/g, "").replace(/^0/, "92");

const FONT_VAR: Record<FontKey, string> = {
  inter: "var(--font-inter)",
  "space-grotesk": "var(--font-grotesk)",
  montserrat: "var(--font-montserrat)",
  poppins: "var(--font-poppins)",
};
const BTN_RADIUS = { pill: "9999px", rounded: "0.75rem", square: "0.25rem" } as const;
const CARD_RADIUS = { sm: "0.25rem", md: "0.75rem", xl: "1.25rem", "2xl": "1.75rem" } as const;
const safe = (c: string, fallback: string) => (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c) ? c : fallback);

/** CSS custom properties that apply the theme settings (injected in the root layout). */
export function themeCss(t: ThemeChrome) {
  const d = DEFAULT_THEME;
  return `html:root{--brand-from:${safe(t.gradientFrom, d.gradientFrom)};--brand-via:${safe(t.gradientVia, d.gradientVia)};--brand-to:${safe(t.gradientTo, d.gradientTo)};--accent:${safe(t.accent, d.accent)};--btn-radius:${BTN_RADIUS[t.buttonStyle] ?? BTN_RADIUS.pill};--radius-card:${CARD_RADIUS[t.cardRadius] ?? CARD_RADIUS.xl};--font-body:${FONT_VAR[t.bodyFont] ?? FONT_VAR.inter};--font-heading:${FONT_VAR[t.headingFont] ?? FONT_VAR["space-grotesk"]};}html:not([data-theme=light]){--bg:${safe(t.background, d.background)};}html[data-theme=light]{--bg:${safe(t.backgroundLight, d.backgroundLight)};}`;
}
