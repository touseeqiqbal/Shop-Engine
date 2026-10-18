import type { Payload } from "payload";
import { sql } from "@payloadcms/db-postgres";
import { conn } from "./stock";
import type { StatKind } from "../lib/shop-stats";

/** One more of `kind` for the store on `day` (and product `ref`) – a single statement, safe with many at once. */
export async function recordStat(payload: Payload, input: { storeId: number | null; day: string; kind: StatKind; ref: string }): Promise<void> {
  await (await conn(payload)).execute(sql`
    INSERT INTO "payload"."cms_shop_stats" ("store_id", "day", "kind", "ref", "count", "updated_at", "created_at")
    VALUES (${input.storeId}, ${input.day}, ${input.kind}::"payload"."enum_cms_shop_stats_kind", ${input.ref}, 1, now(), now())
    ON CONFLICT ("store_id", "day", "kind", "ref") DO UPDATE SET "count" = "payload"."cms_shop_stats"."count" + 1, "updated_at" = now()`);
}

export type Funnel = {
  from: string;
  to: string;
  totals: { views: number; carts: number; checkouts: number; orders: number };
  days: { day: string; views: number; carts: number; checkouts: number; orders: number }[];
  products: { ref: string; id: number | null; title: string; views: number; carts: number }[];
};

/** A store's funnel between two days (YYYY-MM-DD, in its time zone) – the orders counted from the orders. */
export async function funnelFor(payload: Payload, storeId: number | null, from: string, to: string, timezone: string): Promise<Funnel> {
  const db = await conn(payload);
  const { rows: byDay } = await db.execute(sql`
    SELECT "day", "kind"::text AS kind, SUM("count")::int AS n FROM "payload"."cms_shop_stats"
    WHERE "store_id" IS NOT DISTINCT FROM ${storeId} AND "day" BETWEEN ${from} AND ${to} GROUP BY "day", "kind"`);
  const { rows: orderDays } = await db.execute(sql`
    SELECT to_char(("created_at" AT TIME ZONE ${timezone})::date, 'YYYY-MM-DD') AS day, COUNT(*)::int AS n FROM "payload"."cms_orders"
    WHERE "store_id" IS NOT DISTINCT FROM ${storeId} AND ("created_at" AT TIME ZONE ${timezone})::date BETWEEN ${from}::date AND ${to}::date
      AND "status"::text <> 'awaiting-payment'
      -- placed through the online checkout (it gives each attempt an id) – not orders typed in by the team or imported
      AND "attempt_id" IS NOT NULL GROUP BY 1`);
  const { rows: top } = await db.execute(sql`
    SELECT s."ref", SUM(CASE WHEN s."kind"::text = 'view' THEN s."count" ELSE 0 END)::int AS views, SUM(CASE WHEN s."kind"::text = 'cart' THEN s."count" ELSE 0 END)::int AS carts,
           MAX(p."id") AS id, MAX(p."title") AS title
    FROM "payload"."cms_shop_stats" s
    LEFT JOIN "payload"."cms_products" p ON p."store_id" IS NOT DISTINCT FROM s."store_id" AND (p."legacy_id" = s."ref" OR p."id"::text = s."ref")
    WHERE s."store_id" IS NOT DISTINCT FROM ${storeId} AND s."day" BETWEEN ${from} AND ${to} AND s."ref" <> '' AND s."kind"::text IN ('view', 'cart')
    GROUP BY s."ref" ORDER BY views DESC, carts DESC LIMIT 20`);
  const days = new Map<string, Funnel["days"][number]>();
  const day = (d: string) => days.get(d) ?? (days.set(d, { day: d, views: 0, carts: 0, checkouts: 0, orders: 0 }), days.get(d)!);
  for (const r of byDay as { day: string; kind: string; n: number }[]) {
    const d = day(String(r.day));
    if (r.kind === "view") d.views += Number(r.n);
    else if (r.kind === "cart") d.carts += Number(r.n);
    else if (r.kind === "checkout") d.checkouts += Number(r.n);
  }
  for (const r of orderDays as { day: string; n: number }[]) day(String(r.day)).orders += Number(r.n);
  const list = [...days.values()].sort((a, b) => a.day.localeCompare(b.day));
  const sum = (k: "views" | "carts" | "checkouts" | "orders") => list.reduce((s, d) => s + d[k], 0);
  return {
    from,
    to,
    totals: { views: sum("views"), carts: sum("carts"), checkouts: sum("checkouts"), orders: sum("orders") },
    days: list,
    products: (top as { ref: string; views: number; carts: number; id: number | null; title: string | null }[]).map((r) => ({ ref: String(r.ref), id: r.id == null ? null : Number(r.id), title: r.title ?? `Product ${r.ref} (removed)`, views: Number(r.views), carts: Number(r.carts) })),
  };
}

/** Day rows older than ~13 months go (housekeeping). */
export async function pruneShopStats(payload: Payload): Promise<number> {
  const { rows } = await (await conn(payload)).execute(sql`DELETE FROM "payload"."cms_shop_stats" WHERE "day" < to_char(now() - interval '400 days', 'YYYY-MM-DD') RETURNING 1`);
  return rows.length;
}
