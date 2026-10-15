import bcrypt from "bcryptjs";
import { ValidationError, type CollectionConfig } from "payload";
import { canOpenAdminReq, defaultStoreTeamField, noField, roleRank, usersCreate, usersDelete, usersRead, usersUpdate, type Role } from "../access";
import { getTenant, hasStoreRole, platformAdminField, storeIdOf } from "../tenancy";
import { dbName, legacyIdField } from "../fields";
import type { FieldHook } from "payload";

/** A store's team sees only its OWN store in a customer's store lists (never which other shops they use). */
const onlyOwnStore: FieldHook = async ({ value, req }) => {
  if (!Array.isArray(value) || !req.user) return value;
  const t = await getTenant(req);
  if (t.platformAdmin) return value;
  return t.activeStoreId == null ? [] : value.filter((v) => storeIdOf(v) === t.activeStoreId);
};
import { requireTwoFactor } from "../endpoints/two-factor";
import { resetPasswordEmail, type EmailBrand } from "@/lib/account-email";

/** The current store's name and address for customer emails (loaded on demand: this config also loads outside Next.js). */
async function storeEmailBrand(): Promise<EmailBrand> {
  const [{ getSiteInfo }, { currentOrigin }] = await Promise.all([import("@/lib/repo/site-content"), import("@/lib/tenant")]);
  const [info, origin] = await Promise.all([getSiteInfo(), currentOrigin()]);
  return { name: info.name, origin };
}

/**
 * Admins, staff AND storefront customers (role decides what they can do).
 *
 * Migration from Auth.js: customers keep their existing passwords. The old bcrypt hash is stored in
 * `legacyPasswordHash`; on the first login the password is checked against it and, if correct,
 * re-saved as a normal Payload password (then the legacy hash is cleared). Nobody needs a reset email
 * unless they forgot their password (Payload's forgot-password flow covers that).
 */
