import "server-only";
import { unstable_cache } from "next/cache";
import { inStore, payloadClient } from "@/lib/cms/catalog-source";
import { isCmsConfigured } from "@/lib/db/config";
import { currentStoreId } from "@/lib/tenant";

/**
 * Returns & warranty for the storefront – of the store the customer is on: its rules (Settings → Returns & warranty
 * rules), its orders and shop receipts, and requests saved to it.
 */

type Doc = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const digits = (s: string) => s.replace(/\D/g, "").replace(/^92/, "0");

export type ReturnsPolicy = {
  returnDays: number;
  restockingFeePercent: number;
  requirePhotos: boolean;
  reasons: { label: string; changeOfMind: boolean }[];
  returnRules: string[];
  warrantyRules: string[];
  warrantyTable: { type: string; text: string; where: string }[];
};

export const DEFAULT_RETURNS_POLICY: ReturnsPolicy = {
  returnDays: 3,
  restockingFeePercent: 0,
  requirePhotos: true,
  reasons: [
    { label: "Faulty / not working", changeOfMind: false },
    { label: "Damaged in delivery", changeOfMind: false },
    { label: "Wrong item sent", changeOfMind: false },
    { label: "Not as described", changeOfMind: false },
    { label: "Changed my mind", changeOfMind: true },
  ],
  returnRules: ["Items must be in the original box with all accessories.", "Wrong, damaged or faulty items are replaced free of charge.", "Refunds are sent within 3–5 working days after we inspect the item."],
  warrantyRules: ["Warranty covers hardware faults, not physical or liquid damage.", "Keep your receipt or order number.", "Most claims are resolved in 3–7 working days."],
  warrantyTable: [
    { type: "New (box packed)", text: "Official brand / distributor warranty as stated on the product page (usually 1 year)", where: "Brand service centre or via our store" },
    { type: "Open Box", text: "Brand or shop warranty as stated on the product page", where: "Our Saddar shop" },
    { type: "Refurbished", text: "Up to 6 months shop warranty", where: "Our Saddar shop" },
    { type: "Used A+ / Used A", text: "1–3 months checking warranty", where: "Our Saddar shop" },
    { type: "Chargers, batteries, RAM, SSD", text: "1–12 months depending on product (shown on product page)", where: "Our Saddar shop" },
    { type: "Peripherals & accessories", text: "As stated on the product page (brand warranty where applicable)", where: "Our Saddar shop / brand" },
  ],
};

/** A new store's starting rules (until it saves its own): nothing that names another shop. */
export const GENERIC_RETURNS_POLICY: ReturnsPolicy = {
  ...DEFAULT_RETURNS_POLICY,
  returnDays: 7,
  warrantyTable: [{ type: "All products", text: "As stated on the product page", where: "Contact the store" }],
};

const lines = (v: unknown, d: string[]) => {
  const out = str(v)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return out.length ? out : d;
};

const policyCached = unstable_cache(
  async (storeId: number | null): Promise<ReturnsPolicy> => {
    if (!isCmsConfigured) return DEFAULT_RETURNS_POLICY;
    try {
      const payload = await payloadClient();
      const { getStoreSettings } = await import("@/payload/store-settings");
      const g = await getStoreSettings<Doc>(payload, "returns-policy", storeId);
      const { getDefaultStoreId } = await import("@/payload/tenancy");
      const d = storeId == null || storeId === (await getDefaultStoreId(payload)) ? DEFAULT_RETURNS_POLICY : GENERIC_RETURNS_POLICY;
      if (!g.updatedAt) return d;
      const reasons = ((g.reasons as Doc[] | undefined) ?? []).map((r) => ({ label: str(r.label), changeOfMind: r.changeOfMind === true })).filter((r) => r.label);
      const table = ((g.warrantyByCondition as Doc[] | undefined) ?? []).map((r) => ({ type: str(r.type), text: str(r.text), where: str(r.where) })).filter((r) => r.type);
      return {
        returnDays: typeof g.returnDays === "number" ? g.returnDays : d.returnDays,
        restockingFeePercent: typeof g.restockingFeePercent === "number" ? g.restockingFeePercent : 0,
        requirePhotos: g.requirePhotos !== false,
        reasons: reasons.length ? reasons : d.reasons,
        returnRules: lines(g.returnRules, d.returnRules),
        warrantyRules: lines(g.warrantyRules, d.warrantyRules),
        warrantyTable: table.length ? table : d.warrantyTable,
      };
    } catch (e) {
      console.error("[returns] policy:", e);
      return DEFAULT_RETURNS_POLICY;
    }
  },
  ["returns-policy-v2"],
  { tags: ["settings"], revalidate: 300 }
);

