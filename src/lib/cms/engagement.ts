import "server-only";
import { randomBytes } from "node:crypto";
import { unstable_cache } from "next/cache";
import { findProductDoc, payloadClient } from "@/lib/cms/catalog-source";
import { isCmsConfigured } from "@/lib/db/config";

/** Storefront side of questions, stock / price alerts, trade-ins, installments and abandoned carts. */

type Doc = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/* ───────────── settings ───────────── */

export type EmiPlan = { bank: string; months: number; markupPercent: number; minAmount: number };
export type ConversionSettings = {
  emiEnabled: boolean;
  emiMinPrice: number;
  emiHeading: string;
  emiNote: string;
  emiPlans: EmiPlan[];
  cartEnabled: boolean;
  cartFirstHours: number;
  cartSecondHours: number;
  cartSubject: string;
  cartMessage: string;
  cartCoupon: string;
  alertsEnabled: boolean;
  priceDropPercent: number;
};
export const DEFAULT_CONVERSION: ConversionSettings = {
  emiEnabled: false,
  emiMinPrice: 30000,
  emiHeading: "Pay in easy installments",
  emiNote: "Available with credit cards of the banks below. Final amount is confirmed by your bank. WhatsApp us to apply.",
  emiPlans: [],
  cartEnabled: true,
  cartFirstHours: 3,
  cartSecondHours: 24,
  cartSubject: "You left something in your cart",
  cartMessage: "Your items are still waiting – stock is limited, so complete your order before they're gone. Cash on delivery all over Pakistan.",
  cartCoupon: "",
  alertsEnabled: true,
  priceDropPercent: 3,
};

export const getConversionSettings = unstable_cache(
  async (): Promise<ConversionSettings> => {
    if (!isCmsConfigured) return DEFAULT_CONVERSION;
    try {
      const g = (await (await payloadClient()).findGlobal({ slug: "conversion", depth: 0, overrideAccess: true })) as unknown as Doc;
      if (!g.updatedAt) return DEFAULT_CONVERSION;
      const d = DEFAULT_CONVERSION;
      const n = (k: keyof ConversionSettings) => (typeof g[k] === "number" ? (g[k] as number) : (d[k] as number));
      const t = (k: keyof ConversionSettings) => (str(g[k]).trim() ? str(g[k]) : (d[k] as string));
      return {
        emiEnabled: g.emiEnabled === true,
        emiMinPrice: n("emiMinPrice"),
        emiHeading: t("emiHeading"),
        emiNote: t("emiNote"),
        emiPlans: ((g.emiPlans as Doc[] | undefined) ?? []).map((p) => ({ bank: str(p.bank), months: num(p.months), markupPercent: num(p.markupPercent), minAmount: num(p.minAmount) })).filter((p) => p.bank && p.months > 0),
        cartEnabled: g.cartEnabled !== false,
        cartFirstHours: n("cartFirstHours"),
        cartSecondHours: n("cartSecondHours"),
        cartSubject: t("cartSubject"),
        cartMessage: t("cartMessage"),
        cartCoupon: str(g.cartCoupon).trim(),
        alertsEnabled: g.alertsEnabled !== false,
        priceDropPercent: n("priceDropPercent"),
      };
    } catch {
      return DEFAULT_CONVERSION;
    }
  },
  ["conversion-settings-v1"],
  { tags: ["settings"], revalidate: 300 }
);

/* ───────────── questions ───────────── */

export type ProductQuestion = { id: string; name: string; question: string; answer: string; createdAt: string };

export const getProductQuestions = unstable_cache(
  async (productId: string): Promise<ProductQuestion[]> => {
    if (!isCmsConfigured) return [];
    const payload = await payloadClient();
    const doc = await findProductDoc(payload, productId);
    if (!doc) return [];
    const res = await payload.find({ collection: "product-questions", where: { and: [{ product: { equals: doc.id } }, { published: { equals: true } }] }, limit: 30, depth: 0, sort: "-createdAt", overrideAccess: true });
    return (res.docs as unknown as Doc[]).map((q) => ({ id: String(q.id), name: str(q.name), question: str(q.question), answer: str(q.answer), createdAt: str(q.createdAt) }));
  },
  ["product-questions-v1"],
  { tags: ["catalog"], revalidate: 600 }
);

