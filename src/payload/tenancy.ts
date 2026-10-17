import type { Access, CollectionBeforeValidateHook, FieldAccess, Payload, PayloadRequest, RelationshipField, Where } from "payload";
import { userError } from "./errors";

/**
 * Multi-store access (ShopEngine).
 *
 * Two kinds of authority, never mixed:
 *  - Platform admin: the legacy `owner` role or `platformRole = "platform_admin"` (both need 2-step). Sees every store.
 *  - Store roles: an ACTIVE row in `store-memberships` (store_owner > store_manager > store_staff). Legacy `manager` /
 *    `staff` accounts are the default store's team. Owners and managers need 2-step before their role counts.
 *
 * A person always works in ONE store at a time (`users.currentStore`, switched in /cms); every list and every write is
 * limited to it. A platform admin with no current store sees all stores. Nothing a user can edit about themselves
 * grants access – memberships are written only by the server (onboarding, invitations) or a platform admin.
 */

export type StoreRole = "store_owner" | "store_manager" | "store_staff";
export const STORE_ROLES: StoreRole[] = ["store_owner", "store_manager", "store_staff"];
const RANK: Record<StoreRole, number> = { store_staff: 1, store_manager: 2, store_owner: 3 };
export const storeRoleRank = (role: unknown) => RANK[role as StoreRole] ?? 0;

export type TenantUser = {
  id: number | string;
  role?: string | null;
  platformRole?: string | null;
  currentStore?: unknown;
  twoFactor?: { enabled?: boolean | null } | null;
  collection?: string;
  /** a platform admin seeing one store as one of its roles (support) – see /cms-api/platform/view-as */
  supportView?: { store?: number; role?: string; until?: string; reason?: string } | null;
};

export type Tenant = {
  userId: number | null;
  platformAdmin: boolean;
  /** stores the person works in, with the role that counts (owners/managers without 2-step are left out) */
  roles: Map<number, StoreRole>;
  /** the store being worked in; null = a platform admin looking at every store */
  activeStoreId: number | null;
  defaultStoreId: number | null;
  /** stores whose plan lapsed or that a platform admin suspended – readable, not writable */
  readOnly: Set<number>;
  /** support: a platform admin currently seeing a store as one of its roles (their own rights are set aside meanwhile) */
  viewingAs?: { storeId: number; role: StoreRole; until: string };
};

/** A relationship value (id, "12", { id }) as a number, or null. */
export const storeIdOf = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const raw = typeof v === "object" ? (v as { id?: unknown }).id : v;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const twoFactorOk = (u: TenantUser) => process.env.TWO_FACTOR_REQUIRED === "false" || Boolean(u.twoFactor?.enabled);

/** Platform admin: the legacy Owner, or platformRole platform_admin – with 2-step on. */
export const isPlatformAdminUser = (u: TenantUser | null | undefined) =>
  !!u && (u.collection ?? "users") === "users" && (u.role === "owner" || u.platformRole === "platform_admin") && twoFactorOk(u);

/* ───────────── default store ───────────── */

let defaultStore: { id: number | null; at: number } | null = null;

/** The store that owns everything from before multi-store (the original shop). Cached for a minute. */
export async function getDefaultStoreId(payload: Payload): Promise<number | null> {
  if (defaultStore && Date.now() - defaultStore.at < 60_000) return defaultStore.id;
  try {
    const res = await payload.find({ collection: "stores" as never, where: { isDefault: { equals: true } }, limit: 1, depth: 0, overrideAccess: true, sort: "id" });
    const id = storeIdOf(res.docs[0]);
    defaultStore = { id, at: Date.now() };
    return id;
  } catch {
    return defaultStore?.id ?? null;
  }
}
export const forgetDefaultStore = () => {
  defaultStore = null;
};

/* ───────────── who may do what ───────────── */

