import { createHash } from "node:crypto";
import type { Payload } from "payload";
import { intlDigits } from "@/lib/phone";

/** An order as integrations need it (ad conversions, email marketing, accounting, couriers). */

type Doc = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const relId = (v: unknown) => (v && typeof v === "object" ? Number((v as Doc).id) : Number(v));

export type OrderForIntegrations = {
  id: number;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  currency: string;
  subtotal: number;
  discount: number;
  deliveryCharge: number;
  tax: number;
  total: number;
  placedAt: string;
  marketingConsent: boolean;
  customer: { name: string; email: string | null; phone: string; address: string; city: string; area: string | null; postalCode: string | null; country: string };
  items: { productId: string | null; sku: string | null; title: string; qty: number; unitPrice: number }[];
  storeId: number;
};

export async function loadOrder(payload: Payload, id: number): Promise<OrderForIntegrations | null> {
  const o = (await payload.findByID({ collection: "orders", id, depth: 0, overrideAccess: true }).catch(() => null)) as unknown as Doc | null;
  if (!o) return null;
  const c = (o.customer ?? {}) as Doc;
  const store = (await payload.findByID({ collection: "stores", id: relId(o.store), depth: 0, overrideAccess: true }).catch(() => null)) as unknown as Doc | null;
  return {
    id: Number(o.id),
    orderNumber: str(o.orderNumber),
    status: str(o.status),
    paymentMethod: str(o.paymentMethod),
    paymentStatus: str(o.paymentStatus),
    currency: (str(o.currency) || str(store?.currency) || "PKR").toUpperCase(),
    subtotal: num(o.subtotal),
    discount: num(o.discount),
    deliveryCharge: num(o.deliveryCharge),
    tax: num(o.taxTotal),
    total: num(o.total),
    placedAt: str(o.placedAt) || str(o.createdAt),
    marketingConsent: o.marketingConsent === true,
    customer: {
      name: str(c.name),
      email: str(c.email) || null,
      phone: str(c.phone),
      address: str(c.address),
      city: str(c.city),
      area: str(c.area) || null,
      postalCode: str(c.postalCode) || null,
      country: (str(c.country) || str(store?.country) || "PK").toUpperCase(),
    },
    items: ((o.items as Doc[] | undefined) ?? []).map((i) => ({ productId: i.product != null ? String(relId(i.product)) : null, sku: str(i.sku) || null, title: str(i.title), qty: num(i.qty), unitPrice: num(i.unitPrice) })),
    storeId: relId(o.store),
  };
}

/** Ad platforms take personal data only hashed: SHA-256 of the normalised value. */
export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
export const normEmail = (e: string | null | undefined) => (e ? e.trim().toLowerCase() : "");
/** digits only, with the country code (E.164 without "+") – as Meta and TikTok expect */
export const normPhone = (p: string | null | undefined, country: string) => (p ? intlDigits(p, country) : "");

/** The same id the storefront's browser pixel uses for this purchase (so each sale is counted once). */
export const purchaseEventId = (orderNumber: string) => `purchase-${orderNumber}`;

/** Should this event count as the purchase? Card orders when paid; everything else when placed. */
export function isPurchaseEvent(type: string, data: Record<string, unknown>): boolean {
  if (type === "order.paid") return true;
  return type === "order.created" && str(data.status) !== "awaiting-payment";
}
