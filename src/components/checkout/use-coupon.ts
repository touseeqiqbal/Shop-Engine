"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyCoupon, repriceCart } from "@/app/(frontend)/(store)/cart/actions";
import { useCart, type CartLine } from "@/store/cart";

export const toRequestLines = (lines: CartLine[]) =>
  lines.map((l) => ({ productId: l.productId, qty: l.qty, upgradeIds: l.upgrades.map((u) => u.id) }));

/**
 * Refreshes cart line prices/stock from the live catalog once per mount (and when products change),
 * removing lines that are no longer sold. Returns the keys that were changed so the UI can notify.
 */
export function useCartSync(enabled: boolean) {
  const lines = useCart((s) => s.lines);
  const [notice, setNotice] = useState<string | null>(null);
  const productSig = useMemo(() => lines.map((l) => l.key).join(","), [lines]);
  useEffect(() => {
    if (!enabled || !productSig) return;
    let cancelled = false;
    repriceCart(toRequestLines(useCart.getState().lines))
      .then((fresh) => {
        if (cancelled || !fresh.length) return;
        const byKey = new Map(fresh.map((f) => [f.key, f]));
        let changed = 0;
        let removed = 0;
        const next = useCart.getState().lines.flatMap((l) => {
          const f = byKey.get(l.key);
          if (!f) return [l];
          if (!f.available) {
            removed++;
            return [];
          }
          if (f.unitPrice !== l.unitPrice || f.stock !== l.stock || f.taxClass !== l.taxClass || Boolean(f.shipsNothing) !== Boolean(l.shipsNothing)) {
            if (f.unitPrice !== l.unitPrice) changed++;
            const { taxClass: _old, shipsNothing: _ships, ...rest } = l;
            return [{ ...rest, unitPrice: f.unitPrice, basePrice: f.basePrice, stock: f.stock, qty: Math.min(l.qty, Math.max(f.stock, 1)), ...(f.taxClass ? { taxClass: f.taxClass } : {}), ...(f.shipsNothing ? { shipsNothing: true } : {}) }];
          }
          return [l];
        });
        if (changed || removed || next.some((l, i) => l !== useCart.getState().lines[i])) useCart.setState({ lines: next });
        if (removed) setNotice(`${removed} item${removed === 1 ? " is" : "s are"} no longer available and ${removed === 1 ? "was" : "were"} removed from your cart.`);
        else if (changed) setNotice("Some prices in your cart were updated to today's prices.");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled, productSig]);
  return notice;
}

type CouponState = { status: "idle" | "checking" | "applied" | "error"; discount: number; freeShipping: boolean; message: string };

/**
 * Keeps the cart's discounts in sync with the server: the typed coupon (re-validated whenever the cart changes – a
 * minimum order may stop being met) and the store's automatic discounts (checked even without a code).
 */
export function useCartCoupon(enabled = true) {
  const lines = useCart((s) => s.lines);
  const couponCode = useCart((s) => s.couponCode);
  const setCoupon = useCart((s) => s.setCoupon);
  const [state, setState] = useState<CouponState>({ status: "idle", discount: 0, freeShipping: false, message: "" });
  const reqId = useRef(0);
  const signature = useMemo(() => JSON.stringify(toRequestLines(lines)), [lines]);

  const validate = useCallback(
    async (code: string, opts: { persist: boolean }) => {
      const id = ++reqId.current;
      setState((s) => ({ ...s, status: "checking" }));
      try {
        const res = await applyCoupon({ code, lines: JSON.parse(signature) });
        if (id !== reqId.current) return res;
        if (res.ok) {
          setState({ status: res.discount > 0 || res.freeShipping ? "applied" : "idle", discount: res.discount, freeShipping: res.freeShipping, message: res.message });
          if (opts.persist && res.code) setCoupon(res.code);
        } else {
          setState({ status: "error", discount: 0, freeShipping: false, message: res.message });
        }
        return res;
      } catch {
        if (id === reqId.current) setState({ status: "error", discount: 0, freeShipping: false, message: "Couldn't check the coupon – please try again." });
        return null;
      }
    },
    [signature, setCoupon]
  );

  useEffect(() => {
    if (!enabled) return;
    if (lines.length === 0) {
      reqId.current++;
      setState({ status: "idle", discount: 0, freeShipping: false, message: "" });
      return;
    }
    // no code: still ask – the store may have an automatic discount for this cart
    const t = setTimeout(() => void validate(couponCode ?? "", { persist: false }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couponCode, signature, enabled]);

  const remove = useCallback(() => {
    reqId.current++;
    setCoupon(null);
    setState({ status: "idle", discount: 0, freeShipping: false, message: "" });
    // automatic discounts still apply without the code
    void validate("", { persist: false });
  }, [setCoupon, validate]);

  return {
    code: couponCode,
    discount: state.status === "applied" ? state.discount : 0,
    freeShipping: state.status === "applied" && state.freeShipping,
    status: state.status,
    message: state.message,
    apply: (code: string) => validate(code, { persist: true }),
    remove,
  };
}
