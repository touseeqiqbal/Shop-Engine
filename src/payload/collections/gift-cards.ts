import { randomInt } from "node:crypto";
import type { CollectionConfig, FieldAccess } from "payload";
import { assignStore, storeAccess, storeField } from "../tenancy";
import { dbName, perStoreUnique } from "../fields";

/**
 * Gift cards (Marketing → Gift cards): a code with a balance in the store's currency. Shoppers pay with it at checkout
 * (all or part of an order); the balance is taken in the same database transaction as the order and given back when
 * that order is cancelled. The balance and the history change only through the server (src/payload/gift-cards.ts);
 * the team can switch a card off, change its expiry and its recipient.
 */

/** 16 characters without the easily confused 0/O, 1/I/L: XXXX-XXXX-XXXX-XXXX. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const newGiftCardCode = () =>
  Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")).join("-");
/** How shoppers may type it: lower case, spaces, without dashes … */
export const normalizeGiftCardCode = (code: string) => {
  const c = String(code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return c.length === 16 ? `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8, 12)}-${c.slice(12)}` : String(code ?? "").trim().toUpperCase();
};
/** "••••-••••-••••-7KQ2" – staff lists and receipts never show a whole working code twice. */
export const maskGiftCardCode = (code: string) => `••••-••••-••••-${String(code).slice(-4)}`;

const serverOnly: FieldAccess = ({ req }) => Boolean(req.context?.giftCardServer);

export const GiftCards: CollectionConfig = {
  slug: "gift-cards",
  dbName: dbName("gift_cards"),
  labels: { singular: "Gift card", plural: "Gift cards" },
  admin: {
    useAsTitle: "code",
    group: "Sales",
    defaultColumns: ["code", "balance", "initialValue", "status", "recipientName", "expiresAt", "createdAt"],
    description: "A code with a balance that pays for orders at checkout. Leave the code empty to have one made for you.",
  },
  access: storeAccess("store_staff", "store_manager", "store_manager", "store_owner"),
  indexes: perStoreUnique("code"),
  hooks: {
    beforeValidate: [
      assignStore(),
      ({ data, operation }) => {
        if (!data) return data;
        if (operation === "create") {
          data.code = data.code ? normalizeGiftCardCode(String(data.code)) : newGiftCardCode();
          data.balance = Number(data.initialValue) || 0;
        }
        return data;
      },
    ],
    afterChange: [
      // "Email it to the recipient" on a new card
      async ({ doc, operation, req }) => {
        if (operation !== "create" || !doc.sendEmail || !doc.recipientEmail) return doc;
        const { queueNotification } = await import("../../lib/notify");
        const store = typeof doc.store === "object" ? Number(doc.store?.id) : Number(doc.store);
        await queueNotification(req.payload, "gift-card", store, { giftCardId: doc.id }, { req, dedupeKey: `gift-card:${doc.id}` });
        return doc;
      },
    ],
  },
  fields: [
    storeField(),
    { type: "row", fields: [
      { name: "code", type: "text", index: true, access: { update: () => false }, admin: { width: "50%", description: "Empty = made for you (e.g. 7KQ2-…). Can't be changed later." } },
      { name: "status", type: "select", required: true, defaultValue: "active", options: [{ label: "Active", value: "active" }, { label: "Switched off", value: "disabled" }], admin: { width: "50%" } },
    ] },
    { type: "row", fields: [
      { name: "initialValue", type: "number", required: true, min: 0, label: "Value", access: { update: () => false }, admin: { width: "34%", description: "In your store's currency." } },
      { name: "balance", type: "number", min: 0, label: "Balance left", access: { create: serverOnly, update: serverOnly }, admin: { width: "33%", readOnly: true } },
      { name: "expiresAt", type: "date", label: "Expires", admin: { width: "33%", description: "Empty = never." } },
    ] },
    { type: "row", fields: [
      { name: "recipientName", type: "text", admin: { width: "50%" } },
      { name: "recipientEmail", type: "email", admin: { width: "50%" } },
    ] },
    { name: "message", type: "textarea", admin: { description: "Optional – shown in the email to the recipient." } },
    { name: "sendEmail", type: "checkbox", label: "Email the gift card to the recipient when saving", access: { update: () => false } },
    { name: "issuedFor", type: "relationship", relationTo: "orders", label: "Bought with order", admin: { readOnly: true, condition: (d) => Boolean(d?.issuedFor) } },
    // a voucher a customer made from their loyalty points (shown on their account page)
    { type: "row", admin: { condition: (d) => Boolean(d?.customer) }, fields: [
      { name: "customer", type: "relationship", relationTo: "users", label: "Customer's own voucher", access: { create: serverOnly, update: () => false }, admin: { width: "50%", readOnly: true } },
      { name: "fromPoints", type: "number", label: "Made from points", access: { create: serverOnly, update: () => false }, admin: { width: "50%", readOnly: true } },
    ] },
    // every payment with the card and every amount given back (cancelled order), newest last – written by the server
    { name: "ledger", type: "json", label: "History", access: { create: serverOnly, update: serverOnly }, admin: { readOnly: true } },
  ],
};
