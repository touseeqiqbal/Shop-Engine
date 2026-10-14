import type { Payload, PayloadRequest } from "payload";
import { getStoreSettings } from "./store-settings";

/**
 * Works out whether an item is still under warranty.
 *   1. Find the sale: the serial number's unit (sold online or in the shop), else the order / shop receipt number.
 *   2. Months: the unit's own warranty, else the product's warranty text ("6 months", "1 year"),
 *      else the months set for the product's condition in Settings → Returns & warranty rules.
 *   3. Covered if today is before purchase date + months.
 */

type Doc = Record<string, unknown>;
const relId = (v: unknown) => (v && typeof v === "object" ? Number((v as Doc).id) : v == null ? null : Number(v));
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** "6 months" → 6, "1 year" → 12, "2 yrs" → 24, "No warranty" → 0, anything else → null */
export function monthsFromText(text: string): number | null {
  const t = text.toLowerCase();
  if (/no warranty|without warranty/.test(t)) return 0;
  const m = t.match(/(\d+(?:\.\d+)?)\s*(year|yr|month|mon|week|day)/);
  if (!m) return null;
  const n = Number(m[1]);
  if (m[2].startsWith("y")) return Math.round(n * 12);
  if (m[2].startsWith("w")) return Math.max(1, Math.round(n / 4));
  if (m[2].startsWith("d")) return Math.max(1, Math.round(n / 30));
  return Math.round(n);
}

const addMonths = (iso: string, months: number) => {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
};

export async function warrantyFor(payload: Payload, args: { storeId: number | null; serial?: string; orderNumber?: string; productId?: number | null }, req?: PayloadRequest) {
  const fields: Doc = {};
  const notes: string[] = [];
  let purchasedAt = "";
  let product: Doc | null = null;
  let months: number | null = null;
  // only this store's units, orders and receipts
  const inStore = args.storeId == null ? [] : [{ store: { equals: args.storeId } }];
  const find = (collection: "units" | "orders" | "pos-sales", where: Doc) =>
    payload.find({ collection, where: { and: [where, ...inStore] } as never, limit: 1, depth: 0, overrideAccess: true, req }).then((r) => (r.docs[0] as unknown as Doc | undefined) ?? null);

  if (args.serial) {
    const unit = await find("units", { serial: { equals: args.serial } });
    if (unit) {
      fields.unit = unit.id;
      fields.product = relId(unit.product);
      if (unit.order) fields.order = relId(unit.order);
      if (unit.sale) fields.sale = relId(unit.sale);
      if (typeof unit.warrantyMonths === "number") months = unit.warrantyMonths;
      purchasedAt = str(unit.soldAt);
      notes.push(`serial ${args.serial} found`);
    } else notes.push(`serial ${args.serial} not in our records`);
  }

  const number = (args.orderNumber ?? "").trim().toUpperCase();
  if (!purchasedAt && number) {
    if (number.startsWith("POS-")) {
      const sale = await find("pos-sales", { receiptNumber: { equals: number } });
      if (sale) {
        fields.sale = sale.id;
        purchasedAt = str(sale.createdAt);
        const first = (Array.isArray(sale.items) ? sale.items[0] : null) as Doc | null;
        if (!fields.product && first?.product) fields.product = relId(first.product);
        notes.push(`shop receipt ${number}`);
      }
    } else {
      const order = await find("orders", { orderNumber: { equals: number } });
      if (order) {
        fields.order = order.id;
        const delivered = ((order.history as Doc[] | undefined) ?? []).filter((h) => h.status === "delivered").pop();
        purchasedAt = str(delivered?.at) || str(order.placedAt);
        const first = (Array.isArray(order.items) ? order.items[0] : null) as Doc | null;
        if (!fields.product && first?.product) fields.product = relId(first.product);
        notes.push(`order ${number}${delivered ? " (delivery date)" : " (order date)"}`);
      } else notes.push(`order ${number} not found`);
    }
  }

  const productId = (fields.product as number | undefined) ?? args.productId ?? null;
  if (productId) {
    product = (await payload.findByID({ collection: "products", id: productId, depth: 0, overrideAccess: true, req }).catch(() => null)) as unknown as Doc | null;
    if (product && args.storeId != null && relId(product.store) !== args.storeId) product = null;
    if (product) fields.product = product.id;
  }
  if (months == null && product?.warranty) {
    months = monthsFromText(str(product.warranty));
    if (months != null) notes.push(`product warranty “${str(product.warranty)}”`);
  }
  if (months == null && product?.condition) {
    const policy = await getStoreSettings<Doc>(payload, "returns-policy", args.storeId, { req });
    const row = ((policy?.warrantyByCondition as Doc[] | undefined) ?? []).find((r) => r.condition === product!.condition);
    if (row && typeof row.months === "number") {
      months = row.months;
      notes.push(`${str(row.type)} default`);
    }
  }

  fields.purchasedAt = purchasedAt || null;
  fields.warrantyMonths = months;
  if (purchasedAt && months != null) {
    const ends = addMonths(purchasedAt, months);
    fields.warrantyEndsAt = ends;
    fields.inWarranty = Date.parse(ends) >= Date.now() ? "yes" : "no";
  } else {
    fields.warrantyEndsAt = null;
    fields.inWarranty = "unknown";
  }
  fields.checkNote = notes.join(" · ") || "Add a serial number or order / receipt number";
  return { fields, inWarranty: fields.inWarranty as "yes" | "no" | "unknown" };
}
