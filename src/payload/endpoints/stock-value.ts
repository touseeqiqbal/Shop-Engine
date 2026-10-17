import type { Endpoint } from "payload";
import { sql } from "@payloadcms/db-postgres";
import { storeGate } from "./guard";
import { conn } from "../stock";
import { stockValueReport, type StockRow } from "../../lib/stock-value";

/**
 * GET /cms-api/stock-value – what the store's stock is worth (at cost and at today's prices) and how long it has sat
 * without selling. Owners only: cost prices are theirs (Products → Your cost). Products with options are counted per
 * option; archived products are left out.
 */
export const stockValueEndpoint: Endpoint = {
  path: "/stock-value",
  method: "get",
  handler: async (req) => {
    const gate = await storeGate(req, "store_owner");
    if (gate instanceof Response) return gate;
    const store = gate.store;
    const { rows } = await (await conn(req.payload, req)).execute(sql`
      WITH last_sale AS (
        SELECT "product_id", MAX("created_at") AS at FROM "payload"."cms_stock_movements"
        WHERE "store_id" IS NOT DISTINCT FROM ${store} AND "change" < 0 AND "reason"::text IN ('order', 'pos-sale')
        GROUP BY "product_id"
      )
      SELECT p."id", p."title", p."sku", COALESCE(p."stock", 0)::float AS stock, p."cost_price"::float AS cost, COALESCE(p."price", 0)::float AS price,
             p."created_at", ls.at AS last_sold
      FROM "payload"."cms_products" p
      LEFT JOIN last_sale ls ON ls."product_id" = p."id"
      WHERE p."store_id" IS NOT DISTINCT FROM ${store} AND p."status"::text <> 'archived'
        AND NOT EXISTS (SELECT 1 FROM "payload"."cms_products" c WHERE c."variant_of_id" = p."id")`);
    const list: StockRow[] = (rows as Record<string, unknown>[]).map((r) => ({
      id: Number(r.id),
      title: String(r.title ?? ""),
      sku: String(r.sku ?? ""),
      stock: Number(r.stock) || 0,
      costPrice: r.cost == null ? null : Number(r.cost),
      price: Number(r.price) || 0,
      lastSoldAt: r.last_sold ? new Date(String(r.last_sold)).toISOString() : null,
      createdAt: new Date(String(r.created_at)).toISOString(),
    }));
    return Response.json(stockValueReport(list), { headers: { "Cache-Control": "no-store" } });
  },
};
