"use server";
import { z } from "zod";
import { createAlert, createQuestion } from "@/lib/cms/engagement";
import { isCmsConfigured } from "@/lib/db/config";
import { notifyFromStorefront } from "@/lib/notify";
import { rateLimit } from "@/lib/rate-limit";
import { BOT_MESSAGE, verifyTurnstile } from "@/lib/turnstile";
import { normalizePkPhone } from "@/lib/utils";
import { HONEYPOT } from "@/lib/honeypot";

/** Product page: ask a question, and "tell me when it's back / cheaper". */

export type SimpleState = { ok?: boolean; message?: string; ts?: number };

const contactOf = (raw: string) => {
  const v = raw.trim();
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return v.toLowerCase();
  return normalizePkPhone(v);
};

export async function askQuestion(productId: string, _prev: SimpleState, fd: FormData): Promise<SimpleState> {
  const ts = Date.now();
  if (String(fd.get(HONEYPOT) ?? "")) return { ok: true, message: "Thanks! We'll answer soon.", ts };
  if (!isCmsConfigured) return { ok: false, message: "Questions aren't available right now – please WhatsApp us.", ts };
  if (!(await verifyTurnstile(fd, "question"))) return { ok: false, message: BOT_MESSAGE, ts };
  const parsed = z
    .object({ name: z.string().trim().min(2, "Enter your name").max(60), email: z.string().trim().max(120).optional(), question: z.string().trim().min(8, "Write your question").max(800) })
    .safeParse({ name: fd.get("name"), email: String(fd.get("email") ?? "") || undefined, question: fd.get("question") });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message, ts };
  if (parsed.data.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(parsed.data.email)) return { ok: false, message: "Check the email address (or leave it empty).", ts };
  if (!(await rateLimit("question", 5, 3600_000))) return { ok: false, message: "You've asked several questions recently – please try again later.", ts };
  const title = await createQuestion(productId, { name: parsed.data.name, email: parsed.data.email?.toLowerCase(), question: parsed.data.question });
  if (!title) return { ok: false, message: "This product isn't available any more.", ts };
  await notifyFromStorefront("staff", { subject: `New question: ${title}`, lines: [`${parsed.data.name}: ${parsed.data.question}`], link: { href: "/cms/collections/product-questions?where[published][not_equals]=true", label: "Answer it" } });
  return { ok: true, message: parsed.data.email ? "Thanks! We'll email you when it's answered." : "Thanks! The answer will appear here soon.", ts };
}

export async function subscribeAlert(productId: string, kind: "stock" | "price", _prev: SimpleState, fd: FormData): Promise<SimpleState> {
  const ts = Date.now();
  if (String(fd.get(HONEYPOT) ?? "")) return { ok: true, message: "Done!", ts };
  if (!isCmsConfigured) return { ok: false, message: "Alerts aren't available right now.", ts };
  const contact = contactOf(String(fd.get("contact") ?? ""));
  if (!contact) return { ok: false, message: "Enter your email or a mobile number like 0300-1234567.", ts };
  if (!(await rateLimit("alert", 10, 3600_000))) return { ok: false, message: "Too many requests – please try again later.", ts };
  const ok = await createAlert(productId, kind, contact);
  if (!ok) return { ok: false, message: "This product isn't available any more.", ts };
  return { ok: true, message: kind === "stock" ? "Done – we'll tell you as soon as it's back." : "Done – we'll tell you if the price drops.", ts };
}
