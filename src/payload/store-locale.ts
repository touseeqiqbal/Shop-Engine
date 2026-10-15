import type { Payload, PayloadRequest } from "payload";
import { DEFAULT_LOCALE, storeLocale, type StoreLocale } from "../lib/locale";
import { moneyFormatter, type Money } from "../lib/money";
import { getDefaultStoreId } from "./tenancy";

/**
 * A store's country, currency, time zone and language for admin endpoints, hooks, jobs and messages (no request
 * host to go by). Looked up once per request.
 */

const perReq = new WeakMap<object, Map<number, StoreLocale>>();

export async function storeLocaleOf(payload: Payload, storeId: number | null | undefined, req?: PayloadRequest): Promise<StoreLocale> {
  const id = storeId ?? (await getDefaultStoreId(payload));
  if (id == null) return DEFAULT_LOCALE;
  const memo = req ? (perReq.get(req) ?? new Map<number, StoreLocale>()) : null;
  if (req && memo && !perReq.has(req)) perReq.set(req, memo);
  const hit = memo?.get(id);
  if (hit) return hit;
  // a store that no longer exists → the default locale; a database error is NOT hidden (a message in the wrong
  // currency is worse than one sent a little later, when the outbox retries)
  const store = (await payload.findByID({ collection: "stores", id, depth: 0, overrideAccess: true, disableErrors: true, ...(req ? { req } : {}) })) as Record<string, string> | null;
  const loc = store ? storeLocale(store) : DEFAULT_LOCALE;
  memo?.set(id, loc);
  return loc;
}

/** Money in a store's currency (or in `currency` – the one an order was placed in). */
export async function storeMoneyOf(payload: Payload, storeId: number | null | undefined, req?: PayloadRequest, currency?: string | null): Promise<Money> {
  const loc = await storeLocaleOf(payload, storeId, req);
  return moneyFormatter({ currency: currency || loc.currency, locale: loc.locale });
}
