import type { EmailAdapter } from "payload";
import { EMAIL_FROM, deliverEmail } from "@/lib/mailer";

/** Payload's own emails (password resets for /cms and customers) go out the same way as the store's emails. */
const parsed = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(EMAIL_FROM);
const fromName = parsed?.[1] || "Urko Tech Store";
const fromAddress = parsed?.[2] || EMAIL_FROM;

type To = string | { address: string; name?: string } | (string | { address: string; name?: string })[] | undefined;
const addresses = (to: To): string[] => (Array.isArray(to) ? to : to ? [to] : []).map((t) => (typeof t === "string" ? t : t.address));

export const mailerAdapter: EmailAdapter = () => ({
  name: "urko-mailer",
  defaultFromAddress: fromAddress,
  defaultFromName: fromName,
  sendEmail: async (message) =>
    deliverEmail({
      to: addresses(message.to as To),
      subject: String(message.subject ?? ""),
      html: String(message.html ?? ""),
      text: message.text ? String(message.text) : undefined,
    }),
});
