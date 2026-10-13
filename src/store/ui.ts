"use client";
import { create } from "zustand";

interface Toast {
  id: number;
  message: string;
  tone?: "success" | "error" | "info";
}

interface UiState {
  searchOpen: boolean;
  menuOpen: boolean;
  toasts: Toast[];
  setSearchOpen: (v: boolean) => void;
  setMenuOpen: (v: boolean) => void;
  toast: (message: string, tone?: Toast["tone"]) => void;
  dismiss: (id: number) => void;
}

let toastId = 0;

export const useUi = create<UiState>()((set, get) => ({
  searchOpen: false,
  menuOpen: false,
  toasts: [],
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setMenuOpen: (menuOpen) => set({ menuOpen }),
  toast: (message, tone = "success") => {
    const id = ++toastId;
    set({ toasts: [...get().toasts, { id, message, tone }] });
    setTimeout(() => get().dismiss(id), 3200);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
