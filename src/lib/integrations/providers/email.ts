import { http } from "../http";
import type { Ctx, MessagingImpl, ProviderImpl, TestResult } from "../types";

/**
 * Customer emails through the store's own email account: Resend, Brevo or any SMTP server.
 */

type Mail = Parameters<NonNullable<MessagingImpl["email"]>>[1];
const fromOf = (ctx: Ctx) => {
  const email = String(ctx.connection.config.fromEmail ?? "").trim();
  const name = String(ctx.connection.config.fromName ?? "").replace(/["<>]/g, "").trim();
  return { email, name, header: name ? `"${name}" <${email}>` : email };
};

function withTest(send: (ctx: Ctx, mail: Mail) => Promise<void>, check?: (ctx: Ctx) => Promise<{ ok: boolean; account?: string; message?: string }>): ProviderImpl {
  return {
    async test(ctx): Promise<TestResult> {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fromOf(ctx).email)) return { ok: false, message: "Enter the address to send from." };
      const c = check ? await check(ctx) : { ok: true };
      if (!c.ok) return { ok: false, message: c.message ?? "The details aren’t right." };
      const to = String(ctx.connection.config.testEmail ?? "").trim();
      if (!to) return { ok: true, message: c.account ? `Connected (${c.account}).` : "Saved.", ...(c.account ? { state: { account: c.account } } : {}) };
      try {
        await send(ctx, { to: [to], subject: "ShopEngine test email", html: "<p>Your store’s email is connected – customer emails will now be sent from this address.</p>", text: "Your store’s email is connected – customer emails will now be sent from this address." });
        return { ok: true, message: `A test email was sent to ${to}.`, ...(c.account ? { state: { account: c.account } } : {}) };
      } catch (e) {
        return { ok: false, message: `The test email wasn’t sent: ${(e as Error).message}` };
      }
    },
    messaging: { email: send },
  };
}

/* ───────────── Resend ───────────── */

const RESEND = "https://api.resend.com";
const resendHeaders = (ctx: Ctx) => ({ authorization: `Bearer ${ctx.connection.secrets.apiKey ?? ""}`, "user-agent": "ShopEngine/1.0" });

export const resend = withTest(
  async (ctx, mail) => {
    const r = await http<{ message?: string; id?: string }>(`${RESEND}/emails`, {
      provider: "Resend",
      method: "POST",
      headers: resendHeaders(ctx),
      body: { from: fromOf(ctx).header, to: mail.to, subject: mail.subject, html: mail.html, ...(mail.text ? { text: mail.text } : {}), ...(mail.replyTo ? { reply_to: mail.replyTo } : {}), ...(mail.headers ? { headers: mail.headers } : {}) },
    });
    if (!r.ok) throw new Error(`Resend ${r.status}: ${r.data.message ?? "not sent"}`);
  },
  async (ctx) => {
    // a sending-only key can't list domains (401/403 "restricted"): that is fine – it can still send
    const r = await http<{ data?: { name?: string; status?: string }[]; message?: string; name?: string }>(`${RESEND}/domains`, { provider: "Resend", headers: resendHeaders(ctx) });
    if (r.status === 401 && !/restricted/i.test(`${r.data.name ?? ""} ${r.data.message ?? ""}`)) return { ok: false, message: "Resend: the API key isn’t right." };
    if (!r.ok) return { ok: true, account: "sending key" };
    const domain = fromOf(ctx).email.split("@")[1]?.toLowerCase();
    const d = r.data.data?.find((x) => x.name?.toLowerCase() === domain);
    if (!d) return { ok: false, message: `Resend: ${domain} isn’t a domain in this Resend account – add and verify it first.` };
    if (d.status !== "verified") return { ok: false, message: `Resend: ${domain} isn’t verified yet (status: ${d.status}). Add the DNS records Resend shows, then check again.` };
    return { ok: true, account: domain };
  },
);

/* ───────────── Brevo ───────────── */

const BREVO = "https://api.brevo.com/v3";

export const brevo = withTest(
  async (ctx, mail) => {
    const from = fromOf(ctx);
    const r = await http<{ message?: string }>(`${BREVO}/smtp/email`, {
      provider: "Brevo",
      method: "POST",
      headers: { "api-key": ctx.connection.secrets.apiKey ?? "" },
      body: { sender: { email: from.email, ...(from.name ? { name: from.name } : {}) }, to: mail.to.map((email) => ({ email })), subject: mail.subject, htmlContent: mail.html, ...(mail.text ? { textContent: mail.text } : {}), ...(mail.replyTo ? { replyTo: { email: mail.replyTo } } : {}), ...(mail.headers ? { headers: mail.headers } : {}) },
    });
    if (!r.ok) throw new Error(`Brevo ${r.status}: ${r.data.message ?? "not sent"}`);
  },
  async (ctx) => {
    const r = await http<{ email?: string; companyName?: string; message?: string }>(`${BREVO}/account`, { provider: "Brevo", headers: { "api-key": ctx.connection.secrets.apiKey ?? "" } });
    if (!r.ok) return { ok: false, message: `Brevo: ${r.data.message ?? "the API key isn’t right"}` };
    return { ok: true, account: r.data.companyName || r.data.email };
  },
);

/* ───────────── SMTP ───────────── */

async function transport(ctx: Ctx) {
  const nodemailer = (await import("nodemailer")).default;
  const { resolvePublicHost } = await import("@/lib/net/public-request");
  const port = Number(ctx.connection.config.port || 587);
  const host = String(ctx.connection.config.host ?? "").trim();
  // the store's SMTP server: never an internal address – connect to the address checked, the name only for TLS
  const { address } = await resolvePublicHost(host).catch((e: Error) => {
    throw new Error(e.name === "PrivateAddressError" ? "that server is on a private network – use your email provider's public SMTP server" : `couldn't find ${host}`);
  });
  return nodemailer.createTransport({
    host: address,
    tls: { servername: host },
    port,
    secure: port === 465,
    auth: { user: String(ctx.connection.config.username), pass: ctx.connection.secrets.password ?? "" },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });
}

export const smtp = withTest(
  async (ctx, mail) => {
    const t = await transport(ctx);
    await t.sendMail({ from: fromOf(ctx).header, to: mail.to, subject: mail.subject, html: mail.html, text: mail.text, replyTo: mail.replyTo, ...(mail.headers ? { headers: mail.headers } : {}) });
  },
  async (ctx) => {
    try {
      await (await transport(ctx)).verify();
      return { ok: true, account: String(ctx.connection.config.host) };
    } catch (e) {
      return { ok: false, message: `Couldn’t sign in to ${String(ctx.connection.config.host)}: ${(e as Error).message}` };
    }
  },
);
