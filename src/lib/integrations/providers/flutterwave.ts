import { createHmac } from "node:crypto";
import { http, providerMessage } from "../http";
import { IntegrationError, type Ctx } from "../types";
import { badSignature, need, paymentProvider, sameSig, sameAmount } from "./pay-common";

/**
 * Flutterwave Standard v3 (the store's own secret key): a hosted link with OUR tx_ref → Flutterwave's page → back to
 * us → we verify by OUR reference (never the transaction id in the address) and settle on "successful".
 * Webhooks: "verif-hash" = the store's secret hash (v3), or "flutterwave-signature" = HMAC of the body (v4 accounts).
 * Amounts are in main units.
 */

const BASE = "https://api.flutterwave.com/v3";

async function api<T>(ctx: Ctx, path: string, init: { method?: string; body?: unknown } = {}) {
  const r = await http<{ status?: string; message?: string; data?: T }>(`${BASE}${path}`, { provider: "Flutterwave", method: init.method, body: init.body, headers: { authorization: `Bearer ${need(ctx, "secretKey", "Secret key")}` } });
  if (!r.ok || r.data?.status !== "success") throw new IntegrationError(`Flutterwave: ${r.data?.message ?? providerMessage(r.data) ?? `request failed (${r.status})`}`, r.status === 401 ? 400 : 502);
  return r.data.data as T;
}

type Tx = { id: number; tx_ref: string; status: string; amount: number; currency: string };

export default paymentProvider(
  {
    async start(ctx, input) {
      if (!input.email) throw new IntegrationError("Flutterwave needs the shopper’s email.");
      const d = await api<{ link: string }>(ctx, "/payments", {
        method: "POST",
        body: {
          tx_ref: input.attemptRef,
          amount: input.total,
          currency: input.currency,
          redirect_url: input.returnUrl,
          customer: { email: input.email, ...(input.name ? { name: input.name } : {}), ...(input.phone ? { phonenumber: input.phone } : {}) },
          customizations: { title: `Order ${input.orderNumber}` },
          meta: { order: input.orderNumber },
          configurations: { session_duration: Math.max(5, Math.round((input.expiresAt.getTime() - Date.now()) / 60_000)) },
        },
      });
      return { url: d.link, ref: input.attemptRef };
    },

    async status(ctx, ref, _hints, payment) {
      const r = await http<{ status?: string; data?: Tx | null }>(`${BASE}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(ref)}`, { provider: "Flutterwave", headers: { authorization: `Bearer ${need(ctx, "secretKey", "Secret key")}` } });
      const tx = r.data?.data;
      // no transaction yet for this reference: the shopper hasn't paid (or is still on the page)
      if (!tx) return { state: "pending" };
      if (tx.tx_ref !== ref) return { state: "pending" };
      if (tx.status === "successful") {
        // more than the order (Flutterwave allows it) is still the order's amount; less is a mismatch
        const amount = tx.amount >= payment.amount && !sameAmount(tx.amount, payment.amount, tx.currency) ? payment.amount : tx.amount;
        return { state: "paid", amount, currency: tx.currency, paymentId: String(tx.id) };
      }
      if (tx.status === "failed" || tx.status === "cancelled") return { state: "failed", detail: `Flutterwave ${tx.status}` };
      return { state: "pending" };
    },

    async refund(ctx, input) {
      if (!input.paymentId) throw new IntegrationError("Flutterwave: this payment has no transaction id to refund.");
      const d = await api<{ id: number; status: string }>(ctx, `/transactions/${encodeURIComponent(input.paymentId)}/refund`, { method: "POST", body: { amount: input.amount, ...(input.reason ? { comments: input.reason.slice(0, 200) } : {}) } });
      return { id: String(d.id), status: d.status?.startsWith("completed") ? "succeeded" : d.status === "failed" ? "failed" : "pending" };
    },

    async notice(ctx, req) {
      const hash = ctx.connection.secrets.secretHash;
      if (hash) {
        const v4 = req.headers.get("flutterwave-signature");
        const ok = v4 ? sameSig(createHmac("sha256", hash).update(req.raw).digest("base64"), v4) : sameSig(req.headers.get("verif-hash"), hash);
        if (!ok) throw badSignature("Flutterwave");
      }
      const event = JSON.parse(req.raw || "{}") as { data?: { tx_ref?: string; reference?: string } };
      return { ref: event.data?.tx_ref ?? event.data?.reference ?? null };
    },
  },
  async (ctx) => {
    await api(ctx, "/transactions?page=1");
    const test = need(ctx, "secretKey", "Secret key").includes("_TEST");
    return { ok: true, message: `Connected to Flutterwave (${test ? "test" : "live"} key).`, state: { account: test ? "Test key" : "Live key" } };
  },
);
