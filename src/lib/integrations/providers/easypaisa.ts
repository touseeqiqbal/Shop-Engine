import { createCipheriv } from "node:crypto";
import { http } from "../http";
import { IntegrationError, type Ctx } from "../types";
import { need, paymentProvider, pkParts } from "./pay-common";

/**
 * Easypay / Easypaisa hosted checkout (the store's own merchant store): a form posted to Index.jsf → Easypay sends the
 * shopper back with an auth_token → we post it to Confirm.jsf → the shopper confirms and comes back → we ask the
 * inquiry service (v4) about OUR order reference and settle on "PAID" with the right amount. PKR only.
 * merchantHashedReq = Base64(AES-ECB(hash key, the sent fields sorted by name as "k=v&k=v")).
 * The IPN (vouchers paid later at a shop) only tells us which order to ask about – its URL is never fetched.
 */

const host = (ctx: Ctx) => (ctx.connection.mode === "test" ? "https://easypaystg.easypaisa.com.pk" : "https://easypay.easypaisa.com.pk");

export function easypayHashedReq(fields: Record<string, string>, hashKey: string): string {
  const key = Buffer.from(hashKey, "utf8");
  const algo = ({ 16: "aes-128-ecb", 24: "aes-192-ecb", 32: "aes-256-ecb" } as Record<number, string>)[key.length];
  if (!algo) throw new IntegrationError("Easypaisa: the hash key must be 16, 24 or 32 characters long.");
  const plain = Object.keys(fields)
    .filter((k) => fields[k] !== "")
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("&");
  const c = createCipheriv(algo, key, null);
  return Buffer.concat([c.update(plain, "utf8"), c.final()]).toString("base64");
}

const stamp = (d: Date) => {
  const p = pkParts(d);
  return `${p.y}${p.m}${p.d} ${p.H}${p.M}${p.S}`;
};
/** 03XXXXXXXXX, or nothing */
const mobile = (phone: string | null | undefined) => {
  const d = String(phone ?? "").replace(/\D/g, "");
  const local = d.startsWith("92") ? `0${d.slice(2)}` : d;
  return /^03\d{9}$/.test(local) ? local : "";
};

type Inquiry = { responseCode?: string; responseDesc?: string; orderId?: string; transactionStatus?: string; transactionAmount?: number | string; transactionId?: string; paymentMode?: string };

async function inquire(ctx: Ctx, orderId: string): Promise<Inquiry> {
  const credentials = Buffer.from(`${need(ctx, "username", "Partner username", "config")}:${need(ctx, "password", "Partner password")}`).toString("base64");
  const r = await http<Inquiry>(`${host(ctx)}/easypay-service/rest/v4/inquire-transaction`, { provider: "Easypaisa", method: "POST", headers: { Credentials: credentials }, body: { orderId, storeId: need(ctx, "storeId", "Store ID", "config"), accountNum: need(ctx, "accountNum", "Account number", "config") } });
  if (r.status === 401 || r.status === 403) throw new IntegrationError("Easypaisa didn’t accept the partner username and password.", 400);
  if (!r.ok || typeof r.data !== "object") throw new IntegrationError(`Easypaisa: couldn’t check the payment (${r.status})`, 502);
  return r.data;
}

export default paymentProvider(
  {
    async start(ctx, input) {
      if (input.currency !== "PKR") throw new IntegrationError("Easypaisa takes payments in PKR only.");
      const fields: Record<string, string> = {
        amount: (Math.round(input.total * 10) / 10).toFixed(1),
        storeId: need(ctx, "storeId", "Store ID", "config"),
        postBackURL: input.returnUrl,
        orderRefNum: input.attemptRef,
        expiryDate: stamp(input.expiresAt),
        autoRedirect: "1",
        ...(ctx.connection.config.paymentMethod ? { paymentMethod: String(ctx.connection.config.paymentMethod) } : {}),
        ...(input.email ? { emailAddr: input.email } : {}),
        ...(mobile(input.phone) ? { mobileNum: mobile(input.phone) } : {}),
      };
      fields.merchantHashedReq = easypayHashedReq(fields, need(ctx, "hashKey", "Hash key"));
      return { url: `${host(ctx)}/easypay/Index.jsf`, ref: input.attemptRef, form: fields };
    },

    async onReturn(ctx, req) {
      // step 1 done: Easypay hands over a token that the shopper confirms on its second page
      const token = req.params.get("auth_token");
      if (!token) return null;
      const { autoPostPage } = await import("../payments");
      return autoPostPage(`${host(ctx)}/easypay/Confirm.jsf`, { auth_token: token, postBackURL: `${req.returnUrl}&step=done` });
    },

    async status(ctx, ref, _hints, payment) {
      const d = await inquire(ctx, ref);
      // 0003 = no such order yet (not paid on Easypay's page)
      if (d.responseCode !== "0000") return { state: "pending", detail: d.responseDesc };
      if (d.orderId && d.orderId !== ref) return { state: "pending" };
      const status = String(d.transactionStatus ?? "").toUpperCase();
      if (status === "PAID") return { state: "paid", amount: d.transactionAmount != null ? Number(d.transactionAmount) : payment.amount, currency: "PKR", paymentId: d.transactionId ?? ref };
      if (status === "PENDING") return { state: "pending", detail: String(d.paymentMode ?? "").toUpperCase().includes("OTC") ? "voucher" : undefined };
      if (["FAILED", "BLOCKED", "EXPIRED", "REVERSED"].includes(status)) return { state: "failed", detail: `Easypaisa ${status.toLowerCase()}` };
      return { state: "pending" };
    },

    async notice(_ctx, req) {
      // ?url=https://easypay…/order-status/<account>/<order reference> – read the reference, never fetch the address
      const u = req.params.get("url") ?? "";
      const ref = u.split("?")[0].split("/").filter(Boolean).pop() ?? null;
      return { ref: ref && /^[A-Za-z0-9]{4,30}$/.test(ref) ? ref : null };
    },
  },
  async (ctx) => {
    need(ctx, "hashKey", "Hash key");
    if (![16, 24, 32].includes(Buffer.from(need(ctx, "hashKey", "Hash key"), "utf8").length)) throw new IntegrationError("Easypaisa: the hash key must be 16, 24 or 32 characters long.");
    const d = await inquire(ctx, `SECHECK${Date.now().toString(36)}`);
    if (["0004", "0005", "0006", "0007"].includes(String(d.responseCode))) throw new IntegrationError(`Easypaisa: ${d.responseDesc ?? "the store or account wasn’t accepted"}`, 400);
    return { ok: true, message: `Connected to Easypaisa (${ctx.connection.mode === "test" ? "staging" : "live"}).`, state: { account: `Store ${String(ctx.connection.config.storeId ?? "")}` } };
  },
);
