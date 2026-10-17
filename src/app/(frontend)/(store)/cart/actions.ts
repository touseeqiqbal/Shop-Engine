"use server";
import { z } from "zod";
import { resolveDiscounts } from "@/lib/coupons";
import { priceCart } from "@/lib/cart-pricing";
import { rateLimit } from "@/lib/rate-limit";
import { getProductsByIds } from "@/lib/repo/catalog";
import { buyLimit, canOrder, effectivePrice } from "@/lib/utils";
import { MAX_QTY_PER_ITEM } from "@/lib/cart-limits";

const schema = z.object({
  code: z.string().trim().max(40),
  lines: z
    .array(z.object({ productId: z.string().max(120), qty: z.number().int().min(1).max(MAX_QTY_PER_ITEM), upgradeIds: z.array(z.string().max(120)).max(10) }))
    .max(50),
});

export interface RepricedLine {
  key: string;
  available: boolean;
  unitPrice: number;
  basePrice: number;
  stock: number;
  taxClass?: "reduced" | "exempt";
}

/** Live price/stock for each cart line (keyed like the cart store's lineKey) so stale carts show current prices. */
export async function repriceCart(input: { productId: string; qty: number; upgradeIds: string[] }[]): Promise<RepricedLine[]> {
  const parsed = schema.shape.lines.safeParse(input);
  if (!parsed.success) return [];
  const products = await getProductsByIds([...new Set(parsed.data.map((l) => l.productId))]);
  const byId = new Map(products.map((p) => [p.id, p]));
  // a variant offers its main product's upgrades (unless it has its own)
  const parentIds = [...new Set(products.map((p) => p.variantOf).filter((id): id is string => Boolean(id) && !byId.has(id!)))];
  for (const p of parentIds.length ? await getProductsByIds(parentIds) : []) byId.set(p.id, p);
  return parsed.data.map((l) => {
    const key = [l.productId, ...[...l.upgradeIds].sort()].join("|");
    const p = byId.get(l.productId);
    const pool = p ? (p.upgrades.length || !p.variantOf ? p.upgrades : (byId.get(p.variantOf)?.upgrades ?? [])) : [];
    const ups = p ? l.upgradeIds.map((id) => pool.find((u) => u.id === id)) : [];
    if (!p || p.priceOnRequest || ups.some((u) => !u)) return { key, available: false, unitPrice: 0, basePrice: 0, stock: 0 };
    const base = effectivePrice(p);
    // stock = what one line may hold (the cart's own limit for pre-order / keep-selling products)
    return { key, available: canOrder(p), basePrice: base, unitPrice: base + ups.reduce((s, u) => s + (u?.price ?? 0), 0), stock: buyLimit(p), ...(p.taxClass ? { taxClass: p.taxClass } : {}) };
  });
}

export type CouponResult =
  | { ok: true; code: string; discount: number; freeShipping: boolean; message: string; applied: { code: string; label: string; automatic: boolean; amount: number }[] }
  | { ok: false; code: string; message: string };

/**
 * The discounts of the server-priced cart: the typed code (if any) and the store's best automatic discount.
 * Used by the cart page and the checkout summary (the checkout itself works it out again).
 */
export async function applyCoupon(input: { code: string; lines: { productId: string; qty: number; upgradeIds: string[] }[] }): Promise<CouponResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "", message: "Invalid request" };
  if (parsed.data.code && !(await rateLimit("coupon", 30, 10 * 60_000))) return { ok: false, code: parsed.data.code, message: "Too many attempts – please wait a few minutes." };
  const priced = await priceCart(parsed.data.lines);
  const res = await resolveDiscounts(parsed.data.code, { lines: priced.items, products: priced.products, subtotal: priced.subtotal });
  if (!res.ok) return res;
  const auto = res.applied.find((a) => a.automatic);
  const message = res.applied.map((a) => (a.automatic ? `${a.code}: ${a.label}` : `${a.code} applied – ${a.label}`)).join(" · ");
  return { ok: true, code: res.code ?? "", discount: res.discount, freeShipping: res.freeShipping, message: message || (auto ? auto.label : ""), applied: res.applied };
}
