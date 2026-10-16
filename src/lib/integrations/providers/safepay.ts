import { http, providerMessage } from "../http";
import { IntegrationError, type Ctx } from "../types";
import { badSignature, hmacHex, major, minor, need, paymentProvider, sameSig } from "./pay-common";

/**
 * Safepay v3 ("Payments 2.0", the store's own keys): a payment session (tracker) + a one-hour passport token →
 * Safepay's /embedded/ page → back to us with ?tracker= → we fetch OUR tracker and settle on TRACKER_ENDED.
 * Webhooks are HMAC-SHA512 signed with the endpoint's shared secret (when given) – the tracker is always re-read.
 */

const hosts = (ctx: Ctx) => (ctx.connection.mode === "test" ? { api: "https://sandbox.api.getsafepay.com", page: "https://sandbox.api.getsafepay.com/embedded/", env: "sandbox" } : { api: "https://api.getsafepay.com", page: "https://getsafepay.com/embedded/", env: "production" });

async function api<T>(ctx: Ctx, path: string, init: { method?: string; body?: unknown } = {}) {
  const r = await http<T & { status?: { errors?: string[]; message?: string } }>(`${hosts(ctx).api}${path}`, { provider: "Safepay", method: init.method, body: init.body, headers: { "X-SFPY-MERCHANT-SECRET": need(ctx, "secretKey", "Secret key") } });
  if (!r.ok) throw new IntegrationError(`Safepay: ${r.data?.status?.errors?.[0] ?? r.data?.status?.message ?? providerMessage(r.data) ?? `request failed (${r.status})`}`, r.status === 401 ? 400 : 502);
  return r.data as T;
}

type Money = { amount?: number; currency?: string };
type Tracker = { token?: string; state?: string; purchase_totals?: { quote_amount?: Money }; metadata?: Record<string, unknown> };

const metaValue = (v: unknown) => (v && typeof v === "object" ? String((v as { value?: unknown }).value ?? "") : String(v ?? ""));

export default paymentProvider(
  {
    async start(ctx, input) {
      const session = await api<{ data?: { tracker?: { token?: string } } }>(ctx, "/order/payments/v3/", {
        method: "POST",
        body: { merchant_api_key: need(ctx, "apiKey", "Public API key", "config"), intent: "CYBERSOURCE", mode: "payment", currency: input.currency, amount: minor(input.total, input.currency), metadata: { order_id: input.attemptRef, source: "shopengine" }, include_fees: false },
      });
      const tracker = session.data?.tracker?.token;
      if (!tracker) throw new IntegrationError("Safepay didn’t start the payment.", 502);
      const tbt = await api<{ data?: string }>(ctx, "/client/passport/v1/token", { method: "POST", body: {} });
      if (!tbt.data) throw new IntegrationError("Safepay didn’t give a payment token.", 502);
      const h = hosts(ctx);
      const q = new URLSearchParams({ environment: h.env, tracker, tbt: tbt.data, source: "hosted", redirect_url: input.returnUrl, cancel_url: input.cancelUrl });
      return { url: `${h.page}?${q}`, ref: tracker };
    },

    async status(ctx, ref) {
      const r = await api<{ data?: Tracker & { tracker?: Tracker } }>(ctx, `/reporter/api/v1/payments/${encodeURIComponent(ref)}`);
      const d = r.data ?? {};
      // two documented shapes: data.tracker.* or data.*
      const t: Tracker = { ...d, ...(d.tracker ?? {}) };
      if ((t.token ?? ref) !== ref) return { state: "pending" };
      const quote = t.purchase_totals?.quote_amount ?? d.purchase_totals?.quote_amount;
      if (t.state === "TRACKER_ENDED") return { state: "paid", amount: quote?.amount != null && quote.currency ? major(Number(quote.amount), quote.currency) : null, currency: quote?.currency ?? null, paymentId: ref };
      if (["TRACKER_CANCELLED", "TRACKER_EXPIRED", "TRACKER_VOIDED", "TRACKER_REVERSED"].includes(String(t.state))) return { state: "failed", detail: `Safepay ${String(t.state).replace("TRACKER_", "").toLowerCase()}` };
      return { state: "pending" };
    },

    async notice(ctx, req) {
      const secret = ctx.connection.secrets.webhookSecret;
      const body = JSON.parse(req.raw || "{}") as { data?: { tracker?: string; metadata?: Record<string, unknown> } };
      if (secret) {
        const sig = req.headers.get("x-sfpy-signature");
        // Safepay's documents disagree on which bytes are signed: the raw body, the body, or its "data" – any one matches
        const candidates = [req.raw, JSON.stringify(body), JSON.stringify(body.data ?? {})];
        if (!candidates.some((c) => sameSig(hmacHex("sha512", secret, c), sig, true))) throw badSignature("Safepay");
      }
      return { ref: body.data?.tracker ?? null, orderNumber: null, hints: { attempt: metaValue(body.data?.metadata?.order_id) } };
    },
  },
  async (ctx) => {
    need(ctx, "apiKey", "Public API key", "config");
    // a passport token needs a valid secret key and changes nothing
    await api(ctx, "/client/passport/v1/token", { method: "POST", body: {} });
    return { ok: true, message: `Connected to Safepay (${ctx.connection.mode === "test" ? "sandbox" : "live"}).`, state: { account: ctx.connection.mode === "test" ? "Sandbox" : "Live" } };
  },
);
