import type { Condition, Product } from "./types";
import { formatMoney } from "./money";
import { normalizePkMobile } from "./phone";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/**
 * 145000 → "Rs 145,000" – the original shop's currency only.
 * @deprecated use the store's currency: `useMoney()` (client), `getMoney()` (server) or `formatMoney(amount, locale)`.
 */
export function formatPKR(amount: number) {
  return formatMoney(amount);
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function effectivePrice(p: Pick<Product, "price" | "salePrice">) {
  return p.salePrice && p.salePrice < p.price ? p.salePrice : p.price;
}

export function savings(p: Pick<Product, "price" | "salePrice">) {
  return p.price - effectivePrice(p);
}

export function discountPercent(p: Pick<Product, "price" | "salePrice">) {
  const s = savings(p);
  return s > 0 ? Math.round((s / p.price) * 100) : 0;
}

export const conditionMeta: Record<Condition, { label: string; short: string; tone: string; description: string }> = {
  new: { label: "Brand New", short: "New", tone: "emerald", description: "Sealed box, full manufacturer warranty." },
  "used-a-plus": {
    label: "Used A+",
    short: "Used A+",
    tone: "sky",
    description: "Like-new condition. No visible marks, fully tested, excellent battery.",
  },
  "used-a": {
    label: "Used A",
    short: "Used A",
    tone: "amber",
    description: "Very good condition. Light signs of use, fully tested.",
  },
  refurbished: {
    label: "Refurbished",
    short: "Refurb",
    tone: "violet",
    description: "Professionally restored, parts replaced where needed, tested and certified.",
  },
  "open-box": { label: "Open Box", short: "Open Box", tone: "teal", description: "Unused unit with opened packaging." },
};

export function stockLabel(stock: number) {
  if (stock <= 0) return { label: "Out of stock", tone: "rose" as const };
  if (stock <= 3) return { label: `Only ${stock} left`, tone: "amber" as const };
  return { label: "In stock", tone: "emerald" as const };
}

export function readingTime(markdown: string) {
  return Math.max(1, Math.round(markdown.split(/\s+/).length / 220));
}

/** A date in the store's language and time zone (`loc` from `useStoreLocale()` / `getStoreLocale()`; default: the original shop's). */
export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }, loc: { locale: string; timezone?: string } = { locale: "en-PK" }) {
  return new Intl.DateTimeFormat(loc.locale, { ...(loc.timezone ? { timeZone: loc.timezone } : {}), ...opts }).format(new Date(iso));
}

/**
 * Pakistani mobile: 03XX-XXXXXXX (also accepts +92 / 92 prefixes and spaces)
 * @deprecated any country: `normalizePhone(input, storeCountry)` from lib/phone.ts.
 */
export const normalizePkPhone = (input: string): string | null => normalizePkMobile(input);

export function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}
