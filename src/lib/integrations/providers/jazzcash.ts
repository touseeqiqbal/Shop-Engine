import { http } from "../http";
import { IntegrationError, type Ctx } from "../types";
import { hmacHex, minor, need, paymentProvider, pkParts } from "./pay-common";

/**
 * JazzCash Page Redirection v1.1 (the store's own merchant account): a signed form posted to JazzCash's page →
 * the shopper comes back with a POST → we ask JazzCash's Inquire service about OUR reference and settle on a
 * completed payment. The amount is fixed in our signed request (Inquire doesn't report it). PKR only.
 * pp_SecureHash = HMAC-SHA256(integrity salt, "salt&" + the non-empty pp* values sorted by name, joined with "&").
 */

const hosts = (ctx: Ctx) => (ctx.connection.mode === "test" ? "https://sandbox.jazzcash.com.pk" : "https://payments.jazzcash.com.pk");

/** JazzCash's hash: every non-empty field starting with "pp" except pp_SecureHash, sorted by name. */
export function jazzcashHash(fields: Record<string, string>, salt: string): string {
  const keys = Object.keys(fields)
    .filter((k) => k.startsWith("pp") && k !== "pp_SecureHash" && (fields[k] ?? "") !== "")
    .sort();
  return hmacHex("sha256", salt, [salt, ...keys.map((k) => fields[k])].join("&")).toUpperCase();
}

const stamp = (d: Date) => {
  const p = pkParts(d);
  return `${p.y}${p.m}${p.d}${p.H}${p.M}${p.S}`;
};
/** JazzCash replaces these with spaces – remove them first so our hash and theirs see the same text. */
const clean = (s: string, max: number) => s.replace(/[<>\\*=%/:'"|{}]/g, " ").slice(0, max);

const PAID = new Set(["000", "121"]);
const PENDING = new Set(["124", "157"]);

async function inquire(ctx: Ctx, ref: string) {
  const fields: Record<string, string> = { pp_TxnRefNo: ref, pp_MerchantID: need(ctx, "merchantId", "Merchant ID", "config"), pp_Password: need(ctx, "password", "Password"), pp_Version: "1.1" };
  fields.pp_SecureHash = jazzcashHash(fields, need(ctx, "integritySalt", "Integrity salt"));
  const r = await http<Record<string, string>>(`${hosts(ctx)}/ApplicationAPI/API/PaymentInquiry/Inquire`, { provider: "JazzCash", method: "POST", body: fields });
  if (!r.ok || typeof r.data !== "object") throw new IntegrationError(`JazzCash: couldn’t check the payment (${r.status})`, 502);
  return r.data;
}

export default paymentProvider(
  {
    async start(ctx, input) {
      if (input.currency !== "PKR") throw new IntegrationError("JazzCash takes payments in PKR only.");
      const fields: Record<string, string> = {
        pp_Version: "1.1",
        pp_TxnType: String(ctx.connection.config.txnType || "MWALLET"),
        pp_Language: "EN",
        pp_MerchantID: need(ctx, "merchantId", "Merchant ID", "config"),
        pp_SubMerchantID: "",
        pp_Password: need(ctx, "password", "Password"),
        pp_BankID: "",
        pp_ProductID: "",
        pp_TxnRefNo: input.attemptRef,
        pp_Amount: String(minor(input.total, "PKR")),
        pp_TxnCurrency: "PKR",
        pp_TxnDateTime: stamp(new Date()),
        pp_BillReference: input.orderNumber.replace(/[^A-Za-z0-9.]/g, "").slice(0, 20) || "order",
        pp_Description: clean(`Order ${input.orderNumber}`, 200),
        pp_TxnExpiryDateTime: stamp(input.expiresAt),
        pp_ReturnURL: input.returnUrl,
        ppmpf_1: input.orderNumber,
      };
      fields.pp_SecureHash = jazzcashHash(fields, need(ctx, "integritySalt", "Integrity salt"));
      return { url: `${hosts(ctx)}/CustomerPortal/transactionmanagement/merchantform/`, ref: input.attemptRef, form: fields };
    },

    async status(ctx, ref) {
      const d = await inquire(ctx, ref);
      // pp_ResponseCode = the inquiry itself; pp_PaymentResponseCode / pp_Status = the payment
      if (d.pp_ResponseCode !== "000") return { state: "pending", detail: d.pp_ResponseMessage };
      const code = String(d.pp_PaymentResponseCode ?? "");
      const st = String(d.pp_Status ?? "").toLowerCase();
      if (PAID.has(code) && (!st || st === "completed")) return { state: "paid", amount: null, currency: "PKR", paymentId: d.pp_RetrievalReferenceNo || ref };
      if (PENDING.has(code) || !code) return { state: "pending", detail: code === "124" ? "voucher" : undefined };
      return { state: "failed", detail: `JazzCash: ${d.pp_PaymentResponseMessage || code}` };
    },

    async notice(_ctx, req) {
      let ref = req.params.get("pp_TxnRefNo");
      if (!ref && req.raw.trim().startsWith("{")) ref = (JSON.parse(req.raw) as { pp_TxnRefNo?: string }).pp_TxnRefNo ?? null;
      return { ref, ack: Response.json({ pp_ResponseCode: "000", pp_ResponseMessage: "Received" }) };
    },
  },
  async (ctx) => {
    // an unknown reference: wrong credentials are refused before JazzCash looks for it
    const d = await inquire(ctx, `SECHECK${Date.now().toString(36)}`.slice(0, 20));
    const msg = String(d.pp_ResponseMessage ?? "");
    if (/password|merchant ?id|hash|secure/i.test(msg) || ["110", "115"].includes(String(d.pp_ResponseCode))) throw new IntegrationError(`JazzCash: ${msg || "the credentials weren’t accepted"}`, 400);
    return { ok: true, message: `Connected to JazzCash (${ctx.connection.mode === "test" ? "sandbox" : "live"}). Make sure your Return URL is registered with JazzCash.`, state: { account: String(ctx.connection.config.merchantId ?? "") } };
  },
);
