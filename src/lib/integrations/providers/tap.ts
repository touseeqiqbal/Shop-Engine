import { http, providerMessage } from "../http";
import { IntegrationError, type Ctx } from "../types";
import { fixed, currencyDigits, need, paymentProvider, splitName } from "./pay-common";

/**
 * Tap Payments (the store's own secret key): a charge with source "src_all" → Tap's page (KNET, mada, Benefit,
 * Apple Pay, cards) → back to us with ?tap_id= → we read OUR charge and settle on CAPTURED. Updates come to the
 * per-charge post URL; the charge is always re-read (Tap's "hashstring" is not relied on). Test or live = the key.
 */

const BASE = "https://api.tap.company/v2";

async function api<T>(ctx: Ctx, path: string, init: { method?: string; body?: unknown } = {}) {
  const r = await http<T & { errors?: { description?: string }[] }>(`${BASE}${path}`, { provider: "Tap", method: init.method, body: init.body, headers: { authorization: `Bearer ${need(ctx, "secretKey", "Secret key")}` } });
  if (!r.ok) throw new IntegrationError(`Tap: ${r.data?.errors?.[0]?.description ?? providerMessage(r.data) ?? `request failed (${r.status})`}`, r.status === 401 ? 400 : 502);
  return r.data as T;
}

type Charge = { id: string; status: string; amount: number; currency: string; reference?: { order?: string; payment?: string }; transaction?: { url?: string } };

export default paymentProvider(
  {
    async start(ctx, input) {
      if (!input.email) throw new IntegrationError("Tap needs the shopper’s email.");
      const { first, last } = splitName(input.name);
      const minutes = Math.min(60, Math.max(5, Math.round((input.expiresAt.getTime() - Date.now()) / 60_000)));
      const c = await api<Charge>(ctx, "/charges", {
        method: "POST",
        body: {
          amount: Number(fixed(input.total, currencyDigits(input.currency))),
          currency: input.currency,
          customer_initiated: true,
          threeDSecure: true,
          save_card: false,
          description: `Order ${input.orderNumber}`,
          metadata: { udf1: input.orderNumber },
          reference: { transaction: input.attemptRef, order: input.attemptRef, idempotent: input.attemptRef },
          customer: { first_name: first, last_name: last, email: input.email },
          source: { id: "src_all" },
          post: { url: input.notifyUrl },
          redirect: { url: input.returnUrl },
          transaction: { expiry: { period: minutes, type: "MINUTE" } },
        },
      });
      if (!c.transaction?.url) throw new IntegrationError("Tap didn’t return a payment page.", 502);
      return { url: c.transaction.url, ref: c.id };
    },

    async status(ctx, ref) {
      const c = await api<Charge>(ctx, `/charges/${encodeURIComponent(ref)}`);
      if (c.id !== ref) return { state: "pending" };
      if (c.status === "CAPTURED") return { state: "paid", amount: Number(c.amount), currency: c.currency, paymentId: c.id };
      if (["INITIATED", "IN PROGRESS", "UNKNOWN"].includes(c.status)) return { state: "pending" };
      return { state: "failed", detail: `Tap ${c.status.toLowerCase()}` };
    },

    async refund(ctx, input) {
      const r = await api<{ id: string; status: string }>(ctx, "/refunds", {
        method: "POST",
        body: { charge_id: input.paymentId ?? input.ref, amount: Number(fixed(input.amount, currencyDigits(input.currency))), currency: input.currency, reason: "requested_by_customer", reference: { merchant: input.refundRef, idempotent: input.refundRef }, ...(input.reason ? { description: input.reason.slice(0, 200) } : {}) },
      });
      return { id: r.id, status: r.status === "REFUNDED" ? "succeeded" : ["FAILED", "DECLINED", "CANCELLED"].includes(r.status) ? "failed" : "pending" };
    },

    async notice(_ctx, req) {
      const c = JSON.parse(req.raw || "{}") as { id?: string; object?: string };
      return { ref: c.object === "charge" || String(c.id ?? "").startsWith("chg_") ? (c.id ?? null) : null };
    },
  },
  async (ctx) => {
    // a made-up id: "not found" proves the key works, "unauthorized" that it doesn't
    const r = await http(`${BASE}/charges/chg_shopengine_check`, { provider: "Tap", headers: { authorization: `Bearer ${need(ctx, "secretKey", "Secret key")}` } });
    if (r.status === 401 || r.status === 403) throw new IntegrationError("Tap didn’t accept this secret key.", 400);
    const live = need(ctx, "secretKey", "Secret key").startsWith("sk_live_");
    return { ok: true, message: `Connected to Tap (${live ? "live" : "test"} key).`, state: { account: live ? "Live key" : "Test key" } };
  },
);