/** Works out a person's platform / store authority (no caching – see getTenant for the per-request version). */
export async function resolveTenant(payload: Payload, user: TenantUser | null | undefined, req?: PayloadRequest): Promise<Tenant> {
  const defaultStoreId = await getDefaultStoreId(payload);
  const empty: Tenant = { userId: null, platformAdmin: false, roles: new Map(), activeStoreId: null, defaultStoreId, readOnly: new Set() };
  if (!user || (user.collection ?? "users") !== "users") return empty;
  const userId = storeIdOf(user.id);
  const platformAdmin = isPlatformAdminUser(user);
  const roles = new Map<number, StoreRole>();
  const tfa = twoFactorOk(user);

  const memberships = await payload
    .find({ collection: "store-memberships" as never, where: { and: [{ user: { equals: user.id } }, { status: { equals: "active" } }] }, limit: 200, depth: 0, overrideAccess: true, ...(req ? { req } : {}) })
    .catch(() => ({ docs: [] as unknown[] }));
  for (const m of memberships.docs as { store?: unknown; role?: string }[]) {
    const store = storeIdOf(m.store);
    const role = m.role as StoreRole;
    if (store == null || !RANK[role]) continue;
    if (role !== "store_staff" && !tfa) continue; // owners and managers count only with 2-step on
    if (storeRoleRank(role) > storeRoleRank(roles.get(store))) roles.set(store, role);
  }
  // the original shop's team (accounts from before multi-store)
  if (defaultStoreId != null) {
    const legacy: StoreRole | null = user.role === "owner" ? "store_owner" : user.role === "manager" ? "store_manager" : user.role === "staff" ? "store_staff" : null;
    const counts = legacy === "store_staff" || (legacy != null && tfa);
    if (legacy && counts && storeRoleRank(legacy) > storeRoleRank(roles.get(defaultStoreId))) roles.set(defaultStoreId, legacy);
  }

  const readOnly = new Set<number>();
  if (roles.size && !platformAdmin) {
    const stores = await payload
      .find({ collection: "stores" as never, where: { id: { in: [...roles.keys()] } }, limit: 200, depth: 0, overrideAccess: true, ...(req ? { req } : {}) })
      .catch(() => ({ docs: [] as unknown[] }));
    for (const s of stores.docs as { id: number; status?: string; subscriptionStatus?: string }[])
      if (["suspended", "closed"].includes(String(s.status)) || ["expired", "suspended"].includes(String(s.subscriptionStatus))) readOnly.add(Number(s.id));
  }

  // Support "view as": for a while, a platform admin has exactly that role in that one store – nothing more
  const sv = user.supportView;
  const svStore = storeIdOf(sv?.store);
  if (platformAdmin && sv && svStore != null && RANK[sv.role as StoreRole] && Date.parse(String(sv.until)) > Date.now()) {
    const role = sv.role as StoreRole;
    const store = (await payload.findByID({ collection: "stores" as never, id: svStore, depth: 0, overrideAccess: true, ...(req ? { req } : {}) }).catch(() => null)) as { status?: string; subscriptionStatus?: string } | null;
    const ro = new Set<number>(store && (["suspended", "closed"].includes(String(store.status)) || ["expired", "suspended"].includes(String(store.subscriptionStatus))) ? [svStore] : []);
    return { userId, platformAdmin: false, roles: new Map([[svStore, role]]), activeStoreId: svStore, defaultStoreId, readOnly: ro, viewingAs: { storeId: svStore, role, until: String(sv.until) } };
  }

  const current = storeIdOf(user.currentStore);
  const activeStoreId = platformAdmin ? current : current != null && roles.has(current) ? current : ([...roles.keys()].sort((a, b) => a - b)[0] ?? null);
  return { userId, platformAdmin, roles, activeStoreId, defaultStoreId, readOnly };
}

const KEY = "__shopengineTenant";

/** The signed-in person's authority for this request (worked out once per request). */
export async function getTenant(req: PayloadRequest): Promise<Tenant> {
  const ctx = (req.context ??= {}) as Record<string, unknown>;
  const cached = ctx[KEY] as { userId: unknown; tenant: Tenant } | undefined;
  const uid = (req.user as TenantUser | null)?.id ?? null;
  if (cached && cached.userId === uid) return cached.tenant;
  const tenant = await resolveTenant(req.payload, req.user as TenantUser | null, req);
  ctx[KEY] = { userId: uid, tenant };
  return tenant;
}

