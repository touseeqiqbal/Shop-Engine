"use client";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_LOCALE, type StoreLocale } from "@/lib/locale";
import { moneyFormatter, type Money } from "@/lib/money";
import { formatDate } from "@/lib/time";

const LocaleContext = createContext<StoreLocale>(DEFAULT_LOCALE);

/** The store's country, currency, time zone and language for client components (set in the storefront's root layout). */
export function LocaleProvider({ locale, children }: { locale: StoreLocale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/** The current store's locale (outside the provider: the original shop's – Pakistan / PKR). */
export function useStoreLocale(): StoreLocale {
  return useContext(LocaleContext);
}

/** `const money = useMoney(); money(1200)` → the amount in the store's currency ("Rs 1,200", "$1,200.00" …). */
export function useMoney(): Money {
  const l = useContext(LocaleContext);
  return useMemo(() => moneyFormatter(l), [l]);
}

/** Dates in the store's time zone and language. */
export function useDateFormatter() {
  const l = useContext(LocaleContext);
  return useMemo(() => (at: string | number | Date, opts?: Intl.DateTimeFormatOptions) => formatDate(at, l, opts), [l]);
}
