import "server-only";

import type { Payload, Where } from "payload";
import { getSessionUser } from "@/lib/auth";
import { payloadClient } from "@/lib/cms/catalog-source";
import { byStorefrontId } from "@/lib/cms/sales";
import { isCmsConfigured } from "@/lib/db/config";
import { rateLimitKey } from "@/lib/rate-limit";
import { log } from "@/lib/log";
import { countryDefaults, isCurrency, isTimeZone, toCountryCode } from "@/lib/locale";

/**
 * Merchant self-service (Account → Stores): open a store, choose a plan, accept team invitations, publish.
 *
 * Rules (server-side, whatever the browser sends):
 *  - only a signed-in account with a CONFIRMED email opens stores; at most MAX_STORES_PER_USER (default 3) each, and a
 *    few per day (abuse);
 *  - a new store starts as a DRAFT with its owner as the only member (store_owner) – it has no rights anywhere else;
 *  - plans: only active ones; the free trial once per store; paid plans go through billing (src/lib/billing.ts);
 *  - publishing: the owner, from draft only, with a plan that is active / trialing;
 *  - invitations: accepted by the invited email's own (confirmed) account – by link token or from the list.
 */

export type StoreTenantInput = {
  name: string;
  slug?: string;
  businessName?: string;
  country?: string;
  currency?: string;
  timezone?: string;
  defaultLanguage?: string;
  subdomain?: string;
  planId?: string | null;
};

export type SubscriptionPlanOption = {
  id: string;
  slug?: string;
  name: string;
  description?: string | null;
  priceMonthly?: number;
  priceAnnual?: number;
  currency?: string;
  trialDays?: number;
  highlight?: string | null;
  maxProducts?: number;
  maxStaffMembers?: number;
  features?: string[];
};

export type MyStore = {
  id: number;
  name: string;
  slug: string;
  status: string;
  role: string;
  subdomain: string | null;
  customDomain: string | null;
  domainVerified: boolean;
  domainToken: string | null;
  planName: string | null;
  planId: number | null;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  graceEndsAt: string | null;
  trialUsed: boolean;
  paymentsConnected: boolean;
  paymentsReady: boolean;
};

type Doc = Record<string, unknown>;
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const relId = (v: unknown) => (v && typeof v === "object" ? Number((v as Doc).id) : v == null ? null : Number(v));
const MAX_STORES = () => Math.max(1, Number(process.env.MAX_STORES_PER_USER ?? 3));

const normalizeSlug = (value: string | null | undefined, fallback = "store") => {
  const slug = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || fallback;
};

export const buildStoreSlug = (value: string | null | undefined) => normalizeSlug(value, "store");

/** The Payload user behind a storefront session id (a migrated account's id is its legacy id). */
async function userDoc(payload: Payload, sessionUserId: string): Promise<Doc | null> {
  const res = await payload.find({ collection: "users", where: byStorefrontId(sessionUserId), limit: 1, depth: 0, overrideAccess: true, showHiddenFields: true });
  return (res.docs[0] as unknown as Doc | undefined) ?? null;
}

