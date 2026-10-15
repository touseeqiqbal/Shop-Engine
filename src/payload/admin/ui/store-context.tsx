"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@payloadcms/ui";
import { DEFAULT_LOCALE, storeLocale, type StoreLocale } from "../../../lib/locale";
import { moneyFormatter, type Money } from "../../../lib/money";
import { formatDate } from "../../../lib/time";

/** The store the signed-in person works in, and their role there (from /cms-api/platform/my-stores – the server decides). */
export type StoreOption = { id: number; name?: string; slug?: string; status?: string; subscriptionStatus?: string; isDefault?: boolean; role?: string | null } & Partial<StoreLocale>;
export type StoreState = {
  loaded: boolean;
  platformAdmin: boolean;
  activeStoreId: number | null;
  storeRole: string | null;
  readOnly: boolean;
  stores: StoreOption[];
  switchTo: (storeId: number | null) => Promise<void>;
};

const empty: StoreState = { loaded: false, platformAdmin: false, activeStoreId: null, storeRole: null, readOnly: false, stores: [], switchTo: async () => undefined };
const Ctx = createContext<StoreState>(empty);

export function StoreProvider({ children }: { children?: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<Omit<StoreState, "switchTo">>(empty);
  useEffect(() => {
    if (!user) return setState(empty);
    let live = true;
    fetch("/cms-api/platform/my-stores", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: Omit<StoreState, "switchTo" | "loaded"> | null) => live && s && setState({ ...s, loaded: true }))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [user]);
  const switchTo = useCallback(async (storeId: number | null) => {
    const res = await fetch("/cms-api/platform/switch-store", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId }) });
    if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Couldn't switch store.");
    // every list and setting depends on the store – start the admin afresh in it
    window.location.assign("/cms");
  }, []);
  return <Ctx.Provider value={{ ...state, switchTo }}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);

/** A store's name (a relationship value: id or { id }), else the active store's – "" until the list has loaded. */
export const useStoreName = (store?: unknown) => {
  const s = useStore();
  const raw = store != null && typeof store === "object" ? (store as { id?: unknown }).id : store;
  const id = raw == null || raw === "" ? s.activeStoreId : Number(raw);
  return s.stores.find((x) => x.id === id)?.name ?? "";
};

/** Role checks for screens (the server checks again on every action). */
export const useStoreRole = () => {
  const s = useStore();
  const r = s.storeRole;
  return {
    loaded: s.loaded,
    isManager: r === "platform_admin" || r === "store_owner" || r === "store_manager",
    isOwner: r === "platform_admin" || r === "store_owner",
    isPlatformAdmin: r === "platform_admin",
    readOnly: s.readOnly,
  };
};

/**
 * A store's country, currency and time zone (a relationship value: id or { id }), else the active store's – with
 * "all stores" open, the default store's. The original shop's (PKR, Asia/Karachi) until the list has loaded.
 */
export const useAdminLocale = (store?: unknown): StoreLocale => {
  const s = useStore();
  const raw = store != null && typeof store === "object" ? (store as { id?: unknown }).id : store;
  const id = raw == null || raw === "" ? s.activeStoreId : Number(raw);
  const found = s.stores.find((x) => x.id === id) ?? s.stores.find((x) => x.isDefault);
  return found ? storeLocale(found) : DEFAULT_LOCALE;
};

/**
 * Money in a store's currency: `const money = useAdminMoney(doc.store); money(1200)`. An order keeps the currency it
 * was placed in – pass it as `currency` so a later change of the store's currency doesn't relabel old orders.
 */
export const useAdminMoney = (store?: unknown, currency?: string | null): Money => {
  const loc = useAdminLocale(store);
  const cur = currency || loc.currency;
  return useMemo(() => moneyFormatter({ currency: cur, locale: loc.locale }), [cur, loc.locale]);
};

/** Dates in a store's time zone: `const date = useAdminDates(); date(doc.createdAt, { dateStyle: "medium" })`. */
export const useAdminDates = (store?: unknown) => {
  const loc = useAdminLocale(store);
  return useMemo(() => (at: string | number | Date, opts?: Intl.DateTimeFormatOptions) => formatDate(at, loc, opts), [loc]);
};
