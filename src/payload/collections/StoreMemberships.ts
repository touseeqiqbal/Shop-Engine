import type { CollectionConfig, Where } from "payload";
import { isPlatformAdmin } from "../access";
import { dbName } from "../fields";

export const StoreMemberships: CollectionConfig = {
  slug: "store-memberships",
  dbName: dbName("store_memberships"),
  labels: { singular: "Store membership", plural: "Store memberships" },
  admin: {
    useAsTitle: "role",
    defaultColumns: ["store", "user", "role", "status"],
    group: "Platform",
  },
  access: {
    read: ({ req }) => {
      const user = req.user as { id?: string | number; role?: string; platformRole?: string; stores?: Array<string | number | { id?: string | number }> | null } | null | undefined;
      if (!user?.id) return false;
      if (isPlatformAdmin(user as never)) return true;
      const storeIds = (user.stores ?? [])
        .map((store) => (typeof store === "object" && store && "id" in store ? store.id : store))
        .filter((id): id is string | number => typeof id === "string" || typeof id === "number");
      const userId = user.id;
      const ownMembership: Where = { user: { equals: userId } };
      if (storeIds.length === 0) return ownMembership;
      return { or: [ownMembership, { store: { in: storeIds } }] } satisfies Where;
    },
    create: ({ req }) => isPlatformAdmin(req.user as never),
    update: ({ req }) => isPlatformAdmin(req.user as never),
    delete: ({ req }) => isPlatformAdmin(req.user as never),
  },
  fields: [
    { name: "store", type: "relationship", relationTo: "stores", required: true },
    { name: "user", type: "relationship", relationTo: "users", required: true },
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: "store_staff",
      options: [
        { label: "Store owner", value: "store_owner" },
        { label: "Store manager", value: "store_manager" },
        { label: "Store staff", value: "store_staff" },
        { label: "Customer", value: "customer" },
      ],
    },
    {
      name: "status",
      type: "select",
      defaultValue: "active",
      options: [
        { label: "Active", value: "active" },
        { label: "Invited", value: "invited" },
        { label: "Suspended", value: "suspended" },
      ],
    },
    { name: "invitedAt", type: "date" },
    { name: "acceptedAt", type: "date" },
    { name: "notes", type: "textarea" },
  ],
  timestamps: true,
};
