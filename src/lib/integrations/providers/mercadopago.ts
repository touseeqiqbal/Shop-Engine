import { http, providerMessage } from "../http";
import { IntegrationError, type Ctx } from "../types";
import { badSignature, hmacHex, need, paymentProvider, sameSig } from "./pay-common";

/**
 * Mercado Pago Checkout Pro (Preferences API, the store's own access token): a preference with OUR external_reference
 * → Mercado Pago's page → back to us → we look for an APPROVED payment with our reference and settle it.
 * Updates come to the per-payment notification_url; the x-signature is checked when the store gave its secret and
 * Mercado Pago sent one – the payment is always re-read with the store's token. Test with a test seller's credentials.
 */

const BASE = "https://api.mercadopago.com";
const WHOLE = new Set(["CLP", "COP", "PYG"]);

async function api<T>(ctx: Ctx, path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const r = await http<T>(`${BASE}${path}`, { provider: "Mercado Pago", method: init.method, body: init.body, headers: { authorization: `Bearer ${need(ctx, "accessToken", "Access token")}`, ...(init.headers ?? {}) } });
  if (!r.ok) throw new IntegrationError(`Mercado Pago: ${providerMessage(r.data) ?? `request failed (${r.status})`}`, r.status === 401 ? 400 : 502);
  return r.data;
}

type Payment = { id: number; status: string; status_detail?: string; external_reference?: string | null; transaction_amount: number; currency_id: string };

const paid = (p: Payment) => ({ state: "paid" as const, amount: p.transaction_amount, currency: p.currency_id, paymentId: String(p.id) });

/** Mercado Pago's date format with the time zone offset (UTC). */
const mpDate = (d: Date) => d.toISOString().replace("Z", "+00:00");

export default paymentProvider(
  {
    async start(ctx, input) {
      const price = WHOLE.has(input.currency) ? Math.round(input.total) : Math.round(input.total * 100) / 100;
      const pref = await api<{ id: string; init_point?: string }>(ctx, "/checkout/preferences", {
        method: "POST",
        body: {
          items: [{ id: input.orderNumber, title: `Order ${input.orderNumber}`, quantity: 1, unit_price: price, currency_id: input.currency }],
          ...(input.email ? { payer: { email: input.email } } : {}),
          external_reference: input.attemptRef,
          back_urls: { success: input.returnUrl, pending: input.returnUrl, failure: input.cancelUrl },
          auto_return: "approved",
          notification_url: input.notifyUrl,
          expires: true,
          expiration_date_to: mpDate(input.expiresAt),
          metadata: { order: input.orderNumber },
        },
      });
      if (!pref.init_point) throw new IntegrationError("Mercado Pago didn’t return a payment page.", 502);
      return { url: pref.init_point, ref: input.attemptRef };
    },

    async status(ctx, ref, hints) {
      // the id that came back is only a shortcut: the payment must carry OUR reference
      const hinted = hints.payment_id || hints.collection_id;
      if (hinted && /^\d+$/.test(hinted)) {
        const p = await api<Payment>(ctx, `/v1/payments/${hinted}`).catch(() => null);
        if (p && p.external_reference === ref && p.status === "approved") return paid(p);
      }
      const found = await api<{ results?: Payment[] }>(ctx, `/v1/payments/search?external_reference=${encodeURIComponent(ref)}&sort=date_created&criteria=desc`);
      const list = (found.results ?? []).filter((p) => p.external_reference === ref);
      const ok = list.find((p) => p.status === "approved");
      if (ok) return paid(ok);
      // a rejected card can be tried again on the same page – only "pending" until the page expires
      return { state: "pending", detail: list.some((p) => ["pending", "in_process"].includes(p.status) && p.status_detail?.includes("pending_waiting")) ? "voucher" : undefined };
    },

    async refund(ctx, input) {
      if (!input.paymentId) throw new IntegrationError("Mercado Pago: this payment has no payment id to refund.");
      const r = await api<{ id: number; status: string }>(ctx, `/v1/payments/${encodeURIComponent(input.paymentId)}/refunds`, { method: "POST", headers: { "X-Idempotency-Key": input.refundRef }, body: input.amount >= input.total ? {} : { amount: input.amount } });
      return { id: String(r.id), status: r.status === "approved" ? "succeeded" : r.status === "rejected" || r.status === "cancelled" ? "failed" : "pending" };
    },

    async notice(ctx, req) {
      const body = (() => {
        try {
          return JSON.parse(req.raw || "{}") as { type?: string; data?: { id?: string | number } };
        } catch {
          return {};
        }
      })();
      const topic = req.params.get("type") ?? req.params.get("topic") ?? body.type ?? "";
      const id = req.params.get("data.id") ?? (body.data?.id != null ? String(body.data.id) : null) ?? (topic === "payment" ? req.params.get("id") : null);
      const secret = ctx.connection.secrets.webhookSecret;
      const sig = req.headers.get("x-signature");
      if (secret && sig) {
        const parts = Object.fromEntries(sig.split(",").map((p) => p.trim().split("=", 2) as [string, string]));
        const dataId = req.params.get("data.id");
        const reqId = req.headers.get("x-request-id");
        const manifest = `${dataId ? `id:${/[a-z]/i.test(dataId) ? dataId.toLowerCase() : dataId};` : ""}${reqId ? `request-id:${reqId};` : ""}ts:${parts.ts ?? ""};`;
        if (!sameSig(hmacHex("sha256", secret, manifest), parts.v1)) throw badSignature("Mercado Pago");
      }
      if (topic !== "payment" || !id || !/^\d+$/.test(id)) return { ack: new Response("OK", { status: 200 }) };
      // which of our payments is it? (read with the store's token)
      const p = await api<Payment>(ctx, `/v1/payments/${id}`).catch(() => null);
      return { ref: p?.external_reference ?? null, hints: { payment_id: id } };
    },
  },
  async (ctx) => {
    const me = await api<{ nickname?: string; site_id?: string }>(ctx, "/users/me");
    return { ok: true, message: `Connected to Mercado Pago${me.nickname ? ` as ${me.nickname}` : ""}${me.site_id ? ` (${me.site_id})` : ""}.`, state: { account: me.nickname ?? "" } };
  },
);
