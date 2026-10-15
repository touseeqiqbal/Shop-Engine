import "server-only";
import { getCurrentStore, storeDirectory } from "./tenant";
import { DEFAULT_LOCALE, storeLocale, type StoreLocale } from "./locale";
import { moneyFormatter, type Money } from "./money";
import { formatDate } from "./time";

/**
 * The current store's country, currency, time zone and language – for server components, server actions and
 * route handlers. Client components use `useStoreLocale()` / `useMoney()` (components/providers/locale.tsx).
 */

/** The current request's store (the original shop: Pakistan, PKR, Asia/Karachi). */
export async function getStoreLocale(): Promise<StoreLocale> {
  const store = await getCurrentStore();
  return store ? storeLocale(store) : DEFAULT_LOCALE;
}

/** `const money = await getMoney(); money(1200)` → "Rs 1,200" / "$1,200.00" … in the current store's currency. */
export async function getMoney(): Promise<Money> {
  return moneyFormatter(await getStoreLocale());
}

/** A store's locale by id (jobs and messages for a known store); unknown → the default store's. */
export async function localeOfStore(storeId: number | null | undefined): Promise<StoreLocale> {
  const stores = await storeDirectory();
  const store = stores.find((x) => x.id === storeId) ?? stores.find((x) => x.isDefault);
  return store ? storeLocale(store) : DEFAULT_LOCALE;
}

/** Dates in the current store's time zone: `const date = await getDateFormatter(); date(order.placedAt)`. */
export async function getDateFormatter() {
  const loc = await getStoreLocale();
  return (at: string | number | Date, opts?: Intl.DateTimeFormatOptions) => formatDate(at, loc, opts);
}
