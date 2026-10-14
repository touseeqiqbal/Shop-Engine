import "server-only";
import { listAll } from "@/lib/repo/db";
import type { CatalogProduct, Coupon, OrderItem } from "@/lib/types";
import { formatPKR } from "@/lib/utils";
import { isCmsConfigured } from "@/lib/db/config";
import { automaticDiscountsCms, couponUsesByCustomerCms, findCouponCms } from "@/lib/cms/sales";
import { getCategories } from "@/lib/repo/catalog";
import { currentStoreId } from "@/lib/tenant";

/**
 * Discounts, always worked out on the server from the store's own discounts (the browser only shows the result).
 *  - a code the shopper typed, and/or the best automatic discount the cart qualifies for
 *  - percent / amount off / free delivery
 *  - start & end dates, total usage limit, per-customer limit (by email / phone), minimum order
 *  - for the whole order, or only chosen products (incl. their variants), categories (incl. sub-categories) or collections
 *  - a code and an automatic discount add up only when BOTH allow combining; otherwise the bigger one is used
 */

export type CouponCheck =
  | { ok: true; coupon: Coupon; code: string; discount: number; message: string }
  | { ok: false; code: string; message: string };

export type DiscountLine = Pick<OrderItem, "productId" | "unitPrice" | "qty">;

/** Percent / amount off a (part of the) cart – never more than that part; free delivery takes nothing off the items. */
export function couponDiscount(coupon: Pick<Coupon, "kind" | "value">, subtotal: number) {
  if (coupon.kind === "free_shipping") return 0;
  const raw = coupon.kind === "percent" ? (subtotal * coupon.value) / 100 : coupon.value;
  return Math.max(0, Math.min(Math.round(raw), subtotal));
}

const label = (c: Coupon) => (c.kind === "free_shipping" ? "free delivery" : c.kind === "percent" ? `${c.value}% off` : `${formatPKR(c.value)} off`);

/** The part of the cart a discount applies to (the whole cart for "whole order" discounts). */
export async function eligibleSubtotal(c: Coupon, lines: DiscountLine[], products: CatalogProduct[]): Promise<number> {
  const scope = c.appliesTo ?? "all";
  const total = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  if (scope === "all") return total;
  const byId = new Map(products.map((p) => [p.id, p]));
  let match: (productId: string) => boolean;
  if (scope === "products") {
    const ids = new Set(c.productIds ?? []);
    match = (id) => ids.has(id) || ids.has(byId.get(id)?.variantOf ?? "");
  } else if (scope === "categories") {
    const wanted = new Set(c.categoryIds ?? []);
    const parentOf = new Map((await getCategories()).map((x) => [x.id, x.parentId]));
    match = (id) => {
      let cur: string | null | undefined = byId.get(id)?.categoryId;
      for (let hops = 0; cur && hops < 20; hops++) {
        if (wanted.has(cur)) return true;
        cur = parentOf.get(cur);
      }
      return false;
    };
  } else {
    const { collectionProductIds } = await import("@/lib/cms/collections");
    const inCollections = new Set((await Promise.all((c.collectionIds ?? []).map(collectionProductIds))).flat());
    match = (id) => inCollections.has(id) || inCollections.has(byId.get(id)?.variantOf ?? "");
  }
  return lines.filter((l) => match(l.productId)).reduce((s, l) => s + l.unitPrice * l.qty, 0);
}

type Ctx = { lines: DiscountLine[]; products: CatalogProduct[]; customer?: { email?: string | null; phone?: string | null }; storeId?: number | null };

/** Is this discount usable for this cart right now? Returns the amount it takes off (0 for free delivery). */
async function evaluate(c: Coupon, ctx: Ctx, storeId: number | null): Promise<{ ok: true; discount: number; base: number } | { ok: false; message: string }> {
  const now = Date.now();
  if (!c.active) return { ok: false, message: "This coupon code is not valid" };
  if (c.startsAt && Date.parse(c.startsAt) > now) return { ok: false, message: "This coupon isn't active yet" };
  if (c.expiresAt && Date.parse(c.expiresAt) < now) return { ok: false, message: "This coupon has expired" };
  if (c.usageLimit != null && c.used >= c.usageLimit) return { ok: false, message: "This coupon has reached its usage limit" };
  const base = await eligibleSubtotal(c, ctx.lines, ctx.products);
  if (base <= 0) return { ok: false, message: "This coupon doesn't apply to the items in your cart" };
  if (base < c.minOrder) return { ok: false, message: `Add ${formatPKR(c.minOrder - base)} more${c.appliesTo && c.appliesTo !== "all" ? " of the eligible items" : ""} to use this coupon (min. ${formatPKR(c.minOrder)})` };
  if (c.perCustomerLimit && isCmsConfigured && (ctx.customer?.email || ctx.customer?.phone)) {
    const used = await couponUsesByCustomerCms(c.code, storeId, ctx.customer ?? {});
    if (used >= c.perCustomerLimit) return { ok: false, message: c.perCustomerLimit === 1 ? "You've already used this coupon" : `You've already used this coupon ${used} times` };
  }
  return { ok: true, discount: couponDiscount(c, base), base };
}

