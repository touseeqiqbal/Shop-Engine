/**
 * Stock value report on the real database (GET /cms-api/stock-value): a product with a cost price adds its value,
 * a sale moves it to "sold in the last 30 days", an untouched old product shows as a slow mover; only owners may
 * see it (cost prices are theirs).
 * Creates its own records in the default store and removes them afterwards.
 *
 *   node --conditions=react-server node_modules/payload/bin.js run scripts/tests/stock-value.ts
 */
import { randomUUID } from "node:crypto";
import { getPayload } from "payload";
import config from "@payload-config";
import { sql } from "@payloadcms/db-postgres";
import { placeOrderCms } from "../../src/lib/cms/sales";
import { conn } from "../../src/payload/stock";
import { stockValueEndpoint } from "../../src/payload/endpoints/stock-value";
import type { StockValueReport } from "../../src/lib/stock-value";
import type { Order } from "../../src/lib/types";

const payload = await getPayload({ config });
const sys = { overrideAccess: true, depth: 0, context: { system: true, skipRevalidate: true } } as const;
let failed = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) failed++;
};
type Doc = Record<string, unknown>;
const tag = Date.now().toString(36).toUpperCase();
const store = Number(((await payload.find({ collection: "stores", where: { isDefault: { equals: true } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc).id);
const inStore = { ...sys, context: { ...sys.context, storeId: store } };
const cleanup: (() => Promise<unknown>)[] = [];

const person = async (role: "store_owner" | "store_manager") => {
  const email = `sv-${role}-${tag.toLowerCase()}@test.local`;
  const u = (await payload.create({ collection: "users", data: { email, password: `Pw-${tag}-s1!`, name: "Stock Value Test", role: "customer", currentStore: store } as never, ...sys })) as unknown as Doc;
  cleanup.push(() => payload.delete({ collection: "users", id: Number(u.id), overrideAccess: true }));
  const m = (await payload.create({ collection: "store-memberships", data: { store, user: u.id, email, role, status: "active" } as never, ...sys })) as unknown as Doc;
  cleanup.unshift(() => payload.delete({ collection: "store-memberships", id: Number(m.id), overrideAccess: true, context: { system: true } }));
  return { ...((await payload.findByID({ collection: "users", id: Number(u.id), depth: 0, overrideAccess: true })) as object), collection: "users", twoFactor: { enabled: true } };
};
const report = async (user: unknown) => {
  const res = (await stockValueEndpoint.handler({ payload, user, headers: new Headers(), context: {} } as never)) as Response;
  return { status: res.status, body: (await res.json()) as StockValueReport & { error?: string } };
};

try {
  const category = (await payload.create({ collection: "categories", data: { store, name: `SV ${tag}`, slug: `sv-cat-${tag.toLowerCase()}` } as never, ...inStore })) as unknown as Doc;
  const brand = (await payload.create({ collection: "brands", data: { store, name: `SV ${tag}`, slug: `sv-brand-${tag.toLowerCase()}` } as never, ...inStore })) as unknown as Doc;
  cleanup.push(() => payload.delete({ collection: "categories", id: Number(category.id), overrideAccess: true }), () => payload.delete({ collection: "brands", id: Number(brand.id), overrideAccess: true }));
  const product = async (n: string, data: Doc) => {
    const p = (await payload.create({ collection: "products", data: { store, title: `SV ${tag} ${n}`, slug: `sv-${tag.toLowerCase()}-${n}`, sku: `SV-${tag}-${n}`, status: "draft", _status: "published", category: category.id, brand: brand.id, ...data } as never, ...inStore })) as unknown as Doc;
    cleanup.unshift(() => payload.delete({ collection: "products", id: Number(p.id), overrideAccess: true }));
    return Number(p.id);
  };

  const owner = await person("store_owner");
  const manager = await person("store_manager");
  const before = await report(owner);
  check(before.status === 200, `an owner gets the report (${before.status}${before.body.error ? `: ${before.body.error}` : ""})`);
  const denied = await report(manager);
  check(denied.status === 403, `a manager doesn't (cost prices are the owner's) – ${denied.status}`);

  // a fresh product that sells today, and one added a year ago that never sold
  const fresh = await product("fresh", { price: 150, costPrice: 100, stock: 5 });
  const old = await product("old", { price: 900, costPrice: 600, stock: 2 });
  await (await conn(payload)).execute(sql`UPDATE "payload"."cms_products" SET "created_at" = now() - interval '365 days' WHERE "id" = ${old}`);
  const now = new Date().toISOString();
  const sold = await placeOrderCms(
    { id: randomUUID(), orderNumber: `SV-${tag}`, createdAt: now, status: "pending", customer: { name: "SV", phone: "0300-4445559", city: "Karachi", address: "Street 5, Block 6" }, items: [{ productId: String(fresh), slug: "x", name: "SV", image: "", url: "/", unitPrice: 150, qty: 1, upgrades: [] }], subtotal: 150, discount: 0, couponCode: null, deliveryCharge: 0, total: 150, paymentMethod: "cod", paymentStatus: "unpaid", paymentScreenshotUrl: null, courier: null, trackingNumber: null, notes: null, history: [{ status: "pending", at: now }], confirmation: null, risk: null, userId: null, storeId: store } as unknown as Order,
    [{ id: String(fresh), qty: 1, title: "SV" }],
    { attemptId: `sv-${tag}` },
  );
  if (sold.ok) cleanup.unshift(() => payload.delete({ collection: "orders", id: Number(sold.order.id), overrideAccess: true, context: { system: true } }));
  const after = await report(owner);
  const d = after.body;
  check(d.totals.units - before.body.totals.units === 6, `6 more units on the shelves (4 + 2): ${d.totals.units - before.body.totals.units}`);
  check(Math.round(d.totals.costValue - before.body.totals.costValue) === 4 * 100 + 2 * 600, `their value at cost: ${Math.round(d.totals.costValue - before.body.totals.costValue)}`);
  check(Math.round(d.totals.retailValue - before.body.totals.retailValue) === 4 * 150 + 2 * 900, `…and at today's prices: ${Math.round(d.totals.retailValue - before.body.totals.retailValue)}`);
  const slow = d.slow.find((s) => s.id === old);
  check(Boolean(slow) && slow!.neverSold && slow!.days >= 364 && slow!.costValue === 1200, `the year-old product is a slow mover (${slow ? `${slow.days} days, ${slow.costValue}` : "missing"})`);
  check(!d.slow.some((s) => s.id === fresh), "the product that sold today isn't");
  check(d.buckets[0].products - before.body.buckets[0].products === 1, "it counts as sold in the last 30 days");
} catch (e) {
  console.error(e);
  failed++;
} finally {
  for (const fn of cleanup) await fn().catch((e) => console.error("cleanup:", e instanceof Error ? e.message : e));
}

console.log(failed ? `\n${failed} check(s) failed` : "\nAll stock value checks passed");
process.exit(failed ? 1 : 0);