export const Users: CollectionConfig = {
  slug: "users",
  dbName: dbName("users"),
  labels: { singular: "User", plural: "Users & customers" },
  admin: {
    useAsTitle: "email",
    defaultColumns: ["name", "hasAccount", "phone", "createdAt"],
    listSearchableFields: ["email", "name", "phone"],
    group: "Customers & staff",
    components: {
      beforeListTable: [
        {
          path: "/payload/admin/ui/ListTabs#ListTabs",
          clientProps: {
            label: "Customer views",
            tabs: [
              { label: "All", where: "" },
              { label: "Customers", where: "where[role][equals]=customer" },
              { label: "With an account", where: "where[role][equals]=customer&where[hasAccount][equals]=true" },
              { label: "Guest orders only", where: "where[hasAccount][equals]=false" },
              { label: "Blocked", where: "where[blocked][equals]=true" },
              { label: "Staff", where: "where[role][in][0]=owner&where[role][in][1]=manager&where[role][in][2]=staff" },
            ],
            tip: "Every order makes a customer record (from its email). “Guest” = ordered without creating a password yet.",
          },
        },
      ],
    },
  },
  auth: {
    // /cms sign-in lasts 7 days (a stolen laptop / cookie is useful for less time)
    tokenExpiration: 60 * 60 * 24 * 7,
    // No account lock-out: anyone who knows an email could lock its owner out (incl. the platform admin). Wrong
    // passwords are limited per account AND network in src/proxy.ts instead; /cms also needs the 2-step code.
    maxLoginAttempts: 0,
    cookies: { sameSite: "Lax", secure: process.env.NODE_ENV === "production" },
    // Customers get a link to the storefront reset page, staff to /cms.
    forgotPassword: {
      // a customer who only ordered as a guest so far gets "finish creating your account" wording
      generateEmailSubject: (args) => ((args?.user as { hasAccount?: boolean } | undefined)?.hasAccount === false ? "Finish creating your account" : "Reset your password"),
      generateEmailHTML: async (args) => {
        const u = args?.user as { role?: string; hasAccount?: boolean } | undefined;
        return resetPasswordEmail(args?.token ?? "", u?.role, u?.hasAccount === false, await storeEmailBrand()).html;
      },
    },
  },
  access: {
    // owners/managers without 2-step can open /cms only to set it up – every collection refuses them until then
    admin: ({ req }) => canOpenAdminReq(req),
    read: usersRead,
    create: usersCreate, // storefront sign-ups use the Local API with overrideAccess
    update: usersUpdate,
    delete: usersDelete,
    unlock: usersCreate,
  },
  hooks: {
    beforeLogin: [requireTwoFactor],
    beforeOperation: [
      // Lazy password migration from the previous bcrypt hashes.
      async ({ operation, args, req }) => {
        if (operation !== "login") return args;
        const email = String(args?.data?.email ?? "").toLowerCase().trim();
        const password = String(args?.data?.password ?? "");
        if (!email || !password) return args;
        const found = await req.payload.find({
          collection: "users",
          where: { email: { equals: email } },
          limit: 1,
          showHiddenFields: true,
          overrideAccess: true,
          req,
        });
        const user = found.docs[0] as unknown as { id: string | number; legacyPasswordHash?: string | null } | undefined;
        if (user?.legacyPasswordHash && (await bcrypt.compare(password, user.legacyPasswordHash))) {
          await req.payload.update({
            collection: "users",
            id: user.id,
            data: { password, legacyPasswordHash: null } as never,
            overrideAccess: true,
            context: { legacyUpgrade: true },
            req,
          });
        }
        return args;
      },
    ],
    beforeChange: [
      // Roles: nobody can give a role at or above their own, or change someone at or above them (owner excepted).
      async ({ data, originalDoc, operation, req, context }) => {
        if (context?.migrating || context?.legacyUpgrade || context?.twoFactorUpdate || !req.user) return data;
        const me = req.user as { id?: unknown; role?: string };
        const t = await getTenant(req);
        if (t.platformAdmin) return data;
        const isSelf = operation === "update" && originalDoc?.id === me.id;
        // an account is shared by every store it shops at: only its owner (or a platform admin) changes how it signs in
        const emailChanged = typeof data.email === "string" && originalDoc?.email && data.email.toLowerCase() !== String(originalDoc.email).toLowerCase();
        if (operation === "update" && !isSelf && (emailChanged || (typeof data.password === "string" && data.password)))
          throw new ValidationError({ errors: [{ path: "email", message: "Only the customer can change their email or password (send them a password-reset link instead)." }] });
        // switching store: only to a store this person works in
        if (data.currentStore !== undefined && storeIdOf(data.currentStore) !== storeIdOf(originalDoc?.currentStore)) {
          const target = storeIdOf(data.currentStore);
          if (!isSelf || (target != null && !hasStoreRole(t, target, "store_staff"))) data.currentStore = originalDoc?.currentStore ?? null;
        }
        const myRank = roleRank(me.role);
        const newRole = data.role ?? originalDoc?.role;
        if (operation === "update" && !isSelf && roleRank(originalDoc?.role) >= myRank)
          throw new ValidationError({ errors: [{ path: "email", message: "You can't change an account at or above your own role." }] });
        if (data.role !== undefined && (isSelf ? data.role !== originalDoc?.role : roleRank(newRole) >= myRank))
          throw new ValidationError({ errors: [{ path: "role", message: "Only the Owner can give this role." }] });
        return data;
      },
      // Staff passwords: at least 10 characters (customers: 8, checked at sign-up).
      ({ data, originalDoc, context }) => {
        const role = data.role ?? originalDoc?.role;
        if (context?.legacyUpgrade) return data; // re-saving an existing password during the one-time upgrade
        if (typeof data.password === "string" && data.password && role && role !== "customer" && data.password.length < 10) {
          throw new ValidationError({ errors: [{ path: "password", message: "Staff passwords need at least 10 characters." }] });
        }
        return data;
      },
      // A new email address isn't confirmed yet (staff can tick "Email confirmed" again in a later save).
      // A new password ends every storefront sign-in made before it (a stolen session stops working).
      ({ operation, data, originalDoc, context }) => {
        if (operation === "update" && typeof data.email === "string" && originalDoc?.email && data.email.toLowerCase() !== String(originalDoc.email).toLowerCase()) {
          data.emailVerified = false;
        }
        if (operation === "update" && typeof data.password === "string" && data.password && !context?.legacyUpgrade) data.sessionsValidAfter = new Date().toISOString();
        return data;
      },
      // The very first account ever created becomes the Owner (never a customer record made from a guest order).
      async ({ operation, data, req, context }) => {
        if (operation === "create" && !context?.guestCustomer && !context?.storefrontSignup) {
          const { totalDocs } = await req.payload.count({ collection: "users", overrideAccess: true, req });
          if (totalDocs === 0) data.role = "owner";
        }
        return data;
      },
    ],
  },
  fields: [
    {
      name: "twoFactor",
      type: "group",
      label: "2-step verification",
      access: { update: () => false, create: () => false },
      admin: { position: "sidebar", components: { Field: "/payload/admin/security/TwoFactorField#TwoFactorField" } },
      fields: [
        { name: "enabled", type: "checkbox" },
        { name: "secret", type: "text", access: { read: () => false }, admin: { hidden: true } },
        { name: "pendingSecret", type: "text", access: { read: () => false }, admin: { hidden: true } },
        { name: "lastStep", type: "number", access: { read: () => false }, admin: { hidden: true } },
        { name: "backupCodes", type: "json", access: { read: () => false }, admin: { hidden: true } },
        { name: "failedCodes", type: "number", access: { read: () => false }, admin: { hidden: true } },
        { name: "lockedUntil", type: "date", access: { read: () => false }, admin: { hidden: true } },
      ],
    },
    { name: "name", type: "text", admin: { components: { Cell: "/payload/admin/customers/Cells#CustomerNameCell" } } },
    {
      name: "emailVerified",
      type: "checkbox",
      defaultValue: false,
      label: "Email confirmed",
      access: { create: platformAdminField, update: platformAdminField },
      admin: { position: "sidebar", description: "Ticked when the customer clicks the link in the confirmation email." },
    },
    {
      name: "hasAccount",
      type: "checkbox",
      defaultValue: true,
      label: "Has an account",
      access: { create: platformAdminField, update: platformAdminField },
      admin: {
        position: "sidebar",
        components: { Cell: "/payload/admin/customers/Cells#AccountCell" },
        description: "Off = made automatically from a guest order (no password yet). It turns on when the customer signs up or sets a password with the emailed link.",
      },
    },
    { name: "phone", type: "text", admin: { description: "Mobile number, e.g. 0300-1234567 or +44 7700 900123" } },
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: "customer",
      saveToJWT: true,
      options: [
        { label: "Owner", value: "owner" },
        { label: "Manager", value: "manager" },
        { label: "Staff", value: "staff" },
        { label: "Customer", value: "customer" },
      ] satisfies { label: string; value: Role }[],
      // managers may give the Staff or Customer role; only the Owner can make managers and owners (checked below)
      // the original shop's team (legacy roles): its managers add Staff; only a platform admin makes Managers / Owners
      access: { update: defaultStoreTeamField("store_manager"), create: defaultStoreTeamField("store_manager") },
      admin: { position: "sidebar", description: "The original shop's team. Managers can add Staff; only a platform admin can make someone a Manager or Owner. Merchants' teams are managed under Store memberships." },
    },
    {
      name: "platformRole",
      type: "select",
      defaultValue: "customer",
      label: "Platform role",
      // "Merchant" is only a label (set when someone opens a store); store rights come from Store memberships
      options: [
        { label: "Customer", value: "customer" },
        { label: "Merchant", value: "merchant_owner" },
        { label: "Platform admin", value: "platform_admin" },
      ],
      access: { create: platformAdminField, update: platformAdminField },
      admin: { position: "sidebar", description: "Platform admin = runs ShopEngine (every store). Only a platform admin can change this." },
    },
    {
      name: "currentStore",
      type: "relationship",
      relationTo: "stores",
      label: "Working in store",
      admin: { position: "sidebar", description: "The store this person works in in /cms (changed with the store switcher). Empty for a platform admin = all stores." },
    },
    {
      name: "marketingConsent",
      type: "relationship",
      relationTo: "stores",
      hasMany: true,
      label: "Marketing emails allowed by",
      access: { create: platformAdminField, update: platformAdminField },
      hooks: { afterRead: [onlyOwnStore] },
      admin: { readOnly: true, description: "Stores this customer agreed to receive news and offers from (ticked at checkout). Each store sees only its own." },
    },
    {
      name: "customerOf",
      type: "relationship",
      relationTo: "stores",
      hasMany: true,
      label: "Customer of",
      access: { create: platformAdminField, update: platformAdminField },
      hooks: { afterRead: [onlyOwnStore] },
      admin: {
        position: "sidebar",
        description: "Stores this person has ordered from or signed up at (set automatically).",
        condition: (_d, _s, { user }) => ["owner"].includes(String((user as { role?: string } | null)?.role)) || (user as { platformRole?: string } | null)?.platformRole === "platform_admin",
      },
    },
    {
      type: "collapsible",
      label: "Customer profile",
      admin: { initCollapsed: true },
      fields: [
        {
          name: "addresses",
          type: "json",
          defaultValue: [],
          validate: (v: unknown) => (v == null || (Array.isArray(v) && v.length <= 10 && JSON.stringify(v).length <= 20_000) ? true : "At most 10 saved addresses."),
          admin: { description: "Saved delivery addresses (managed from the storefront account page)." },
        },
        {
          name: "wishlist",
          type: "json",
          defaultValue: [],
          validate: (v: unknown) => (v == null || (Array.isArray(v) && v.length <= 200 && v.every((x) => typeof x === "string" && x.length <= 120)) ? true : "Wishlist is too long."),
        },
        // account-wide (one account shops at every store): the original shop's team and platform admins only
        { name: "tags", type: "text", hasMany: true, access: { read: defaultStoreTeamField("store_staff"), update: defaultStoreTeamField("store_staff") } },
        { name: "notes", type: "textarea", access: { read: defaultStoreTeamField("store_staff"), update: defaultStoreTeamField("store_staff") }, admin: { description: "Internal – never shown to the customer." } },
        { name: "blocked", type: "checkbox", defaultValue: false, access: { read: defaultStoreTeamField("store_staff"), update: defaultStoreTeamField("store_manager") }, admin: { description: "Blocked accounts can't place orders on any store. Other stores block phone numbers instead (Blocked phones)." } },
        { name: "orders", type: "join", collection: "orders", on: "user", admin: { defaultColumns: ["orderNumber", "status", "total", "placedAt"], allowCreate: false } },
      ],
    },
    {
      name: "legacyPasswordHash",
      type: "text",
      hidden: true,
      access: { read: noField, update: noField, create: noField },
    },
    // a password reset ends every storefront sign-in made before this time (see lib/auth.ts)
    { name: "sessionsValidAfter", type: "date", access: { read: platformAdminField, update: () => false, create: () => false }, admin: { hidden: true } },
    legacyIdField,
  ],
  timestamps: true,
};
