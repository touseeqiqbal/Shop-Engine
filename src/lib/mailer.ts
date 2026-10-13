import nodemailer, { type Transporter } from "nodemailer";

/**
 * One way out for every email (store notifications, contact form, /cms password resets, account emails).
 *
 *   SMTP (used when SMTP_HOST is set) – any mailbox: Google Workspace / Gmail, Zoho, Hostinger, Brevo…
 *     SMTP_HOST, SMTP_PORT (default 587; 465 = SSL), SMTP_USER, SMTP_PASS, SMTP_SECURE (optional "true"/"false")
 *   Resend (otherwise, when RESEND_API_KEY is set) – https://resend.com
 *
 *   EMAIL_FROM  – sender, default "Urko Tech Store <info@urkotechstore.com>". With SMTP it must be an address
 *                 the mailbox may send as (usually SMTP_USER itself).
 *
 * No provider configured → emails are logged in development and skipped otherwise. STAGING=true skips all email.
 * Not "server-only": the Payload config (and its CLI) imports this too.
 */

export const EMAIL_FROM = process.env.EMAIL_FROM || "Urko Tech Store <info@urkotechstore.com>";

export type EmailProvider = "smtp" | "resend" | null;
export function emailProvider(): EmailProvider {
  if (process.env.SMTP_HOST) return "smtp";
  if (process.env.RESEND_API_KEY) return "resend";
  return null;
}
export const isEmailConfigured = () => emailProvider() !== null;

export interface OutgoingEmail {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  from?: string;
}

const TIMEOUT = 15_000;
const g = globalThis as unknown as { __urkoSmtp?: Transporter };

function smtp() {
  if (!g.__urkoSmtp) {
    const port = Number(process.env.SMTP_PORT || 587);
    g.__urkoSmtp = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" } : undefined,
      connectionTimeout: TIMEOUT,
      greetingTimeout: TIMEOUT,
      socketTimeout: TIMEOUT,
    });
  }
  return g.__urkoSmtp;
}

/** Sends one email. Throws on provider errors (callers decide whether to swallow). Returns false when skipped. */
export async function deliverEmail(mail: OutgoingEmail): Promise<boolean> {
  const to = (Array.isArray(mail.to) ? mail.to : [mail.to]).filter(Boolean);
  if (!to.length) return false;
  const provider = emailProvider();
  if (process.env.STAGING === "true" || !provider) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[email] ${provider ? "STAGING – not sent" : "no email provider set – not sent"}: "${mail.subject}" → ${to.join(", ")}${mail.text ? `\n${mail.text}` : ""}`);
    }
    return false;
  }
  const from = mail.from || EMAIL_FROM;

  if (provider === "smtp") {
    await smtp().sendMail({ from, to, subject: mail.subject, html: mail.html, text: mail.text, replyTo: mail.replyTo });
    return true;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject: mail.subject, html: mail.html, text: mail.text, reply_to: mail.replyTo }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return true;
}
