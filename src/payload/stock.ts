import { sql } from "@payloadcms/db-postgres";
import type { Payload, PayloadRequest } from "payload";
import { userError } from "./errors";
import { log } from "../lib/log";
import type { StockReason } from "./collections/history";

/**
 * Stock changes done in ONE database statement, so the website and the shop counter can never both
 * sell the last unit (no read-then-write race). The stock status (in / low / out) is refreshed right after,
 * in the same transaction when `req` is passed.
 */

type Exec = { execute: (q: unknown) => Promise<{ rows: Record<string, unknown>[] }> };
type Db = { drizzle: Exec; sessions?: Record<string, { db: Exec } | undefined> };

/**
 * A product's system-managed values as they are LIVE. With drafts on, the copy a product draft holds can be old
 * (sales, reviews happened since) – these are the real ones.
 */
export async function liveProduct(payload: Payload, id: number, req?: PayloadRequest, lock = false): Promise<{ stock: number; rating: number; reviewCount: number; soldCount: number } | null> {
  // lock = keep the row locked until the save commits, so a sale can't slip in between reading and writing the stock
  const forUpdate = lock && req?.transactionID ? sql` FOR UPDATE` : sql``;
  const { rows } = await (await conn(payload, req)).execute(sql`SELECT "stock", "rating", "review_count", "sold_count" FROM "payload"."cms_products" WHERE "id" = ${id}${forUpdate}`);
  const r = rows[0];
  return r ? { stock: Number(r.stock ?? 0), rating: Number(r.rating ?? 0), reviewCount: Number(r.review_count ?? 0), soldCount: Number(r.sold_count ?? 0) } : null;
}

/** Rating / review count written straight to the live product (an update through Payload would publish an editor's pending draft). */
export async function setProductRating(payload: Payload, id: number, rating: number, reviewCount: number, req?: PayloadRequest) {
  await (await conn(payload, req)).execute(sql`UPDATE "payload"."cms_products" SET "rating" = ${rating}, "review_count" = ${reviewCount} WHERE "id" = ${id}`);
}

/** Cost price from a received purchase, straight to the live product (same reason as above). */
export async function setProductCost(payload: Payload, id: number, cost: number | null, req?: PayloadRequest) {
  await (await conn(payload, req)).execute(sql`UPDATE "payload"."cms_products" SET "cost_price" = ${cost} WHERE "id" = ${id}`);
}

/** The database connection – inside a hook, the SAME transaction as the document being saved (pass `req`). */
export async function conn(payload: Payload, req?: PayloadRequest): Promise<Exec> {
  const adapter = payload.db as unknown as Db;
  if (!req?.transactionID) return adapter.drizzle;
  const tx = adapter.sessions?.[String(await req.transactionID)]?.db;
  // Never silently fall outside the caller's transaction (that could deadlock against our own row locks)
  if (!tx) throw new Error("Stock change: database transaction not found");
  return tx;
}

/**
 * Why the stock changes – set by the caller on `req.context.stockLog` just before calling these functions
 * (e.g. { reason: "pos-sale", ref: receiptNumber }). Every change is written to Stock history in the SAME
 * transaction, so the history can never disagree with the stock.
 */
export type StockLog = { reason?: StockReason; ref?: string; serial?: string; note?: string };
export const setStockLog = (req: PayloadRequest | undefined, log: StockLog) => {
  if (!req) return;
  // change the SAME context object: hooks keep a reference to it (e.g. orderStock sets context.assignUnits for
  // orderUnits) – replacing it would silently drop those flags
  if (!req.context) req.context = {};
  (req.context as Record<string, unknown>).stockLog = log;
};