/** The person's active role in a store (null = none). */
async function roleIn(payload: Payload, userId: number, storeId: number): Promise<string | null> {
  const m = (await payload.find({ collection: "store-memberships", where: { and: [{ store: { equals: storeId } }, { user: { equals: userId } }, { status: { equals: "active" } }] }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined;
  return m ? String(m.role) : null;
}

/** Does this account work in any store (an active membership)? – the account nav shows "Manage stores" then. */
export async function worksInAnyStore(sessionUserId: string): Promise<boolean> {
  if (!sessionUserId || !isCmsConfigured) return false;
  const payload = await payloadClient();
  const user = await userDoc(payload, sessionUserId);
  if (!user) return false;
  const { totalDocs } = await payload.count({ collection: "store-memberships", where: { and: [{ user: { equals: user.id } }, { status: { equals: "active" } }] }, overrideAccess: true });
  return totalDocs > 0;
}

/** The stores this account works in (active memberships), with what Account → Stores shows about each. */
export async function listStoresForUser(sessionUserId: string): Promise<MyStore[]> {
  if (!sessionUserId || !isCmsConfigured) return [];
  const payload = await payloadClient();
  const user = await userDoc(payload, sessionUserId);
  if (!user) return [];
  const memberships = (await payload.find({ collection: "store-memberships", where: { and: [{ user: { equals: user.id } }, { status: { equals: "active" } }] }, depth: 0, limit: 100, overrideAccess: true })).docs as unknown as Doc[];
  const roles = new Map(memberships.map((m) => [relId(m.store), String(m.role)]));
  if (!roles.size) return [];
  const stores = (await payload.find({ collection: "stores", where: { id: { in: [...roles.keys()] } }, depth: 1, limit: 100, overrideAccess: true, sort: "createdAt", showHiddenFields: true })).docs as unknown as Doc[];
  return stores.map((s) => {
    const plan = s.plan && typeof s.plan === "object" ? (s.plan as Doc) : null;
    const role = roles.get(Number(s.id)) ?? "store_staff";
    return {
      id: Number(s.id),
      name: String(s.name ?? ""),
      slug: String(s.slug ?? ""),
      status: String(s.status ?? "draft"),
      role,
      subdomain: (s.subdomain as string) || null,
      customDomain: (s.customDomain as string) || null,
      domainVerified: Boolean(s.domainVerifiedAt),
      // the DNS record to add – only the owner needs it
      domainToken: role === "store_owner" ? ((s.domainVerificationToken as string) || null) : null,
      planName: plan ? String(plan.name ?? "") : null,
      planId: plan ? Number(plan.id) : relId(s.plan),
      subscriptionStatus: String(s.subscriptionStatus ?? "trialing"),
      trialEndsAt: (s.trialEndsAt as string) || null,
      graceEndsAt: (s.graceEndsAt as string) || null,
      trialUsed: s.trialUsed === true,
      paymentsConnected: Boolean(s.paymentsAccountId),
      paymentsReady: s.paymentsChargesEnabled === true,
    };
  });
}

/** Invitations waiting for this account (sent to its email address). */
export async function listPendingStoreInvitations(sessionUserId: string) {
  if (!sessionUserId || !isCmsConfigured) return [] as Array<{ id: number; store: { id: number; name: string } | null; role: string; expiresAt: string | null }>;
  const payload = await payloadClient();
  const user = await userDoc(payload, sessionUserId);
  if (!user?.email) return [];
  const docs = (
    await payload.find({
      collection: "store-memberships",
      where: { and: [{ email: { equals: String(user.email).toLowerCase() } }, { status: { equals: "invited" } }, { or: [{ inviteExpiresAt: { exists: false } }, { inviteExpiresAt: { greater_than: new Date().toISOString() } }] }] },
      depth: 1,
      limit: 50,
      overrideAccess: true,
      sort: "createdAt",
    })
  ).docs as unknown as Doc[];
  return docs.map((m) => {
    const s = m.store && typeof m.store === "object" ? (m.store as Doc) : null;
    return { id: Number(m.id), store: s ? { id: Number(s.id), name: String(s.name ?? "") } : null, role: String(m.role), expiresAt: (m.inviteExpiresAt as string) || null };
  });
}

/** Active plans, cheapest first (the pricing list; archived plans are never offered). */
export async function listSubscriptionPlans(): Promise<SubscriptionPlanOption[]> {
  if (!isCmsConfigured) return [];
  const payload = await payloadClient();
  const plans = (await payload.find({ collection: "subscription-plans", where: { status: { equals: "active" } }, depth: 0, limit: 50, overrideAccess: true, sort: "sortOrder" })).docs as unknown as Doc[];
  return plans
    .map((plan) => ({
      id: String(plan.id),
      slug: (plan.slug as string) ?? String(plan.id),
      name: String(plan.name ?? "Plan"),
      description: (plan.description as string) ?? null,
      priceMonthly: Number(plan.priceMonthly ?? 0),
      priceAnnual: Number(plan.priceAnnual ?? 0),
      currency: String(plan.currency ?? "PKR"),
      trialDays: Number(plan.trialDays ?? 0),
      highlight: (plan.highlight as string) ?? null,
      maxProducts: Number(plan.maxProducts ?? 0),
      maxStaffMembers: Number(plan.maxStaffMembers ?? 0),
      features: Array.isArray(plan.features) ? (plan.features as string[]) : [],
    }))
    .sort((a, b) => a.priceMonthly - b.priceMonthly);
}

export async function createStoreForUser(sessionUserId: string, input: StoreTenantInput): Promise<Result<{ storeId: string; checkoutUrl?: string }>> {
  if (!sessionUserId || !isCmsConfigured) return { ok: false, error: "Store creation requires the database to be connected." };
  const payload = await payloadClient();
  const user = await userDoc(payload, sessionUserId);
  if (!user) return { ok: false, error: "Please sign in again." };
  if (user.blocked === true) return { ok: false, error: "This account can't open stores." };
  if (user.emailVerified !== true) return { ok: false, error: "Please confirm your email address first (open the link we sent you), then create your store." };

  const name = input.name.trim();
  const slug = normalizeSlug(input.slug || input.name, "store");
  const subdomain = normalizeSlug(input.subdomain || slug, "store");
  if (name.length < 2) return { ok: false, error: "Store name must be at least 2 characters long." };
  if (slug.length < 3) return { ok: false, error: "Please choose a store address of at least 3 letters or numbers." };

  // how many stores this account already owns
  const owned = await payload.count({ collection: "store-memberships", where: { and: [{ user: { equals: user.id } }, { role: { equals: "store_owner" } }] }, overrideAccess: true });
  if (owned.totalDocs >= MAX_STORES()) return { ok: false, error: `You can own up to ${MAX_STORES()} stores. Contact ShopEngine support for more.` };
  if (!rateLimitKey(`store-create:${user.id}`, 3, 24 * 60 * 60_000)) return { ok: false, error: "You've created several stores today – please try again tomorrow." };

  const exists = await payload.count({ collection: "stores", where: { or: [{ slug: { equals: slug } }, { subdomain: { equals: subdomain } }] }, overrideAccess: true });
  if (exists.totalDocs > 0) return { ok: false, error: "This store address is already taken. Please choose another one." };

  // only an ACTIVE plan can be chosen (else the cheapest active one)
  const plans = await listSubscriptionPlans();
  const plan = (input.planId ? plans.find((p) => p.id === input.planId || p.slug === input.planId) : undefined) ?? plans[0];
  if (input.planId && !plans.some((p) => p.id === input.planId || p.slug === input.planId)) return { ok: false, error: "This plan isn't available. Please choose another." };

  // the country brings its currency and time zone unless the owner chose others
  const country = toCountryCode(input.country) ?? "PK";
  const home = countryDefaults(country);
  const currency = input.currency?.trim() && isCurrency(input.currency.trim().toUpperCase()) ? input.currency.trim().toUpperCase() : home.currency;
  const timezone = input.timezone?.trim() && isTimeZone(input.timezone.trim()) ? input.timezone.trim() : home.timezone;
  const language = input.defaultLanguage?.trim() || "en";
  let store: Doc;
  try {
    store = (await payload.create({
      collection: "stores",
      data: {
        name,
        slug,
        businessName: input.businessName?.trim() || name,
        subdomain,
        country,
        currency,
        timezone,
        defaultLanguage: language,
        status: "draft",
        owner: user.id,
        billingEmail: user.email,
        // no plan state until choosePlan below sets the real one (free → active, trial → trialing, paid → after payment):
        // "trialing" here left a store whose payment page was abandoned (or failed) on an unlimited plan for ever
        subscriptionStatus: "expired",
      } as never,
      depth: 0,
      overrideAccess: true,
      context: { system: true },
    })) as unknown as Doc;
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    // the Stores rules (reserved names, format) explain themselves
    if (/reserved|not allowed|taken|unique|already/i.test(msg)) return { ok: false, error: msg.replace(/^.*?:\s*/, "") || "This store address can't be used." };
    log.error("stores.create_failed", e);
    return { ok: false, error: "We couldn't create the store. Please try again." };
  }
  const storeId = Number(store.id);

  await payload.create({
    collection: "store-memberships",
    data: { store: storeId, user: user.id, email: String(user.email).toLowerCase(), role: "store_owner", status: "active", invitedAt: new Date().toISOString(), acceptedAt: new Date().toISOString() } as never,
    depth: 0,
    overrideAccess: true,
    context: { system: true },
  });

  // the store's own settings pages, filled with its details
  const { ensureStoreSettings } = await import("@/payload/store-settings");
  await ensureStoreSettings(payload, storeId, {
    "store-info": { name, shortName: name, email: user.email },
    "seo-settings": { titleTemplate: `%s | ${name}`, defaultTitle: name },
  }).catch((e) => log.error("stores.settings_failed", e, { store: storeId }));

  // its plan: free → active; paid → the one free trial, or the payment page
  let checkoutUrl: string | undefined;
  if (plan) {
    const { choosePlan } = await import("@/lib/billing");
    const r = await choosePlan(payload, { storeId, planId: Number(plan.id), cycle: "monthly", email: String(user.email), returnUrl: billingReturnUrl() }).catch((e) => {
      log.error("stores.plan_failed", e, { store: storeId });
      return { ok: false as const, error: "plan" };
    });
    if (r.ok) checkoutUrl = r.checkoutUrl;
  }

  // the new store is where the owner works from now on (/cms opens it)
  await payload.update({
    collection: "users",
    id: Number(user.id),
    data: { currentStore: storeId, ...(user.platformRole === "customer" || !user.platformRole ? { platformRole: "merchant_owner" } : {}) } as never,
    depth: 0,
    overrideAccess: true,
    context: { system: true },
  });

  log.info("stores.created", { store: storeId, by: user.id, plan: plan?.id ?? null });
  return { ok: true, storeId: String(storeId), ...(checkoutUrl ? { checkoutUrl } : {}) };
}

const billingReturnUrl = () => `${(process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "")}/account/stores`;

/** Accept an invitation (from the list, or the emailed link's token) – only by the account with the invited email. */
export async function acceptStoreInvitation(sessionUserId: string, ref: { membershipId?: string; token?: string }): Promise<Result<{ storeId: number }>> {
  if (!sessionUserId || !isCmsConfigured || (!ref.membershipId && !ref.token)) return { ok: false, error: "This invitation could not be accepted." };
  const payload = await payloadClient();
  const user = await userDoc(payload, sessionUserId);
  if (!user) return { ok: false, error: "Please sign in again." };
  if (user.emailVerified !== true) return { ok: false, error: "Please confirm your email address first, then accept the invitation." };
  const { hashInviteToken } = await import("@/payload/collections/StoreMemberships");
  const where: Where = ref.token ? { inviteTokenHash: { equals: hashInviteToken(ref.token) } } : { id: { equals: Number(ref.membershipId) } };
  const m = (await payload.find({ collection: "store-memberships", where: { and: [where, { status: { equals: "invited" } }] }, limit: 1, depth: 0, overrideAccess: true, showHiddenFields: true })).docs[0] as unknown as Doc | undefined;
  if (!m) return { ok: false, error: "Invitation not found – it may have been accepted or withdrawn already." };
  if (String(m.email ?? "").toLowerCase() !== String(user.email ?? "").toLowerCase()) return { ok: false, error: `This invitation was sent to another email address. Sign in with that address to accept it.` };
  if (m.inviteExpiresAt && Date.parse(String(m.inviteExpiresAt)) < Date.now()) return { ok: false, error: "This invitation has expired – ask the store to send a new one." };
  const storeId = Number(relId(m.store));
  // already in this store under another record (e.g. invited twice): keep the existing one
  if (await roleIn(payload, Number(user.id), storeId)) {
    await payload.delete({ collection: "store-memberships", id: Number(m.id), overrideAccess: true, context: { system: true } }).catch(() => undefined);
    return { ok: true, storeId };
  }
  await payload.update({
    collection: "store-memberships",
    id: Number(m.id),
    data: { user: user.id, status: "active", acceptedAt: new Date().toISOString(), inviteTokenHash: null } as never,
    depth: 0,
    overrideAccess: true,
    context: { system: true },
  });
  await payload.update({ collection: "users", id: Number(user.id), data: { currentStore: storeId } as never, depth: 0, overrideAccess: true, context: { system: true } });
  log.info("stores.invite_accepted", { store: storeId, user: user.id, role: m.role });
  return { ok: true, storeId };
}

/** The owner opens a draft store to shoppers (needs an active or trialing plan). */
export async function publishStore(sessionUserId: string, storeIdRaw: string): Promise<Result> {
  if (!sessionUserId || !storeIdRaw || !isCmsConfigured) return { ok: false, error: "Store could not be published." };
  const payload = await payloadClient();
  const user = await userDoc(payload, sessionUserId);
  const storeId = Number(storeIdRaw);
  if (!user || !Number.isFinite(storeId) || (await roleIn(payload, Number(user.id), storeId)) !== "store_owner") return { ok: false, error: "Only the store's owner can publish it." };
  const store = (await payload.findByID({ collection: "stores", id: storeId, depth: 0, overrideAccess: true })) as unknown as Doc;
  if (store.status !== "draft") return { ok: false, error: store.status === "active" ? "This store is already live." : "This store can't be published – contact ShopEngine support." };
  if (!["active", "trialing"].includes(String(store.subscriptionStatus))) return { ok: false, error: "Choose a plan (or pay for it) before publishing." };
  const products = await payload.count({ collection: "products", where: { and: [{ store: { equals: storeId } }, { status: { equals: "active" } }] }, overrideAccess: true });
  if (!products.totalDocs) return { ok: false, error: "Add at least one active product in /cms before publishing." };
  await payload.update({ collection: "stores", id: storeId, data: { status: "active" } as never, depth: 0, overrideAccess: true, context: { system: true } });
  log.info("stores.published", { store: storeId, by: user.id });
  return { ok: true };
}

/** The owner chooses (or changes) the store's plan. Paid plans may return a payment page to open. */
export async function setStorePlanForUser(sessionUserId: string, storeIdRaw: string, planId: string, cycle: "monthly" | "annual" = "monthly"): Promise<Result<{ checkoutUrl?: string }>> {
  if (!sessionUserId || !storeIdRaw || !planId || !isCmsConfigured) return { ok: false, error: "A valid plan selection is required." };
  const payload = await payloadClient();
  const user = await userDoc(payload, sessionUserId);
  const storeId = Number(storeIdRaw);
  if (!user || (await roleIn(payload, Number(user.id), storeId)) !== "store_owner") return { ok: false, error: "Only the store's owner can change its plan." };
  const { choosePlan } = await import("@/lib/billing");
  try {
    const r = await choosePlan(payload, { storeId, planId: Number(planId), cycle, email: String(user.email), returnUrl: billingReturnUrl() });
    return r.ok ? { ok: true, ...(r.checkoutUrl ? { checkoutUrl: r.checkoutUrl } : {}) } : r;
  } catch (e) {
    log.error("stores.plan_change_failed", e, { store: storeId });
    return { ok: false, error: "We couldn't change the plan right now. Please try again." };
  }
}

/** Cancels the plan at the end of the paid period (owner). */
export async function cancelStorePlanForUser(sessionUserId: string, storeIdRaw: string): Promise<Result> {
  const payload = await payloadClient();
  const user = await userDoc(payload, sessionUserId);
  const storeId = Number(storeIdRaw);
  if (!user || (await roleIn(payload, Number(user.id), storeId)) !== "store_owner") return { ok: false, error: "Only the store's owner can cancel its plan." };
  const { cancelPlan } = await import("@/lib/billing");
  const r = await cancelPlan(payload, storeId);
  return r.ok ? { ok: true } : { ok: false, error: r.error ?? "Couldn't cancel." };
}

/**
 * The owner connects the store's card payment account with the provider that works in the store's country (Stripe
 * Connect onboarding for now – lib/payments/gateways.ts).
 */
export async function paymentsLinkForUser(sessionUserId: string, storeIdRaw: string): Promise<Result<{ url: string }>> {
  const payload = await payloadClient();
  const user = await userDoc(payload, sessionUserId);
  const storeId = Number(storeIdRaw);
  if (!user || (await roleIn(payload, Number(user.id), storeId)) !== "store_owner") return { ok: false, error: "Only the store's owner can connect payments." };
  const store = (await payload.findByID({ collection: "stores", id: storeId, depth: 0, overrideAccess: true })) as unknown as Doc;
  const { storeGateway } = await import("@/lib/payments/gateways");
  const { countryInText, storeLocale } = await import("@/lib/locale");
  const gateway = storeGateway(store);
  const country = storeLocale(store as { country?: string }).country;
  if (!gateway?.connectLink || !gateway.configured())
    return { ok: false, error: gateway ? "Card payments aren't available on this platform yet." : `No card payment provider works in ${countryInText(country)} yet – use bank transfer, cash on delivery or your own payment methods (Settings → Payments).` };
  const { hasFeature, storeLimits } = await import("@/lib/billing");
  if (!hasFeature(await storeLimits(payload, storeId), "online_payments")) return { ok: false, error: "Your plan doesn't include online card payments – upgrade to use them." };
  try {
    return { ok: true, url: await gateway.connectLink(payload, { storeId, email: String(store.billingEmail || user.email), country, returnUrl: `${billingReturnUrl()}?payments=${storeId}` }) };
  } catch (e) {
    log.error("stores.payments_link_failed", e, { store: storeId });
    return { ok: false, error: "We couldn't open the payment setup. Please try again." };
  }
}

/** After returning from payment onboarding: re-check whether the account can take cards. */
export async function refreshPaymentsForUser(sessionUserId: string, storeIdRaw: string): Promise<Result<{ ready: boolean }>> {
  const payload = await payloadClient();
  const user = await userDoc(payload, sessionUserId);
  const storeId = Number(storeIdRaw);
  if (!user || !(await roleIn(payload, Number(user.id), storeId))) return { ok: false, error: "Not your store." };
  const store = (await payload.findByID({ collection: "stores", id: storeId, depth: 0, overrideAccess: true })) as unknown as Doc;
  const { storeGateway } = await import("@/lib/payments/gateways");
  const gateway = storeGateway(store);
  if (!gateway?.refreshAccount) return { ok: true, ready: false };
  try {
    return { ok: true, ready: await gateway.refreshAccount(payload, storeId) };
  } catch (e) {
    log.error("stores.payments_refresh_failed", e, { store: storeId });
    return { ok: false, error: "Couldn't check the payment account right now." };
  }
}

/** The owner sets a custom domain (verified separately with a DNS TXT record). */
export async function setCustomDomainForUser(sessionUserId: string, storeIdRaw: string, domain: string): Promise<Result> {
  const payload = await payloadClient();
  const user = await userDoc(payload, sessionUserId);
  const storeId = Number(storeIdRaw);
  if (!user || (await roleIn(payload, Number(user.id), storeId)) !== "store_owner") return { ok: false, error: "Only the store's owner can change its domain." };
  const { hasFeature, storeLimits } = await import("@/lib/billing");
  if (domain && !hasFeature(await storeLimits(payload, storeId), "custom_domain")) return { ok: false, error: "Your plan doesn't include a custom domain – upgrade to use one." };
  try {
    await payload.update({ collection: "stores", id: storeId, data: { customDomain: domain.trim().toLowerCase() || null } as never, depth: 0, overrideAccess: true, context: { system: true } });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? "This domain can't be used.").replace(/^.*?:\s*/, "") };
  }
}

/** Checks the store's DNS TXT record (`_shopengine.<domain>` = its verification token) and marks the domain verified. */
export async function verifyCustomDomainForUser(sessionUserId: string, storeIdRaw: string): Promise<Result<{ verified: boolean }>> {
  const payload = await payloadClient();
  const user = await userDoc(payload, sessionUserId);
  const storeId = Number(storeIdRaw);
  if (!user || (await roleIn(payload, Number(user.id), storeId)) !== "store_owner") return { ok: false, error: "Only the store's owner can verify its domain." };
  if (!rateLimitKey(`domain-verify:${storeId}`, 10, 60 * 60_000)) return { ok: false, error: "Too many checks – please wait a while (DNS changes can take up to an hour)." };
  const store = (await payload.findByID({ collection: "stores", id: storeId, depth: 0, overrideAccess: true, showHiddenFields: true })) as unknown as Doc;
  const domain = String(store.customDomain ?? "");
  const token = String(store.domainVerificationToken ?? "");
  if (!domain || !token) return { ok: false, error: "Set a custom domain first." };
  const { hasFeature, storeLimits } = await import("@/lib/billing");
  if (!hasFeature(await storeLimits(payload, storeId), "custom_domain")) return { ok: false, error: "Your plan doesn't include a custom domain – upgrade to use one." };
  const { resolveTxt } = await import("node:dns/promises");
  // the TXT record may be on the domain itself or on _shopengine.<domain>
  const records = (await Promise.all([domain, `_shopengine.${domain}`].map((name) => resolveTxt(name).catch(() => [] as string[][])))).flat();
  const verified = records.some((r) => r.join("").trim() === token);
  if (verified && !store.domainVerifiedAt) {
    // only if the store still has THIS domain and token: the DNS lookup takes a while, and a domain changed meanwhile
    // (to another store's address, or ShopEngine's own) must not get the "verified" mark meant for the old one
    const { sql } = await import("@payloadcms/db-postgres");
    const { conn } = await import("@/payload/stock");
    const { rows } = await (await conn(payload)).execute(sql`
      UPDATE "payload"."cms_stores" SET "domain_verified_at" = now(), "updated_at" = now()
      WHERE "id" = ${storeId} AND "custom_domain" = ${domain} AND "domain_verification_token" = ${token} AND "domain_verified_at" IS NULL
      RETURNING "id"`);
    if (!rows.length) return { ok: false, error: "The domain changed while it was being checked – please check it again." };
    const { clearRedirectCache, revalidate } = await import("@/payload/revalidate");
    clearRedirectCache();
    revalidate(["stores"]);
  }
  return { ok: true, verified };
}

export async function requireMerchantSession() {
  const user = await getSessionUser();
  if (!user) throw new Error("Please sign in before creating a store.");
  return user;
}
