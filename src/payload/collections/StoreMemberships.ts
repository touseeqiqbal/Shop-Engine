import { createHash, randomBytes } from "node:crypto";
import type { CollectionAfterChangeHook, CollectionBeforeChangeHook, CollectionBeforeDeleteHook, CollectionConfig, Where } from "payload";
import { dbName } from "../fields";
import { userError } from "../errors";
import { getTenant, hasStoreRole, platformAdminField, storeIdOf, storeRoleRank, type StoreRole } from "../tenancy";

/**
 * Who works in which store, and as what. This is the ONLY source of store rights (see tenancy.ts):
 * suspending or deleting a membership takes effect on the person's next request.
 *  - store_owner: everything in the store incl. billing, payments and the team (one per store; changed by a platform admin)
 *  - store_manager: everything except billing / ownership; can invite staff
 *  - store_staff: day-to-day catalog and orders; no settings, no money settings, no deletes of core data
 */

export const INVITE_DAYS = 7;
export const hashInviteToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Managers and owners manage their store's team – never above their own role, never the owner.
 * People join only by accepting an emailed invitation (Account → Stores): the team can't attach an account directly,
 * nor mark an invitation accepted. The plan's team size limit applies.
 */
const guardTeamChange: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req, context }) => {
  if (context?.system) return data;
  const t = await getTenant(req);
  const store = storeIdOf(data.store ?? originalDoc?.store);
  // a suspended member coming back takes a seat again: checked like a new one (suspending, inviting more and then
  // re-activating used to grow the team past the plan)
  const reactivating = operation === "update" && originalDoc?.status === "suspended" && data.status !== undefined && data.status !== "suspended";
  if (reactivating && !t.platformAdmin) {
    const { storeLimits } = await import("../../lib/billing");
    const limits = await storeLimits(req.payload, store);
    if (limits.maxStaffMembers > 0) {
      const used = await req.payload.count({ collection: "store-memberships", where: { and: [{ store: { equals: store } }, { status: { not_equals: "suspended" } }] }, overrideAccess: true, req });
      if (used.totalDocs >= limits.maxStaffMembers) throw userError(`Your plan allows ${limits.maxStaffMembers} team members. Upgrade the plan (Account → Stores) to add more.`, 403);
    }
  }
  if (operation === "create") {
    const email = String(data.email ?? "").trim().toLowerCase();
    if (!t.platformAdmin || !data.user) {
      if (!email) throw userError("Enter the email address of the person to invite.", 400);
      const dup = await req.payload.count({ collection: "store-memberships", where: { and: [{ store: { equals: store } }, { email: { equals: email } }, { status: { not_equals: "suspended" } }] }, overrideAccess: true, req });
      if (dup.totalDocs) throw userError("This person is already in the team or invited.", 400);
    }
    const { storeLimits } = await import("../../lib/billing");
    const limits = await storeLimits(req.payload, store);
    if (limits.maxStaffMembers > 0 && !t.platformAdmin) {
      const used = await req.payload.count({ collection: "store-memberships", where: { and: [{ store: { equals: store } }, { status: { not_equals: "suspended" } }] }, overrideAccess: true, req });
      if (used.totalDocs >= limits.maxStaffMembers) throw userError(`Your plan allows ${limits.maxStaffMembers} team members. Upgrade the plan (Account → Stores) to add more.`, 403);
    }
  }
  if (t.platformAdmin) return data;
  const myRank = storeRoleRank(t.roles.get(store ?? -1));
  if (!hasStoreRole(t, store, "store_manager") || t.readOnly.has(Number(store))) throw userError("Only the store's owner or a manager can change its team.", 403);
  const role = String(data.role ?? originalDoc?.role) as StoreRole;
  if (role === "store_owner" || originalDoc?.role === "store_owner") throw userError("The store owner can only be changed by ShopEngine support.", 403);
  if (storeRoleRank(role) >= myRank) throw userError("You can only give roles below your own.", 403);
  if (operation === "create") {
    data.user = null;
    data.status = "invited";
  }
  if (operation === "update") {
    if (originalDoc && storeRoleRank(originalDoc.role) >= myRank) throw userError("You can't change someone at or above your own role.", 403);
    // who and where never change (invite someone else instead); only the invited person accepts an invitation
    data.store = originalDoc?.store;
    data.user = originalDoc?.user ?? null;
    data.email = originalDoc?.email;
    if (originalDoc?.status === "invited" && data.status === "active") throw userError("The invited person accepts the invitation themselves (the emailed link).", 400);
    if (!originalDoc?.user && data.status === "active") data.status = originalDoc?.status;
  }
  return data;
};

/** A new invitation gets a one-time token (only its hash is kept) and an expiry; the email is sent after saving. */
const issueInvite: CollectionBeforeChangeHook = async ({ data, operation, req, context }) => {
  if (operation !== "create" || data.status !== "invited" || !data.email) return data;
  const token = randomBytes(24).toString("base64url");
  data.inviteTokenHash = hashInviteToken(token);
  data.invitedAt = new Date().toISOString();
  data.inviteExpiresAt = new Date(Date.now() + INVITE_DAYS * 86400_000).toISOString();
  if (req.user && !data.invitedBy) data.invitedBy = req.user.id;
  context.inviteToken = token;
  return data;
};