export const getReturnsPolicy = async (storeId?: number | null) => policyCached(storeId === undefined ? await currentStoreId() : storeId);

export type ReturnableOrder = {
  id: number;
  orderNumber: string;
  customerName: string;
  phone: string;
  status: string;
  deliveredAt: string | null;
  daysLeft: number | null;
  items: { index: number; productId: number | null; title: string; qty: number; unitPrice: number; serials: string[] }[];
};

/** Order (or shop receipt) by its number + the phone used, with the serials sold on it. Null if they don't match. */
export async function findOrderForAftersales(number: string, phone: string, returnDays: number): Promise<ReturnableOrder | null> {
  const payload = await payloadClient();
  const store = inStore(await currentStoreId());
  const n = number.trim().toUpperCase();
  if (n.startsWith("POS-")) {
    const sale = (await payload.find({ collection: "pos-sales", where: { and: [{ receiptNumber: { equals: n } }, store] }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined;
    if (!sale || sale.status === "voided" || digits(str(sale.customerPhone)) !== digits(phone)) return null;
    const days = Math.floor((Date.now() - Date.parse(str(sale.createdAt))) / 864e5);
    return {
      id: Number(sale.id),
      orderNumber: n,
      customerName: str(sale.customerName),
      phone: str(sale.customerPhone),
      status: "delivered",
      deliveredAt: str(sale.createdAt),
      daysLeft: returnDays - days,
      items: ((sale.items as Doc[]) ?? []).map((i, index) => ({ index, productId: Number((i.product as Doc)?.id ?? i.product) || null, title: str(i.title), qty: Number(i.qty) || 1, unitPrice: Number(i.unitPrice) || 0, serials: str(i.serial) ? [str(i.serial)] : [] })),
    };
  }
  const o = (await payload.find({ collection: "orders", where: { and: [{ orderNumber: { equals: n } }, store] }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined;
  if (!o || digits(str((o.customer as Doc)?.phone)) !== digits(phone)) return null;
  const delivered = ((o.history as Doc[] | undefined) ?? []).filter((h) => h.status === "delivered").pop();
  const deliveredAt = o.status === "delivered" || o.status === "returned" ? str(delivered?.at) || str(o.updatedAt) : null;
  const units = (await payload.find({ collection: "units", where: { order: { equals: o.id } }, limit: 50, depth: 0, overrideAccess: true })).docs as unknown as Doc[];
  return {
    id: Number(o.id),
    orderNumber: n,
    customerName: str((o.customer as Doc)?.name),
    phone: str((o.customer as Doc)?.phone),
    status: str(o.status),
    deliveredAt,
    daysLeft: deliveredAt ? returnDays - Math.floor((Date.now() - Date.parse(deliveredAt)) / 864e5) : null,
    items: ((o.items as Doc[]) ?? []).map((i, index) => {
      const productId = Number((i.product as Doc)?.id ?? i.product) || null;
      return { index, productId, title: str(i.title), qty: Number(i.qty) || 1, unitPrice: Number(i.unitPrice) || 0, serials: units.filter((u) => Number(u.product) === productId).map((u) => str(u.serial)) };
    }),
  };
}

export async function createReturnRequest(data: Doc): Promise<string> {
  const payload = await payloadClient();
  const store = await currentStoreId();
  const doc = (await payload.create({ collection: "return-requests", data: { ...data, store } as never, overrideAccess: true, depth: 0, context: { storefront: true, storeId: store } })) as unknown as Doc;
  return str(doc.requestNumber);
}

export async function createWarrantyClaim(data: Doc): Promise<{ claimNumber: string; inWarranty: string; warrantyEndsAt: string | null }> {
  const payload = await payloadClient();
  const store = await currentStoreId();
  const doc = (await payload.create({ collection: "warranty-claims", data: { ...data, store } as never, overrideAccess: true, depth: 0, context: { storefront: true, storeId: store } })) as unknown as Doc;
  return { claimNumber: str(doc.claimNumber), inWarranty: str(doc.inWarranty), warrantyEndsAt: str(doc.warrantyEndsAt) || null };
}
