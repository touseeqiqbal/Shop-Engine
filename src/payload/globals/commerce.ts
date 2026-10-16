import type { Field, GlobalConfig } from "payload";
import { anyone, platformAdmins } from "../access";
import { dbName } from "../fields";
import { revalidate } from "../revalidate";
import { PAKISTAN_CITIES } from "../../lib/cities";
import { manualMethodId } from "../../lib/payments/methods";
import { toCountryCode } from "../../lib/locale";

/** Country lists typed as names or codes ("UK, United States, ae") are kept as ISO codes. */
const asCountryCodes = ({ value }: { value?: unknown }) => (Array.isArray(value) ? [...new Set(value.map((v) => toCountryCode(String(v)) ?? String(v).trim()))] : value);
const knownCountries = (value: unknown) => {
  const bad = (Array.isArray(value) ? value : []).filter((v) => !toCountryCode(String(v)));
  return bad.length ? `Unknown country: ${bad.join(", ")} – use names or ISO codes such as GB, AE, US.` : true;
};

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
  access: { read: anyone, update: platformAdmins },
  hooks: { afterChange },
  fields: [
    {
      type: "row",
      fields: [
        { name: "freeDeliveryThreshold", type: "number", min: 0, defaultValue: 15000, label: "Free delivery above", admin: { width: "50%", description: "Store-wide, in your store's currency. 0 = no free delivery. A zone can override it." } },
        { name: "defaultCharge", type: "number", min: 0, defaultValue: 350, label: "Charge when no zone matches", admin: { width: "50%" } },
      ],
    },
    // deliveries abroad: shoppers then pick their country at checkout
    { name: "shipTo", type: "text", hasMany: true, label: "Also deliver to (countries)", validate: knownCountries, hooks: { beforeChange: [asCountryCodes] }, admin: { description: "Other countries you ship to – names or codes, e.g. United Kingdom, AE. Empty = only your store's country. Give them zones below (a zone's Countries)." } },
    {
      name: "zones",
      type: "array",
      labels: { singular: "Zone", plural: "Zones" },
      admin: { components: { RowLabel: "/payload/admin/RowLabel#ZoneRowLabel" }, description: "An address uses the first zone that lists its city (or postcode); every other address uses the “rest of the country” zone." },
      fields: [
        { type: "row", fields: [
          { name: "name", type: "text", required: true, admin: { width: "50%" } },
          { name: "rest", type: "checkbox", label: "Rest of the country (all other addresses)", admin: { width: "50%", style: { alignSelf: "center" } } },
        ] },
        // Pakistani stores pick from the city list; every store can type cities, areas or postcodes
        { name: "cities", type: "select", hasMany: true, options: CITY_OPTIONS, admin: { condition: (_, s) => !s?.rest, components: { Field: "/payload/admin/CountryOnly#PakistanOnlySelect" } } },
        { name: "countries", type: "text", hasMany: true, label: "Countries", validate: knownCountries, hooks: { beforeChange: [asCountryCodes] }, admin: { description: "Empty = your store's own country. A zone for deliveries abroad lists its countries, e.g. GB, IE (with “Rest of the country” it covers all of them)." } },
        { name: "places", type: "text", hasMany: true, label: "Cities, areas or postcodes", admin: { condition: (_, s) => !s?.rest, description: "Type one and press Enter. A postcode start ends with * (e.g. SW1* or 100*)." } },
        { type: "row", fields: [
          { name: "charge", type: "number", required: true, min: 0, label: "Delivery charge", admin: { width: "33%" } },
          { name: "freeAbove", type: "number", min: 0, label: "Free above", admin: { width: "33%", description: "Empty = store-wide. 0 = never free." } },
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

/** Shows a settings group to stores in Pakistan only (the values stay saved – nothing is lost if the country changes). */
const pakistanOnly = (f: Field): Field => {
  const admin = (f.admin ?? {}) as { components?: Record<string, unknown> };
  return { ...f, admin: { ...admin, components: { ...(admin.components ?? {}), Field: "/payload/admin/CountryOnly#PakistanOnlyGroup" } } } as Field;
};

/** Gives each of the store's own methods a stable id (from its name the first time; never a duplicate or a built-in id). */
function uniqueMethodIds(value: unknown) {
  if (!Array.isArray(value)) return value;
  const seen = new Set<string>();
  return value.map((row: Record<string, unknown>) => {
    const base = manualMethodId(String(row.name ?? ""));
    let id = typeof row.methodId === "string" && row.methodId ? row.methodId : base;
    for (let n = 2; seen.has(id); n++) id = `${base}-${n}`;
    seen.add(id);
    return { ...row, methodId: id };
  });
}

export const PaymentSettings: GlobalConfig = {
  slug: "payments",
  dbName: dbName("payments"),
  label: "Payments",
  admin: { group: "Settings", description: "Which payment methods shoppers can choose, account details and rules for large Cash-on-Delivery orders. Amounts are in your store's currency." },
  access: { read: anyone, update: platformAdmins },
  hooks: { afterChange },
  fields: [
    method("cod", "Cash on Delivery", true, [
      { type: "row", fields: [
        { name: "fee", type: "number", min: 0, defaultValue: 0, label: "COD handling fee", admin: { width: "33%", description: "Added to COD orders. 0 = none." } },
        { name: "maxOrder", type: "number", min: 0, label: "Max COD order", admin: { width: "33%", description: "Empty = no limit." } },
        { name: "advanceThreshold", type: "number", min: 0, defaultValue: 100000, label: "Ask advance above", admin: { width: "34%" } },
      ] },
      { name: "advanceAmount", type: "number", min: 0, defaultValue: 5000, label: "Advance amount", admin: { description: "Paid by bank transfer or one of your wallets to confirm high-value COD orders. 0 = never ask." } },
    ]),
    // Pakistan's mobile wallets – shown to stores in Pakistan only
    pakistanOnly(method("jazzcash", "JazzCash", true, [
      { type: "row", fields: [
        { name: "title", type: "text", label: "Account title", admin: { width: "50%" } },
        { name: "number", type: "text", label: "Mobile account number", admin: { width: "50%", description: "Empty = JazzCash isn't offered at checkout." } },
      ] },
    ])),
    pakistanOnly(method("easypaisa", "EasyPaisa", true, [
      { type: "row", fields: [
        { name: "title", type: "text", label: "Account title", admin: { width: "50%" } },
        { name: "number", type: "text", label: "Mobile account number", admin: { width: "50%", description: "Empty = EasyPaisa isn't offered at checkout." } },
      ] },
    ])),
    method("bank", "Bank transfer", true, [
      { type: "row", fields: [
        { name: "bankName", type: "text", admin: { width: "50%" } },
        { name: "accountTitle", type: "text", admin: { width: "50%" } },
      ] },
      { type: "row", fields: [
        { name: "accountNumber", type: "text", admin: { width: "50%" } },
        { name: "iban", type: "text", label: "IBAN / SWIFT / routing", admin: { width: "50%" } },
      ] },
    ]),
    method("card", "Debit / credit card (online)", false, [
      { name: "cardInfo", type: "ui", admin: { components: { Field: { path: "/payload/admin/BlockNote#BlockNote", clientProps: { text: "Cards are taken on the payment provider's secure page (Stripe, where it is available in your country). The store's owner connects the payment account in Account → Stores → Online payments; until then cards stay hidden at checkout." } } } } },
    ]),
    // ideas for the store's country (UPI in India, M-Pesa in Kenya, PIX in Brazil …)
    { name: "paymentIdeas", type: "ui", admin: { components: { Field: "/payload/admin/PaymentIdeas#PaymentIdeas" } } },
    {
      name: "manualMethods",
      type: "array",
      label: "Other payment methods",
      labels: { singular: "Payment method", plural: "Payment methods" },
      admin: {
        description: "Any way your customers pay you directly – a local wallet or bank app (UPI, M-Pesa, PIX, bKash …), or “Card on delivery”. Paid before shipping: the shopper sends the money, uploads the receipt and its transaction id, and you approve it on the order.",
        components: { RowLabel: "/payload/admin/RowLabel#PaymentMethodRowLabel" },
      },
      hooks: { beforeChange: [({ value }) => uniqueMethodIds(value)] },
      fields: [
        { type: "row", fields: [
          { name: "name", type: "text", required: true, label: "Name shown at checkout", admin: { width: "40%", placeholder: "e.g. UPI, M-Pesa, PIX" } },
          { name: "enabled", type: "checkbox", defaultValue: true, label: "Offer it", admin: { width: "20%", style: { alignSelf: "center" } } },
          { name: "due", type: "select", required: true, defaultValue: "upfront", label: "Paid", options: [{ label: "Before shipping (with receipt)", value: "upfront" }, { label: "On delivery / pickup", value: "on-delivery" }], admin: { width: "40%" } },
        ] },
        { name: "note", type: "text", label: "Note under the option", admin: { placeholder: "e.g. Instant – pay from any bank app" } },
        { name: "details", type: "array", label: "Where to pay", labels: { singular: "Detail", plural: "Details" }, admin: { description: "e.g. UPI ID → shop@okbank, Paybill → 123456.", condition: (_, s) => s?.due !== "on-delivery" }, fields: [
          { type: "row", fields: [
            { name: "label", type: "text", required: true, admin: { width: "40%" } },
            { name: "value", type: "text", required: true, admin: { width: "60%" } },
          ] },
        ] },
        { name: "instructions", type: "textarea", label: "Instructions", admin: { description: "Optional steps, e.g. “Use your order number as the reference”." } },
        // the id stored on orders – made from the name the first time, then kept (renaming doesn't break old orders)
        { name: "methodId", type: "text", admin: { hidden: true } },
      ],
    },
    {
      name: "tax",
      type: "group",
      label: "Tax",
      admin: { description: "Sales tax / VAT on orders. Shown on the order, invoice and reports." },
      fields: [
        { type: "row", fields: [
          { name: "enabled", type: "checkbox", defaultValue: false, label: "Charge tax", admin: { width: "25%", style: { alignSelf: "center" } } },
          { name: "rate", type: "number", min: 0, max: 50, defaultValue: 0, label: "Rate (%)", admin: { width: "25%" } },
          { name: "inclusive", type: "checkbox", defaultValue: true, label: "Prices already include tax", admin: { width: "25%", style: { alignSelf: "center" }, description: "Off = tax is added on top at checkout." } },
          { name: "label", type: "text", defaultValue: "Sales tax", admin: { width: "25%" } },
        ] },
        { name: "taxDelivery", type: "checkbox", defaultValue: false, label: "Delivery charges are taxed too" },
      ],
    },
  ],
};
