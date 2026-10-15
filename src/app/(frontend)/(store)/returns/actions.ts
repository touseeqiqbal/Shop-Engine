"use server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createReturnRequest, createWarrantyClaim, findOrderForAftersales, getReturnsPolicy, type ReturnableOrder } from "@/lib/cms/aftersales";
import { notifyFromStorefront } from "@/lib/notify";
import { ORDER_NUMBER_EXAMPLE, ORDER_NUMBER_RE } from "@/lib/order-number";
import { rateLimit } from "@/lib/rate-limit";
import { storePhotos } from "@/lib/uploads";
import { normalizePhone } from "@/lib/phone";
import { getStoreLocale } from "@/lib/store-locale";
import { formatDate } from "@/lib/time";
import { log } from "@/lib/log";
import { BOT_MESSAGE, verifyTurnstile } from "@/lib/turnstile";
import { HONEYPOT } from "@/lib/honeypot";

/** Customer return / warranty forms (/returns). Orders are found by order (or shop receipt) number + phone. */

const numberSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine((v) => ORDER_NUMBER_RE.test(v) || /^POS-\d{6}-(?:\d{4}|\d{6})$/.test(v), `Order number looks like ${ORDER_NUMBER_EXAMPLE} (or a shop receipt POS-…)`);
/** `country` = the store's country (ISO code): phone numbers are checked for it. */
const phoneSchema = (country: string) => z.string().refine((v) => !!normalizePhone(v, country), "Enter the mobile number used for the order");

export type LookupState = { ok: true; order: Omit<ReturnableOrder, "id">; returnDays: number } | { ok: false; message: string } | null;

export async function lookupForReturn(number: string, phone: string): Promise<LookupState> {
  const { country } = await getStoreLocale();
  const n = numberSchema.safeParse(number);
  const p = phoneSchema(country).safeParse(phone);
  if (!n.success) return { ok: false, message: n.error.issues[0].message };
  if (!p.success) return { ok: false, message: p.error.issues[0].message };
  if (!(await rateLimit("returns-lookup", 15, 10 * 60_000))) return { ok: false, message: "Too many tries – please wait a few minutes." };
  const policy = await getReturnsPolicy();
  const order = await findOrderForAftersales(n.data, normalizePhone(p.data, country)!, policy.returnDays).catch(() => null);
  if (!order) return { ok: false, message: "We couldn't find an order with that number and phone. Check both and try again." };
  const { id: _id, ...rest } = order;
  return { ok: true, order: rest, returnDays: policy.returnDays };
}

export type SubmitState = { ok: true; reference: string; message: string } | { ok: false; message: string } | null;

export async function submitReturn(_prev: SubmitState, fd: FormData): Promise<SubmitState> {
  if (String(fd.get(HONEYPOT) ?? "")) return { ok: false, message: "Something went wrong." };
  if (!(await verifyTurnstile(fd, "aftersales"))) return { ok: false, message: BOT_MESSAGE };
  const { country } = await getStoreLocale();
  const n = numberSchema.safeParse(String(fd.get("orderNumber") ?? ""));
  const p = phoneSchema(country).safeParse(String(fd.get("phone") ?? ""));
  if (!n.success || !p.success) return { ok: false, message: "Find your order first." };
  if (!(await rateLimit("returns-submit", 5, 60 * 60_000))) return { ok: false, message: "Too many requests – please WhatsApp us instead." };
  const policy = await getReturnsPolicy();
  const order = await findOrderForAftersales(n.data, normalizePhone(p.data, country)!, policy.returnDays).catch(() => null);
  if (!order) return { ok: false, message: "We couldn't find that order." };
  if (order.status !== "delivered" || order.daysLeft == null) return { ok: false, message: "Returns can be requested once the order is delivered." };
  if (order.daysLeft < 0) return { ok: false, message: `Returns are accepted within ${policy.returnDays} days of delivery. For faults after that, please make a warranty claim.` };

  let picked: { index: number; qty: number }[] = [];
  try {
    picked = (JSON.parse(String(fd.get("items") ?? "[]")) as { index: number; qty: number }[]).filter((x) => order.items[x.index] && x.qty > 0);
  } catch {
    picked = [];
  }
  if (!picked.length) return { ok: false, message: "Tick the item(s) you want to return." };
  const reason = policy.reasons.find((r) => r.label === String(fd.get("reason") ?? ""));
  if (!reason) return { ok: false, message: "Choose a reason." };
  const details = String(fd.get("details") ?? "").trim().slice(0, 2000);
  const photos = fd.getAll("photos");
  if (policy.requirePhotos && !photos.some((f) => f instanceof File && f.size > 0)) return { ok: false, message: "Please add at least one photo of the item." };
  const stored = await storePhotos(photos, "returns", randomUUID().slice(0, 12));
  if ("error" in stored) return { ok: false, message: stored.error };

  type ReturnLine = { product: number | null; title: string; qty: number; unitPrice: number; serial: string | null };
  const items = picked.flatMap((x): ReturnLine[] => {
    const i = order.items[x.index];
    const qty = Math.min(x.qty, i.qty);
    // serial-numbered laptops: one line per laptop, so each one can be checked and put back by its serial
    if (i.serials.length) return i.serials.slice(0, qty).map((serial) => ({ product: i.productId, title: i.title, qty: 1, unitPrice: i.unitPrice, serial }));
    return [{ product: i.productId, title: i.title, qty, unitPrice: i.unitPrice, serial: null }];
  });
  const reference = await createReturnRequest({
    status: "requested",
    orderNumber: order.orderNumber,
    order: order.orderNumber.startsWith("POS-") ? null : order.id,
    customerName: order.customerName || "Customer",
    customerPhone: order.phone,
    items,
    reason: reason.label,
    changeOfMind: reason.changeOfMind,
    details,
    photoKeys: stored.keys,
  });
  await notifyFromStorefront("staff", { subject: `New return ${reference}`, lines: [`${order.customerName} · ${order.phone}`, `Order ${order.orderNumber} – ${reason.label}`, ...items.map((i) => `• ${i.title} × ${i.qty}`)], link: { href: "/cms/collections/return-requests?where[status][equals]=requested", label: "Open returns" } });
  log.info("return.requested", { reference, order: order.orderNumber });
  return { ok: true, reference, message: `We've got your return request ${reference}. We'll WhatsApp or call you within 1 working day.` };
}