async function logMove(db: Exec, req: PayloadRequest | undefined, productId: number, title: unknown, change: number, stockAfter: number, fallback: StockReason = "other") {
  if (!change) return;
  const ctx = (req?.context?.stockLog ?? {}) as StockLog;
  const u = req?.user as { id?: number; email?: string } | null | undefined;
  // a person in /cms or the API (shoppers can't get an admin token); the website's own code shows as "—"
  const who = u && !req?.context?.storefront ? u : null;
  await db.execute(sql`
    INSERT INTO "payload"."cms_stock_movements" ("store_id", "product_id", "product_title", "change", "stock_after", "reason", "reference", "serial", "by_id", "by_email", "note")
    VALUES ((SELECT "store_id" FROM "payload"."cms_products" WHERE "id" = ${productId}), ${productId}, ${String(title ?? "")}, ${change}, ${stockAfter}, ${ctx.reason ?? fallback}::"payload"."enum_cms_stock_movements_reason",
            ${ctx.ref ?? null}, ${ctx.serial ?? null}, ${who?.id ?? null}, ${who?.email ?? null}, ${ctx.note ?? null})`);
}

const STATUS = sql`CASE WHEN "stock" <= 0 THEN 'out' WHEN "stock" <= COALESCE("low_stock_threshold", 2) THEN 'low' ELSE 'in' END::"payload"."enum_cms_products_stock_status"`;

/**
 * A product with variants (options like colour / size) has no stock of its own – its stock is the total of its
 * variants. Selling, restocking or counting it directly would break that total, so it's refused with a clear message.
 */
async function refuseVariantParent(db: Exec, productId: number) {
  const { rows } = await db.execute(sql`SELECT p."title" FROM "payload"."cms_products" p WHERE p."id" = ${productId} AND EXISTS (SELECT 1 FROM "payload"."cms_products" c WHERE c."variant_of_id" = p."id")`);
  if (rows.length) throw userError(`“${String(rows[0].title ?? "This product")}” has options (variants) – choose the option (e.g. the colour / size). Stock is kept per option.`, 400);
}

/** Takes `qty` off a product only if that many are in stock. Returns the new stock, or null if there weren't enough. */
export async function takeStock(payload: Payload, productId: number, qty: number, req?: PayloadRequest): Promise<number | null> {
  const db = await conn(payload, req);
  await refuseVariantParent(db, productId);
  const { rows } = await db.execute(sql`
    UPDATE "payload"."cms_products" SET "stock" = "stock" - ${qty}, "sold_count" = COALESCE("sold_count", 0) + ${qty}
    WHERE "id" = ${productId} AND COALESCE("stock", 0) >= ${qty}
    RETURNING "stock", "title", "low_stock_threshold", "store_id"`);
  if (!rows.length) return null;
  await refreshStatus(payload, productId, req);
  await logMove(db, req, productId, rows[0].title, -qty, Number(rows[0].stock));
  await lowStockAlert(payload, req, { productId, title: String(rows[0].title ?? ""), after: Number(rows[0].stock), sold: qty, threshold: rows[0].low_stock_threshold == null ? 2 : Number(rows[0].low_stock_threshold), storeId: rows[0].store_id == null ? null : Number(rows[0].store_id) });
  return Number(rows[0].stock);
}

/** A sale just took the product down to its "warn me at" level (or sold it out): tell the store's team, once a day. */
async function lowStockAlert(payload: Payload, req: PayloadRequest | undefined, p: { productId: number; title: string; after: number; sold: number; threshold: number; storeId: number | null }) {
  const before = p.after + p.sold;
  const crossed = (before > p.threshold && p.after <= p.threshold) || (before > 0 && p.after <= 0);
  if (!crossed) return;
  try {
    const { queueNotification } = await import("../lib/notify");
    const subject = p.after <= 0 ? `Sold out: ${p.title}` : `Low stock: ${p.title} (${p.after} left)`;
    await queueNotification(payload, "staff", p.storeId, { subject, lines: [p.after <= 0 ? "The last one was just sold." : `Only ${p.after} left – your warning level is ${p.threshold}.`], link: { href: `/cms/collections/products/${p.productId}`, label: "Open the product" } }, { req, dedupeKey: `stock-alert:${p.productId}:${p.after <= 0 ? "out" : "low"}:${new Date().toISOString().slice(0, 10)}` });
  } catch (e) {
    log.error("stock.low_alert_failed", e, { product: p.productId });
  }
}

