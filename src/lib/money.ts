import { DEFAULT_LOCALE, type StoreLocale } from "./locale";

/**
 * Money in the store's own currency. Amounts are plain numbers in the currency's main unit (rupees, dollars, euros);
 * they are rounded to what the currency allows (0 decimals for PKR / JPY, 2 for USD, 3 for KWD).
 * Client-safe. The original shop keeps its familiar "Rs 145,000".
 */

type MoneyLocale = Pick<StoreLocale, "currency" | "locale">;

const cache = new Map<string, Intl.NumberFormat>();
function nf(currency: string, locale: string, compact = false) {
  const key = `${currency}|${locale}|${compact}`;
  let f = cache.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat(locale, { style: "currency", currency, ...(compact ? { notation: "compact", maximumFractionDigits: 1 } : {}) });
    } catch {
      f = new Intl.NumberFormat("en", { style: "currency", currency: "USD" });
    }
    cache.set(key, f);
  }
  return f;
}

/** Decimals the currency uses (USD 2, PKR 0 as shops price it, JPY 0, KWD 3). */
export function currencyDigits(currency: string): number {
  // rupees are priced in whole numbers in practice (Intl says 2)
  if (currency === "PKR" || currency === "INR" || currency === "LKR" || currency === "NPR" || currency === "BDT") return 0;
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/**
 * Rounds DOWN to the currency's smallest unit – what a balance can pay (a gift card holding Rs 50.5 pays Rs 50: rounding
 * it up to 51 asked for more than the card held, and the payment was refused every time).
 */
export function floorMoney(amount: number, currency: string = DEFAULT_LOCALE.currency): number {
  const f = 10 ** currencyDigits(currency);
  return Math.floor((Number(amount) || 0) * f + 1e-9) / f;
}

/** Rounds to the currency's smallest unit (1 rupee, 1 cent …). */
export function roundMoney(amount: number, currency: string = DEFAULT_LOCALE.currency): number {
  const f = 10 ** currencyDigits(currency);
  return Math.round((Number(amount) || 0) * f) / f;
}

/** 145000 → "Rs 145,000" (PKR) · 1234.5 → "$1,234.50" (USD) · 3000 → "AED 3,000.00" … */
export function formatMoney(amount: number, loc: MoneyLocale = DEFAULT_LOCALE): string {
  const currency = loc.currency || DEFAULT_LOCALE.currency;
  const value = roundMoney(amount, currency);
  const digits = currencyDigits(currency);
  // the original shop's style, unchanged
  if (currency === "PKR") return `Rs ${new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(value)}`;
  const f = nf(currency, loc.locale || "en");
  const opts = f.resolvedOptions();
  if (opts.maximumFractionDigits === digits) return f.format(value);
  return new Intl.NumberFormat(loc.locale || "en", { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

/** Short form for charts: "Rs 1.2M", "$12K". */
export function formatMoneyCompact(amount: number, loc: MoneyLocale = DEFAULT_LOCALE): string {
  if ((loc.currency || "PKR") === "PKR") return `Rs ${new Intl.NumberFormat("en-PK", { notation: "compact", maximumFractionDigits: 1 }).format(amount)}`;
  return nf(loc.currency, loc.locale || "en", true).format(amount);
}

/** The currency's symbol or code as the store shows it ("Rs", "$", "€", "AED"). */
export function currencySymbol(loc: MoneyLocale = DEFAULT_LOCALE): string {
  if ((loc.currency || "PKR") === "PKR") return "Rs";
  return nf(loc.currency, loc.locale || "en").formatToParts(0).find((p) => p.type === "currency")?.value ?? loc.currency;
}

/** A formatter bound to one store's currency: `const money = moneyFormatter(locale); money(1200)`. */
export type Money = ((amount: number) => string) & { currency: string; locale: string; round: (n: number) => number; symbol: string };
export function moneyFormatter(loc: MoneyLocale = DEFAULT_LOCALE): Money {
  const fn = ((amount: number) => formatMoney(amount, loc)) as Money;
  fn.currency = loc.currency;
  fn.locale = loc.locale;
  fn.round = (n: number) => roundMoney(n, loc.currency);
  fn.symbol = currencySymbol(loc);
  return fn;
}
