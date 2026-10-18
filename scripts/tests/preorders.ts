/**
 * Pre-orders and backorders on the real database (Products → When sold out):
 *  - "Stop selling": an order for more than the stock is refused (as before);
 *  - "Keep selling": the order goes through, stock goes below 0, the line is marked backorder with what is owed;
 *    the shop counter (POS) still can't sell what isn't there; cancelling puts the stock back;
 *  - "Pre-order" with a future ship date: every unit is a pre-order, even when some are in stock;
 *  - the team can't switch "keep selling" off while units are still owed; serial-tracked products never oversell;
 *  - a stock count treats a negative stock as an empty shelf (what is owed stays owed).
 * Creates its own records in the default store and removes them afterwards.
 *
 *   node --conditions=react-server node_modules/payload/bin.js run scripts/tests/preorders.ts
 */
import { randomUUID } from "node:crypto";
import { getPayload } from "payload";
import config from "@payload-config";
import { placeOrderCms } from "../../src/lib/cms/sales";
import { addStock, takeStock } from "../../src/payload/stock";
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
const orders: number[] = [];

const product = async (n: string, data: Doc) => {
  const p = (await payload.create({ collection: "products", data: { store, title: `Pre ${tag} ${n}`, slug: `pre-${tag.toLowerCase()}-${n}`, sku: `PRE-${tag}-${n}`, price: 100, status: "draft", _status: "published", category: category.id, brand: brand.id, ...data } as never, ...inStore })) as unknown as Doc;
  cleanup.unshift(() => payload.delete({ collection: "products", id: Number(p.id), overrideAccess: true }));
  return Number(p.id);
};
const read = async (id: number) => (await payload.findByID({ collection: "products", id, depth: 0, overrideAccess: true })) as unknown as Doc;
const stockOf = async (id: number) => Number((await read(id)).stock);
const order = async (n: string, productId: number, qty: number) => {
  const now = new Date().toISOString();
  const o = {
    id: randomUUID(), orderNumber: `PRE-${tag}-${n}`, createdAt: now, status: "pending",
    customer: { name: "Pre Test", phone: "0300-4445558", city: "Karachi", address: "Street 5, Block 6" },
    items: [{ productId: String(productId), slug: "x", name: `Pre ${n}`, image: "", url: "/", unitPrice: 100, qty, upgrades: [] }],
    subtotal: 100 * qty, discount: 0, couponCode: null, deliveryCharge: 0, total: 100 * qty, paymentMethod: "cod", paymentStatus: "unpaid",
    paymentScreenshotUrl: null, courier: null, trackingNumber: null, notes: null, history: [{ status: "pending", at: now }], confirmation: null, risk: null, userId: null, storeId: store,
  } as unknown as Order;
  const r = await placeOrderCms(o, [{ id: String(productId), qty, title: `Pre ${n}` }], { attemptId: `pre-${tag}-${n}` });
  if (r.ok) orders.push(Number(r.order.id));
  return r;
};
const lineOf = async (orderId: number) => (((await payload.findByID({ collection: "orders", id: orderId, depth: 0, overrideAccess: true })) as unknown as Doc).items as Doc[])[0];

const category = (await payload.create({ collection: "categories", data: { store, name: `Pre ${tag}`, slug: `pre-cat-${tag.toLowerCase()}` } as never, ...inStore })) as unknown as Doc;
const brand = (await payload.create({ collection: "brands", data: { store, name: `Pre ${tag}`, slug: `pre-brand-${tag.toLowerCase()}` } as never, ...inStore })) as unknown as Doc;
cleanup.push(() => payload.delete({ collection: "categories", id: Number(category.id), overrideAccess: true }), () => payload.delete({ collection: "brands", id: Number(brand.id), overrideAccess: true }));