export const roleIn = (t: Tenant, storeId: number | null | undefined): StoreRole | null => (storeId == null ? null : (t.roles.get(storeId) ?? null));
export const hasStoreRole = (t: Tenant, storeId: number | null | undefined, min: StoreRole) => t.platformAdmin || storeRoleRank(roleIn(t, storeId)) >= RANK[min];
export const canWriteStore = (t: Tenant, storeId: number | null | undefined, min: StoreRole) => t.platformAdmin || (hasStoreRole(t, storeId, min) && !t.readOnly.has(Number(storeId)));
/** Has /cms rights right now: a platform admin or anyone on a store team (2-step done where needed). */
export const isAdminCapable = (t: Tenant) => t.platformAdmin || t.roles.size > 0;

/**
 * May SIGN IN to /cms (2-step setup still pending is fine – the account just gets no rights until it's on):
 * the original shop's team, a platform admin, or anyone with an active store membership. Shoppers can't.
 * `needsTwoFactor` = this account's sign-in must use 2-step (owner / manager anywhere, platform admin).
 */
export async function adminSeat(payload: Payload, user: TenantUser | null | undefined, req?: PayloadRequest): Promise<{ allowed: boolean; needsTwoFactor: boolean }> {
  if (!user) return { allowed: false, needsTwoFactor: false };
  const legacy = ["owner", "manager", "staff"].includes(String(user.role));
  const platform = user.platformRole === "platform_admin";
  const res = await payload
    .find({ collection: "store-memberships" as never, where: { and: [{ user: { equals: user.id } }, { status: { equals: "active" } }] }, limit: 200, depth: 0, overrideAccess: true, ...(req ? { req } : {}) })
    .catch(() => ({ docs: [] as unknown[] }));
  const roles = (res.docs as { role?: string }[]).map((m) => String(m.role));
  const needsTwoFactor = platform || user.role === "owner" || user.role === "manager" || roles.some((r) => r === "store_owner" || r === "store_manager");
  return { allowed: legacy || platform || roles.length > 0, needsTwoFactor };
}

/** Rows of the store being worked in, when the person's role there is at least `min` (true = everything). */
export function storeScope(t: Tenant, min: StoreRole, field = "store"): Where | boolean {
  if (t.platformAdmin) return t.activeStoreId == null ? true : { [field]: { equals: t.activeStoreId } };
  const s = t.activeStoreId;
  return s != null && storeRoleRank(t.roles.get(s)) >= RANK[min] ? { [field]: { equals: s } } : false;
}

const combine = (scope: Where | boolean, extra: (Where | undefined)[]): Where | boolean => {
  if (scope === true) return true;
  const rest = extra.filter((w): w is Where => Boolean(w));
  if (!rest.length) return scope;
  const all = scope ? [scope, ...rest] : rest;
  return all.length === 1 ? all[0] : { or: all };
};

type ReadOptions = { field?: string; public?: Where; self?: string };

/** Read access: the active store's rows for its team (+ public rows / the person's own rows, when given). */
export const readFor =
  (min: StoreRole, opts: ReadOptions = {}): Access =>
  async ({ req }) => {
    const t = await getTenant(req);
    return combine(storeScope(t, min, opts.field), [opts.public, opts.self && t.userId != null ? { [opts.self]: { equals: t.userId } } : undefined]);
  };

/** Update / delete access: the active store's rows, only while that store is writable. */
export const writeFor =
  (min: StoreRole, field = "store"): Access =>
  async ({ req }) => {
    const t = await getTenant(req);
    if (!t.platformAdmin && t.activeStoreId != null && t.readOnly.has(t.activeStoreId)) return false;
    return storeScope(t, min, field);
  };

/** Create access: the target store (given or the active one) must be one where the person has at least `min`. */
export const createFor =
  (min: StoreRole, field = "store"): Access =>
  async ({ req, data }) => {
    const t = await getTenant(req);
    if (t.platformAdmin) return true;
    const target = storeIdOf((data as Record<string, unknown> | undefined)?.[field]) ?? t.activeStoreId;
    return canWriteStore(t, target, min);
  };

/** The three above for a typical store-owned collection. */
export const storeAccess = (r: StoreRole, c: StoreRole = r, u: StoreRole = c, d: StoreRole = "store_manager") => ({
  read: readFor(r),
  create: createFor(c),
  update: writeFor(u),
  delete: writeFor(d),
});