/** Puts `qty` back (cancelled order, refused parcel, restocked return, voided shop sale). */
export async function putBackStock(payload: Payload, productId: number, qty: number, req?: PayloadRequest): Promise<number> {
  const db = await conn(payload, req);
  await refuseVariantParent(db, productId);
  const { rows } = await db.execute(sql`
    UPDATE "payload"."cms_products" SET "stock" = COALESCE("stock", 0) + ${qty}, "sold_count" = GREATEST(0, COALESCE("sold_count", 0) - ${qty})
    WHERE "id" = ${productId}
    RETURNING "stock", "title"`);
  await refreshStatus(payload, productId, req);
  if (rows.length) await logMove(db, req, productId, rows[0].title, qty, Number(rows[0].stock));
  return Number(rows[0]?.stock ?? 0);
}

/** Adds stock that was bought in (purchase received, count found more) – unlike putBackStock it doesn't touch "sold". */
export async function addStock(payload: Payload, productId: number, qty: number, req?: PayloadRequest): Promise<number> {
  const db = await conn(payload, req);
  await refuseVariantParent(db, productId);
  const { rows } = await db.execute(sql`
    WITH old AS (SELECT COALESCE("stock", 0) AS before FROM "payload"."cms_products" WHERE "id" = ${productId} FOR UPDATE)
    UPDATE "payload"."cms_products" p SET "stock" = GREATEST(0, old.before + ${qty}) FROM old WHERE p."id" = ${productId}
    RETURNING p."stock", p."title", old.before`);
  await refreshStatus(payload, productId, req);
  if (rows.length) await logMove(db, req, productId, rows[0].title, Number(rows[0].stock) - Number(rows[0].before), Number(rows[0].stock));
  return Number(rows[0]?.stock ?? 0);
}

/**
 * Uses one coupon of a store if it still has uses left – a single statement, so two shoppers can't both take the last use.
 * Codes are per store: the same code in another store is a different coupon.
 */
export async function consumeCoupon(payload: Payload, code: string, storeId: number | null, req?: PayloadRequest): Promise<boolean> {
  const { rows } = await (await conn(payload, req)).execute(sql`
    UPDATE "payload"."cms_discounts" SET "used" = COALESCE("used", 0) + 1, "updated_at" = now()
    WHERE upper("code") = ${code.trim().toUpperCase()} AND "store_id" IS NOT DISTINCT FROM ${storeId} AND COALESCE("active", true)
      AND ("usage_limit" IS NULL OR COALESCE("used", 0) < "usage_limit")
      AND ("starts_at" IS NULL OR "starts_at" <= now())
      AND ("expires_at" IS NULL OR "expires_at" > now())
    RETURNING "id"`);
  return rows.length > 0;
}

/** Gives a coupon use back (order cancelled before delivery) – only call it for an order that really used one. */
export async function releaseCoupon(payload: Payload, code: string, storeId: number | null, req?: PayloadRequest): Promise<void> {
  await (await conn(payload, req)).execute(sql`
    UPDATE "payload"."cms_discounts" SET "used" = GREATEST(0, COALESCE("used", 0) - 1), "updated_at" = now()
    WHERE upper("code") = ${code.trim().toUpperCase()} AND "store_id" IS NOT DISTINCT FROM ${storeId}`);
}

/** Lowers the "sold" count (a serial-tracked laptop came back – its stock is recounted from the units). */
export async function lowerSoldCount(payload: Payload, productId: number, qty: number, req?: PayloadRequest): Promise<void> {
  await (await conn(payload, req)).execute(sql`UPDATE "payload"."cms_products" SET "sold_count" = GREATEST(0, COALESCE("sold_count", 0) - ${qty}) WHERE "id" = ${productId}`);
}