export async function createQuestion(productId: string, q: { name: string; email?: string; question: string }) {
  const payload = await payloadClient();
  const doc = await findProductDoc(payload, productId);
  if (!doc || doc.status !== "active") return null;
  await payload.create({ collection: "product-questions", data: { product: doc.id, name: q.name, email: q.email || null, question: q.question, published: false } as never, overrideAccess: true });
  return str(doc.title);
}

/* ───────────── stock & price alerts ───────────── */

export async function createAlert(productId: string, kind: "stock" | "price", contact: string) {
  const payload = await payloadClient();
  const doc = await findProductDoc(payload, productId);
  if (!doc || doc.status !== "active") return false;
  const existing = await payload.find({ collection: "stock-alerts", where: { and: [{ product: { equals: doc.id } }, { kind: { equals: kind } }, { contact: { equals: contact } }, { status: { equals: "waiting" } }] }, limit: 1, depth: 0, overrideAccess: true });
  if (existing.docs.length) return true;
  const price = num(doc.compareAtPrice) > num(doc.price) ? num(doc.price) : num(doc.price);
  await payload.create({ collection: "stock-alerts", data: { product: doc.id, kind, contact, status: "waiting", priceAtSignup: price } as never, overrideAccess: true });
  return true;
}

/* ───────────── trade-ins ───────────── */

export async function createTradeIn(data: Doc) {
  const payload = await payloadClient();
  const doc = (await payload.create({ collection: "trade-ins", data: data as never, overrideAccess: true, depth: 0 })) as unknown as Doc;
  return String(doc.id);
}

/* ───────────── abandoned carts ───────────── */

export type DraftItem = { productId: string; name: string; qty: number; unitPrice: number; slug?: string; url?: string; image?: string; brandName?: string };

/** Saves (or refreshes) the checkout a shopper has started, keyed by their phone / email. */
export async function saveCheckoutDraft(d: { name: string; phone: string | null; email: string | null; items: DraftItem[] }) {
  const payload = await payloadClient();
  const contact = d.email || d.phone;
  if (!contact || !d.items.length) return;
  const total = d.items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const or = [d.phone ? { phone: { equals: d.phone } } : null, d.email ? { email: { equals: d.email } } : null].filter(Boolean) as Doc[];
  const existing = (await payload.find({ collection: "abandoned-carts", where: { and: [{ or }, { status: { in: ["open", "reminded"] } }] } as never, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined;
  const data = { contact, name: d.name || null, phone: d.phone, email: d.email, items: d.items, total, lastActivityAt: new Date().toISOString() };
  if (existing) await payload.update({ collection: "abandoned-carts", id: Number(existing.id), data: data as never, overrideAccess: true });
  else await payload.create({ collection: "abandoned-carts", data: { ...data, status: "open", remindersSent: 0, token: randomBytes(16).toString("base64url") } as never, overrideAccess: true });
}

/** Called when an order is placed: the shopper's open cart counts as recovered (if we reminded them) or is closed. */
export async function closeDraftForOrder(phone: string, email: string | null, orderNumber: string) {
  const payload = await payloadClient();
  const or = [{ phone: { equals: phone } }, ...(email ? [{ email: { equals: email } }] : [])];
  const res = await payload.find({ collection: "abandoned-carts", where: { and: [{ or }, { status: { in: ["open", "reminded"] } }] } as never, limit: 5, depth: 0, overrideAccess: true });
  for (const c of res.docs as unknown as Doc[]) {
    if (c.status === "reminded") await payload.update({ collection: "abandoned-carts", id: Number(c.id), data: { status: "recovered", recoveredOrder: orderNumber } as never, overrideAccess: true });
    else await payload.delete({ collection: "abandoned-carts", id: Number(c.id), overrideAccess: true });
  }
}

export async function findDraftByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(token)) return null;
  const payload = await payloadClient();
  return ((await payload.find({ collection: "abandoned-carts", where: { token: { equals: token } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined) ?? null;
}

export async function stopDraftReminders(token: string) {
  const c = await findDraftByToken(token);
  if (!c) return;
  await (await payloadClient()).update({ collection: "abandoned-carts", id: Number(c.id), data: { status: "stopped" } as never, overrideAccess: true });
}