/** Platform admins only. */
export const platformAdmins: Access = async ({ req }) => (await getTenant(req)).platformAdmin;
export const platformAdminField: FieldAccess = async ({ req }) => (await getTenant(req)).platformAdmin;

/** Field access by role in the document's store (or, while creating, the store being worked in). */
export const storeRoleField =
  (min: StoreRole): FieldAccess =>
  async ({ req, doc, data }) => {
    if (!req.user) return false;
    const t = await getTenant(req);
    if (t.platformAdmin) return true;
    const store = storeIdOf((doc as Record<string, unknown> | undefined)?.store) ?? storeIdOf((data as Record<string, unknown> | undefined)?.store) ?? t.activeStoreId;
    return hasStoreRole(t, store, min);
  };

/**
 * Read access for catalogue-like collections: shoppers and the public read everything public (`publicWhere`, or all);
 * a store's team (in /cms) reads only its own store's rows, drafts included.
 */
export const publicOrStore =
  (min: StoreRole, publicWhere?: Where): Access =>
  async ({ req }) => {
    if (!req.user) return publicWhere ?? true;
    const t = await getTenant(req);
    if (!isAdminCapable(t)) return publicWhere ?? true;
    const scope = storeScope(t, min);
    if (scope === true) return true;
    return scope ? scope : (publicWhere ?? false);
  };

/** Settings of the original shop (the globals): platform admins and the default store's team. */
export const defaultStoreAccess =
  (min: StoreRole): Access =>
  async ({ req }) => {
    const t = await getTenant(req);
    return t.platformAdmin || (hasStoreRole(t, t.defaultStoreId, min) && t.activeStoreId === t.defaultStoreId);
  };

/* ───────────── the `store` field and its hook ───────────── */

/** Which store a new document belongs to – set by the server, never trusted from a form. */
export const assignStore =
  (field = "store"): CollectionBeforeValidateHook =>
  async ({ data, originalDoc, operation, req, context }) => {
    if (!data) return data;
    if (context?.migrating) return data;
    // ShopEngine's own inbox (the marketing site's contact form): no store – only platform admins see it
    if (operation === "create" && context?.platformInbox && !req.user) {
      data[field] = null;
      return data;
    }
    const t = req.user ? await getTenant(req) : null;
    if (operation === "create") {
      let store = storeIdOf(data[field]) ?? storeIdOf(context?.storeId);
      if (store == null && t) store = t.activeStoreId;
      if (store == null) store = await getDefaultStoreId(req.payload);
      if (store == null) throw userError("Choose a store first (store switcher at the top of /cms).", 400);
      // a person creating something (admin, REST) must be on that store's team; the website's own code has no user
      if (t && !context?.storefront && !t.platformAdmin && !canWriteStore(t, store, "store_staff")) throw userError("You can't add records to that store.", 403);
      data[field] = store;
      return data;
    }
    // update: the store never changes (except by a platform admin)
    const before = storeIdOf(originalDoc?.[field]);
    if (data[field] !== undefined && storeIdOf(data[field]) !== before) {
      if (!t?.platformAdmin || storeIdOf(data[field]) == null) data[field] = before;
    }
    if (before == null && storeIdOf(data[field]) == null) data[field] = (t?.activeStoreId ?? (await getDefaultStoreId(req.payload))) || undefined;
    return data;
  };

/** The `store` relationship every store-owned collection carries (shown to platform admins only). */
export const storeField = (overrides: Partial<RelationshipField> = {}): RelationshipField =>
  ({
    name: "store",
    type: "relationship",
    relationTo: "stores",
    index: true,
    label: "Store",
    access: { update: platformAdminField },
    admin: {
      position: "sidebar",
      description: "The store this belongs to (set automatically).",
      condition: (_data, _sibling, { user }) => isPlatformAdminUser(user as TenantUser | null),
    },
    ...overrides,
  }) as RelationshipField;

/** Relationship choices limited to the same store as the document being edited (enforced by Payload on save too). */
export const sameStore = ({ data }: { data?: Record<string, unknown> }): Where | true => {
  const s = storeIdOf(data?.store);
  return s == null ? true : { store: { equals: s } };
};
