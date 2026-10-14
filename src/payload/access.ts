import type { Access, FieldAccess, PayloadRequest, Where } from "payload";
import { getTenant, hasStoreRole, isAdminCapable, isPlatformAdminUser, storeIdOf, type StoreRole, type TenantUser } from "./tenancy";

/**
 * Roles.
 *  - users.role (legacy, the original shop): owner = platform admin; manager / staff = the default store's team;
 *    customer = everybody else (shoppers AND merchants – a merchant's authority comes from store memberships).
 *  - users.platformRole: "platform_admin" = runs ShopEngine. Only a platform admin can set it.
 *  - store-memberships: store_owner / store_manager / store_staff per store (see tenancy.ts).
 */
export type Role = "owner" | "manager" | "staff" | "customer";
export type PlatformRole = "platform_admin" | "merchant_owner" | "merchant_manager" | "merchant_staff" | "customer";
export const STAFF_ROLES: Role[] = ["owner", "manager", "staff"];
export type { StoreRole, Tenant } from "./tenancy";

const RANK: Record<Role, number> = { customer: 0, staff: 1, manager: 2, owner: 3 };
export const roleRank = (role: unknown) => RANK[role as Role] ?? 0;

/**
 * Owners, managers and platform admins must have 2-step verification on (unless TWO_FACTOR_REQUIRED=false, emergencies
 * only). Until they do, their role grants nothing – they can only sign in and set it up (/cms/security).
 */
export const needsTwoFactorSetup = (user: TenantUser | null | undefined) =>
  !!user && (user.role === "owner" || user.role === "manager" || user.platformRole === "platform_admin") && process.env.TWO_FACTOR_REQUIRED !== "false" && !user.twoFactor?.enabled;

export const isPlatformAdmin = (user: TenantUser | null | undefined) => isPlatformAdminUser(user);

/** May open /cms at all (incl. people who still have to set up 2-step): checked against store memberships. */
export const canOpenAdminReq = async (req: PayloadRequest) => {
  const u = req.user as TenantUser | null;
  if (!u) return false;
  if (STAFF_ROLES.includes(u.role as Role) || u.platformRole === "platform_admin") return true;
  return isAdminCapable(await getTenant(req));
};

// Collection access
export const anyone: Access = () => true;
/** Anyone who may open /cms (store teams and platform admins). */
export const adminUsers: Access = ({ req }) => canOpenAdminReq(req);
export const nobody: Access = () => false;
export const noField: FieldAccess = () => false;

/** A signed-in person's own documents only (via a `user` relationship); never anybody else's. */
export const ownDocs =
  (field = "user"): Access =>
  ({ req }) =>
    req.user ? ({ [field]: { equals: req.user.id } } satisfies Where) : false;

/** Members of the store being worked in (for listing its team): ids from store-memberships. */
async function teamUserIds(req: PayloadRequest, storeId: number): Promise<Array<number | string>> {
  const res = await req.payload.find({ collection: "store-memberships" as never, where: { store: { equals: storeId } }, limit: 500, depth: 0, overrideAccess: true, req });
  return (res.docs as { user?: unknown }[]).map((m) => storeIdOf(m.user)).filter((v): v is number => v != null);
}

/**
 * Users collection – reading: platform admins everyone; a store's team the customers of the store they work in and its
 * team; everybody else only themselves.
 */
export const usersRead: Access = async ({ req }) => {
  const u = req.user as TenantUser | null;
  if (!u) return false;
  const t = await getTenant(req);
  if (t.platformAdmin) return true;
  const self: Where = { id: { equals: u.id } };
  const store = t.activeStoreId;
  if (store == null || !hasStoreRole(t, store, "store_staff")) return self;
  const or: Where[] = [self, { customerOf: { in: [store] } }];
  const team = await teamUserIds(req, store);
  if (team.length) or.push({ id: { in: team } });
  if (store === t.defaultStoreId) or.push({ role: { in: STAFF_ROLES } });
  return { or };
};

/**
 * Users collection – changing an account. An account is shared by every store it shops at, so: platform admins anyone;
 * the original shop's team (legacy roles) the accounts below their role that belong to that shop (rank rules and the
 * email/password guard in Users.ts); everybody else – merchants included – only themselves.
 */
export const usersUpdate: Access = async ({ req }) => {
  const u = req.user as TenantUser | null;
  if (!u) return false;
  const t = await getTenant(req);
  if (t.platformAdmin) return true;
  const self: Where = { id: { equals: u.id } };
  const home = t.defaultStoreId;
  if (home == null || t.activeStoreId !== home || !STAFF_ROLES.includes(u.role as Role)) return self;
  const customers: Where = { and: [{ role: { equals: "customer" } }, { customerOf: { in: [home] } }] };
  if (u.role === "manager" && hasStoreRole(t, home, "store_manager")) return { or: [self, { role: { equals: "staff" } }, customers] };
  if (hasStoreRole(t, home, "store_staff")) return { or: [self, customers] };
  return self;
};

/** Users collection – deleting an account (it may shop at other stores too): platform admins only. */
export const usersDelete: Access = async ({ req }) => (await getTenant(req)).platformAdmin;

/** Users collection – creating accounts in /cms: platform admins and the default store's managers (storefront sign-ups use the Local API). */
export const usersCreate: Access = async ({ req }) => {
  const t = await getTenant(req);
  return t.platformAdmin || (t.activeStoreId === t.defaultStoreId && hasStoreRole(t, t.defaultStoreId, "store_manager"));
};

/** Field access: the original shop's team (platform admins included) – for account-wide fields like tags, notes, blocked. */
export const defaultStoreTeamField =
  (min: StoreRole): FieldAccess =>
  async ({ req }) => {
    const t = await getTenant(req);
    return t.platformAdmin || (t.activeStoreId === t.defaultStoreId && hasStoreRole(t, t.defaultStoreId, min));
  };

export { platformAdminField, platformAdmins, storeRoleField, readFor, writeFor, createFor, storeAccess, defaultStoreAccess, getTenant } from "./tenancy";
