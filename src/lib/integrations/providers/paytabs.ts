import { http, providerMessage } from "../http";
import { IntegrationError, type Ctx } from "../types";
import { badSignature, currencyDigits, fixed, hmacHex, need, paymentProvider, sameSig } from "./pay-common";

/**
 * PayTabs PT2 Hosted Payment Page (the store's own profile, in its account's region): a "sale" request → PayTabs'
 * page → the shopper comes back with a POST → we query OUR transaction and settle on response_status "A".
 * The server-to-server callback is signed with the server key (HMAC-SHA256 of the body). Test = the test profile.
 */

const DOMAINS: Record<string, string> = {
  SAU: "https://secure.paytabs.sa",
  ARE: "https://secure.paytabs.com",
  EGY: "https://secure-egypt.paytabs.com",
  OMN: "https://secure-oman.paytabs.com",
  JOR: "https://secure-jordan.paytabs.com",
  KWT: "https://secure-kuwait.paytabs.com",
  IRQ: "https://secure-iraq.paytabs.com",
  MAR: "https://secure-morocco.paytabs.com",
  QAT: "https://secure-doha.paytabs.com",
  GLOBAL: "https://secure-global.paytabs.com",
};

const domain = (ctx: Ctx) => DOMAINS[String(ctx.connection.config.region || "ARE")] ?? DOMAINS.ARE;
const profile = (ctx: Ctx) => {
  const id = Number(need(ctx, "profileId", "Profile ID", "config"));
  if (!Number.isFinite(id)) throw new IntegrationError("PayTabs: the Profile ID is a number.");
  return id;
};

type Result = { tran_ref?: string; tran_type?: string; cart_amount?: string | number; tran_total?: string | number; cart_currency?: string; tran_currency?: string; redirect_url?: string; payment_result?: { response_status?: string; response_message?: string }; message?: string; code?: number };

async function api(ctx: Ctx, path: string, body: Record<string, unknown>) {
  const r = await http<Result>(`${domain(ctx)}${path}`, { provider: "PayTabs", method: "POST", body: { profile_id: profile(ctx), ...body }, headers: { authorization: need(ctx, "serverKey", "Server key") } });
  return r;
}

export default paymentProvider(
  {
    async start(ctx, input) {
      const r = await api(ctx, "/payment/request", {
        tran_type: "sale",
        tran_class: "ecom",
        cart_id: input.attemptRef,
        cart_description: `Order ${input.orderNumber}`,
        cart_currency: input.currency,
        cart_amount: Number(fixed(input.total, currencyDigits(input.currency))),
        return: input.returnUrl,
        callback: input.notifyUrl,
        hide_shipping: true,
        user_defined: { udf1: input.orderNumber },
        ...(input.email && input.name ? { customer_details: { name: input.name, email: input.email, ...(input.phone ? { phone: input.phone } : {}) } } : {}),
      });
      if (!r.ok || !r.data.redirect_url || !r.data.tran_ref) throw new IntegrationError(`PayTabs: ${r.data?.message ?? providerMessage(r.data) ?? `couldn’t open the payment page (${r.status})`}`, 502);
      return { url: r.data.redirect_url, ref: r.data.tran_ref };
    },

    async status(ctx, ref) {
      const r = await api(ctx, "/payment/query", { tran_ref: ref });
      if (!r.ok) throw new IntegrationError(`PayTabs: ${r.data?.message ?? `couldn’t check the payment (${r.status})`}`, 502);
      const t = r.data;
      if (t.tran_ref !== ref) return { state: "pending" };
      const s = t.payment_result?.response_status ?? "";
      if (s === "A" && String(t.tran_type ?? "").toLowerCase() === "sale") return { state: "paid", amount: Number(t.tran_total ?? t.cart_amount), currency: t.tran_currency ?? t.cart_currency ?? null, paymentId: ref };
      if (s === "H" || s === "P" || !s) return { state: "pending" };
      return { state: "failed", detail: `PayTabs: ${t.payment_result?.response_message ?? s}` };
    },

    async refund(ctx, input) {
      const r = await api(ctx, "/payment/request", { tran_type: "refund", tran_class: "ecom", cart_id: input.refundRef, cart_currency: input.currency, cart_amount: Number(fixed(input.amount, currencyDigits(input.currency))), cart_description: (input.reason || "Refund").slice(0, 128), tran_ref: input.paymentId ?? input.ref });
      if (!r.ok || !r.data.tran_ref) throw new IntegrationError(`PayTabs: ${r.data?.message ?? `refund failed (${r.status})`}`, 502);
      const s = r.data.payment_result?.response_status;
      return { id: r.data.tran_ref, status: s === "A" ? "succeeded" : s === "P" || s === "H" ? "pending" : "failed" };
    },

    async notice(ctx, req) {
      if (!sameSig(hmacHex("sha256", need(ctx, "serverKey", "Server key"), req.raw), req.headers.get("signature"), true)) throw badSignature("PayTabs");
      const t = JSON.parse(req.raw || "{}") as Result;
      return { ref: t.tran_ref ?? null };
    },
  },
  async (ctx) => {
    // an unknown transaction: "not found" proves the profile and key work together
    const r = await api(ctx, "/payment/query", { tran_ref: "TST0000000000000" });
    const msg = String(r.data?.message ?? "");
    if (r.status === 401 || r.status === 403 || /authenticat|profile|server key/i.test(msg)) throw new IntegrationError(`PayTabs: ${msg || "the profile ID and server key weren’t accepted"} – check them and the region.`, 400);
    return { ok: true, message: "Connected to PayTabs.", state: { account: `Profile ${profile(ctx)}` } };
  },
);