try {
  // ── stop selling (the default) ──
  const plain = await product("a", { stock: 1 });
  const refused = await order("A", plain, 2);
  check(!refused.ok && refused.reason === "sold-out" && (await stockOf(plain)) === 1, "“Stop selling”: 2 of a product with 1 in stock is refused");

  // ── keep selling ──
  const keep = await product("b", { stock: 1, backorders: "backorder" });
  const placed = await order("B", keep, 3);
  check(placed.ok === true && (await stockOf(keep)) === -2, `“Keep selling”: 3 with 1 in stock goes through, stock ${await stockOf(keep)}`);
  if (placed.ok) {
    const line = await lineOf(Number(placed.order.id));
    check(line.availability === "backorder" && Number(line.owedQty) === 2, `the line is marked backorder, 2 owed (${String(line.availability)}, ${String(line.owedQty)})`);
    check(placed.order.items[0]?.availability === "backorder" && placed.order.items[0]?.owedQty === 2, "the storefront's copy of the order says so too");
  }
  check((await takeStock(payload, keep, 1)) === null && (await stockOf(keep)) === -2, "the shop counter can't sell it while nothing is on the shelf");
  check((await read(keep)).stockStatus === "out", "its stock status is Out (shows up in the restock list)");
  // the team edits the (published) product while 2 are owed
  const saved = await payload.update({ collection: "products", id: keep, data: { title: `Pre ${tag} b renamed` } as never, ...inStore }).then(() => true).catch((e) => (console.log(`  ${e instanceof Error ? e.message : e}`), false));
  check(saved && (await stockOf(keep)) === -2, "the team can still save the product while units are owed (stock stays −2)");
  // …but can't switch "keep selling" off
  let blocked = false;
  await payload.update({ collection: "products", id: keep, data: { backorders: "no" } as never, ...inStore }).catch(() => (blocked = true));
  check(blocked && (await read(keep)).backorders === "backorder", "switching “Keep selling” off while units are owed is refused");

  // ── stock count: a negative stock is an empty shelf ──
  const email = `pre-${tag.toLowerCase()}@test.local`;
  const manager = (await payload.create({ collection: "users", data: { email, password: `Pw-${tag}-p1!`, name: "Pre Test", role: "customer", currentStore: store } as never, ...sys })) as unknown as Doc;
  cleanup.push(() => payload.delete({ collection: "users", id: Number(manager.id), overrideAccess: true }));
  const membership = (await payload.create({ collection: "store-memberships", data: { store, user: manager.id, email, role: "store_manager", status: "active" } as never, ...sys })) as unknown as Doc;
  cleanup.unshift(() => payload.delete({ collection: "store-memberships", id: Number(membership.id), overrideAccess: true, context: { system: true } }));
  const M = { ...((await payload.findByID({ collection: "users", id: Number(manager.id), depth: 0, overrideAccess: true })) as object), collection: "users", twoFactor: { enabled: true } };
  const { inventoryEndpoints } = await import("../../src/payload/endpoints/inventory");
  const call = async (path: string, body: unknown) => {
    const ep = inventoryEndpoints.find((e) => e.path === path)!;
    const res = (await ep.handler({ payload, user: M, headers: new Headers(), json: async () => body, context: {} } as never)) as Response;
    return (await res.json()) as Doc;
  };
  const count = await call("/stock-count/start", { name: `Pre ${tag}`, categoryId: category.id });
  cleanup.unshift(() => payload.delete({ collection: "stock-counts", id: Number(count.id), overrideAccess: true }));
  const lines = (((await payload.findByID({ collection: "stock-counts", id: Number(count.id), depth: 0, overrideAccess: true })) as unknown as Doc).lines ?? []) as Doc[];
  check(Number(lines.find((l) => Number(l.productId) === keep)?.expected) === 0, "a stock count expects an empty shelf for it (not −2)");
  await call("/stock-count/set", { id: count.id, productId: keep, counted: 0 });
  const done = await call("/stock-count/finish", { id: count.id, apply: true });
  check(!done.error && (await stockOf(keep)) === -2, `applying a count of 0 keeps the 2 owed (stock ${await stockOf(keep)}${done.error ? `, ${String(done.error)}` : ""})`);

  // a purchase of 1 arrives: 1 is still owed (it used to become 0 – the owed unit was forgotten)
  check((await addStock(payload, keep, 1)) === -1, `receiving 1 while 2 are owed leaves 1 owed (stock ${await stockOf(keep)})`);

  // the order is cancelled → its 3 come back
  if (placed.ok) await payload.update({ collection: "orders", id: Number(placed.order.id), data: { status: "cancelled" } as never, overrideAccess: true, depth: 0 });
  check((await stockOf(keep)) === 2, "cancelling puts the 3 back (stock 2: the 1 received + the 1 on the shelf)");

  // ── pre-order with a ship date in the future ──
  const pre = await product("c", { stock: 5, backorders: "preorder", releaseDate: new Date(Date.now() + 10 * 86_400_000).toISOString() });
  const preOrder = await order("C", pre, 2);
  if (preOrder.ok) {
    const line = await lineOf(Number(preOrder.order.id));
    check(line.availability === "preorder" && Number(line.owedQty) === 2 && (await stockOf(pre)) === 3, "before its ship date every unit is a pre-order (even with stock)");
  } else check(false, "pre-order placed");
  // released (date passed) with stock: a normal sale
  await payload.update({ collection: "products", id: pre, data: { releaseDate: new Date(Date.now() - 86_400_000).toISOString() } as never, ...inStore });
  const after = await order("D", pre, 1);
  if (after.ok) check(!(await lineOf(Number(after.order.id))).availability, "after its ship date, units in stock sell normally");
  else check(false, "released product sold");

  // ── serial-tracked products never oversell ──
  const tracked = await product("e", { stock: 0, backorders: "backorder", trackUnits: true });
  const trackedOrder = await order("E", tracked, 1);
  check(!trackedOrder.ok && trackedOrder.reason === "sold-out", "a serial-tracked product with no units can't be backordered");
} catch (e) {
  console.error(e);
  failed++;
} finally {
  for (const id of orders) await payload.delete({ collection: "orders", id, overrideAccess: true, context: { system: true } }).catch((e) => console.error("cleanup order:", e instanceof Error ? e.message : e));
  for (const fn of cleanup) await fn().catch((e) => console.error("cleanup:", e instanceof Error ? e.message : e));
}

console.log(failed ? `\n${failed} check(s) failed` : "\nAll pre-order checks passed");
process.exit(failed ? 1 : 0);
