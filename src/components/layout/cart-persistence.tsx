"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { lineKey, useCart, type CartLine } from "@/store/cart";
import { loadCart, saveCart } from "@/app/(frontend)/(store)/cart/saved-cart";

const AUTH_PAGE = /^\/account\/(login|register)/;

/**
 * Keeps a signed-in shopper's cart on the server too (per store), so it follows them to another device:
 * the saved cart is merged into this browser's cart (lines already here win) when the page opens and right after
 * signing in; then every change is saved a moment later. Guests: one check, then nothing.
 */
export function CartPersistence() {
  const pathname = usePathname();
  const signedIn = useRef<boolean | null>(null);
  const lastPath = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // check (again) on first load and when leaving the sign-in / sign-up page
  useEffect(() => {
    const was = lastPath.current;
    lastPath.current = pathname;
    if (was !== null && !(AUTH_PAGE.test(was) && !AUTH_PAGE.test(pathname))) return;
    let cancelled = false;
    loadCart()
      .then((saved) => {
        if (cancelled) return;
        signedIn.current = saved !== null;
        if (!saved?.length) {
          // just signed in with an empty account cart: keep what's in this browser on the account
          if (saved && useCart.getState().lines.length) void saveCart(toLines(useCart.getState().lines));
          return;
        }
        const here = useCart.getState().lines;
        const merged: CartLine[] = [...here];
        for (const s of saved) {
          const key = lineKey(s.productId, s.upgrades);
          if (merged.some((l) => l.key === key)) continue;
          const extra = s.upgrades.reduce((sum, u) => sum + u.price, 0);
          merged.push({ key, productId: s.productId, slug: s.slug, name: s.name, image: s.image, url: s.url, brandName: s.brandName, basePrice: s.unitPrice - extra, unitPrice: s.unitPrice, qty: s.qty, stock: s.stock, upgrades: s.upgrades });
        }
        if (merged.length !== here.length) useCart.setState({ lines: merged });
      })
      .catch(() => {
        signedIn.current = false;
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // save every change (a moment later) while signed in
  useEffect(() => {
    const unsubscribe = useCart.subscribe((state, prev) => {
      if (state.lines === prev.lines || signedIn.current === false) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void saveCart(toLines(state.lines)).then((ok) => {
          if (!ok && signedIn.current === null) signedIn.current = false;
        });
      }, 1500);
    });
    return () => {
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return null;
}

const toLines = (lines: CartLine[]) => lines.map((l) => ({ productId: l.productId, qty: l.qty, upgradeIds: l.upgrades.map((u) => u.id) }));
