/**
 * Store resolution helpers shared by the server, the proxy and tests (no server-only imports here).
 *
 * Which store a request is for (ShopEngine):
 *  1. a VERIFIED custom domain (shop.example.com, or www.shop.example.com) → that store
 *  2. <subdomain>.<PLATFORM_ROOT_DOMAIN> (e.g. myshop.shopengine.app) → the store with that subdomain (unknown → none)
 *  3. anything else (the main site address, localhost, the Railway address) → the default store
 */

import { storeLocale } from "./locale";

/** Cookie naming the store being previewed – honoured only while Draft Mode is on (set by /api/preview for a store's team). */
export const PREVIEW_STORE_COOKIE = "se-preview-store";

export type StoreDirectoryEntry = {
  id: number;
  slug: string;
  name: string;
  status: string;
  subscriptionStatus: string;
  isDefault: boolean;
  subdomain: string | null;
  customDomain: string | null;
  domainVerified: boolean;
  currency: string;
  country: string;
  timezone: string;
  language: string;
  orderPrefix: string;
  trialEndsAt: string | null;
  graceEndsAt: string | null;
};

const s = (v: unknown) => (typeof v === "string" ? v : "");
const pickLocale = ({ country, currency, timezone }: { country: string; currency: string; timezone: string }) => ({ country, currency, timezone });

/** A Stores document → its routing details. */
export function toDirectoryEntry(d: Record<string, unknown>): StoreDirectoryEntry {
  return {
    id: Number(d.id),
    slug: s(d.slug),
    name: s(d.name),
    status: s(d.status) || "active",
    subscriptionStatus: s(d.subscriptionStatus) || "active",
    isDefault: d.isDefault === true,
    subdomain: s(d.subdomain) || null,
    customDomain: s(d.customDomain) || null,
    domainVerified: Boolean(d.domainVerifiedAt),
    // money, clock and country: missing or invalid values fall back to the country's (lib/locale.ts)
    ...pickLocale(storeLocale(d as { country?: string; currency?: string; timezone?: string })),
    language: s(d.defaultLanguage) || "en",
    orderPrefix: s(d.orderPrefix),
    trialEndsAt: s(d.trialEndsAt) || null,
    graceEndsAt: s(d.graceEndsAt) || null,
  };
}

/** The platform's own domain for store sub-domains (PLATFORM_ROOT_DOMAIN, e.g. "shopengine.app"). */
export const platformRootDomain = () => (process.env.PLATFORM_ROOT_DOMAIN ?? "").trim().toLowerCase().replace(/^\.+|\.+$/g, "");

/** "Shop.Example.com:3000" → "shop.example.com" */
export const hostOnly = (host: string | null | undefined) =>
  String(host ?? "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");

/** The store a host name belongs to (null = no such store, e.g. an unknown sub-domain). */
export function matchStore(stores: StoreDirectoryEntry[], host: string | null | undefined, root = platformRootDomain()): StoreDirectoryEntry | null {
  const h = hostOnly(host);
  const byDomain = h ? stores.find((s) => s.customDomain && s.domainVerified && (h === s.customDomain || h === `www.${s.customDomain}`)) : undefined;
  if (byDomain) return byDomain;
  if (root && h.endsWith(`.${root}`)) {
    const sub = h.slice(0, -(root.length + 1));
    if (sub && sub !== "www") return stores.find((s) => s.subdomain === sub) ?? null;
  }
  return stores.find((s) => s.isDefault) ?? null;
}

export type Availability = { open: true } | { open: false; reason: "missing" | "suspended" | "closed" | "setting-up" | "plan-ended" };

/**
 * Whether a store's shop is open to shoppers right now.
 * Draft stores are "coming soon" (their team previews them in Draft Mode); suspended / closed stores are offline;
 * a store whose plan ended (expired, or past due beyond its grace date) goes offline until it's paid.
 */
export function storeAvailability(store: StoreDirectoryEntry | null, now = Date.now()): Availability {
  if (!store) return { open: false, reason: "missing" };
  if (store.status === "suspended") return { open: false, reason: "suspended" };
  if (store.status === "closed") return { open: false, reason: "closed" };
  if (store.status === "draft") return { open: false, reason: "setting-up" };
  if (store.isDefault) return { open: true };
  if (store.subscriptionStatus === "expired" || store.subscriptionStatus === "suspended") return { open: false, reason: "plan-ended" };
  if (store.subscriptionStatus === "past_due" && store.graceEndsAt && Date.parse(store.graceEndsAt) < now) return { open: false, reason: "plan-ended" };
  return { open: true };
}

/** The public address of a store (verified custom domain, platform sub-domain, else the main site). */
export function storeOrigin(store: Pick<StoreDirectoryEntry, "isDefault" | "subdomain" | "customDomain" | "domainVerified">, siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "", root = platformRootDomain()): string {
  if (store.customDomain && store.domainVerified) return `https://${store.customDomain}`;
  if (!store.isDefault && store.subdomain && root) return `https://${store.subdomain}.${root}`;
  return siteUrl.replace(/\/+$/, "");
}
