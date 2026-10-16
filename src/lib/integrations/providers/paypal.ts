import { http, providerMessage } from "../http";
import { IntegrationError, type Ctx } from "../types";
import { badSignature, fixed, need, paymentProvider } from "./pay-common";

/**
 * PayPal Orders v2 (the store's own REST app): create an order → PayPal's page → back to us → we capture it and
 * settle on the capture being COMPLETED. Webhook (optional): CHECKOUT.ORDER.APPROVED / PAYMENT.CAPTURE.* – verified
 * with PayPal's verify-webhook-signature when the store gave its Webhook ID; either way we re-read the order.
 */

const base = (ctx: Ctx) => (ctx.connection.mode === "test" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com");
const NO_DECIMALS = new Set(["HUF", "JPY", "TWD"]);
const value = (amount: number, currency: string) => (NO_DECIMALS.has(currency) ? String(Math.round(amount)) : fixed(amount, 2));

const tokens = new Map<string, { token: string; until: number }>();

async function token(ctx: Ctx): Promise<string> {
  const id = need(ctx, "clientId", "Client ID", "config");
  const secret = need(ctx, "clientSecret", "Secret");
  const key = `${ctx.connection.id}:${ctx.connection.mode}:${id}`;
  const hit = tokens.get(key);
  if (hit && hit.until > Date.now()) return hit.token;
  const r = await http<{ access_token?: string; expires_in?: number }>(`${base(ctx)}/v1/oauth2/token`, { provider: "PayPal", method: "POST", headers: { authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}` }, body: new URLSearchParams({ grant_type: "client_credentials" }) });
  if (!r.ok || !r.data.access_token) throw new IntegrationError(`PayPal: ${providerMessage(r.data) ?? "sign-in failed"} – check the Client ID, Secret and test / live mode.`, 400);
  tokens.set(key, { token: r.data.access_token, until: Date.now() + Math.max(60, (r.data.expires_in ?? 3000) - 120) * 1000 });
  return r.data.access_token;
}

async function api<T>(ctx: Ctx, path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  return http<T>(`${base(ctx)}${path}`, { provider: "PayPal", method: init.method, body: init.body, headers: { authorization: `Bearer ${await token(ctx)}`, ...(init.headers ?? {}) } });
}

type Money = { currency_code: string; value: string };
type Capture = { id: string; status: string; amount?: Money };
type Order = { id: string; status: string; links?: { rel: string; href: string }[]; purchase_units?: { custom_id?: string; payments?: { captures?: Capture[] } }[] };

export default paymentProvider(
  {
    async start(ctx, input) {
      const r = await api<Order>(ctx, "/v2/checkout/orders", {
        method: "POST",
        headers: { "PayPal-Request-Id": input.attemptRef, Prefer: "return=representation" },
        body: {
          intent: "CAPTURE",
          purchase_units: [{ reference_id: "default", custom_id: input.attemptRef, description: `Order ${input.orderNumber}`.slice(0, 127), amount: { currency_code: input.currency, value: value(input.total, input.currency) } }],
          payment_source: {
            paypal: { experience_context: { return_url: input.returnUrl, cancel_url: input.cancelUrl, user_action: "PAY_NOW", shipping_preference: "NO_SHIPPING", landing_page: "NO_PREFERENCE", payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED" } },
          },
        },
      });
      const url = r.data.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
      if (!r.ok || !r.data.id || !url) throw new IntegrationError(`PayPal: ${providerMessage(r.data) ?? `couldn’t create the payment (${r.status})`}`, 502);
      return { url, ref: r.data.id };
    },

    async status(ctx, ref, hints) {
      const path = `/v2/checkout/orders/${encodeURIComponent(ref)}`;
      let order = (await api<Order>(ctx, path)).data;
      if (!order?.id) throw new IntegrationError("PayPal: couldn’t read the payment", 502);
      // approved by the shopper: take the money now (the same request id makes a second try harmless)
      if (order.status === "APPROVED" && hints.capture === "1") {
        const cap = await api<Order>(ctx, `${path}/capture`, { method: "POST", headers: { "PayPal-Request-Id": `capture-${ref}`, Prefer: "return=representation" }, body: {} });
        order = cap.ok && cap.data?.id ? cap.data : (await api<Order>(ctx, path)).data;
      }
      const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
      if (order.status === "COMPLETED" && capture?.status === "COMPLETED") return { state: "paid", amount: Number(capture.amount?.value), currency: capture.amount?.currency_code ?? null, paymentId: capture.id };
      if (capture && ["DECLINED", "FAILED"].includes(capture.status)) return { state: "failed", detail: `PayPal ${capture.status.toLowerCase()}` };
      if (order.status === "VOIDED") return { state: "failed", detail: "PayPal payment voided" };
      return { state: "pending" };
    },

    async refund(ctx, input) {
      if (!input.paymentId) throw new IntegrationError("PayPal: this payment has no capture to refund.");
      const r = await api<{ id?: string; status?: string }>(ctx, `/v2/payments/captures/${encodeURIComponent(input.paymentId)}/refund`, {
        method: "POST",
        headers: { "PayPal-Request-Id": input.refundRef, Prefer: "return=representation" },
        body: { amount: { currency_code: input.currency, value: value(input.amount, input.currency) }, ...(input.reason ? { note_to_payer: input.reason.slice(0, 255) } : {}) },
      });
      if (!r.ok || !r.data.id) throw new IntegrationError(`PayPal: ${providerMessage(r.data) ?? `refund failed (${r.status})`}`, 502);
      return { id: r.data.id, status: r.data.status === "COMPLETED" ? "succeeded" : r.data.status === "PENDING" ? "pending" : "failed" };
    },

    async notice(ctx, req) {
      const event = JSON.parse(req.raw || "{}") as { event_type?: string; resource?: { id?: string; supplementary_data?: { related_ids?: { order_id?: string } } } };
      const webhookId = String(ctx.connection.config.webhookId ?? "").trim();
      if (webhookId) {
        const h = req.headers;
        // posted back exactly as received (PayPal compares the event byte for byte)
        const body = `{"auth_algo":${JSON.stringify(h.get("paypal-auth-algo") ?? "")},"cert_url":${JSON.stringify(h.get("paypal-cert-url") ?? "")},"transmission_id":${JSON.stringify(h.get("paypal-transmission-id") ?? "")},"transmission_sig":${JSON.stringify(h.get("paypal-transmission-sig") ?? "")},"transmission_time":${JSON.stringify(h.get("paypal-transmission-time") ?? "")},"webhook_id":${JSON.stringify(webhookId)},"webhook_event":${req.raw}}`;
        const v = await api<{ verification_status?: string }>(ctx, "/v1/notifications/verify-webhook-signature", { method: "POST", body, headers: { "content-type": "application/json" } });
        if (v.data?.verification_status !== "SUCCESS") throw badSignature("PayPal");
      }
      const t = event.event_type ?? "";
      const ref = t.startsWith("CHECKOUT.ORDER") ? event.resource?.id : event.resource?.supplementary_data?.related_ids?.order_id;
      return { ref: ref ?? null };
    },
  },
  async (ctx) => {
    await token(ctx);
    return { ok: true, message: `Connected to PayPal (${ctx.connection.mode === "test" ? "sandbox" : "live"}).`, state: { account: ctx.connection.mode === "test" ? "Sandbox" : "Live" } };
  },
);
