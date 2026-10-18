/**
 * Shop funnel on the real database: many events at once are all counted (one row per store, day, kind and product),
 * the report adds them up with the store's orders and names the products, only managers see it, and old days are
 * pruned. Uses a store of its own (created and removed here), so the numbers are exact.
 *
 *   node --conditions=react-server node_modules/payload/bin.js run scripts/tests/shop-funnel.ts
 */
import { getPayload } from "payload";
import config from "@payload-config";
import { sql } from "@payloadcms/db-postgres";
import { conn } from "../../src/payload/stock";
import { funnelFor, pruneShopStats, recordStat } from "../../src/payload/shop-stats";
import { shopFunnelEndpoint } from "../../src/payload/endpoints/shop-funnel";
import { addDays, dayIn } from "../../src/lib/time";
import { randomUUID } from "node:crypto";
import { placeOrderCms } from "../../src/lib/cms/sales";
import type { Order } from "../../src/lib/types";

const payload = await getPayload({ config });
const sys = { overrideAccess: true, depth: 0, context: { system: true, skipRevalidate: true } } as const;
let failed = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) failed++;
};
type Doc = Record<string, unknown>;
const tag = Date.now().toString(36);
const cleanup: (() => Promise<unknown>)[] = [];

try {
  const store = (await payload.create({ collection: "stores", data: { name: `Funnel ${tag}`, slug: `funnel-${tag}`, subdomain: `funnel-${tag}`, status: "active", subscriptionStatus: "active" } as never, ...sys })) as unknown as Doc;
  const storeId = Number(store.id);
  cleanup.push(() => payload.delete({ collection: "stores", id: storeId, overrideAccess: true, context: { system: true } }));
  cleanup.unshift(async () => (await conn(payload)).execute(sql`DELETE FROM "payload"."cms_shop_stats" WHERE "store_id" = ${storeId}`));
  const tz = "Asia/Karachi";
  const today = dayIn(Date.now(), tz);
  const category = (await payload.create({ collection: "categories", data: { store: storeId, name: `F ${tag}`, slug: `f-cat-${tag}` } as never, ...sys, context: { ...sys.context, storeId } })) as unknown as Doc;
  const brand = (await payload.create({ collection: "brands", data: { store: storeId, name: `F ${tag}`, slug: `f-brand-${tag}` } as never, ...sys, context: { ...sys.context, storeId } })) as unknown as Doc;
  const product = (await payload.create({ collection: "products", data: { store: storeId, title: `Funnel Phone ${tag}`, slug: `funnel-${tag}`, sku: `F-${tag}`, price: 100, stock: 5, status: "draft", _status: "published", category: category.id, brand: brand.id } as never, ...sys, context: { ...sys.context, storeId } })) as unknown as Doc;
  cleanup.unshift(() => payload.delete({ collection: "products", id: Number(product.id), overrideAccess: true }));
  cleanup.push(() => payload.delete({ collection: "categories", id: Number(category.id), overrideAccess: true }), () => payload.delete({ collection: "brands", id: Number(brand.id), overrideAccess: true }));
  const ref = String(product.legacyId || product.id);

  // 50 views at the same moment, 6 carts, 3 checkouts; and yesterday 10 views
  await Promise.all(Array.from({ length: 50 }, () => recordStat(payload, { storeId, day: today, kind: "view", ref })));
  await Promise.all(Array.from({ length: 6 }, () => recordStat(payload, { storeId, day: today, kind: "cart", ref })));
  await Promise.all(Array.from({ length: 3 }, () => recordStat(payload, { storeId, day: today, kind: "checkout", ref: "" })));
  await Promise.all(Array.from({ length: 10 }, () => recordStat(payload, { storeId, day: addDays(today, -1), kind: "view", ref })));
  const { rows } = await (await conn(payload)).execute(sql`SELECT COUNT(*)::int AS rows, SUM("count")::int AS total FROM "payload"."cms_shop_stats" WHERE "store_id" = ${storeId}`);
  check(Number(rows[0].rows) === 4 && Number(rows[0].total) === 69, `69 events at once → 4 day rows, every one counted (${String(rows[0].rows)} rows, ${String(rows[0].total)})`);

  // one order through the online checkout (it has an attempt id) and one typed in by the team (none)
  for (const [n, attemptId] of [["ON", `fun-${tag}`], ["TEAM", null]] as const) {
    const now = new Date().toISOString();
    const r = await placeOrderCms(
      { id: randomUUID(), orderNumber: `FUN-${tag}-${n}`, createdAt: now, status: "pending", customer: { name: "Funnel", phone: "0300-4445552", city: "Karachi", address: "Street 5, Block 6" }, items: [{ productId: String(product.id), slug: "x", name: "F", image: "", url: "/", unitPrice: 100, qty: 1, upgrades: [] }], subtotal: 100, discount: 0, couponCode: null, deliveryCharge: 0, total: 100, paymentMethod: "cod", paymentStatus: "unpaid", paymentScreenshotUrl: null, courier: null, trackingNumber: null, notes: null, history: [{ status: "pending", at: now }], confirmation: null, risk: null, userId: null, storeId } as unknown as Order,
      [{ id: String(product.id), qty: 1, title: "F" }],
      { attemptId },
    );
    if (r.ok) cleanup.unshift(() => payload.delete({ collection: "orders", id: Number(r.order.id), overrideAccess: true, context: { system: true } }));
  }

  const f = await funnelFor(payload, storeId, addDays(today, -6), today, tz);
  check(f.totals.views === 60 && f.totals.carts === 6 && f.totals.checkouts === 3, `the funnel adds them up (${JSON.stringify(f.totals)})`);
  check(f.totals.orders === 1, `orders: only the one placed through the online checkout (${f.totals.orders})`);
  check(f.days.length === 2 && f.days.at(-1)?.views === 50, "day by day");
  check(f.products[0]?.title === `Funnel Phone ${tag}` && f.products[0].views === 60 && f.products[0].carts === 6 && f.products[0].id === Number(product.id), "the most viewed product, by name");
  const other = await funnelFor(payload, storeId, addDays(today, -40), addDays(today, -30), tz);
  check(other.totals.views === 0, "nothing outside the period");

  // only managers
  const person = async (role: string) => {
    const email = `funnel-${role}-${tag}@test.local`;
    const u = (await payload.create({ collection: "users", data: { email, password: `Pw-${tag}-f1!`, name: "Funnel", role: "customer", currentStore: storeId } as never, ...sys })) as unknown as Doc;
    cleanup.push(() => payload.delete({ collection: "users", id: Number(u.id), overrideAccess: true }));
    const m = (await payload.create({ collection: "store-memberships", data: { store: storeId, user: u.id, email, role, status: "active" } as never, ...sys })) as unknown as Doc;
    cleanup.unshift(() => payload.delete({ collection: "store-memberships", id: Number(m.id), overrideAccess: true, context: { system: true } }));
    return { ...((await payload.findByID({ collection: "users", id: Number(u.id), depth: 0, overrideAccess: true })) as object), collection: "users", twoFactor: { enabled: true } };
  };
  const call = async (user: unknown) => (await shopFunnelEndpoint.handler({ payload, user, headers: new Headers(), url: "http://x/cms-api/shop-funnel?days=7", context: {} } as never)) as Response;
  const asManager = await call(await person("store_manager"));
  const body = (await asManager.json()) as { totals?: { views: number } };
  check(asManager.status === 200 && body.totals?.views === 60, `a manager sees the report (${asManager.status})`);
  check((await call(await person("store_staff"))).status === 403, "staff don't");

  // old days are pruned
  await (await conn(payload)).execute(sql`
    INSERT INTO "payload"."cms_shop_stats" ("store_id", "day", "kind", "ref", "count", "updated_at", "created_at") VALUES (${storeId}, ${addDays(today, -500)}, 'view', ${ref}, 3, now(), now())`);
  await pruneShopStats(payload);
  const { rows: left } = await (await conn(payload)).execute(sql`SELECT COUNT(*)::int AS n FROM "payload"."cms_shop_stats" WHERE "store_id" = ${storeId}`);
  check(Number(left[0].n) === 4, "days older than ~13 months are removed, recent ones kept");
} catch (e) {
  console.error(e);
  failed++;
} finally {
  for (const fn of cleanup) await fn().catch((e) => console.error("cleanup:", e instanceof Error ? e.message : e));
}

console.log(failed ? `\n${failed} check(s) failed` : "\nAll shop funnel checks passed");
process.exit(failed ? 1 : 0);
