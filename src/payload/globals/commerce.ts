import type { Field, GlobalConfig } from "payload";
import { anyone, managers } from "../access";
import { dbName } from "../fields";
import { revalidate } from "../revalidate";
import { PAKISTAN_CITIES } from "../../lib/cities";

/*
 * Settings → Shipping and Settings → Payments (like Shopify's "Shipping and delivery" and "Payments").
 * Until a global is saved for the first time the storefront keeps the values from the old admin
 * (Store settings), so nothing changes on deploy. Saving refreshes checkout/cart immediately.
 */

const SETTINGS_TAG = "settings"; // same tag as TAGS.settings in src/lib/repo/catalog.ts
const afterChange = [({ doc }: { doc: unknown }) => (revalidate([SETTINGS_TAG], ["/", "/shipping-policy", "/checkout"]), doc)];

const CITY_OPTIONS = [...PAKISTAN_CITIES].sort((a, b) => a.localeCompare(b)).map((c) => ({ label: c, value: c }));

export const ShippingSettings: GlobalConfig = {
  slug: "shipping",
  dbName: dbName("shipping"),
  label: "Shipping & delivery",
  admin: { group: "Settings", description: "Delivery charges by city, free-delivery threshold and delivery times. Use the fee tester below to check any city and cart total." },
  access: { read: anyone, update: managers },
  hooks: { afterChange },
  fields: [
    {
      type: "row",
      fields: [
        { name: "freeDeliveryThreshold", type: "number", min: 0, defaultValue: 15000, label: "Free delivery above (Rs)", admin: { width: "50%", description: "Store-wide. 0 = no free delivery. A zone can override it." } },
        { name: "defaultCharge", type: "number", min: 0, defaultValue: 350, label: "Charge when no zone matches (Rs)", admin: { width: "50%" } },
      ],
    },
    {
      name: "zones",
      type: "array",
      labels: { singular: "Zone", plural: "Zones" },
      admin: { components: { RowLabel: "/payload/admin/RowLabel#ZoneRowLabel" }, description: "A city uses the first zone that lists it; every other city uses the “rest of Pakistan” zone." },
      fields: [
        { type: "row", fields: [
          { name: "name", type: "text", required: true, admin: { width: "50%" } },
          { name: "rest", type: "checkbox", label: "Rest of Pakistan (all other cities)", admin: { width: "50%", style: { alignSelf: "center" } } },
        ] },
        { name: "cities", type: "select", hasMany: true, options: CITY_OPTIONS, admin: { condition: (_, s) => !s?.rest } },
        { type: "row", fields: [
          { name: "charge", type: "number", required: true, min: 0, label: "Delivery charge (Rs)", admin: { width: "33%" } },
          { name: "freeAbove", type: "number", min: 0, label: "Free above (Rs)", admin: { width: "33%", description: "Empty = store-wide. 0 = never free." } },
          { name: "estimate", type: "text", label: "Delivery time", admin: { width: "34%", description: "e.g. 1–3 working days. Empty = automatic." } },
        ] },
      ],
    },
    { name: "feeTester", type: "ui", admin: { components: { Field: "/payload/admin/ShippingFeeTester#ShippingFeeTester" } } },
  ],
};

const method = (name: string, label: string, defaultEnabled: boolean, extra: Field[] = []): Field => ({
  name,
  type: "group",
  label,
  fields: [
    { type: "row", fields: [
      { name: "enabled", type: "checkbox", defaultValue: defaultEnabled, label: `Offer ${label}`, admin: { width: "30%", style: { alignSelf: "center" } } },
      { name: "note", type: "text", label: "Note at checkout", admin: { width: "70%", description: "Optional, e.g. “Pay within 24 hours”." } },
    ] },
    ...extra,
  ],
});

export const PaymentSettings: GlobalConfig = {
  slug: "payments",
  dbName: dbName("payments"),
  label: "Payments",
  admin: { group: "Settings", description: "Which payment methods shoppers can choose, account details and rules for large Cash-on-Delivery orders." },
  access: { read: anyone, update: managers },
  hooks: { afterChange },
  fields: [
    method("cod", "Cash on Delivery", true, [
      { type: "row", fields: [
        { name: "fee", type: "number", min: 0, defaultValue: 0, label: "COD handling fee (Rs)", admin: { width: "33%", description: "Added to COD orders. 0 = none." } },
        { name: "maxOrder", type: "number", min: 0, label: "Max COD order (Rs)", admin: { width: "33%", description: "Empty = no limit." } },
        { name: "advanceThreshold", type: "number", min: 0, defaultValue: 100000, label: "Ask advance above (Rs)", admin: { width: "34%" } },
      ] },
      { name: "advanceAmount", type: "number", min: 0, defaultValue: 5000, label: "Advance amount (Rs)", admin: { description: "Paid by JazzCash / EasyPaisa / bank to confirm high-value COD orders. 0 = never ask." } },
    ]),
    method("jazzcash", "JazzCash", true, [
      { type: "row", fields: [
        { name: "title", type: "text", defaultValue: "Urko Tech Store", label: "Account title", admin: { width: "50%" } },
        { name: "number", type: "text", defaultValue: "0342-6693115", label: "Mobile account number", admin: { width: "50%" } },
      ] },
    ]),
    method("easypaisa", "EasyPaisa", true, [
      { type: "row", fields: [
        { name: "title", type: "text", defaultValue: "Urko Tech Store", label: "Account title", admin: { width: "50%" } },
        { name: "number", type: "text", defaultValue: "0343-5867409", label: "Mobile account number", admin: { width: "50%" } },
      ] },
    ]),
    method("bank", "Bank transfer", true, [
      { type: "row", fields: [
        { name: "bankName", type: "text", defaultValue: "Meezan Bank", admin: { width: "50%" } },
        { name: "accountTitle", type: "text", defaultValue: "Urko Tech Store", admin: { width: "50%" } },
      ] },
      { type: "row", fields: [
        { name: "accountNumber", type: "text", admin: { width: "50%" } },
        { name: "iban", type: "text", label: "IBAN", admin: { width: "50%" } },
      ] },
    ]),
    { name: "cardInfo", type: "ui", admin: { components: { Field: { path: "/payload/admin/BlockNote#BlockNote", clientProps: { text: "Debit / credit cards: shown as “Coming soon” at checkout until a payment gateway (e.g. PayFast, Safepay) is connected." } } } } },
  ],
};
