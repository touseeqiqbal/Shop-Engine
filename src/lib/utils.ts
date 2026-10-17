import type { Condition, Product } from "./types";
import { formatMoney } from "./money";
import { normalizePkMobile } from "./phone";
import { MAX_QTY_PER_ITEM } from "./cart-limits";

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

/* ── pre-orders and backorders (Products → When sold out) ── */
type Stocked = Pick<Product, "stock" | "backorders" | "releaseDate" | "backorderNote">;
const keepsSelling = (p: Partial<Stocked>) => p.backorders === "backorder" || p.backorders === "preorder";

/** A pre-order right now: not released yet, or released but nothing in stock. */
export const isPreorder = (p: Stocked, now = Date.now()) =>
  p.backorders === "preorder" && (p.stock <= 0 || Boolean(p.releaseDate && Date.parse(p.releaseDate) > now));

/** Can it be ordered now? In stock, or set to keep taking orders when sold out. */
export const canOrder = (p: Stocked) => p.stock > 0 || keepsSelling(p);

/** The most one cart line may hold: what is in stock – or the cart's own limit for pre-order / keep-selling products. */
export const buyLimit = (p: Stocked) => (keepsSelling(p) ? MAX_QTY_PER_ITEM : Math.max(0, p.stock));

/** An order line that ships later: "Pre-order – ships when released" / "2 of 3 on backorder – ship when back in stock". */
export function shipsLater(i: { availability?: "preorder" | "backorder"; owedQty?: number; qty: number }): string {
  if (i.availability === "preorder") return "Pre-order – ships when released";
  if (i.availability !== "backorder") return "";
  return i.owedQty && i.owedQty < i.qty ? `${i.owedQty} of ${i.qty} on backorder – they ship when back in stock` : "On backorder – ships when back in stock";
}

/** What the product page and cards say about availability (`date` formats the ship-from day in the store's way). */
export function availabilityLabel(p: Stocked, date: (iso: string) => string = (iso) => formatDate(iso, { day: "numeric", month: "short" })) {
  if (isPreorder(p)) {
    const later = p.releaseDate && Date.parse(p.releaseDate) > Date.now() ? date(p.releaseDate) : "";
    return { kind: "preorder" as const, label: later ? `Pre-order · ships from ${later}` : "Pre-order", note: p.backorderNote || null, tone: "violet" as const };
  }
  if (p.stock <= 0 && p.backorders === "backorder") return { kind: "backorder" as const, label: "On backorder", note: p.backorderNote || "Ships when back in stock", tone: "amber" as const };
  return { kind: p.stock > 0 ? ("in" as const) : ("out" as const), ...stockLabel(p.stock), note: null };
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
