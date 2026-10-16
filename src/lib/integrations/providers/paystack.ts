import { http, providerMessage } from "../http";
import { IntegrationError, type Ctx } from "../types";
import { badSignature, hmacHex, need, paymentProvider, sameSig } from "./pay-common";

/**
 * Paystack (the store's own secret key): initialize a transaction with OUR reference → Paystack's page → back to us
 * with ?reference= → we verify it and settle on "success". Webhooks are signed with the secret key (HMAC-SHA512).
 * Amounts are always ×100 (kobo, pesewas, cents – XOF too).
 */

const BASE = "https://api.paystack.co";
const sub = (amount: number) => Math.round(amount * 100);

async function api<T>(ctx: Ctx, path: string, init: { method?: string; body?: unknown } = {}) {
  const r = await http<{ status?: boolean; message?: string; data?: T }>(`${BASE}${path}`, { provider: "Paystack", method: init.method, body: init.body, headers: { authorization: `Bearer ${need(ctx, "secretKey", "Secret key")}` } });
  if (!r.ok || r.data?.status === false) throw new IntegrationError(`Paystack: ${r.data?.message ?? providerMessage(r.data) ?? `request failed (${r.status})`}`, r.status === 401 ? 400 : 502);
  return r.data.data as T;
}

type Tx = { status: string; reference: string; amount: number; currency: string; gateway_response?: string };

export default paymentProvider(
  {
    async start(ctx, input) {
      if (!input.email) throw new IntegrationError("Paystack needs the shopper’s email.");
      const d = await api<{ authorization_url: string; reference: string }>(ctx, "/transaction/initialize", {
        method: "POST",
        body: { email: input.email, amount: sub(input.total), currency: input.currency, reference: input.attemptRef, callback_url: input.returnUrl, metadata: { order: input.orderNumber, cancel_action: input.cancelUrl } },
      });
      return { url: d.authorization_url, ref: d.reference || input.attemptRef };
    },

    async status(ctx, ref) {
      const r = await http<{ status?: boolean; data?: Tx }>(`${BASE}/transaction/verify/${encodeURIComponent(ref)}`, { provider: "Paystack", headers: { authorization: `Bearer ${need(ctx, "secretKey", "Secret key")}` } });
      // not started on Paystack's page yet
      if (r.status === 404 || r.data?.status === false) return { state: "pending" };
      const tx = r.data?.data;
      if (!r.ok || !tx) throw new IntegrationError(`Paystack: couldn’t check the payment (${r.status})`, 502);
      if (tx.reference !== ref) return { state: "pending" };
      if (tx.status === "success") return { state: "paid", amount: tx.amount / 100, currency: tx.currency, paymentId: tx.reference };
      if (tx.status === "failed" || tx.status === "reversed") return { state: "failed", detail: `Paystack: ${tx.gateway_response ?? tx.status}` };
      // "abandoned" = not paid (yet): the page may still be in use
      return { state: "pending" };
    },

    async refund(ctx, input) {
      const d = await api<{ id: number | string; status: string }>(ctx, "/refund", { method: "POST", body: { transaction: input.paymentId ?? input.ref, amount: sub(input.amount), currency: input.currency, ...(input.reason ? { merchant_note: input.reason.slice(0, 200) } : {}) } });
      return { id: String(d.id), status: d.status === "processed" ? "succeeded" : d.status === "failed" ? "failed" : "pending" };
    },

    async notice(ctx, req) {
      if (!sameSig(hmacHex("sha512", need(ctx, "secretKey", "Secret key"), req.raw), req.headers.get("x-paystack-signature"))) throw badSignature("Paystack");
      const event = JSON.parse(req.raw || "{}") as { event?: string; data?: { reference?: string } };
      return { ref: event.event?.startsWith("charge.") ? (event.data?.reference ?? null) : null };
    },
  },
  async (ctx) => {
    await api(ctx, "/transaction?perPage=1");
    const live = need(ctx, "secretKey", "Secret key").startsWith("sk_live_");
    return { ok: true, message: `Connected to Paystack (${live ? "live" : "test"} key).`, state: { account: live ? "Live key" : "Test key" } };
  },
);
