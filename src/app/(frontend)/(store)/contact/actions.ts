"use server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { saveContactMessage } from "@/lib/repo/messages";
import { normalizePhone, phonePlaceholder } from "@/lib/phone";
import { getStoreLocale } from "@/lib/store-locale";
import { BOT_MESSAGE, verifyTurnstile } from "@/lib/turnstile";
import { HONEYPOT } from "@/lib/honeypot";
import { log } from "@/lib/log";

export interface ContactState {
  ok: boolean;
  message: string;
  errors?: Partial<Record<"name" | "phone" | "email" | "subject" | "message", string>>;
}

/** `country` = the store's country (ISO code): phone numbers are checked for it. */
const schema = (country: string) =>
  z.object({
    name: z.string().trim().min(2, "Please enter your name").max(80, "Name is too long"),
    phone: z
      .string()
      .trim()
      .transform((v) => normalizePhone(v, country) ?? "")
      .refine((v) => v.length > 0, country === "PK" ? "Enter a valid Pakistani mobile number, e.g. 0342-6693115" : `Enter a valid phone number, e.g. ${phonePlaceholder(country)}`),
    email: z.union([z.literal(""), z.string().trim().email("Enter a valid email address").max(120)]).optional(),
    subject: z.string().trim().max(120, "Subject is too long").optional(),
    message: z.string().trim().min(10, "Please write a little more (at least 10 characters)").max(3000, "Message is too long"),
  });

export async function submitContact(_prev: ContactState, formData: FormData): Promise<ContactState> {
  // Honeypot – real users never fill this hidden field.
  if (String(formData.get(HONEYPOT) ?? "").trim()) {
    return { ok: true, message: "Thank you! Your message has been received." };
  }
  if (!(await verifyTurnstile(formData, "contact"))) return { ok: false, message: BOT_MESSAGE };

  const parsed = schema((await getStoreLocale()).country).safeParse({
    name: formData.get("name") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    subject: formData.get("subject") ?? "",
    message: formData.get("message") ?? "",
  });
  if (!parsed.success) {
    const errors: ContactState["errors"] = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0] as keyof NonNullable<ContactState["errors"]>;
      if (k && !errors[k]) errors[k] = issue.message;
    }
    return { ok: false, message: "Please fix the highlighted fields.", errors };
  }

  if (!(await rateLimit("contact", 5, 3600_000))) {
    return { ok: false, message: "Too many messages from your connection. Please try again later or message us on WhatsApp." };
  }

  const data = { ...parsed.data, email: parsed.data.email || undefined, subject: parsed.data.subject || undefined };
  try {
    await saveContactMessage(data);
  } catch (err) {
    log.error("contact.save_failed", err);
    return { ok: false, message: "Sorry, we couldn't send your message right now. Please call or WhatsApp us instead." };
  }
  return { ok: true, message: `Thank you, ${data.name.split(" ")[0]}! We've received your message and will reply within store hours.` };
}
