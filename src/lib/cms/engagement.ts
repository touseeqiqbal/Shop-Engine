import "server-only";
import { randomBytes } from "node:crypto";
import { unstable_cache } from "next/cache";
import { findProductDoc, inStore, payloadClient } from "@/lib/cms/catalog-source";
import { isCmsConfigured } from "@/lib/db/config";
import { currentStoreId } from "@/lib/tenant";

/**
 * Storefront side of questions, stock / price alerts, trade-ins, installments and abandoned carts – always of ONE store
 * (the request's store unless a store id is passed, e.g. by background jobs).
 */

type StoreArg = number | null | undefined;
const storeOf = async (storeId: StoreArg) => (storeId === undefined ? await currentStoreId() : storeId);

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

const conversionCached = unstable_cache(
  async (storeId: number | null): Promise<ConversionSettings> => {
    if (!isCmsConfigured) return DEFAULT_CONVERSION;
    try {
      const { getStoreSettings } = await import("@/payload/store-settings");
      const g = await getStoreSettings<Doc>(await payloadClient(), "conversion", storeId);
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
  ["conversion-settings-v2"],
  { tags: ["settings"], revalidate: 300 }
);

/** The store's Settings → Conversion (installments, abandoned-cart reminders, alerts). */
export const getConversionSettings = async (storeId?: StoreArg) => conversionCached(await storeOf(storeId));

/* ───────────── questions ───────────── */

export type ProductQuestion = { id: string; name: string; question: string; answer: string; createdAt: string };

const questionsCached = unstable_cache(
  async (productId: string, storeId: number | null): Promise<ProductQuestion[]> => {
    if (!isCmsConfigured) return [];
    const payload = await payloadClient();
    const doc = await findProductDoc(payload, productId, storeId);
    if (!doc) return [];
    const res = await payload.find({ collection: "product-questions", where: { and: [{ product: { equals: doc.id } }, { published: { equals: true } }] }, limit: 30, depth: 0, sort: "-createdAt", overrideAccess: true });
    return (res.docs as unknown as Doc[]).map((q) => ({ id: String(q.id), name: str(q.name), question: str(q.question), answer: str(q.answer), createdAt: str(q.createdAt) }));
  },
  ["product-questions-v2"],
  { tags: ["catalog"], revalidate: 600 }
);

export const getProductQuestions = async (productId: string, storeId?: StoreArg) => questionsCached(productId, await storeOf(storeId));

export async function createQuestion(productId: string, q: { name: string; email?: string; question: string }, storeId?: StoreArg) {
  const payload = await payloadClient();
  const store = await storeOf(storeId);
  const doc = await findProductDoc(payload, productId, store);
  if (!doc || doc.status !== "active") return null;
  await payload.create({ collection: "product-questions", data: { store: doc.store ?? store, product: doc.id, name: q.name, email: q.email || null, question: q.question, published: false } as never, overrideAccess: true, context: { storefront: true } });
  return str(doc.title);
}

/* ───────────── stock & price alerts ───────────── */

export async function createAlert(productId: string, kind: "stock" | "price", contact: string, storeId?: StoreArg) {
  const payload = await payloadClient();
  const store = await storeOf(storeId);
  const doc = await findProductDoc(payload, productId, store);
  if (!doc || doc.status !== "active") return false;
  const existing = await payload.find({ collection: "stock-alerts", where: { and: [{ product: { equals: doc.id } }, { kind: { equals: kind } }, { contact: { equals: contact } }, { status: { equals: "waiting" } }] }, limit: 1, depth: 0, overrideAccess: true });
  if (existing.docs.length) return true;
  const price = num(doc.price);
  await payload.create({ collection: "stock-alerts", data: { store: doc.store ?? store, product: doc.id, kind, contact, status: "waiting", priceAtSignup: price } as never, overrideAccess: true, context: { storefront: true } });
  return true;
}

/* ───────────── trade-ins ───────────── */

export async function createTradeIn(data: Doc, storeId?: StoreArg) {
  const payload = await payloadClient();
  const store = await storeOf(storeId);
  const doc = (await payload.create({ collection: "trade-ins", data: { ...data, store } as never, overrideAccess: true, depth: 0, context: { storefront: true, storeId: store } })) as unknown as Doc;
  return String(doc.id);
}

/* ───────────── abandoned carts ───────────── */

export type DraftItem = { productId: string; name: string; qty: number; unitPrice: number; slug?: string; url?: string; image?: string; brandName?: string; upgrades?: { id: string; group: string; label: string; price: number }[] };

/**
 * Saves (or refreshes) the checkout a shopper has started, keyed by their phone / email. An open cart is only changed by
 * the browser that started it (`ownerToken`, kept in a cookie) – typing someone else's number can't replace their cart.
 * Returns the cart's token (for that cookie).
 */
export async function saveCheckoutDraft(d: { name: string; phone: string | null; email: string | null; items: DraftItem[] }, storeId?: StoreArg, ownerToken?: string | null): Promise<string | null> {
  const payload = await payloadClient();
  const store = await storeOf(storeId);
  const contact = d.email || d.phone;
  if (!contact || !d.items.length) return null;
  const total = d.items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const or = [d.phone ? { phone: { equals: d.phone } } : null, d.email ? { email: { equals: d.email } } : null].filter(Boolean) as Doc[];
  const existing = (await payload.find({ collection: "abandoned-carts", where: { and: [{ or }, { status: { in: ["open", "reminded"] } }, inStore(store)] } as never, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined;
  const data = { contact, name: d.name || null, phone: d.phone, email: d.email, items: d.items, total, lastActivityAt: new Date().toISOString() };
  if (existing) {
    if (!ownerToken || ownerToken !== existing.token) return null;
    await payload.update({ collection: "abandoned-carts", id: Number(existing.id), data: data as never, overrideAccess: true, context: { storefront: true } });
    return String(existing.token);
  }
  const token = randomBytes(16).toString("base64url");
  await payload.create({ collection: "abandoned-carts", data: { ...data, store, status: "open", remindersSent: 0, token } as never, overrideAccess: true, context: { storefront: true, storeId: store } });
  return token;
}

/** Called when an order is placed: the shopper's open cart counts as recovered (if we reminded them) or is closed. */
export async function closeDraftForOrder(phone: string, email: string | null, orderNumber: string, storeId?: StoreArg) {
  const payload = await payloadClient();
  const store = await storeOf(storeId);
  const or = [{ phone: { equals: phone } }, ...(email ? [{ email: { equals: email } }] : [])];
  const res = await payload.find({ collection: "abandoned-carts", where: { and: [{ or }, { status: { in: ["open", "reminded"] } }, inStore(store)] } as never, limit: 5, depth: 0, overrideAccess: true });
  for (const c of res.docs as unknown as Doc[]) {
    if (c.status === "reminded") await payload.update({ collection: "abandoned-carts", id: Number(c.id), data: { status: "recovered", recoveredOrder: orderNumber } as never, overrideAccess: true });
    else await payload.delete({ collection: "abandoned-carts", id: Number(c.id), overrideAccess: true });
  }
}

/** A reminder link's cart – only on the store it belongs to. */
export async function findDraftByToken(token: string, storeId?: StoreArg) {
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(token)) return null;
  const payload = await payloadClient();
  const store = await storeOf(storeId);
  return ((await payload.find({ collection: "abandoned-carts", where: { and: [{ token: { equals: token } }, inStore(store)] }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined) ?? null;
}

export async function stopDraftReminders(token: string, storeId?: StoreArg) {
  const c = await findDraftByToken(token, storeId);
  if (!c) return;
  await (await payloadClient()).update({ collection: "abandoned-carts", id: Number(c.id), data: { status: "stopped" } as never, overrideAccess: true });
}
