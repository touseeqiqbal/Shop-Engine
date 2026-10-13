import bcrypt from "bcryptjs";
import { ValidationError, type CollectionConfig } from "payload";
import { canOpenAdmin, deletableUsers, editableUsers, managerField, managers, noField, roleRank, staffField, staffOrSelf, type Role } from "../access";
import { dbName, legacyIdField } from "../fields";
import { requireTwoFactor } from "../endpoints/two-factor";
import { resetPasswordEmail } from "@/lib/account-email";

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
    maxLoginAttempts: 10,
    lockTime: 15 * 60 * 1000,
    cookies: { sameSite: "Lax", secure: process.env.NODE_ENV === "production" },
    // Customers get a link to the storefront reset page, staff to /cms.
    forgotPassword: {
      // a customer who only ordered as a guest so far gets "finish creating your account" wording
      generateEmailSubject: (args) => ((args?.user as { hasAccount?: boolean } | undefined)?.hasAccount === false ? "Finish creating your Urko Tech Store account" : "Reset your Urko Tech Store password"),
      generateEmailHTML: (args) => {
        const u = args?.user as { role?: string; hasAccount?: boolean } | undefined;
        return resetPasswordEmail(args?.token ?? "", u?.role, u?.hasAccount === false).html;
      },
    },
  },
  access: {
    // owners/managers without 2-step can open /cms only to set it up – every collection refuses them until then
    admin: ({ req }) => canOpenAdmin(req.user as never),
    read: staffOrSelf,
    create: managers, // storefront sign-ups use the Local API with overrideAccess
    update: editableUsers,
    delete: deletableUsers,
    unlock: managers,
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
      ({ data, originalDoc, operation, req, context }) => {
        if (context?.migrating || context?.legacyUpgrade || context?.twoFactorUpdate || !req.user) return data;
        const me = req.user as { id?: unknown; role?: string };
        if (me.role === "owner") return data;
        const myRank = roleRank(me.role);
        const isSelf = operation === "update" && originalDoc?.id === me.id;
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
      ({ operation, data, originalDoc }) => {
        if (operation === "update" && typeof data.email === "string" && originalDoc?.email && data.email.toLowerCase() !== String(originalDoc.email).toLowerCase()) {
          data.emailVerified = false;
        }
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
      access: { create: staffField, update: staffField },
      admin: { position: "sidebar", description: "Ticked when the customer clicks the link in the confirmation email." },
    },
    {
      name: "hasAccount",
      type: "checkbox",
      defaultValue: true,
      label: "Has an account",
      access: { create: staffField, update: staffField },
      admin: {
        position: "sidebar",
        components: { Cell: "/payload/admin/customers/Cells#AccountCell" },
        description: "Off = made automatically from a guest order (no password yet). It turns on when the customer signs up or sets a password with the emailed link.",
      },
    },
    { name: "phone", type: "text", admin: { description: "Pakistani mobile, e.g. 0300-1234567" } },
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
      access: { update: managerField, create: managerField },
      admin: { position: "sidebar", description: "Managers can add Staff; only the Owner can make someone a Manager or Owner." },
    },
    {
      name: "platformRole",
      type: "select",
      defaultValue: "customer",
      label: "Platform role",
      options: [
        { label: "Customer", value: "customer" },
        { label: "Platform admin", value: "platform_admin" },
        { label: "Merchant owner", value: "merchant_owner" },
        { label: "Merchant manager", value: "merchant_manager" },
        { label: "Merchant staff", value: "merchant_staff" },
      ],
      admin: { position: "sidebar", description: "Optional platform-level access when a user is assigned to the ShopEngine control plane." },
    },
    {
      name: "currentStore",
      type: "relationship",
      relationTo: "stores",
      label: "Current store",
      admin: { position: "sidebar", description: "Default active store for this user in the platform context." },
    },
    {
      name: "stores",
      type: "relationship",
      relationTo: "stores",
      hasMany: true,
      label: "Stores",
      admin: { description: "All stores this user can access." },
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
        { name: "tags", type: "text", hasMany: true, access: { read: staffField, update: staffField } },
        { name: "notes", type: "textarea", access: { read: staffField, update: staffField }, admin: { description: "Internal – never shown to the customer." } },
        { name: "blocked", type: "checkbox", defaultValue: false, access: { read: staffField, update: staffField }, admin: { description: "Blocked customers can't place orders." } },
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
    { name: "sessionsValidAfter", type: "date", access: { read: staffField, update: () => false, create: () => false }, admin: { hidden: true } },
    legacyIdField,
  ],
  timestamps: true,
};
