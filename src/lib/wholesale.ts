/** Wholesale helpers shared by the storefront, the quote form and the admin inbox (client-safe – no server imports). */
import type { Product, WholesaleBuyerType, WholesaleInquiry } from "@/lib/types";

export const WHOLESALE_PATH = "/wholesale";
export const WHOLESALE_CATEGORY_SLUG = "wholesale-lots";
/** Default minimum quantity for a bulk quote when a product doesn't set one. */
export const DEFAULT_MIN_QTY = 5;

export const BUYER_TYPES: WholesaleBuyerType[] = ["shop", "reseller", "corporate", "education", "individual", "other"];
export const BUYER_TYPE_LABEL: Record<WholesaleBuyerType, string> = {
  shop: "Computer / mobile shop",
  reseller: "Reseller / online seller",
  corporate: "Company / office",
  education: "School / university / institute",
  individual: "Individual (bulk for family / team)",
  other: "Other",
};

/** Retail product that also accepts bulk quotes. */
export const isWholesaleAvailable = (p: Pick<Product, "wholesale" | "priceOnRequest">) => Boolean(p.wholesale?.available) && !p.priceOnRequest;

export function wholesaleMinQty(p: Pick<Product, "wholesale">) {
  return Math.max(2, p.wholesale?.minQty || DEFAULT_MIN_QTY);
}

/** Link to the quote form, pre-filled with a product (and optional quantity). */
export function quoteHref(slug?: string, qty?: number) {
  const q = new URLSearchParams();
  if (slug) q.set("product", slug);
  if (qty && qty > 0) q.set("qty", String(qty));
  const s = q.toString();
  return `${WHOLESALE_PATH}${s ? `?${s}` : ""}#quote`;
}

/** Plain-text summary used for WhatsApp messages (customer → store and admin → customer). */
export function inquirySummary(i: Pick<WholesaleInquiry, "name" | "businessName" | "city" | "items" | "budget" | "message">) {
  return [
    `Wholesale quote request – ${i.name}${i.businessName ? ` (${i.businessName})` : ""}, ${i.city}`,
    ...i.items.map((it) => `• ${it.qty} × ${it.productName}`),
    i.budget ? `Budget: ${i.budget}` : null,
    i.message ? `Note: ${i.message}` : null,
  ]
    .filter((l): l is string => Boolean(l))
    .join("\n");
}