const sendInvite: CollectionAfterChangeHook = async ({ doc, operation, req, context }) => {
  if (operation !== "create" || !context.inviteToken) return doc;
  const storeId = storeIdOf(doc.store);
  const store = (await req.payload.findByID({ collection: "stores", id: Number(storeId), depth: 0, overrideAccess: true, req }).catch(() => null)) as { name?: string } | null;
  const { queueNotification } = await import("../../lib/notify");
  const by = req.user as { name?: string; email?: string } | null;
  await queueNotification(
    req.payload,
    "store-invite",
    storeId,
    { email: doc.email, storeName: store?.name ?? "a store", role: doc.role, token: context.inviteToken, invitedBy: by?.name || by?.email || null },
    { req, dedupeKey: `store-invite:${doc.id}` },
  );
  return doc;
};

const guardTeamDelete: CollectionBeforeDeleteHook = async ({ id, req, context }) => {
  if (context?.system) return;
  const t = await getTenant(req);
  if (t.platformAdmin) return;
  const m = (await req.payload.findByID({ collection: "store-memberships", id, depth: 0, overrideAccess: true, req }).catch(() => null)) as { store?: unknown; role?: string; user?: unknown } | null;
  if (!m) return;
  const store = storeIdOf(m.store);
  if (m.role === "store_owner") throw userError("The store owner can't be removed.", 403);
  // leaving a store yourself is always allowed
  if (storeIdOf(m.user) === t.userId) return;
  if (!hasStoreRole(t, store, "store_manager") || storeRoleRank(m.role) >= storeRoleRank(t.roles.get(store ?? -1))) throw userError("You can't remove this person.", 403);
};

export const StoreMemberships: CollectionConfig = {
  slug: "store-memberships",
  dbName: dbName("store_memberships"),
  labels: { singular: "Team member", plural: "Store team" },
  admin: {
    useAsTitle: "email",
    defaultColumns: ["user", "email", "role", "status", "store"],
    group: "Platform",
    description: "Who works in this store. Add someone by their email: they get an invitation link and join once they accept it.",
  },
  indexes: [{ fields: ["store", "user"], unique: true }],
  access: {
    // platform admins: all; a store's managers/owner: its team; everyone: their own memberships
    read: async ({ req }) => {
      if (!req.user) return false;
      const t = await getTenant(req);
      if (t.platformAdmin) return t.activeStoreId == null ? true : { or: [{ store: { equals: t.activeStoreId } }, { user: { equals: req.user.id } }] };
      const own: Where = { user: { equals: req.user.id } };
      return t.activeStoreId != null && hasStoreRole(t, t.activeStoreId, "store_manager") ? { or: [own, { store: { equals: t.activeStoreId } }] } : own;
    },
    create: async ({ req, data }) => {
      const t = await getTenant(req);
      if (t.platformAdmin) return true;
      const store = storeIdOf((data as { store?: unknown } | undefined)?.store) ?? t.activeStoreId;
      return hasStoreRole(t, store, "store_manager") && !t.readOnly.has(Number(store));
    },
    update: async ({ req }) => {
      const t = await getTenant(req);
      if (t.platformAdmin) return true;
      return t.activeStoreId != null && hasStoreRole(t, t.activeStoreId, "store_manager") ? { store: { equals: t.activeStoreId } } : false;
    },
    delete: async ({ req }) => {
      if (!req.user) return false;
      const t = await getTenant(req);
      if (t.platformAdmin) return true;
      const own: Where = { user: { equals: req.user.id } };
      return t.activeStoreId != null && hasStoreRole(t, t.activeStoreId, "store_manager") ? { or: [own, { store: { equals: t.activeStoreId } }] } : own;
    },
  },
  hooks: {
    beforeValidate: [
      async ({ data, req, operation }) => {
        if (!data || operation !== "create") return data;
        if (data.email) data.email = String(data.email).trim().toLowerCase();
        if (data.store == null) data.store = (await getTenant(req)).activeStoreId;
        return data;
      },
    ],
    beforeChange: [guardTeamChange, issueInvite],
    afterChange: [sendInvite],
    beforeDelete: [guardTeamDelete],
  },
  fields: [
    { name: "store", type: "relationship", relationTo: "stores", required: true, index: true, access: { update: platformAdminField } },
    { name: "user", type: "relationship", relationTo: "users", index: true, admin: { description: "Filled in when the invitation is accepted." } },
    { name: "email", type: "email", index: true, admin: { description: "Who was invited." } },
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: "store_staff",
      options: [
        { label: "Owner", value: "store_owner" },
        { label: "Manager", value: "store_manager" },
        { label: "Staff", value: "store_staff" },
      ],
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "invited",
      index: true,
      options: [
        { label: "Invited", value: "invited" },
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
      ],
      admin: { description: "Suspended: keeps the record, removes all access at once." },
    },
    { name: "invitedBy", type: "relationship", relationTo: "users", access: { update: () => false }, admin: { readOnly: true } },
    // set by the invitation hook and the server (accepting) – never through /cms or the API (an expiry could be stretched)
    { type: "row", fields: [
      { name: "invitedAt", type: "date", access: { create: () => false, update: () => false }, admin: { width: "33%", readOnly: true } },
      { name: "inviteExpiresAt", type: "date", access: { create: () => false, update: () => false }, admin: { width: "33%", readOnly: true } },
      { name: "acceptedAt", type: "date", access: { create: () => false, update: () => false }, admin: { width: "34%", readOnly: true } },
    ] },
    // sha256 of the emailed invitation token – the token itself is never stored
    { name: "inviteTokenHash", type: "text", index: true, access: { read: () => false, create: () => false, update: () => false }, admin: { hidden: true } },
    { name: "notes", type: "textarea" },
  ],
  timestamps: true,
};
