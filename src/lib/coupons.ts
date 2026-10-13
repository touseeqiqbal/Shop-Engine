import "server-only";
import { listAll } from "@/lib/repo/db";
import type { Coupon } from "@/lib/types";
import { formatPKR } from "@/lib/utils";
import { isCmsConfigured } from "@/lib/db/config";
import { findCouponCms } from "@/lib/cms/sales";

export type CouponCheck =
  | { ok: true; coupon: Coupon; code: string; discount: number; message: string }
  | { ok: false; code: string; message: string };

export function couponDiscount(coupon: Coupon, subtotal: number) {
  const raw = coupon.kind === "percent" ? (subtotal * coupon.value) / 100 : coupon.value;
  return Math.max(0, Math.min(Math.round(raw), subtotal));
}

/** Validates a coupon against the live coupons table (active, not expired, min order, usage limit). */
export async function checkCoupon(rawCode: string, subtotal: number): Promise<CouponCheck> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, code, message: "Enter a coupon code" };
  const coupon = isCmsConfigured
    ? await findCouponCms(code) // /cms → Sales → Discounts
    : (await listAll("coupons", { privileged: true }).catch(() => listAll("coupons"))).find((c) => c.code.toUpperCase() === code);
  if (!coupon || !coupon.active) return { ok: false, code, message: "This coupon code is not valid" };
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now())
    return { ok: false, code, message: "This coupon has expired" };
  if (coupon.usageLimit != null && coupon.used >= coupon.usageLimit)
    return { ok: false, code, message: "This coupon has reached its usage limit" };
  if (subtotal < coupon.minOrder)
    return { ok: false, code, message: `Add ${formatPKR(coupon.minOrder - subtotal)} more to use this coupon (min. order ${formatPKR(coupon.minOrder)})` };
  const discount = couponDiscount(coupon, subtotal);
  const label = coupon.kind === "percent" ? `${coupon.value}% off` : `${formatPKR(coupon.value)} off`;
  return { ok: true, coupon, code: coupon.code, discount, message: `${coupon.code} applied – ${label}` };
}
