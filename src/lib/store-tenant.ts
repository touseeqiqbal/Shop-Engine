import "server-only";

import { getSessionUser } from "@/lib/auth";
import { payloadClient } from "@/lib/cms/catalog-source";
import { isDatabaseConfigured } from "@/lib/db/config";

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
  trialDays?: number;
};

const DEFAULT_SUBSCRIPTION_PLANS = [
  { name: "Starter", description: "Launch a single storefront with core commerce essentials.", priceMonthly: 0, trialDays: 14, maxProducts: 200, maxStaffMembers: 3, maxStorageGb: 5 },
  { name: "Growth", description: "Scale your storefront with more products, staff, and automation.", priceMonthly: 9999, trialDays: 14, maxProducts: 2000, maxStaffMembers: 10, maxStorageGb: 25 },
  { name: "Scale", description: "Advanced operations for larger merchants and high-volume teams.", priceMonthly: 29999, trialDays: 14, maxProducts: 10000, maxStaffMembers: 50, maxStorageGb: 100 },
] as const;

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

export async function listStoresForUser(userId: string) {
  if (!userId || !isDatabaseConfigured) return [] as Array<{ id: string | number; name: string; slug?: string; status?: string; owner?: unknown }>;
  const payload = await payloadClient();
  const docs = (
    await payload.find({
      collection: "stores" as never,
      where: {
        or: [{ owner: { equals: userId } }, { members: { in: [userId] } }],
      },
      depth: 0,
      limit: 50,
      overrideAccess: true,
      sort: "createdAt",
    })
  ).docs as Array<{ id: string | number; name: string; slug?: string; status?: string; owner?: unknown }>;
  return docs;
}

export async function listPendingStoreInvitations(userId: string) {
  if (!userId || !isDatabaseConfigured) return [] as Array<{ id: string | number; store?: { id: string | number; name?: string; slug?: string } | null; role?: string }>;
  const payload = await payloadClient();
  const docs = (
    await payload.find({
      collection: "store-memberships" as never,
      where: {
        and: [{ user: { equals: userId } }, { status: { equals: "invited" } }],
      },
      depth: 1,
      limit: 50,
      overrideAccess: true,
      sort: "createdAt",
    })
  ).docs as Array<{ id: string | number; store?: { id: string | number; name?: string; slug?: string } | null; role?: string }>;
  return docs;
}

async function ensureDefaultSubscriptionPlans(payload: Awaited<ReturnType<typeof payloadClient>>) {
  const existing = (await payload.find({
    collection: "subscription-plans" as never,
    depth: 0,
    limit: 50,
    overrideAccess: true,
    sort: "priceMonthly",
  })).docs as Array<{ id: string | number; slug?: string; name?: string; description?: string | null; priceMonthly?: number; trialDays?: number; status?: string }>;

  if (existing.length > 0) return existing;

  const created = [] as Array<{ id: string | number; slug?: string; name?: string; description?: string | null; priceMonthly?: number; trialDays?: number; status?: string }>;
  for (const plan of DEFAULT_SUBSCRIPTION_PLANS) {
    const record = (await payload.create({
      collection: "subscription-plans" as never,
      data: {
        name: plan.name,
        description: plan.description,
        status: "active",
        priceMonthly: plan.priceMonthly,
        priceAnnual: plan.priceMonthly * 12,
        trialDays: plan.trialDays,
        maxProducts: plan.maxProducts,
        maxStaffMembers: plan.maxStaffMembers,
        maxStorageGb: plan.maxStorageGb,
        features: ["Storefront", "Orders", "Customers", "Analytics"],
        highlight: plan.name,
      } as never,
      depth: 0,
      overrideAccess: true,
    })) as { id: string | number; slug?: string; name?: string; description?: string | null; priceMonthly?: number; trialDays?: number; status?: string };
    created.push(record);
  }
  return created;
}

