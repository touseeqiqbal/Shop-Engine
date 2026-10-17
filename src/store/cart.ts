"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CatalogProduct, UpgradeOption } from "@/lib/types";
import { buyLimit, effectivePrice } from "@/lib/utils";
import { MAX_QTY_PER_ITEM } from "@/lib/cart-limits";

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
}

interface CartState {
  lines: CartLine[];
  couponCode: string | null;
  drawerOpen: boolean;
  /** increments on every add – drives the cart icon bounce */
  pulse: number;
  add: (p: CatalogProduct, opts?: { qty?: number; upgrades?: UpgradeOption[]; openDrawer?: boolean }) => void;
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
        if (p.priceOnRequest) return; // quote-only wholesale lots can't be bought online
        const upgrades = opts.upgrades ?? [];
        const key = lineKey(p.id, upgrades);
        const qty = opts.qty ?? 1;
        const base = effectivePrice(p);
        const unit = base + upgrades.reduce((s, u) => s + u.price, 0);
        const lines = [...get().lines];
        const existing = lines.find((l) => l.key === key);
        // the stock – or the cart's own limit for pre-order / keep-selling products
        const limit = buyLimit(p);
        if (existing) existing.qty = Math.min(existing.qty + qty, Math.max(limit, 1), MAX_QTY_PER_ITEM);
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
            qty: Math.min(qty, Math.max(limit, 1), MAX_QTY_PER_ITEM),
            stock: limit,
            upgrades,
            ...(p.taxClass ? { taxClass: p.taxClass } : {}),
          });
        set({ lines, pulse: get().pulse + 1, drawerOpen: opts.openDrawer ?? true });
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

export const cartCount = (lines: CartLine[]) => lines.reduce((s, l) => s + l.qty, 0);
export const cartSubtotal = (lines: CartLine[]) => lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
