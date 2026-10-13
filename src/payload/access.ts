import type { Access, FieldAccess, Where } from "payload";

/**
 * Roles (stored on the `users` collection):
 *  - owner    – everything, incl. cost/profit, settings, staff management
 *  - manager  – everything except cost/profit fields and role changes
 *  - staff    – catalog + orders + customers; no settings, no cost/profit, no deletes of core data
 *  - customer – storefront account only; can read/update their own profile and see their own orders
 */
export type Role = "owner" | "manager" | "staff" | "customer";
export type PlatformRole = "platform_admin" | "merchant_owner" | "merchant_manager" | "merchant_staff" | "customer";
export const STAFF_ROLES: Role[] = ["owner", "manager", "staff"];

export type StoreMemberRole = "store_owner" | "store_manager" | "store_staff" | "customer";

type StoreRef = string | number | { id?: string | number | null } | null | undefined;

type AnyUser = {
  id: string | number;
  role?: Role | null;
  platformRole?: PlatformRole | null;
  currentStore?: StoreRef;
  stores?: StoreRef[] | null;
  collection?: string;
  twoFactor?: { enabled?: boolean | null } | null;
} | null | undefined;

const normalizeStoreId = (value: StoreRef): string | number | null => {
  if (typeof value === "string" || typeof value === "number") return value;
  if (value && typeof value === "object" && "id" in value && (typeof value.id === "string" || typeof value.id === "number")) return value.id;
  return null;
};

export const getUserStoreIds = (user: AnyUser): Array<string | number> => {
  if (!user) return [];
  const ids = [user.currentStore, ...(Array.isArray(user.stores) ? user.stores : [])].map(normalizeStoreId).filter((v): v is string | number => v !== null);
  return [...new Set(ids)];
};

const RANK: Record<Role, number> = { customer: 0, staff: 1, manager: 2, owner: 3 };
export const roleRank = (role: unknown) => RANK[role as Role] ?? 0;

const merchantAdminRoles = new Set(["merchant_owner", "merchant_manager", "merchant_staff"]);

/**
 * Owners and managers must have 2-step verification on (unless TWO_FACTOR_REQUIRED=false, emergencies only).
 * Until they do, the SERVER treats them as having no admin rights at all – they can only sign in and set it up
 * (/cms/security uses the /2fa endpoints, which check the role directly). The pop-up in /cms is just the guide.
 */
export const needsTwoFactorSetup = (user: AnyUser) =>
  !!user &&
  ((user.role === "owner" || user.role === "manager") || merchantAdminRoles.has(user.platformRole ?? "")) &&
  process.env.TWO_FACTOR_REQUIRED !== "false" &&
  !user.twoFactor?.enabled;

/** Universal SaaS role helpers for the platform and a merchant's store-level roles. */
export const isPlatformAdmin = (user: AnyUser) => !!user && (user.role === "owner" || user.platformRole === "platform_admin");
export const isStoreOwner = (user: AnyUser) => !!user && (user.role === "owner" || user.platformRole === "merchant_owner");
export const isStoreManager = (user: AnyUser) => !!user && (user.role === "manager" || user.platformRole === "merchant_manager");
export const isStoreStaff = (user: AnyUser) => !!user && (user.role === "staff" || user.platformRole === "merchant_staff");

/** May open /cms at all (incl. owners/managers who still have to set up 2-step). */
export const canOpenAdmin = (user: AnyUser) => !!user && (STAFF_ROLES.includes(user.role as Role) || merchantAdminRoles.has(user.platformRole ?? ""));
export const isStaffUser = (user: AnyUser) => canOpenAdmin(user) && !needsTwoFactorSetup(user);
export const isManagerUser = (user: AnyUser) =>
  isStaffUser(user) && ((user!.role === "owner" || user!.role === "manager") || user!.platformRole === "merchant_manager" || user!.platformRole === "merchant_owner");
export const isOwnerUser = (user: AnyUser) => isStaffUser(user) && (user!.role === "owner" || user!.platformRole === "merchant_owner");

export const storeScopedAccess =
  (field = "store"): Access =>
  ({ req }) => {
    const u = req.user as AnyUser;
    if (!u) return false;
    if (isPlatformAdmin(u)) return true;
    const allowedStoreIds = getUserStoreIds(u);
    if (allowedStoreIds.length === 0) return STAFF_ROLES.includes(u.role as Role) ? true : false;
    return { [field]: { in: allowedStoreIds } } satisfies Where;
  };

export const storeWriteAccess = storeScopedAccess("store");

// Collection access
export const anyone: Access = () => true;
export const nobody: Access = () => false;
export const staff: Access = ({ req }) => isStaffUser(req.user as AnyUser);
export const managers: Access = ({ req }) => isManagerUser(req.user as AnyUser);
export const owners: Access = ({ req }) => isOwnerUser(req.user as AnyUser);

/** Staff see everything; everyone else only documents whose `status` is active. */
export const activeOrStaff: Access = ({ req }) => {
  if (isStaffUser(req.user as AnyUser)) return true;
  // on the store AND published (a new product saved only as a draft stays out of sight)
  const where: Where = { and: [{ status: { equals: "active" } }, { _status: { not_equals: "draft" } }] };
  return where;
};

/** Staff see everything; a signed-in customer only their own documents (via the `user` relationship). */
export const staffOrOwnDocs =
  (field = "user"): Access =>
  ({ req }) => {
    const u = req.user as AnyUser;
    if (isStaffUser(u)) return true;
    if (u) return { [field]: { equals: u.id } } satisfies Where;
    return false;
  };

/** Users collection: staff read all, a customer only themselves. */
export const staffOrSelf: Access = ({ req }) => {
  const u = req.user as AnyUser;
  if (isStaffUser(u)) return true;
  if (u) return { id: { equals: u.id } } satisfies Where;
  return false;
};

/**
 * Users collection – who may CHANGE an account: yourself, or someone of a LOWER role.
 * Owner: everyone. Manager: staff and customers. Staff: customers. Customer: only themselves.
 * (So nobody can change the email or password of someone above them – no account takeover.)
 */
export const editableUsers: Access = ({ req }) => {
  const u = req.user as AnyUser;
  if (!u) return false;
  if (isOwnerUser(u)) return true;
  const self = { id: { equals: u.id } };
  if (isManagerUser(u)) return { or: [self, { role: { in: ["staff", "customer"] } }] } satisfies Where;
  if (isStaffUser(u)) return { or: [self, { role: { equals: "customer" } }] } satisfies Where;
  return self satisfies Where;
};

/** Users collection – deleting: managers may delete staff and customers; only an owner may delete a manager or owner. */
export const deletableUsers: Access = ({ req }) => {
  const u = req.user as AnyUser;
  if (isOwnerUser(u)) return true;
  if (isManagerUser(u)) return { role: { in: ["staff", "customer"] } } satisfies Where;
  return false;
};

// Field access
export const ownerField: FieldAccess = ({ req }) => isOwnerUser(req.user as AnyUser);
export const staffField: FieldAccess = ({ req }) => isStaffUser(req.user as AnyUser);
export const managerField: FieldAccess = ({ req }) => isManagerUser(req.user as AnyUser);
export const noField: FieldAccess = () => false;