export async function listSubscriptionPlans() {
  if (!isDatabaseConfigured) return [] as SubscriptionPlanOption[];
  const payload = await payloadClient();
  const plans = await ensureDefaultSubscriptionPlans(payload);

  return plans.map((plan) => ({
    id: String(plan.id),
    slug: plan.slug ?? String(plan.id),
    name: plan.name ?? "Plan",
    description: plan.description ?? null,
    priceMonthly: Number(plan.priceMonthly ?? 0),
    trialDays: Number(plan.trialDays ?? 0),
  }));
}

export async function createStoreForUser(userId: string, input: StoreTenantInput) {
  if (!userId || !isDatabaseConfigured) {
    return { ok: false as const, error: "Store creation requires the database to be connected." };
  }

  const name = input.name.trim();
  const slug = normalizeSlug(input.slug || input.name, "store");
  const subdomain = normalizeSlug(input.subdomain || slug, "store");

  if (name.length < 2) {
    return { ok: false as const, error: "Store name must be at least 2 characters long." };
  }
  if (slug.length < 2) {
    return { ok: false as const, error: "Please choose a valid store slug." };
  }

  const payload = await payloadClient();
  const exists = await payload.find({
    collection: "stores" as never,
    where: {
      or: [{ slug: { equals: slug } }, { subdomain: { equals: subdomain } }],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  if (exists.docs.length > 0) {
    return { ok: false as const, error: "This store URL is already taken. Please choose another one." };
  }

  const planIdentifier = input.planId?.trim();
  let selectedPlanDoc: { id?: string | number; name?: string; priceMonthly?: number; trialDays?: number; slug?: string } | undefined;

  if (planIdentifier) {
    const found = await payload.find({
      collection: "subscription-plans" as never,
      where: {
        or: [{ id: { equals: planIdentifier } }, { slug: { equals: planIdentifier } }],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    selectedPlanDoc = found.docs[0] as { id?: string | number; name?: string; priceMonthly?: number; trialDays?: number; slug?: string } | undefined;
  }

  if (!selectedPlanDoc) {
    const seededPlans = await ensureDefaultSubscriptionPlans(payload);
    const fallback = seededPlans[0];
    selectedPlanDoc = fallback as { id?: string | number; name?: string; priceMonthly?: number; trialDays?: number; slug?: string } | undefined;
  }

  const trialEndsAt = selectedPlanDoc?.trialDays ? new Date(Date.now() + Number(selectedPlanDoc.trialDays) * 86400000).toISOString() : undefined;

  const store = (await payload.create({
    collection: "stores" as never,
    data: {
      name,
      slug,
      businessName: input.businessName?.trim() || name,
      subdomain,
      country: input.country?.trim() || "Pakistan",
      currency: input.currency?.trim() || "PKR",
      timezone: input.timezone?.trim() || "Asia/Karachi",
      defaultLanguage: input.defaultLanguage?.trim() || "en",
      status: "draft",
      owner: userId,
      members: [userId],
      plan: selectedPlanDoc?.id ? selectedPlanDoc.id : undefined,
      subscriptionStatus: selectedPlanDoc ? "trialing" : "draft",
      trialEndsAt,
      billingEmail: undefined,
      settings: {
        country: input.country?.trim() || "Pakistan",
        currency: input.currency?.trim() || "PKR",
        timezone: input.timezone?.trim() || "Asia/Karachi",
        defaultLanguage: input.defaultLanguage?.trim() || "en",
      },
    } as never,
    depth: 0,
    overrideAccess: true,
  })) as { id: string | number };

  await payload.create({
    collection: "store-memberships" as never,
    data: {
      store: store.id,
      user: userId,
      role: "store_owner",
      status: "active",
      invitedAt: new Date().toISOString(),
      acceptedAt: new Date().toISOString(),
    } as never,
    depth: 0,
    overrideAccess: true,
  });

  if (selectedPlanDoc?.id) {
    await payload.create({
      collection: "store-subscriptions" as never,
      data: {
        storeId: store.id,
        plan: selectedPlanDoc.id,
        status: "trialing",
        billingCycle: "monthly",
        trialEndsAt,
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: trialEndsAt,
        amount: Number(selectedPlanDoc.priceMonthly ?? 0),
        currency: input.currency?.trim() || "PKR",
        paymentProvider: "manual",
      } as never,
      depth: 0,
      overrideAccess: true,
    });
  }

  const user = (await payload.find({
    collection: "users" as never,
    where: { id: { equals: userId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })).docs[0] as { stores?: Array<string | number | { id?: string | number }> | null; currentStore?: string | number | null } | undefined;

  const nextStores = Array.from(
    new Set([...(Array.isArray(user?.stores) ? user.stores : []), store.id].map((item) => (typeof item === "object" && item && "id" in item ? String(item.id) : String(item))))
  );

  await payload.update({
    collection: "users" as never,
    id: userId,
    data: {
      stores: nextStores,
      currentStore: store.id,
      platformRole: "merchant_owner",
    } as never,
    depth: 0,
    overrideAccess: true,
  });

  return { ok: true as const, storeId: String(store.id), planId: selectedPlanDoc?.id ? String(selectedPlanDoc.id) : undefined };
}

export async function acceptStoreInvitation(userId: string, membershipId: string) {
  if (!userId || !membershipId || !isDatabaseConfigured) {
    return { ok: false as const, error: "This invitation could not be accepted." };
  }

  const payload = await payloadClient();
  const membership = (await payload.find({
    collection: "store-memberships" as never,
    where: { and: [{ id: { equals: membershipId } }, { user: { equals: userId } }] },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })).docs[0] as { id: string | number; store?: { id: string | number } | null; status?: string } | undefined;

  if (!membership) {
    return { ok: false as const, error: "Invitation not found." };
  }

  await payload.update({
    collection: "store-memberships" as never,
    id: membership.id,
    data: { status: "active", acceptedAt: new Date().toISOString() } as never,
    depth: 0,
    overrideAccess: true,
  });

  const storeId = membership.store?.id ?? membership.store;
  if (typeof storeId !== "undefined" && storeId !== null) {
    const user = (await payload.find({
      collection: "users" as never,
      where: { id: { equals: userId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })).docs[0] as { stores?: Array<string | number | { id?: string | number }> | null; currentStore?: string | number | null } | undefined;

    const nextStores = Array.from(
      new Set([...(Array.isArray(user?.stores) ? user.stores : []), storeId].map((item) => (typeof item === "object" && item && "id" in item ? String(item.id) : String(item))))
    );

    await payload.update({
      collection: "users" as never,
      id: userId,
      data: {
        stores: nextStores,
        currentStore: storeId,
        platformRole: "merchant_staff",
      } as never,
      depth: 0,
      overrideAccess: true,
    });
  }

  return { ok: true as const };
}

export async function publishStore(userId: string, storeId: string) {
  if (!userId || !storeId || !isDatabaseConfigured) {
    return { ok: false as const, error: "Store could not be published." };
  }

  const payload = await payloadClient();
  const store = (await payload.find({
    collection: "stores" as never,
    where: { and: [{ id: { equals: storeId } }, { owner: { equals: userId } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })).docs[0] as { id: string | number; status?: string } | undefined;

  if (!store) {
    return { ok: false as const, error: "You do not have permission to publish this store." };
  }

  await payload.update({
    collection: "stores" as never,
    id: store.id,
    data: { status: "active" } as never,
    depth: 0,
    overrideAccess: true,
  });

  return { ok: true as const };
}

export async function getCurrentStoreForUser(userId: string) {
  if (!userId || !isDatabaseConfigured) return null;
  const payload = await payloadClient();
  const user = (await payload.find({
    collection: "users" as never,
    where: { id: { equals: userId } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })).docs[0] as { currentStore?: { id?: string | number; name?: string; slug?: string } | null } | undefined;
  return user?.currentStore ?? null;
}

export async function requireMerchantSession() {
  const user = await getSessionUser();
  if (!user) throw new Error("Please sign in before creating a store.");
  return user;
}
