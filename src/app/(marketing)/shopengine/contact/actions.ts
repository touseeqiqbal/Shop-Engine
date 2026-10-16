"use server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { BOT_MESSAGE, verifyTurnstile } from "@/lib/turnstile";
import { HONEYPOT } from "@/lib/honeypot";
import { isCmsConfigured } from "@/lib/db/config";
import { deliverEmail } from "@/lib/mailer";
import { log } from "@/lib/log";
import { CONTACT_TOPICS as TOPICS } from "@/lib/marketing/content";

/**
 * The marketing site's contact form → ShopEngine's own inbox: a contact message with no store (only platform admins see
 * it in /cms → Contact messages), plus an email to PLATFORM_CONTACT_EMAIL when that and an email provider are set.
 */

export type ContactField = "name" | "email" | "company" | "topic" | "message";
export interface PlatformContactState {
  ok: boolean;
  message: string;
  errors?: Partial<Record<ContactField, string>>;
  /** what was typed, so the form keeps it when there's an error */
  values?: Partial<Record<ContactField, string>>;
  ts?: number;
}

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80, "Name is too long"),
  email: z.string().trim().email("Enter a valid email address").max(120, "Email is too long"),
  company: z.string().trim().max(120, "Company name is too long").optional(),
  topic: z.enum(TOPICS, { message: "Choose a topic" }),
  message: z.string().trim().min(10, "Please write a little more (at least 10 characters)").max(4000, "Message is too long (4,000 characters at most)"),
});

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

export async function submitPlatformContact(_prev: PlatformContactState, fd: FormData): Promise<PlatformContactState> {
  // honeypot: people never fill it – answer as if it worked
  if (String(fd.get(HONEYPOT) ?? "").trim()) return { ok: true, message: "Thank you – your message has been sent.", ts: Date.now() };
  const values = Object.fromEntries((["name", "email", "company", "topic", "message"] as const).map((k) => [k, String(fd.get(k) ?? "").slice(0, 4000)])) as Record<ContactField, string>;
  if (!(await verifyTurnstile(fd, "platform_contact"))) return { ok: false, message: BOT_MESSAGE, values, ts: Date.now() };

  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    const errors: PlatformContactState["errors"] = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0] as ContactField;
      if (k && !errors[k]) errors[k] = issue.message;
    }
    return { ok: false, message: "Please fix the highlighted fields.", errors, values, ts: Date.now() };
  }
  if (!(await rateLimit("platform-contact", 5, 3600_000))) return { ok: false, message: "Too many messages from your connection – please try again in an hour.", values, ts: Date.now() };

  const m = parsed.data;
  const subject = `${m.topic}${m.company ? ` – ${m.company}` : ""}`;
  let saved = false;
  if (isCmsConfigured) {
    try {
      const { payloadClient } = await import("@/lib/cms/catalog-source");
      const payload = await payloadClient();
      await payload.create({
        collection: "contact-messages",
        data: { name: m.name, email: m.email, subject: `[ShopEngine] ${subject}`.slice(0, 200), message: m.message, handled: false, receivedAt: new Date().toISOString() },
        overrideAccess: true,
        depth: 0,
        context: { platformInbox: true },
      });
      saved = true;
    } catch (e) {
      log.error("platform_contact.save_failed", e);
    }
  }

  let emailed = false;
  const to = (process.env.PLATFORM_CONTACT_EMAIL ?? "").trim();
  if (to) {
    try {
      const text = `${m.name} <${m.email}>${m.company ? `\nCompany: ${m.company}` : ""}\nTopic: ${m.topic}\n\n${m.message}`;
      const html = `<p><strong>${esc(m.name)}</strong> &lt;${esc(m.email)}&gt;${m.company ? `<br>Company: ${esc(m.company)}` : ""}<br>Topic: ${esc(m.topic)}</p><p style="white-space:pre-wrap">${esc(m.message)}</p>`;
      emailed = await deliverEmail({ to, subject: `ShopEngine contact: ${subject}`.slice(0, 200), html, text, replyTo: m.email });
    } catch (e) {
      log.error("platform_contact.email_failed", e);
    }
  }

  if (!saved && !emailed) {
    // development without a database or email provider: say so instead of pretending
    if (!isCmsConfigured && !to) log.warn("platform_contact.no_inbox", { topic: m.topic });
    return { ok: false, message: "Sorry – we couldn't send your message right now. Please try again in a few minutes.", values, ts: Date.now() };
  }
  return { ok: true, message: `Thank you, ${m.name.split(" ")[0]} – your message has been sent. We reply by email to ${m.email}.`, ts: Date.now() };
}
