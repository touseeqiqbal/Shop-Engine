import { createHash, randomBytes } from "node:crypto";
import { http } from "../http";
import { IntegrationError, type Ctx } from "../types";
import { attemptTime } from "../payments";
import { need, paymentProvider, pkParts, sameSig } from "./pay-common";

/**
 * PayFast Pakistan (gopayfast.com / APPS, the store's own merchant id): a token for OUR basket and amount → a form
 * posted to PayFast's page → back to us → we ask PayFast's transaction status service for the basket. If that service
 * isn't enabled for the merchant, the answer PayFast sent back is accepted only with a valid validation_hash
 * (SHA-256 of basket|secured key|merchant id|err_code) – the token already bound the basket to the amount. PKR only.
 * Not to be confused with PayFast South Africa.
 */

const hosts = (ctx: Ctx) =>
  ctx.connection.mode === "test"
    ? { ipg: "https://ipguat.apps.net.pk/Ecommerce/api/Transaction", api: "https://apipxyuat.apps.net.pk:8443/api" }
    : { ipg: "https://ipg1.apps.net.pk/Ecommerce/api/Transaction", api: "https://apipxy.apps.net.pk:8443/api" };

const amountText = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
const orderDate = (d: Date) => {
  const p = pkParts(d);
  return { full: `${p.y}-${p.m}-${p.d} ${p.H}:${p.M}:${p.S}`, day: `${p.y}-${p.m}-${p.d}` };
};

export const payfastValidationHash = (basketId: string, securedKey: string, merchantId: string, errCode: string) => createHash("sha256").update(`${basketId}|${securedKey}|${merchantId}|${errCode}`).digest("hex");

async function accessToken(ctx: Ctx, basket: string, amount: string): Promise<string> {
  const r = await http<{ ACCESS_TOKEN?: string; access_token?: string }>(`${hosts(ctx).ipg}/GetAccessToken`, {
    provider: "PayFast",
    method: "POST",
    body: new URLSearchParams({ MERCHANT_ID: need(ctx, "merchantId", "Merchant ID", "config"), SECURED_KEY: need(ctx, "securedKey", "Secured key"), BASKET_ID: basket, TXNAMT: amount, CURRENCY_CODE: "PKR" }),
  });
  const token = r.data?.ACCESS_TOKEN ?? r.data?.access_token;
  if (!r.ok || !token) throw new IntegrationError("PayFast didn’t accept the merchant ID and secured key.", r.ok ? 400 : 502);
  return token;
}

/** The status service (Direct API); null when it isn't available for this merchant. */
async function apiStatus(ctx: Ctx, basket: string, date: string): Promise<{ status_code?: string; status_msg?: string; transaction_id?: string } | null> {
  const h = hosts(ctx);
  const t = await http<{ token?: string }>(`${h.api}/token`, { provider: "PayFast", method: "POST", body: new URLSearchParams({ merchant_id: need(ctx, "merchantId", "Merchant ID", "config"), secured_key: need(ctx, "securedKey", "Secured key"), grant_type: "client_credentials", customer_ip: "127.0.0.1" }), timeoutMs: 12_000 }).catch(() => null);
  if (!t?.ok || !t.data?.token) return null;
  const r = await http<{ status_code?: string; status_msg?: string; transaction_id?: string }>(`${h.api}/transaction/basket_id/${encodeURIComponent(basket)}?order_date=${encodeURIComponent(date)}&customer_ip=127.0.0.1`, { provider: "PayFast", headers: { authorization: `Bearer ${t.data.token}` }, timeoutMs: 12_000 }).catch(() => null);
  return r?.ok && r.data && typeof r.data === "object" ? r.data : null;
}

/** Keys of PayFast's answer come in mixed case. */
const lower = (h: Record<string, string>) => Object.fromEntries(Object.entries(h).map(([k, v]) => [k.toLowerCase(), v]));

export default paymentProvider(
  {
    async start(ctx, input) {
      if (input.currency !== "PKR") throw new IntegrationError("PayFast takes payments in PKR only.");
      const amount = amountText(input.total);
      const token = await accessToken(ctx, input.attemptRef, amount);
      const at = attemptTime(input.attemptRef) ?? new Date();
      const fields: Record<string, string> = {
        MERCHANT_ID: need(ctx, "merchantId", "Merchant ID", "config"),
        MERCHANT_NAME: need(ctx, "merchantName", "Merchant name", "config"),
        TOKEN: token,
        PROCCODE: "00",
        TXNAMT: amount,
        CUSTOMER_MOBILE_NO: input.phone ?? "",
        CUSTOMER_EMAIL_ADDRESS: input.email ?? "",
        SIGNATURE: randomBytes(8).toString("hex"),
        VERSION: "SHOPENGINE-1.0",
        TXNDESC: `Order ${input.orderNumber}`,
        SUCCESS_URL: input.returnUrl,
        FAILURE_URL: input.cancelUrl,
        BASKET_ID: input.attemptRef,
        ORDER_DATE: orderDate(at).full,
        CHECKOUT_URL: input.notifyUrl,
        CURRENCY_CODE: "PKR",
        TRAN_TYPE: "ECOMM_PURCHASE",
        RECURRING_TXN: "",
      };
      return { url: `${hosts(ctx).ipg}/PostTransaction`, ref: input.attemptRef, form: fields };
    },

    async status(ctx, ref, hints) {
      const at = attemptTime(ref) ?? new Date();
      const d = await apiStatus(ctx, ref, orderDate(at).day);
      if (d?.status_code) {
        if (d.status_code === "00" || d.status_code === "79") return { state: "paid", amount: null, currency: "PKR", paymentId: d.transaction_id ?? ref };
        if (d.status_code === "001") return { state: "pending" };
        return { state: "failed", detail: `PayFast: ${d.status_msg ?? d.status_code}` };
      }
      // no status service: only PayFast's own signed answer counts
      const h = lower(hints);
      if (h.basket_id === ref && h.validation_hash && h.err_code != null) {
        const expected = payfastValidationHash(ref, need(ctx, "securedKey", "Secured key"), need(ctx, "merchantId", "Merchant ID", "config"), h.err_code);
        if (sameSig(expected, h.validation_hash, true)) return h.err_code === "000" || h.err_code === "00" ? { state: "paid", amount: null, currency: "PKR", paymentId: h.transaction_id || ref } : { state: "failed", detail: `PayFast: ${h.err_msg ?? h.err_code}` };
      }
      return { state: "pending" };
    },

    async notice(_ctx, req) {
      const h = lower(Object.fromEntries(req.params));
      let body: Record<string, string> = {};
      if (req.raw.trim().startsWith("{")) body = lower(JSON.parse(req.raw) as Record<string, string>);
      const all = { ...body, ...h };
      return { ref: all.basket_id ?? null, hints: all };
    },
  },
  async (ctx) => {
    // a token for a made-up basket changes nothing and proves the merchant id and key
    await accessToken(ctx, `SECHECK${Date.now().toString(36)}`, "1");
    return { ok: true, message: `Connected to PayFast (${ctx.connection.mode === "test" ? "UAT" : "live"}).`, state: { account: String(ctx.connection.config.merchantName ?? "") } };
  },
);
