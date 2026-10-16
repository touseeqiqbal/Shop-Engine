import { http } from "../http";
import type { Ctx, ProviderImpl, TestResult } from "../types";

/**
 * SMS through the store's own provider. Numbers arrive as international digits without "+" (923001234567).
 */

type Sender = (ctx: Ctx, to: string, text: string) => Promise<void>;

/** Every SMS provider's test: check the account, then (optionally) send a test message. */
function withTest(send: Sender, check?: (ctx: Ctx) => Promise<{ ok: boolean; account?: string; message?: string }>): ProviderImpl {
  return {
    async test(ctx): Promise<TestResult> {
      const c = check ? await check(ctx) : { ok: true };
      if (!c.ok) return { ok: false, message: c.message ?? "The details aren’t right." };
      const testTo = String(ctx.connection.config.testNumber ?? "").replace(/[^\d+]/g, "");
      const account = c.account;
      if (!testTo) return { ok: true, message: account ? `Connected (${account}).` : "Saved.", ...(account ? { state: { account } } : {}) };
      try {
        await send(ctx, testTo.replace(/^\+/, ""), "Test message from your store on ShopEngine – SMS is connected.");
        return { ok: true, message: `A test SMS was sent to ${testTo}.`, ...(account ? { state: { account } } : {}) };
      } catch (e) {
        return { ok: false, message: `The test SMS wasn’t sent: ${(e as Error).message}` };
      }
    },
    messaging: { sms: send },
  };
}

/* ───────────── Twilio ───────────── */

const twilioAuth = (ctx: Ctx) => `Basic ${Buffer.from(`${ctx.connection.config.accountSid}:${ctx.connection.secrets.authToken ?? ""}`).toString("base64")}`;

export const twilio = withTest(
  async (ctx, to, text) => {
    const from = String(ctx.connection.config.from ?? "");
    const body = new URLSearchParams({ To: `+${to}`, Body: text.slice(0, 1600) });
    body.set(from.startsWith("MG") ? "MessagingServiceSid" : "From", from);
    const r = await http<{ message?: string; status?: string }>(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(String(ctx.connection.config.accountSid))}/Messages.json`, { provider: "Twilio", method: "POST", headers: { authorization: twilioAuth(ctx) }, body });
    if (!r.ok) throw new Error(`Twilio ${r.status}: ${r.data.message ?? "not sent"}`);
  },
  async (ctx) => {
    const r = await http<{ friendly_name?: string; message?: string; status?: string }>(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(String(ctx.connection.config.accountSid))}.json`, { provider: "Twilio", headers: { authorization: twilioAuth(ctx) } });
    return r.ok ? { ok: true, account: r.data.friendly_name } : { ok: false, message: `Twilio: ${r.data.message ?? "the Account SID or Auth Token isn’t right"}` };
  },
);

/* ───────────── Africa's Talking ───────────── */

const atBase = (ctx: Ctx) => (String(ctx.connection.config.username) === "sandbox" ? "https://api.sandbox.africastalking.com/version1" : "https://api.africastalking.com/version1");

export const africastalking = withTest(
  async (ctx, to, text) => {
    const body = new URLSearchParams({ username: String(ctx.connection.config.username), to: `+${to}`, message: text, bulkSMSMode: "1" });
    if (ctx.connection.config.from) body.set("from", String(ctx.connection.config.from));
    const r = await http<{ SMSMessageData?: { Message?: string; Recipients?: { statusCode?: number; status?: string }[] } }>(`${atBase(ctx)}/messaging`, { provider: "Africa’s Talking", method: "POST", headers: { apiKey: ctx.connection.secrets.apiKey ?? "" }, body });
    const rec = r.data.SMSMessageData?.Recipients?.[0];
    if (!r.ok || !rec || (rec.statusCode !== 100 && rec.statusCode !== 101 && rec.statusCode !== 102)) throw new Error(`Africa’s Talking: ${rec?.status ?? r.data.SMSMessageData?.Message ?? `not sent (${r.status})`}`);
  },
  async (ctx) => {
    const r = await http<{ UserData?: { balance?: string } }>(`${atBase(ctx)}/user?username=${encodeURIComponent(String(ctx.connection.config.username))}`, { provider: "Africa’s Talking", headers: { apiKey: ctx.connection.secrets.apiKey ?? "" } });
    return r.ok && r.data.UserData ? { ok: true, account: `balance ${r.data.UserData.balance ?? "?"}` } : { ok: false, message: "Africa’s Talking: the username or API key isn’t right." };
  },
);

/* ───────────── Branded SMS Pakistan (H3 Technologies) ───────────── */

const H3 = "https://secure.h3techs.com/sms/api";

export const brandedSmsPk = withTest(
  async (ctx, to, text) => {
    const body = new URLSearchParams({ email: String(ctx.connection.config.email), key: ctx.connection.secrets.apiKey ?? "", mask: String(ctx.connection.config.mask), to, message: text });
    const r = await http<{ sms?: { code?: string; response?: unknown } }>(`${H3}/send`, { provider: "Branded SMS Pakistan", method: "POST", body });
    if (!r.ok || r.data.sms?.code !== "000") throw new Error(`Branded SMS Pakistan: ${typeof r.data.sms?.response === "string" ? r.data.sms.response : `not sent (${r.data.sms?.code ?? r.status})`}`);
  },
  async (ctx) => {
    const r = await http<{ sms?: { code?: string; response?: unknown } }>(`${H3}/balance?email=${encodeURIComponent(String(ctx.connection.config.email))}&key=${encodeURIComponent(ctx.connection.secrets.apiKey ?? "")}`, { provider: "Branded SMS Pakistan" });
    const ok = r.ok && (r.data.sms?.code === "000" || r.data.sms?.code === "200");
    return ok ? { ok: true, account: typeof r.data.sms?.response === "string" || typeof r.data.sms?.response === "number" ? `balance ${String(r.data.sms.response)}` : undefined } : { ok: false, message: "Branded SMS Pakistan: the email or API key isn’t right." };
  },
);

/* ───────────── any provider with a "send" web address ───────────── */

export const smsHttp = withTest(async (ctx, to, text) => {
  const template = ctx.connection.secrets.url ?? "";
  if (!template.includes("{to}") || !template.includes("{message}")) throw new Error("The send address must contain {to} and {message}.");
  const url = template.replaceAll("{to}", encodeURIComponent(to)).replaceAll("{message}", encodeURIComponent(text));
  const u = new URL(url);
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("The send address must be a web address.");
  const r =
    ctx.connection.config.method === "POST"
      ? await http(`${u.origin}${u.pathname}`, { provider: "SMS provider", method: "POST", body: new URLSearchParams(u.searchParams) })
      : await http(url, { provider: "SMS provider" });
  const want = String(ctx.connection.config.successText ?? "").trim();
  if (!r.ok || (want && !r.text.includes(want))) throw new Error(`SMS provider answered ${r.status}: ${r.text.slice(0, 200)}`);
});