/** Sets stock to an exact number (stock count, unit-tracked products). */
export async function setStock(payload: Payload, productId: number, stock: number, req?: PayloadRequest): Promise<void> {
  const db = await conn(payload, req);
  await refuseVariantParent(db, productId);
  const { rows } = await db.execute(sql`
    WITH old AS (SELECT COALESCE("stock", 0) AS before FROM "payload"."cms_products" WHERE "id" = ${productId} FOR UPDATE)
    UPDATE "payload"."cms_products" p SET "stock" = ${Math.max(0, stock)} FROM old WHERE p."id" = ${productId}
    RETURNING p."stock", p."title", old.before`);
  await refreshStatus(payload, productId, req);
  if (rows.length) await logMove(db, req, productId, rows[0].title, Number(rows[0].stock) - Number(rows[0].before), Number(rows[0].stock), "units");
}

/**
 * Cost at the time of sale on each line of an order / shop-counter sale (filled once, for the profit report):
 * the laptop's own cost for a serial-numbered unit sold at the counter, otherwise the product's cost price.
 */
export async function snapshotCosts(payload: Payload, kind: "orders" | "pos-sales", parentId: number, req?: PayloadRequest): Promise<void> {
  const db = await conn(payload, req);
  if (kind === "orders")
    await db.execute(sql`
      UPDATE "payload"."cms_orders_items" i SET "unit_cost" = COALESCE(
        (SELECT AVG(u."cost_price") FROM "payload"."cms_units" u WHERE u."order_id" = i."_parent_id" AND u."product_id" = i."product_id" AND u."cost_price" IS NOT NULL),
        (SELECT p."cost_price" FROM "payload"."cms_products" p WHERE p."id" = i."product_id"))
      WHERE i."_parent_id" = ${parentId} AND i."unit_cost" IS NULL`);
  else
    await db.execute(sql`
      UPDATE "payload"."cms_pos_sales_items" i SET "unit_cost" = COALESCE(
        (SELECT u."cost_price" FROM "payload"."cms_units" u WHERE u."id" = i."unit_id"),
        (SELECT p."cost_price" FROM "payload"."cms_products" p WHERE p."id" = i."product_id"))
      WHERE i."_parent_id" = ${parentId} AND i."unit_cost" IS NULL`);
}

async function refreshStatus(payload: Payload, productId: number, req?: PayloadRequest) {
  const db = await conn(payload, req);
  await db.execute(sql`UPDATE "payload"."cms_products" SET "stock_status" = ${STATUS} WHERE "id" = ${productId}`);
  // a variant changed → its parent's stock is the total of all its variants again
  const { rows } = await db.execute(sql`SELECT "variant_of_id" FROM "payload"."cms_products" WHERE "id" = ${productId}`);
  if (rows[0]?.variant_of_id) await syncVariantParent(payload, Number(rows[0].variant_of_id), req);
}

/** A product with variants: stock = total of its variants (and its in / low / out status from that). */
export async function syncVariantParent(payload: Payload, parentId: number, req?: PayloadRequest): Promise<void> {
  await (await conn(payload, req)).execute(sql`
    UPDATE "payload"."cms_products" p
    SET "stock" = t.total,
        "stock_status" = (CASE WHEN t.total <= 0 THEN 'out' WHEN t.total <= COALESCE(p."low_stock_threshold", 2) THEN 'low' ELSE 'in' END)::"payload"."enum_cms_products_stock_status"
    FROM (SELECT COALESCE(SUM(GREATEST("stock", 0)), 0) AS total FROM "payload"."cms_products" WHERE "variant_of_id" = ${parentId}) t
    WHERE p."id" = ${parentId} AND EXISTS (SELECT 1 FROM "payload"."cms_products" c WHERE c."variant_of_id" = ${parentId})`);
}

/** True when the product has variants (its stock is the total of them). */
export async function hasVariants(payload: Payload, productId: number, req?: PayloadRequest): Promise<boolean> {
  const { rows } = await (await conn(payload, req)).execute(sql`SELECT 1 FROM "payload"."cms_products" WHERE "variant_of_id" = ${productId} LIMIT 1`);
  return rows.length > 0;
}

/**
 * Locks every product of an order (and the main products of variants) in id order before changing any of them.
 * Two orders with the same products in a different order then wait for each other instead of deadlocking.
 */
