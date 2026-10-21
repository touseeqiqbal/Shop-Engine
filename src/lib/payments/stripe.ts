import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stripe over its REST API (no SDK): Connect accounts for merchants, hosted Checkout for shoppers, refunds, and
 * webhook signature checks. Card details never touch ShopEngine – shoppers pay on Stripe's page.
 *
 *   STRIPE_SECRET_KEY          platform secret key (sk_…)
 *   STRIPE_WEBHOOK_SECRET      signing secret of the webhook endpoint /api/webhooks/stripe (whsec_…)
 *   PLATFORM_FEE_PERCENT       optional ShopEngine commission on each order (application fee), e.g. 1.5
 */

const API = "https://api.stripe.com/v1";

export const stripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);

/** Stripe's form encoding: { a: { b: [1] } } → a[b][0]=1 */
export function encodeForm(value: unknown, prefix = "", out: string[] = []): string {
  if (value === undefined || value === null) return out.join("&");
  if (Array.isArray(value)) value.forEach((v, i) => encodeForm(v, `${prefix}[${i}]`, out));
  else if (typeof value === "object") for (const [k, v] of Object.entries(value as Record<string, unknown>)) encodeForm(v, prefix ? `${prefix}[${k}]` : k, out);
  else out.push(`${encodeURIComponent(prefix)}=${encodeURIComponent(String(value))}`);
  return out.join("&");
}

export class StripeError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

/** One Stripe API call. `account` = the merchant's connected account; `idempotencyKey` makes a retry harmless. */
export async function stripe<T = Record<string, unknown>>(method: "GET" | "POST" | "DELETE", path: string, params?: Record<string, unknown>, opts: { account?: string | null; idempotencyKey?: string } = {}): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeError("Online payments aren't set up (STRIPE_SECRET_KEY).", 503);
  const body = params ? encodeForm(params) : "";
  const url = method === "GET" && body ? `${API}${path}?${body}` : `${API}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2024-06-20",
      ...(opts.account ? { "Stripe-Account": opts.account } : {}),
      ...(opts.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey } : {}),
    },
    body: method === "GET" ? undefined : body,
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: string } } & T;
  if (!res.ok) throw new StripeError(json.error?.message ?? `Stripe ${res.status}`, res.status, json.error?.code);
  return json;
}

/** Currencies Stripe counts in whole units (no cents). */
const ZERO_DECIMAL = new Set(["bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf"]);
/**
 * Currencies Stripe counts in thousandths – and only in whole hundredths (the last digit must be 0). They used to be
 * multiplied by 100 like cents, so a 10.000 KWD order was charged (and refunded) 1.000 KWD.
 */
const THREE_DECIMAL = new Set(["bhd", "jod", "kwd", "omr", "tnd"]);
export const toMinor = (amount: number, currency: string) => {
  const c = currency.toLowerCase();
  if (ZERO_DECIMAL.has(c)) return Math.round(amount);
  if (THREE_DECIMAL.has(c)) return Math.round(amount * 100) * 10;
  return Math.round(amount * 100);
};
export const fromMinor = (amount: number, currency: string) => {
  const c = currency.toLowerCase();
  return ZERO_DECIMAL.has(c) ? amount : THREE_DECIMAL.has(c) ? amount / 1000 : amount / 100;
};

/**
 * Verifies a webhook: the `Stripe-Signature` header (t=…,v1=…) must be an HMAC-SHA256 of "t.body" with the endpoint's
 * signing secret, and no older than `toleranceSec` (a replayed old event is refused). Returns the parsed event.
 */
export function verifyStripeWebhook(rawBody: string, header: string | null, secret: string | undefined, toleranceSec = 300, now = Date.now()): { id: string; type: string; account?: string; created: number; data: { object: Record<string, unknown> } } {
  if (!secret) throw new StripeError("Webhook secret not set", 500);
  if (!header) throw new StripeError("Missing signature", 400);
  const parts = header.split(",").map((p) => p.trim().split("=") as [string, string]);
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!Number.isFinite(t) || !signatures.length) throw new StripeError("Bad signature header", 400);
  if (Math.abs(now / 1000 - t) > toleranceSec) throw new StripeError("Signature too old", 400);
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`, "utf8").digest();
  const ok = signatures.some((s) => {
    const got = Buffer.from(s, "hex");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
  if (!ok) throw new StripeError("Signature mismatch", 400);
  return JSON.parse(rawBody);
}

/** For tests and local tools: a valid signature header for a body. */
export function signStripePayload(rawBody: string, secret: string, t = Math.floor(Date.now() / 1000)) {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${rawBody}`, "utf8").digest("hex")}`;
}
