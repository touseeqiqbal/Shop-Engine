import { http, providerMessage } from "../http";
import { IntegrationError, type Ctx } from "../types";
import { badSignature, hmacHex, major, minor, need, paymentProvider, sameSig } from "./pay-common";

/**
 * Razorpay Payment Links (the store's own key): a link per payment attempt → Razorpay's page → back to us → we fetch
 * the link and settle when it is "paid" in full. Webhook (optional): payment_link.* signed with the webhook secret.
 * Test or live is decided by the key itself (rzp_test_… / rzp_live_…).
 */

const BASE = "https://api.razorpay.com/v1";

function auth(ctx: Ctx) {
  return `Basic ${Buffer.from(`${need(ctx, "keyId", "Key ID", "config")}:${need(ctx, "keySecret", "Key secret")}`).toString("base64")}`;
}

async function api<T>(ctx: Ctx, path: string, init: { method?: string; body?: unknown } = {}) {
  const r = await http<T & { error?: { description?: string } }>(`${BASE}${path}`, { provider: "Razorpay", method: init.method, body: init.body, headers: { authorization: auth(ctx) } });
  if (!r.ok) throw new IntegrationError(`Razorpay: ${r.data?.error?.description ?? providerMessage(r.data) ?? `request failed (${r.status})`}`, r.status === 401 ? 400 : 502);
  return r.data as T;
}

type Link = { id: string; short_url?: string; status: string; amount: number; amount_paid: number; currency: string; reference_id?: string; payments?: { payment_id: string; status: string }[] | null };

const validEmail = (e: string | null | undefined) => (e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : undefined);
const contact = (p: string | null | undefined) => {
  const d = String(p ?? "").replace(/[^\d+]/g, "");
  return d.length >= 8 && d.length <= 14 ? d : undefined;
};

export default paymentProvider(
  {
    async start(ctx, input) {
      // at least 16 minutes ahead (Razorpay's minimum is 15)
      const expireBy = Math.floor(Math.max(input.expiresAt.getTime(), Date.now() + 16 * 60_000) / 1000);
      const customer = Object.fromEntries(Object.entries({ name: input.name ?? undefined, email: validEmail(input.email), contact: contact(input.phone) }).filter(([, v]) => v));
      const link = await api<Link>(ctx, "/payment_links", {
        method: "POST",
        body: {
          amount: minor(input.total, input.currency),
          currency: input.currency,
          accept_partial: false,
          reference_id: input.attemptRef,
          description: `Order ${input.orderNumber}`,
          ...(Object.keys(customer).length ? { customer } : {}),
          notify: { sms: false, email: false },
          reminder_enable: false,
          notes: { order: input.orderNumber },
          callback_url: input.returnUrl,
          callback_method: "get",
          expire_by: expireBy,
        },
      });
      if (!link.short_url) throw new IntegrationError("Razorpay didn’t return a payment page.", 502);
      return { url: link.short_url, ref: link.id };
    },

    async status(ctx, ref) {
      const link = await api<Link>(ctx, `/payment_links/${encodeURIComponent(ref)}`);
      const captured = link.payments?.find((p) => p.status === "captured");
      if (link.status === "paid" && link.amount_paid >= link.amount) return { state: "paid", amount: major(link.amount_paid, link.currency), currency: link.currency, paymentId: captured?.payment_id ?? link.payments?.[0]?.payment_id ?? null };
      if (link.status === "expired" || link.status === "cancelled") return { state: "failed", detail: `Razorpay link ${link.status}` };
      return { state: "pending" };
    },

    async refund(ctx, input) {
      if (!input.paymentId) throw new IntegrationError("Razorpay: this payment has no payment id to refund.");
      const r = await api<{ id: string; status: string }>(ctx, `/payments/${encodeURIComponent(input.paymentId)}/refund`, { method: "POST", body: { amount: minor(input.amount, input.currency), speed: "normal", receipt: input.refundRef, notes: input.reason ? { reason: input.reason.slice(0, 250) } : {} } });
      return { id: r.id, status: r.status === "processed" ? "succeeded" : r.status === "failed" ? "failed" : "pending" };
    },

    async notice(ctx, req) {
      const secret = ctx.connection.secrets.webhookSecret;
      if (secret && !sameSig(hmacHex("sha256", secret, req.raw), req.headers.get("x-razorpay-signature"))) throw badSignature("Razorpay");
      const event = JSON.parse(req.raw || "{}") as { payload?: { payment_link?: { entity?: { id?: string } } } };
      return { ref: event.payload?.payment_link?.entity?.id ?? null };
    },
  },
  async (ctx) => {
    await api(ctx, "/payments?count=1");
    const live = String(ctx.connection.config.keyId ?? "").startsWith("rzp_live_");
    return { ok: true, message: `Connected to Razorpay (${live ? "live" : "test"} key).`, state: { account: live ? "Live key" : "Test key" } };
  },
);
