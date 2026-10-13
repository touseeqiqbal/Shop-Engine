"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Product ids the shopper saved (wishlist), is comparing (max 3) or recently viewed. */
interface ListsState {
  wishlist: string[];
  compare: string[];
  recent: string[];
  toggleWishlist: (id: string) => void;
  toggleCompare: (id: string) => { ok: boolean; reason?: string };
  removeCompare: (id: string) => void;
  clearCompare: () => void;
  pushRecent: (id: string) => void;
}

export const MAX_COMPARE = 3;

export const useLists = create<ListsState>()(
  persist(
    (set, get) => ({
      wishlist: [],
      compare: [],
      recent: [],
      toggleWishlist: (id) => {
        const w = get().wishlist;
        set({ wishlist: w.includes(id) ? w.filter((x) => x !== id) : [id, ...w] });
      },
      toggleCompare: (id) => {
        const c = get().compare;
        if (c.includes(id)) {
          set({ compare: c.filter((x) => x !== id) });
          return { ok: true };
        }
        if (c.length >= MAX_COMPARE) return { ok: false, reason: `You can compare up to ${MAX_COMPARE} products` };
        set({ compare: [...c, id] });
        return { ok: true };
      },
      removeCompare: (id) => set({ compare: get().compare.filter((x) => x !== id) }),
      clearCompare: () => set({ compare: [] }),
      pushRecent: (id) => set({ recent: [id, ...get().recent.filter((x) => x !== id)].slice(0, 12) }),
    }),
    { name: "urko-lists" }
  )
);
