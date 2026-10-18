"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CatalogProduct, UpgradeOption } from "@/lib/types";
import { buyLimit, effectivePrice } from "@/lib/utils";
import { MAX_QTY_PER_ITEM } from "@/lib/cart-limits";
import { shopStat } from "@/lib/shop-stats";

export interface CartLine {
  key: string; // productId + selected upgrade ids
  productId: string;
  slug: string;
  name: string;
  image: string;
  url: string;
  brandName: string;
  basePrice: number;
  unitPrice: number; // base + upgrades
  qty: number;
  stock: number;
  upgrades: UpgradeOption[];
  /** the product's tax class when it isn't the normal rate (Products → Tax) */
  taxClass?: "reduced" | "exempt";
  /** a download: nothing to ship */
  shipsNothing?: boolean;
}

/** What `add` did: the line's quantity now, and what stopped it from adding all of it (the stock or the per-item limit). */
export interface AddResult {
  qty: number;
  max: number;
  capped: "stock" | "limit" | null;
}

interface CartState {
  lines: CartLine[];
  couponCode: string | null;
  drawerOpen: boolean;
  /** increments on every add – drives the cart icon bounce */
  pulse: number;
  /** `exact` (Buy Now): the line gets exactly `qty` instead of that many more */
  add: (p: CatalogProduct, opts?: { qty?: number; upgrades?: UpgradeOption[]; openDrawer?: boolean; exact?: boolean }) => AddResult;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  setCoupon: (code: string | null) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
}

export const lineKey = (productId: string, upgrades: UpgradeOption[] = []) =>
  [productId, ...upgrades.map((u) => u.id).sort()].join("|");

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      couponCode: null,
      drawerOpen: false,
      pulse: 0,
      add: (p, opts = {}) => {
        if (p.priceOnRequest) return { qty: 0, max: 0, capped: null }; // quote-only wholesale lots can't be bought online
        shopStat("cart", p.id); // the shop's own count (Reports → Shop funnel)
        const upgrades = opts.upgrades ?? [];
        const key = lineKey(p.id, upgrades);
        const qty = opts.qty ?? 1;
        const base = effectivePrice(p);
        const unit = base + upgrades.reduce((s, u) => s + u.price, 0);
        const lines = [...get().lines];
        const at = lines.findIndex((l) => l.key === key);
        const existing = at >= 0 ? lines[at] : undefined;
        // the stock – or the cart's own limit for pre-order / keep-selling products
        const limit = buyLimit(p);
        const max = Math.min(Math.max(limit, 1), MAX_QTY_PER_ITEM);
        const wanted = existing && !opts.exact ? existing.qty + qty : qty;
        const result: AddResult = { qty: Math.min(wanted, max), max, capped: wanted > max ? (limit < MAX_QTY_PER_ITEM ? "stock" : "limit") : null };
        if (existing) lines[at] = { ...existing, qty: result.qty };
        else
          lines.push({
            key,
            productId: p.id,
            slug: p.slug,
            name: p.name,
            image: p.images[0] ?? "",
            url: p.url,
            brandName: p.brandName,
            basePrice: base,
            unitPrice: unit,
            qty: result.qty,
            stock: limit,
            upgrades,
            ...(p.taxClass ? { taxClass: p.taxClass } : {}),
            ...(p.shipsNothing ? { shipsNothing: true } : {}),
          });
        set({ lines, pulse: get().pulse + 1, drawerOpen: opts.openDrawer ?? true });
        return result;
      },
      setQty: (key, qty) =>
        set({
          lines: get()
            .lines.map((l) => (l.key === key ? { ...l, qty: Math.max(1, Math.min(qty, Math.max(l.stock, 1), MAX_QTY_PER_ITEM)) } : l)),
        }),
      remove: (key) => set({ lines: get().lines.filter((l) => l.key !== key) }),
      clear: () => set({ lines: [], couponCode: null }),
      setCoupon: (couponCode) => set({ couponCode }),
      openDrawer: () => set({ drawerOpen: true }),
      closeDrawer: () => set({ drawerOpen: false }),
    }),
    {
      name: "urko-cart",
      partialize: (s) => ({ lines: s.lines, couponCode: s.couponCode }),
    }
  )
);

/** The toast when `add` couldn't add all of it ("Only 3 in stock"), else null. */
export function addLimitMessage(r: AddResult): string | null {
  if (!r.capped) return null;
  return r.capped === "stock" ? `Only ${r.max} in stock – your cart has ${r.qty}` : `You can buy up to ${r.max} of this item at a time`;
}

export const cartCount = (lines: CartLine[]) => lines.reduce((s, l) => s + l.qty, 0);
export const cartSubtotal = (lines: CartLine[]) => lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