export async function lockProducts(payload: Payload, ids: number[], req?: PayloadRequest): Promise<void> {
  if (!ids.length || !req?.transactionID) return; // outside a transaction every statement stands alone
  const list = sql.join([...new Set(ids)].map((i) => sql`${i}`), sql`, `);
  await (await conn(payload, req)).execute(sql`
    SELECT "id" FROM "payload"."cms_products"
    WHERE "id" IN (${list}) OR "id" IN (SELECT "variant_of_id" FROM "payload"."cms_products" WHERE "id" IN (${list}) AND "variant_of_id" IS NOT NULL)
    ORDER BY "id" FOR UPDATE`);
}

/** Takes stock for several lines; all or nothing. Returns the titles that were short, or [] on success. */
export async function takeStockForLines(payload: Payload, lines: { productId: number; qty: number; title?: string }[], req?: PayloadRequest): Promise<string[]> {
  const done: { productId: number; qty: number }[] = [];
  await lockProducts(payload, lines.map((l) => l.productId), req);
  for (const l of [...lines].sort((a, b) => a.productId - b.productId)) {
    const left = await takeStock(payload, l.productId, l.qty, req);
    if (left === null) {
      for (const d of done) await putBackStock(payload, d.productId, d.qty, req);
      return [l.title ?? `#${l.productId}`];
    }
    done.push(l);
  }
  return [];
}

/* ───────────── individual units (serial numbers) ───────────── */

const UNIT_STATUS = (s: string) => sql`${s}::"payload"."enum_cms_units_status"`;

/** Products (of these ids) that track each unit by serial number */
export async function trackedProducts(payload: Payload, ids: number[], req?: PayloadRequest): Promise<Set<number>> {
  if (!ids.length) return new Set();
  const { rows } = await (await conn(payload, req)).execute(sql`SELECT "id" FROM "payload"."cms_products" WHERE "track_units" = true AND "id" IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`);
  return new Set(rows.map((r) => Number(r.id)));
}

/** Stock of a unit-tracked product = its units that are In stock. */
export async function recountUnits(payload: Payload, productId: number, req?: PayloadRequest): Promise<number> {
  const db = await conn(payload, req);
  const { rows } = await db.execute(sql`
    WITH old AS (SELECT COALESCE("stock", 0) AS before FROM "payload"."cms_products" WHERE "id" = ${productId} FOR UPDATE)
    UPDATE "payload"."cms_products" p SET "stock" = (SELECT count(*) FROM "payload"."cms_units" WHERE "product_id" = ${productId} AND "status" = 'in-stock')
    FROM old WHERE p."id" = ${productId} RETURNING p."stock", p."title", old.before`);
  await refreshStatus(payload, productId, req);
  if (rows.length) await logMove(db, req, productId, rows[0].title, Number(rows[0].stock) - Number(rows[0].before), Number(rows[0].stock), "units");
  return Number(rows[0]?.stock ?? 0);
}

/** Reserves up to `qty` In-stock units of a product for an online order (oldest first, never the same unit twice). */
export async function reserveUnits(payload: Payload, orderId: number, productId: number, qty: number, req?: PayloadRequest): Promise<string[]> {
  const { rows } = await (await conn(payload, req)).execute(sql`
    UPDATE "payload"."cms_units" SET "status" = ${UNIT_STATUS("reserved")}, "order_id" = ${orderId}, "updated_at" = now()
    WHERE "id" IN (
      SELECT "id" FROM "payload"."cms_units" WHERE "product_id" = ${productId} AND "status" = 'in-stock'
      ORDER BY "received_at" NULLS LAST, "id" LIMIT ${qty} FOR UPDATE SKIP LOCKED
    ) RETURNING "serial"`);
  await recountUnits(payload, productId, req);
  return rows.map((r) => String(r.serial));
}

