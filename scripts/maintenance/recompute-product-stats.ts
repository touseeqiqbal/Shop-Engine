/**
 * Replaces the demo / migrated rating, review count and "sold" numbers with REAL figures:
 *   rating + reviewCount  ← approved reviews in /cms → Reviews
 *   soldCount             ← delivered website orders + completed shop-counter sales
 *
 *   npm run stats:recompute              (report only – shows what would change)
 *   npm run stats:recompute -- --apply   (writes it; take a backup first – see docs/BACKUP-RESTORE.md)
 *
 * On Railway: run it from your computer with DATABASE_URL set to the database's public URL and PAYLOAD_SECRET set.
 */
import { getPayload } from "payload";
import config from "@payload-config";
import { sql } from "@payloadcms/db-postgres";

const apply = process.argv.includes("--apply");
const payload = await getPayload({ config });
const db = (payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<{ rows: Record<string, unknown>[] }> } }).drizzle;

const { rows } = await db.execute(sql`
  SELECT p.id, p.title, p.rating, p.review_count, p.sold_count,
    COALESCE(r.avg, 0) AS real_rating, COALESCE(r.n, 0) AS real_reviews,
    COALESCE(o.qty, 0) + COALESCE(s.qty, 0) AS real_sold
  FROM "payload"."cms_products" p
  LEFT JOIN (SELECT product_id, ROUND(AVG(rating)::numeric, 1) AS avg, COUNT(*) AS n FROM "payload"."cms_reviews" WHERE approved = true GROUP BY product_id) r ON r.product_id = p.id
  LEFT JOIN (SELECT i.product_id, SUM(i.qty) AS qty FROM "payload"."cms_orders_items" i JOIN "payload"."cms_orders" o ON o.id = i._parent_id WHERE o.status = 'delivered' GROUP BY i.product_id) o ON o.product_id = p.id
  LEFT JOIN (SELECT i.product_id, SUM(i.qty) AS qty FROM "payload"."cms_pos_sales_items" i JOIN "payload"."cms_pos_sales" s ON s.id = i._parent_id WHERE s.status = 'completed' GROUP BY i.product_id) s ON s.product_id = p.id
  ORDER BY p.id`);

let changed = 0;
for (const r of rows) {
  const now = { rating: Number(r.rating) || 0, reviews: Number(r.review_count) || 0, sold: Number(r.sold_count) || 0 };
  const real = { rating: Number(r.real_rating) || 0, reviews: Number(r.real_reviews) || 0, sold: Number(r.real_sold) || 0 };
  if (now.rating === real.rating && now.reviews === real.reviews && now.sold === real.sold) continue;
  changed++;
  console.log(`${String(r.title).slice(0, 50).padEnd(50)} rating ${now.rating}→${real.rating}  reviews ${now.reviews}→${real.reviews}  sold ${now.sold}→${real.sold}`);
  if (apply)
    await db.execute(sql`UPDATE "payload"."cms_products" SET rating = ${real.rating}, review_count = ${real.reviews}, sold_count = ${real.sold}, updated_at = now() WHERE id = ${Number(r.id)}`);
}
console.log(`\n${changed} product(s) ${apply ? "updated" : "would change – run again with --apply to save"}.`);
process.exit(0);
