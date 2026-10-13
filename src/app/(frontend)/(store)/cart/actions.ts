"use server";
import { z } from "zod";
import { checkCoupon } from "@/lib/coupons";
import { priceCart } from "@/lib/cart-pricing";
import { rateLimit } from "@/lib/rate-limit";
import { getProductsByIds } from "@/lib/repo/catalog";
import { effectivePrice } from "@/lib/utils";
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
}

/** Live price/stock for each cart line (keyed like the cart store's lineKey) so stale carts show current prices. */
export async function repriceCart(input: { productId: string; qty: number; upgradeIds: string[] }[]): Promise<RepricedLine[]> {
  const parsed = schema.shape.lines.safeParse(input);
  if (!parsed.success) return [];
  const products = await getProductsByIds([...new Set(parsed.data.map((l) => l.productId))]);
  const byId = new Map(products.map((p) => [p.id, p]));
  return parsed.data.map((l) => {
    const key = [l.productId, ...[...l.upgradeIds].sort()].join("|");
    const p = byId.get(l.productId);
    const ups = p ? l.upgradeIds.map((id) => p.upgrades.find((u) => u.id === id)) : [];
    if (!p || p.priceOnRequest || ups.some((u) => !u)) return { key, available: false, unitPrice: 0, basePrice: 0, stock: 0 };
    const base = effectivePrice(p);
    return { key, available: p.stock > 0, basePrice: base, unitPrice: base + ups.reduce((s, u) => s + (u?.price ?? 0), 0), stock: p.stock };
  });
}

export type CouponResult = { ok: true; code: string; discount: number; message: string } | { ok: false; code: string; message: string };

/** Validates a coupon against the server-priced cart. Used by the cart page and the checkout summary. */
export async function applyCoupon(input: { code: string; lines: { productId: string; qty: number; upgradeIds: string[] }[] }): Promise<CouponResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "", message: "Invalid request" };
  if (!(await rateLimit("coupon", 30, 10 * 60_000))) return { ok: false, code: parsed.data.code, message: "Too many attempts – please wait a few minutes." };
  const { subtotal } = await priceCart(parsed.data.lines);
  const res = await checkCoupon(parsed.data.code, subtotal);
  return res.ok ? { ok: true, code: res.code, discount: res.discount, message: res.message } : res;
}