/** Moves an order's units from one state to another (e.g. reserved → sold on delivery, → in-stock on cancel). */
export async function moveOrderUnits(payload: Payload, orderId: number, to: "in-stock" | "sold" | "returned", req?: PayloadRequest): Promise<number[]> {
  const { rows } = await (await conn(payload, req)).execute(sql`
    UPDATE "payload"."cms_units" SET "status" = ${UNIT_STATUS(to)},
      "order_id" = ${to === "in-stock" ? null : orderId},
      "sold_at" = ${to === "sold" ? sql`now()` : to === "in-stock" ? null : sql`"sold_at"`},
      "updated_at" = now()
    WHERE "order_id" = ${orderId} AND "status" IN ('reserved', 'sold')
    RETURNING "product_id"`);
  const products = [...new Set(rows.map((r) => Number(r.product_id)))];
  for (const p of products) await recountUnits(payload, p, req);
  return products;
}

/** Sells one specific unit at the shop counter. Returns its product id, or null if it isn't In stock any more. */
export async function sellUnit(payload: Payload, unitId: number, saleId: number | null, req?: PayloadRequest): Promise<number | null> {
  const { rows } = await (await conn(payload, req)).execute(sql`
    UPDATE "payload"."cms_units" SET "status" = ${UNIT_STATUS("sold")}, "sale_id" = ${saleId}, "sold_at" = now(), "updated_at" = now()
    WHERE "id" = ${unitId} AND "status" = 'in-stock' RETURNING "product_id"`);
  if (!rows.length) return null;
  const productId = Number(rows[0].product_id);
  await recountUnits(payload, productId, req);
  await (await conn(payload, req)).execute(sql`UPDATE "payload"."cms_products" SET "sold_count" = COALESCE("sold_count", 0) + 1 WHERE "id" = ${productId}`);
  return productId;
}

/** Puts a shop-sold unit back in stock (voided sale). */
export async function unsellUnit(payload: Payload, unitId: number, req?: PayloadRequest): Promise<void> {
  const { rows } = await (await conn(payload, req)).execute(sql`
    UPDATE "payload"."cms_units" SET "status" = ${UNIT_STATUS("in-stock")}, "sale_id" = NULL, "sold_at" = NULL, "updated_at" = now()
    WHERE "id" = ${unitId} AND "status" = 'sold' RETURNING "product_id"`);
  if (!rows.length) return;
  const productId = Number(rows[0].product_id);
  await recountUnits(payload, productId, req);
  await (await conn(payload, req)).execute(sql`UPDATE "payload"."cms_products" SET "sold_count" = GREATEST(0, COALESCE("sold_count", 0) - 1) WHERE "id" = ${productId}`);
}

/** Links shop-sold units to their sale once the sale record exists. */
export async function linkUnitsToSale(payload: Payload, unitIds: number[], saleId: number, req?: PayloadRequest): Promise<void> {
  if (!unitIds.length) return;
  await (await conn(payload, req)).execute(sql`UPDATE "payload"."cms_units" SET "sale_id" = ${saleId} WHERE "id" IN (${sql.join(unitIds.map((i) => sql`${i}`), sql`, `)})`);
}

/** Locks a row for the rest of the transaction and returns its current status (serialises concurrent changes). */
export async function lockRowStatus(payload: Payload, table: "cms_orders" | "cms_pos_sales" | "cms_stock_counts" | "cms_purchases", id: number, req: PayloadRequest): Promise<string | null> {
  const { rows } = await (await conn(payload, req)).execute(sql`SELECT "status" FROM ${sql.raw(`"payload"."${table}"`)} WHERE "id" = ${id} FOR UPDATE`);
  return rows.length ? String(rows[0].status) : null;
}

export const lockOrderStatus = (payload: Payload, orderId: number, req: PayloadRequest) => lockRowStatus(payload, "cms_orders", orderId, req);

/** A stock change saved through a normal product save (edited in /cms, CSV import, new product). */
export async function recordStockChange(payload: Payload, req: PayloadRequest | undefined, productId: number, title: unknown, change: number, stockAfter: number, reason: StockReason) {
  await logMove(await conn(payload, req), req, productId, title, change, stockAfter, reason);
}
