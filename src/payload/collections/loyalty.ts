import type { CollectionConfig, FieldAccess } from "payload";
import { assignStore, storeAccess, storeField, storeIdOf } from "../tenancy";
import { dbName, perStoreUnique } from "../fields";
import { userError } from "../errors";

/**
 * Loyalty points per customer and store (Marketing → Loyalty points). Points come from delivered orders and go into
 * vouchers the customer makes on their account page (src/payload/loyalty.ts). The team sees every balance and its
 * history, and a manager can correct one ("Add or take away") – the balance itself only changes on the server.
 */

const serverOnly: FieldAccess = ({ req }) => Boolean(req.context?.loyaltyServer);

export const LoyaltyAccounts: CollectionConfig = {
  slug: "loyalty-accounts",
  dbName: dbName("loyalty_accounts"),
  labels: { singular: "Loyalty points", plural: "Loyalty points" },
  admin: {
    useAsTitle: "customerEmail",
    group: "Marketing",
    defaultColumns: ["customerEmail", "balance", "earned", "updatedAt"],
    description: "Points customers earned on delivered orders (Settings → Installments & reminders → Loyalty points). They turn them into a voucher on their account page.",
  },
  access: storeAccess("store_staff", "store_manager", "store_manager", "store_owner"),
  indexes: perStoreUnique("customer"),
  hooks: {
    beforeValidate: [assignStore()],
    beforeChange: [
      async ({ data, originalDoc, operation, req }) => {
        // who it is – shown in the list (customers are searched by email)
        const customer = Number(typeof data.customer === "object" && data.customer ? data.customer.id : data.customer ?? (typeof originalDoc?.customer === "object" ? originalDoc?.customer?.id : originalDoc?.customer));
        if (Number.isFinite(customer) && customer > 0) {
          const u = (await req.payload.findByID({ collection: "users", id: customer, depth: 0, overrideAccess: true, req }).catch(() => null)) as { email?: string } | null;
          if (!u) throw userError("Choose a customer.", 400);
          data.customerEmail = u.email ?? "";
        } else if (operation === "create") throw userError("Choose a customer.", 400);
        const adjust = Math.trunc(Number(data.adjustBy) || 0);
        const note = String(data.adjustNote ?? "").trim().slice(0, 200) || "Corrected by the team";
        delete data.adjustBy;
        delete data.adjustNote;
        if (req.context?.loyaltyServer) return data;
        if (operation === "create") {
          // a new account with a starting balance
          const start = Math.max(0, adjust);
          data.balance = start;
          data.earned = start;
          data.ledger = start ? [{ at: new Date().toISOString(), points: start, note }] : [];
          return data;
        }
        // the balance, total and history are the server's: never written from the form …
        delete data.balance;
        delete data.earned;
        delete data.ledger;
        // … a correction goes through the same single-statement change as everything else, in this save's transaction
        if (adjust) {
          const { addPoints } = await import("../loyalty");
          await addPoints(req.payload, { storeId: storeIdOf(originalDoc?.store), userId: customer, points: adjust, note }, req);
        }
        return data;
      },
    ],
  },
  fields: [
    storeField(),
    { type: "row", fields: [
      // not required in the database: deleting a customer's account must not fail because of their points
      { name: "customer", type: "relationship", relationTo: "users", label: "Customer", access: { update: () => false }, admin: { width: "50%" } },
      { name: "customerEmail", type: "text", index: true, label: "Email", admin: { width: "50%", readOnly: true } },
    ] },
    { type: "row", fields: [
      { name: "balance", type: "number", defaultValue: 0, label: "Points now", access: { create: serverOnly, update: serverOnly }, admin: { width: "50%", readOnly: true } },
      { name: "earned", type: "number", defaultValue: 0, label: "Earned in total", access: { create: serverOnly, update: serverOnly }, admin: { width: "50%", readOnly: true } },
    ] },
    { type: "row", fields: [
      { name: "adjustBy", type: "number", virtual: true, label: "Add or take away", admin: { width: "50%", description: "e.g. 200 or -50 – applied when you save." } },
      { name: "adjustNote", type: "text", virtual: true, label: "Why", admin: { width: "50%", description: "Shown in the history, e.g. “Sorry for the late delivery”." } },
    ] },
    { name: "ledger", type: "json", label: "History", access: { create: serverOnly, update: serverOnly }, admin: { readOnly: true } },
  ],
};
