import { sql } from "@payloadcms/db-postgres";
import type { CollectionBeforeChangeHook, Payload } from "payload";
import { userError } from "./errors";
import { getTenant, storeIdOf } from "./tenancy";

/**
 * Plan limits and features, enforced by the server whatever the browser sends (see src/lib/billing.ts storeLimits):
 *  - maxProducts / maxStorageGb / maxStaffMembers (0 = unlimited) – checked when a record is created;
 *  - features – e.g. "pos", "discounts", "reports" – checked by the endpoints and collections that provide them.
 * The default store and stores without a plan have no limits; platform admins are never limited.
 */

export type PlanFeature = "custom_domain" | "online_payments" | "pos" | "reports" | "discounts" | "abandoned_carts";

export const FEATURE_LABEL: Record<PlanFeature, string> = {
  custom_domain: "a custom domain",
  online_payments: "online card payments",
  pos: "the shop counter (POS)",
  reports: "advanced reports",
  discounts: "discount codes",
  abandoned_carts: "abandoned cart recovery",
};

async function limitsOf(payload: Payload, storeId: number | null) {
  const { storeLimits } = await import("../lib/billing");
  return storeLimits(payload, storeId);
}

/** Does this store's plan include the feature? (true without a plan / for the default store) */
export async function storeHasFeature(payload: Payload, storeId: number | null, feature: PlanFeature): Promise<boolean> {
  const { hasFeature } = await import("../lib/billing");
  return hasFeature(await limitsOf(payload, storeId), feature);
}

export const upgradeMessage = (feature: PlanFeature) => `Your plan doesn't include ${FEATURE_LABEL[feature]}. Upgrade the plan (Account → Stores) to use it.`;

/** Collection hook: creating records here needs a plan feature (e.g. Discounts → "discounts"). */
export const requireFeature =
  (feature: PlanFeature): CollectionBeforeChangeHook =>
  async ({ data, operation, req, context }) => {
    if (operation !== "create" || context?.migrating || context?.system || context?.storefront) return data;
    const t = await getTenant(req);
    if (t.platformAdmin) return data;
    if (!(await storeHasFeature(req.payload, storeIdOf(data.store) ?? t.activeStoreId, feature))) throw userError(upgradeMessage(feature), 403);
    return data;
  };

/** Products: at most the plan's number of products (variants included). */
export const productLimit: CollectionBeforeChangeHook = async ({ data, operation, req, context }) => {
  if (operation !== "create" || context?.migrating || context?.system) return data;
  const t = await getTenant(req);
  if (t.platformAdmin) return data;
  const store = storeIdOf(data.store) ?? t.activeStoreId;
  const { maxProducts } = await limitsOf(req.payload, store);
  if (maxProducts > 0) {
    const used = await req.payload.count({ collection: "products", where: { store: { equals: store } }, overrideAccess: true, req });
    if (used.totalDocs >= maxProducts) throw userError(`Your plan allows ${maxProducts} products. Upgrade the plan (Account → Stores) to add more.`, 403);
  }
  return data;
};

/** Media: the store's uploads stay within the plan's storage (GB). */
export const storageLimit: CollectionBeforeChangeHook = async ({ data, operation, req, context }) => {
  if (operation !== "create" || context?.migrating || context?.system) return data;
  const t = await getTenant(req);
  if (t.platformAdmin) return data;
  const store = storeIdOf(data.store) ?? t.activeStoreId;
  const { maxStorageGb } = await limitsOf(req.payload, store);
  if (maxStorageGb > 0 && store != null) {
    const { conn } = await import("./stock");
    const db = await conn(req.payload, req);
    const r = (await db.execute(sql`SELECT COALESCE(SUM("filesize"), 0) AS used FROM "payload"."cms_media" WHERE "store_id" = ${store}`)) as unknown as { rows: { used: number | string }[] };
    const used = Number(r.rows[0]?.used ?? 0) + (Number(data.filesize) || 0);
    if (used > maxStorageGb * 1024 ** 3) throw userError(`This upload would go over your plan's ${maxStorageGb} GB of storage. Delete unused files or upgrade the plan.`, 403);
  }
  return data;
};
