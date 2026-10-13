"use server";
import { after } from "next/server";
import { z } from "zod";
import { PAKISTAN_CITIES } from "@/lib/cities";
import { notifyWholesaleInquiry } from "@/lib/notify";
import { rateLimit } from "@/lib/rate-limit";
import { getProductsByIds } from "@/lib/repo/catalog";
import { saveWholesaleInquiry } from "@/lib/repo/wholesale";
import type { WholesaleInquiryItem } from "@/lib/types";
import { normalizePkPhone } from "@/lib/utils";
import { BUYER_TYPES, inquirySummary } from "@/lib/wholesale";
import { BOT_MESSAGE, verifyTurnstile } from "@/lib/turnstile";
import { HONEYPOT } from "@/lib/honeypot";
import { log } from "@/lib/log";

export type QuoteField = "name" | "businessName" | "phone" | "email" | "city" | "buyerType" | "items" | "budget" | "message";

export type QuoteState =
  | { ok: false; message?: string; errors?: Partial<Record<QuoteField, string>>; ts?: number }
  | { ok: true; message: string; summary: string; firstName: string; units: number; ts: number };

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80, "Name is too long"),
  businessName: z.string().trim().max(120, "Business name is too long"),
  phone: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const n = normalizePkPhone(v);
      if (!n) {
        ctx.addIssue({ code: "custom", message: "Enter a valid mobile number, e.g. 0342-6693115" });
        return z.NEVER;
      }
      return n;
    }),
  email: z.union([z.literal(""), z.email("Enter a valid email address").max(120)]),
  city: z.string().refine((c) => PAKISTAN_CITIES.includes(c), "Please choose your city from the list"),
  buyerType: z.enum(BUYER_TYPES as [string, ...string[]], "Choose what best describes you"),
  items: z
    .array(
      z.object({
        productId: z.string().max(140).optional(),
        productName: z.string().trim().min(2, "Describe each item (model / specs)").max(200, "Item description is too long"),
        qty: z.coerce.number().int("Whole numbers only").min(1, "Quantity must be at least 1").max(100_000, "Quantity is too large"),
      })
    )
    .min(1, "Add at least one item you need")
    .max(30, "Too many rows – put the rest in the message"),
  budget: z.string().trim().max(120, "Budget is too long"),
  message: z.string().trim().max(3000, "Message is too long"),
  source: z.string().trim().max(200).regex(/^\/[^\s]*$/).optional().catch(undefined),
});

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
};

function parseItems(raw: string): unknown {
  try {
    const v = JSON.parse(raw);
    // drop completely empty rows the user never filled in
    return Array.isArray(v) ? v.filter((r) => r && (String(r.productName ?? "").trim() || r.productId)) : [];
  } catch {
    return [];
  }
}

export async function submitWholesaleQuote(_prev: QuoteState, fd: FormData): Promise<QuoteState> {
  const ts = Date.now();
  // Honeypot – real buyers never see/fill this field. Pretend success so bots learn nothing.
  if (str(fd, HONEYPOT).trim()) return { ok: true, message: "Thank you! Your quote request has been received.", summary: "", firstName: "", units: 0, ts };
  if (!(await verifyTurnstile(fd, "wholesale"))) return { ok: false, message: BOT_MESSAGE, ts };

  const parsed = schema.safeParse({
    name: str(fd, "name"),
    businessName: str(fd, "businessName"),
    phone: str(fd, "phone"),
    email: str(fd, "email").trim(),
    city: str(fd, "city"),
    buyerType: str(fd, "buyerType"),
    items: parseItems(str(fd, "items")),
    budget: str(fd, "budget"),
    message: str(fd, "message"),
    source: str(fd, "source") || undefined,
  });
  if (!parsed.success) {
    const errors: Partial<Record<QuoteField, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "") as QuoteField;
      if (key && !errors[key]) errors[key] = issue.message;
    }
    return { ok: false, message: "Please fix the highlighted fields.", errors, ts };
  }
  const data = parsed.data;

  if (!(await rateLimit("wholesale", 5, 3600_000)))
    return { ok: false, message: "Too many quote requests from your connection. Please try again later or message us on WhatsApp.", ts };

  // Product names / links come from the live catalog, never from the client.
  const products = await getProductsByIds([...new Set(data.items.map((i) => i.productId).filter((x): x is string => Boolean(x)))]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const items: WholesaleInquiryItem[] = data.items.map((i) => {
    const p = i.productId ? byId.get(i.productId) : undefined;
    return p ? { productId: p.id, productName: p.name, url: p.url, qty: i.qty } : { productName: i.productName, qty: i.qty };
  });

  let inquiry;
  try {
    inquiry = await saveWholesaleInquiry({
      name: data.name,
      businessName: data.businessName || undefined,
      phone: data.phone,
      email: data.email || undefined,
      city: data.city,
      buyerType: data.buyerType as (typeof BUYER_TYPES)[number],
      items,
      budget: data.budget || undefined,
      message: data.message || undefined,
      source: data.source,
    });
  } catch (err) {
    log.error("wholesale.save_failed", err);
    return { ok: false, message: "Sorry, we couldn't send your request right now. Please WhatsApp or call us instead.", ts };
  }

  // Email alert after the response is sent – never blocks or fails the request.
  const saved = inquiry;
  after(() => notifyWholesaleInquiry(saved));

  const firstName = data.name.split(" ")[0];
  return {
    ok: true,
    message: `Thank you, ${firstName}! We've received your wholesale quote request and will contact you within store hours.`,
    summary: inquirySummary(inquiry),
    firstName,
    units: items.reduce((s, i) => s + i.qty, 0),
    ts,
  };
}