/** Validates a typed code for this cart (cart page "Apply", checkout). */
export async function checkCoupon(rawCode: string, ctx: Ctx): Promise<CouponCheck> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, code, message: "Enter a coupon code" };
  const storeId = ctx.storeId === undefined ? await currentStoreId() : ctx.storeId;
  const coupon = isCmsConfigured
    ? await findCouponCms(code, storeId) // /cms → Sales → Discounts (this store's)
    : (await listAll("coupons", { privileged: true }).catch(() => listAll("coupons"))).find((c) => c.code.toUpperCase() === code);
  if (!coupon || !coupon.active || coupon.automatic) return { ok: false, code, message: "This coupon code is not valid" };
  const r = await evaluate(coupon, ctx, storeId);
  if (!r.ok) return { ok: false, code, message: r.message };
  return { ok: true, coupon, code: coupon.code, discount: r.discount, message: `${coupon.code} applied – ${label(coupon)}` };
}

export type DiscountResult =
  | { ok: true; discount: number; freeShipping: boolean; code: string | null; applied: { code: string; label: string; automatic: boolean; amount: number }[] }
  | { ok: false; code: string; message: string };

/**
 * Everything taken off this cart: the typed code (if valid) and the best automatic discount, combined by the rules above.
 * `code` in the result is the TYPED code (the one whose use is counted when the order is placed).
 */
export async function resolveDiscounts(rawCode: string | null | undefined, ctx: Ctx & { subtotal: number }): Promise<DiscountResult> {
  const storeId = ctx.storeId === undefined ? await currentStoreId() : ctx.storeId;
  const typed = rawCode?.trim() ? await checkCoupon(rawCode, { ...ctx, storeId }) : null;
  if (typed && !typed.ok) return typed;

  // the best automatic discount for this cart (free delivery counts as worth the delivery charge – compared by amount)
  let auto: { coupon: Coupon; discount: number } | null = null;
  if (isCmsConfigured) {
    for (const c of await automaticDiscountsCms(storeId).catch(() => [] as Coupon[])) {
      const r = await evaluate(c, ctx, storeId);
      if (!r.ok) continue;
      const worth = c.kind === "free_shipping" ? 1 : r.discount;
      if (!auto || worth > (auto.coupon.kind === "free_shipping" ? 1 : auto.discount)) auto = { coupon: c, discount: r.discount };
    }
  }

  const picks: { coupon: Coupon; discount: number; automatic: boolean }[] = [];
  if (typed?.ok && auto) {
    if (typed.coupon.combinable && auto.coupon.combinable) picks.push({ coupon: typed.coupon, discount: typed.discount, automatic: false }, { coupon: auto.coupon, discount: auto.discount, automatic: true });
    else picks.push(typed.discount >= auto.discount ? { coupon: typed.coupon, discount: typed.discount, automatic: false } : { coupon: auto.coupon, discount: auto.discount, automatic: true });
  } else if (typed?.ok) picks.push({ coupon: typed.coupon, discount: typed.discount, automatic: false });
  else if (auto) picks.push({ coupon: auto.coupon, discount: auto.discount, automatic: true });

  const discount = Math.min(ctx.subtotal, picks.reduce((s, p) => s + p.discount, 0));
  return {
    ok: true,
    discount,
    freeShipping: picks.some((p) => p.coupon.kind === "free_shipping"),
    code: picks.find((p) => !p.automatic)?.coupon.code ?? null,
    applied: picks.map((p) => ({ code: p.coupon.code, label: label(p.coupon), automatic: p.automatic, amount: p.discount })),
  };
}
