import type { CollectionAfterChangeHook, CollectionConfig, CollectionSlug, GlobalAfterChangeHook, GlobalConfig, GlobalSlug, Payload, PayloadRequest } from "payload";
import { assignStore, createFor, getDefaultStoreId, platformAdmins, readFor, storeField, writeFor, type StoreRole } from "./tenancy";

/**
 * Per-store settings (theme, header, shipping, payments, store info …).
 *
 * Each settings page that used to be ONE global for the whole site is now a collection with one document per store
 * ("store-<global slug>"), with exactly the same fields – so the admin screens and their helpers work unchanged.
 * The original globals stay as the default store's fallback (and for rollback); only platform admins edit them.
 */

/** Global slug → who in a store may edit it. */
export const STORE_SETTING_ROLES: Record<string, StoreRole> = {
  "theme-settings": "store_manager",
  "announcement-bar": "store_staff",
  header: "store_manager",
  footer: "store_manager",
  "whatsapp-button": "store_staff",
  shipping: "store_manager",
  payments: "store_manager",
  notifications: "store_manager",
  "store-info": "store_manager",
  "seo-settings": "store_manager",
  "page-texts": "store_staff",
  testimonials: "store_staff",
  faqs: "store_staff",
  "order-protection": "store_manager",
  "returns-policy": "store_manager",
  "cookie-notice": "store_manager",
  "sales-channels": "store_manager",
  conversion: "store_manager",
};

export type StoreSettingKey = keyof typeof STORE_SETTING_ROLES;
export const storeSettingsSlug = (globalSlug: string) => `store-${globalSlug}` as CollectionSlug;

/** The per-store twin of a global settings page. */
export function toStoreSettingsCollection(global: GlobalConfig): CollectionConfig {
  const min = STORE_SETTING_ROLES[global.slug] ?? "store_manager";
  const label = typeof global.label === "string" ? global.label : global.slug;
  const versions = global.versions ? { maxPerDoc: (typeof global.versions === "object" && "max" in global.versions ? Number(global.versions.max) : 30) || 30 } : false;
  // the global's own after-change hooks (cache refreshes) run for the store's copy too
  const afterChange: CollectionAfterChangeHook[] = (global.hooks?.afterChange ?? []).map(
    (hook: GlobalAfterChangeHook): CollectionAfterChangeHook =>
      (args) =>
        hook({ ...(args as unknown as Parameters<GlobalAfterChangeHook>[0]), global: global as never }),
  );
  return {
    slug: storeSettingsSlug(global.slug),
    dbName: `cms_ss_${global.slug.replace(/-/g, "_")}`,
    labels: { singular: label, plural: label },
    admin: {
      group: "Store settings",
      description: typeof global.admin?.description === "string" ? global.admin.description : undefined,
      // reached from the admin menu (/cms/settings/<page>), which opens the store's own document
      hidden: true,
    },
    access: { read: readFor(min), readVersions: readFor(min), create: createFor(min), update: writeFor(min), delete: platformAdmins },
    versions,
    hooks: { beforeValidate: [assignStore()], afterChange },
    fields: [storeField({ unique: true }), ...global.fields],
  };
}

/**
 * A store's settings for one page. The store's own document; for the default store without one yet, the original
 * global; otherwise an empty object (callers fill in their defaults, exactly as they did for an empty global).
 */
export async function getStoreSettings<T = Record<string, unknown>>(payload: Payload, globalSlug: GlobalSlug | StoreSettingKey, storeId: number | null | undefined, opts: { req?: PayloadRequest; depth?: number } = {}): Promise<T> {
  const depth = opts.depth ?? 0;
  const defaultStoreId = await getDefaultStoreId(payload);
  const store = storeId ?? defaultStoreId;
  if (store != null) {
    const res = await payload
      .find({ collection: storeSettingsSlug(String(globalSlug)), where: { store: { equals: store } }, limit: 1, depth, overrideAccess: true, ...(opts.req ? { req: opts.req } : {}) })
      .catch(() => null);
    if (res?.docs[0]) return res.docs[0] as T;
  }
  if (store == null || store === defaultStoreId)
    return (await payload.findGlobal({ slug: globalSlug as GlobalSlug, depth, overrideAccess: true, ...(opts.req ? { req: opts.req } : {}) }).catch(() => ({}))) as T;
  return {} as T;
}

/** Makes sure a store has its own document for every settings page (called when a store is created). */
export async function ensureStoreSettings(payload: Payload, storeId: number, initial: Partial<Record<StoreSettingKey, Record<string, unknown>>> = {}, req?: PayloadRequest) {
  for (const slug of Object.keys(STORE_SETTING_ROLES)) {
    const collection = storeSettingsSlug(slug);
    const found = await payload.find({ collection, where: { store: { equals: storeId } }, limit: 1, depth: 0, overrideAccess: true, ...(req ? { req } : {}) });
    if (found.docs.length) continue;
    await payload.create({ collection, data: { ...(initial[slug] ?? {}), store: storeId } as never, overrideAccess: true, context: { storeId }, ...(req ? { req } : {}) });
  }
}
