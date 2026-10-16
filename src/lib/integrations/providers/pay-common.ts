import { createHmac, timingSafeEqual } from "node:crypto";
import { IntegrationError, type PaymentImpl, type ProviderImpl, type TestResult, type Ctx } from "../types";

/** Shared bits of the payment provider modules (lib/integrations/payments.ts does the settling). */

export const hmacHex = (alg: "sha256" | "sha512", key: string, msg: string | Buffer) => createHmac(alg, key).update(msg).digest("hex");

/** Constant-time compare of two signatures (`caseless` for providers that send upper-case hex). */
export function sameSig(a: string | null | undefined, b: string | null | undefined, caseless = false): boolean {
  if (!a || !b) return false;
  const x = Buffer.from(caseless ? a.toLowerCase() : a);
  const y = Buffer.from(caseless ? b.toLowerCase() : b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** A provider's signature didn't match: the update is refused (the provider retries; nothing is settled). */
export const badSignature = (provider: string) => new IntegrationError(`${provider}: signature doesn’t match`, 401);

/** Date/time parts in Pakistan time (the PK gateways want local time; Pakistan has no daylight saving). */
export function pkParts(d: Date) {
  const t = new Date(d.getTime() + 5 * 3_600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return { y: String(t.getUTCFullYear()), m: p(t.getUTCMonth() + 1), d: p(t.getUTCDate()), H: p(t.getUTCHours()), M: p(t.getUTCMinutes()), S: p(t.getUTCSeconds()) };
}

/** Number to string with fixed decimals, no thousands separators. */
export const fixed = (n: number, digits = 2) => (Math.round(n * 10 ** digits) / 10 ** digits).toFixed(digits);

/** Currencies with 3 decimals (Gulf) and none (JPY …), as payment providers count them. */
const THREE = new Set(["BHD", "KWD", "OMR", "JOD", "TND", "LYD", "IQD"]);
const ZERO = new Set(["JPY", "KRW", "VND", "CLP", "PYG", "UGX", "RWF", "XAF", "XOF", "HUF", "TWD", "ISK", "BIF", "DJF", "GNF", "KMF", "MGA", "VUV", "XPF"]);
export const currencyDigits = (currency: string) => (THREE.has(currency.toUpperCase()) ? 3 : ZERO.has(currency.toUpperCase()) ? 0 : 2);
/** Amount in the smallest unit the provider counts in (paisa, cents, fils). */
export const minor = (amount: number, currency: string) => Math.round(amount * 10 ** currencyDigits(currency));
export const major = (amount: number, currency: string) => amount / 10 ** currencyDigits(currency);

/** Same amount within half of the smallest unit. */
export const sameAmount = (a: number | null | undefined, b: number, currency: string) => a != null && Math.abs(a - b) < 0.5 / 10 ** currencyDigits(currency);

/** A shopper's name split for providers that want first / last name. */
export function splitName(name: string | null | undefined): { first: string; last: string } {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? "Customer", last: parts.slice(1).join(" ") || parts[0] || "Customer" };
}

/** Wraps a payment provider: its inbound addresses go through the shared settling code. */
export function paymentProvider(payment: PaymentImpl, test: (ctx: Ctx) => Promise<TestResult>): ProviderImpl {
  return {
    test,
    payment,
    async inbound(ctx, req) {
      const { paymentInbound } = await import("../payments");
      return paymentInbound(ctx, payment, req);
    },
  };
}

/** The setting or key, or an error naming what's missing. */
export function need(ctx: Ctx, key: string, label: string, kind: "secret" | "config" = "secret"): string {
  const v = kind === "secret" ? ctx.connection.secrets[key] : ctx.connection.config[key];
  if (typeof v !== "string" || !v.trim()) throw new IntegrationError(`${label} is missing – open the integration and fill it in.`);
  return v.trim();
}