export async function submitWarranty(_prev: SubmitState, fd: FormData): Promise<SubmitState> {
  if (String(fd.get(HONEYPOT) ?? "")) return { ok: false, message: "Something went wrong." };
  if (!(await verifyTurnstile(fd, "aftersales"))) return { ok: false, message: BOT_MESSAGE };
  const loc = await getStoreLocale();
  const schema = z.object({
    name: z.string().trim().min(3, "Enter your name").max(100),
    phone: phoneSchema(loc.country),
    serial: z.string().trim().max(60).optional(),
    orderNumber: z.string().trim().toUpperCase().max(20).optional(),
    issue: z.string().trim().min(10, "Tell us what's wrong (at least a few words)").max(2000),
  });
  const parsed = schema.safeParse({ name: fd.get("name"), phone: fd.get("phone"), serial: fd.get("serial") || undefined, orderNumber: fd.get("orderNumber") || undefined, issue: fd.get("issue") });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const d = parsed.data;
  if (!d.serial && !d.orderNumber) return { ok: false, message: "Enter the serial number or your order / receipt number." };
  if (!(await rateLimit("warranty-submit", 5, 60 * 60_000))) return { ok: false, message: "Too many requests – please WhatsApp us instead." };
  const phone = normalizePhone(d.phone, loc.country)!;
  if (d.orderNumber) {
    const policy = await getReturnsPolicy();
    const order = await findOrderForAftersales(d.orderNumber, phone, policy.returnDays).catch(() => null);
    if (!order) return { ok: false, message: "That order / receipt number doesn't match your phone number." };
  }
  const stored = await storePhotos(fd.getAll("photos"), "warranty", randomUUID().slice(0, 12));
  if ("error" in stored) return { ok: false, message: stored.error };
  const claim = await createWarrantyClaim({ status: "open", customerName: d.name, customerPhone: phone, serial: d.serial ?? null, orderNumber: d.orderNumber ?? null, issue: d.issue, photoKeys: stored.keys });
  await notifyFromStorefront("staff", { subject: `New warranty claim ${claim.claimNumber}`, lines: [`${d.name} · ${phone}`, `Serial ${d.serial ?? "–"} · order ${d.orderNumber ?? "–"}`, d.issue, `Warranty check: ${claim.inWarranty}`], link: { href: "/cms/collections/warranty-claims?where[status][equals]=open", label: "Open warranty claims" } });
  log.info("warranty.claimed", { reference: claim.claimNumber, inWarranty: claim.inWarranty });
  const until = claim.warrantyEndsAt ? formatDate(claim.warrantyEndsAt, loc) : "";
  const note =
    claim.inWarranty === "yes"
      ? ` Good news: it's in warranty until ${until}.`
      : claim.inWarranty === "no"
        ? ` Our records show the warranty ended on ${until} – we'll still take a look and tell you the options.`
        : "";
  return { ok: true, reference: claim.claimNumber, message: `Warranty claim ${claim.claimNumber} received.${note} We'll WhatsApp or call you within 1 working day.` };
}
