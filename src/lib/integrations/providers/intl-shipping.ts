import type { IntegrationField } from "../catalog-types";
import type { Ctx, ParcelInput } from "../types";

/** What the international carriers (Shippo, EasyPost, DHL Express) share: the sender's address, parcel size, customs. */

export const SENDER_FIELDS: IntegrationField[] = [
  { key: "senderName", label: "Sender name", type: "text", required: true },
  { key: "senderCompany", label: "Company", type: "text" },
  { key: "senderStreet", label: "Street address", type: "text", required: true },
  { key: "senderCity", label: "City", type: "text", required: true },
  { key: "senderState", label: "State / province (code)", type: "text", placeholder: "CA" },
  { key: "senderZip", label: "Postcode / ZIP", type: "text", required: true },
  { key: "senderCountry", label: "Country (2-letter code)", type: "text", required: true, placeholder: "US" },
  { key: "senderPhone", label: "Phone", type: "text", required: true },
  { key: "senderEmail", label: "Email", type: "text", required: true },
  { key: "boxSize", label: "Usual box size in cm (L × W × H)", type: "text", default: "30x20x10", placeholder: "30x20x10" },
  { key: "customsSigner", label: "Name on customs forms", type: "text", help: "Needed for parcels to other countries." },
];

export const sender = (ctx: Ctx) => {
  const c = ctx.connection.config;
  const s = (k: string) => String(c[k] ?? "").trim();
  return { name: s("senderName"), company: s("senderCompany"), street1: s("senderStreet"), city: s("senderCity"), state: s("senderState"), zip: s("senderZip"), country: s("senderCountry").toUpperCase(), phone: s("senderPhone"), email: s("senderEmail") };
};

/** The box in cm (from "30x20x10"). */
export function box(ctx: Ctx): { l: number; w: number; h: number } {
  const [l, w, h] = String(ctx.connection.config.boxSize || "30x20x10")
    .split(/[x×*,\s]+/i)
    .map((n) => Number(n));
  return { l: l > 0 ? l : 30, w: w > 0 ? w : 20, h: h > 0 ? h : 10 };
}

export const international = (ctx: Ctx, p: ParcelInput) => sender(ctx).country !== p.customer.country;

export const receiver = (p: ParcelInput) => ({ name: p.customer.name, street1: p.customer.address, street2: p.customer.area ?? "", city: p.customer.city, zip: p.customer.postalCode ?? "", country: p.customer.country, phone: p.customer.phone, email: p.customer.email ?? "" });

/** The items' share of the parcel weight (customs forms want a weight per line). */
export const lineWeights = (p: ParcelInput) => {
  const units = p.items.reduce((n, i) => n + i.qty, 0) || 1;
  return p.items.map((i) => Math.max(0.01, Math.round(((p.weightKg * i.qty) / units) * 1000) / 1000));
};
