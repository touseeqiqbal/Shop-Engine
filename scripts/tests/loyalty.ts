/**
 * Loyalty points on the real database:
 *  - a signed-in customer's order earns its points once it is DELIVERED (not before), once;
 *  - returned → the points are taken back; delivered again → earned again;
 *  - all points → one voucher (a gift card in their name) – two clicks at once never make two vouchers;
 *  - a manager corrects a balance ("Add or take away"); nobody types a balance directly;
 *  - with loyalty switched off nothing is earned.
 * Turns loyalty on for the default store while it runs (and restores the settings), creates its own records and
 * removes them afterwards.
 *
 *   node --conditions=react-server node_modules/payload/bin.js run scripts/tests/loyalty.ts
 */
import { randomUUID } from "node:crypto";
import { getPayload } from "payload";
import config from "@payload-config";
import { placeOrderCms } from "../../src/lib/cms/sales";
import { pointsToVoucher } from "../../src/lib/cms/loyalty";
import { addPoints, pointsBalance } from "../../src/payload/loyalty";
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

// loyalty on for this store: 10 points per 100, 1 point = 1, vouchers from 50 points
const settings = (await payload.find({ collection: "store-conversion" as never, where: { store: { equals: store } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined;
let madeSettings: number | null = null;
const setLoyalty = async (loyalty: Doc) => {
  const id = settings ? Number(settings.id) : madeSettings;
  if (id != null) await payload.update({ collection: "store-conversion" as never, id, data: { loyalty } as never, ...inStore });
  else {
    const made = (await payload.create({ collection: "store-conversion" as never, data: { store, loyalty } as never, ...inStore })) as unknown as Doc;
    madeSettings = Number(made.id);
    cleanup.push(() => payload.delete({ collection: "store-conversion" as never, id: Number(made.id), overrideAccess: true }));
  }
};
const before = settings?.loyalty ?? null;
cleanup.push(() => (settings ? payload.update({ collection: "store-conversion" as never, id: Number(settings.id), data: { loyalty: before ?? { enabled: false } } as never, ...inStore }) : Promise.resolve()));

try {
  await setLoyalty({ enabled: true, pointsPer100: 10, pointValue: 1, minRedeem: 50 });
  const email = `loyal-${tag.toLowerCase()}@test.local`;
  const customer = (await payload.create({ collection: "users", data: { email, password: `Pw-${tag}-l1!`, name: "Loyal Customer", role: "customer" } as never, ...sys })) as unknown as Doc;
  const userId = Number(customer.id);
  cleanup.push(() => payload.delete({ collection: "users", id: userId, overrideAccess: true }));
  cleanup.unshift(() => payload.delete({ collection: "loyalty-accounts" as never, where: { customer: { equals: userId } } as never, overrideAccess: true }));
  cleanup.unshift(() => payload.delete({ collection: "gift-cards" as never, where: { customer: { equals: userId } } as never, overrideAccess: true }));

  const category = (await payload.create({ collection: "categories", data: { store, name: `Loyal ${tag}`, slug: `loyal-cat-${tag.toLowerCase()}` } as never, ...inStore })) as unknown as Doc;
  const brand = (await payload.create({ collection: "brands", data: { store, name: `Loyal ${tag}`, slug: `loyal-brand-${tag.toLowerCase()}` } as never, ...inStore })) as unknown as Doc;
  cleanup.push(() => payload.delete({ collection: "categories", id: Number(category.id), overrideAccess: true }), () => payload.delete({ collection: "brands", id: Number(brand.id), overrideAccess: true }));
  const product = (await payload.create({ collection: "products", data: { store, title: `Loyal ${tag}`, slug: `loyal-${tag.toLowerCase()}`, sku: `LOY-${tag}`, price: 1000, stock: 20, status: "draft", _status: "published", category: category.id, brand: brand.id } as never, ...inStore })) as unknown as Doc;
  cleanup.unshift(() => payload.delete({ collection: "products", id: Number(product.id), overrideAccess: true }));

  const order = async (n: string) => {
    const now = new Date().toISOString();
    const r = await placeOrderCms(
      { id: randomUUID(), orderNumber: `LOY-${tag}-${n}`, createdAt: now, status: "pending", customer: { name: "Loyal", phone: "0300-4445550", email, city: "Karachi", address: "Street 5, Block 6" }, items: [{ productId: String(product.id), slug: "x", name: "Loyal", image: "", url: "/", unitPrice: 1000, qty: 1, upgrades: [] }], subtotal: 1000, discount: 0, couponCode: null, deliveryCharge: 200, total: 1200, paymentMethod: "cod", paymentStatus: "unpaid", paymentScreenshotUrl: null, courier: null, trackingNumber: null, notes: null, history: [{ status: "pending", at: now }], confirmation: null, risk: null, userId: String(userId), storeId: store } as unknown as Order,
      [{ id: String(product.id), qty: 1, title: "Loyal" }],
      { attemptId: `loy-${tag}-${n}` },
    );
    if (!r.ok) throw new Error(`order ${n} not placed`);
    const id = Number(r.order.id);
    cleanup.unshift(() => payload.delete({ collection: "orders", id, overrideAccess: true, context: { system: true } }));
    return id;
  };
  const move = (id: number, status: string) => payload.update({ collection: "orders", id, data: { status } as never, ...sys });
  const balance = () => pointsBalance(payload, store, userId);

  // ── earned on delivery ──
  const a = await order("A");
  await move(a, "confirmed");
  await move(a, "dispatched");
  check((await balance()) === 0, "nothing before the order is delivered");
  await move(a, "delivered");
  check((await balance()) === 100, `delivered: 10 points per 100 on the items (not delivery) – ${await balance()}`);
  const delivered = (await payload.findByID({ collection: "orders", id: a, depth: 0, overrideAccess: true })) as unknown as Doc;
  check(Number(delivered.pointsEarned) === 100, "the order remembers what it earned");
  await payload.update({ collection: "orders", id: a, data: { adminNotes: "saved again" } as never, ...sys });
  check((await balance()) === 100, "saving the delivered order again earns nothing more");

  // ── came back ──
  await move(a, "returned");
  check((await balance()) === 0, "returned: the 100 points are taken back");
  await move(a, "delivered");
  check((await balance()) === 100, "delivered again: earned again");

  // ── points → voucher ──
  const voucher = await pointsToVoucher({ id: userId, email, name: "Loyal Customer" }, store);
  check(voucher.ok && voucher.value === 100 && (await balance()) === 0, `100 points → a ${voucher.ok ? voucher.value : "?"} voucher, 0 points left`);
  if (voucher.ok) {
    const card = (await payload.find({ collection: "gift-cards" as never, where: { code: { equals: voucher.code } } as never, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined;
    check(Number(card?.balance) === 100 && Number(card?.customer) === userId && Number(card?.fromPoints) === 100 && card?.status === "active", "the voucher is a working gift card in their name");
  }
  const tooFew = await pointsToVoucher({ id: userId, email }, store);
  check(!tooFew.ok && tooFew.reason === "few", "no points left → no voucher");
  // two clicks at once
  await addPoints(payload, { storeId: store, userId, points: 80, note: "test" });
  const both = await Promise.all([pointsToVoucher({ id: userId, email }, store), pointsToVoucher({ id: userId, email }, store)]);
  const vouchers = (await payload.count({ collection: "gift-cards" as never, where: { customer: { equals: userId } } as never, overrideAccess: true })).totalDocs;
  check(both.filter((r) => r.ok).length === 1 && vouchers === 2 && (await balance()) === 0, `two clicks at once make one voucher (${both.filter((r) => r.ok).length} made)`);

  // ── returned after its points became a voucher: the points are owed (balance below 0), not kept ──
  await move(a, "returned");
  check((await balance()) === -100, `an order returned after its points were spent leaves them owed (balance ${await balance()})`);
  const owedVoucher = await pointsToVoucher({ id: userId, email }, store);
  check(!owedVoucher.ok, "…and no new voucher while points are owed");
  await addPoints(payload, { storeId: store, userId, points: 100, note: "test: settle the owed points" });

  // ── the team corrects a balance ──
  const mEmail = `loyal-m-${tag.toLowerCase()}@test.local`;
  const manager = (await payload.create({ collection: "users", data: { email: mEmail, password: `Pw-${tag}-l2!`, name: "Loyal Manager", role: "customer", currentStore: store } as never, ...sys })) as unknown as Doc;
  cleanup.push(() => payload.delete({ collection: "users", id: Number(manager.id), overrideAccess: true }));
  const m = (await payload.create({ collection: "store-memberships", data: { store, user: manager.id, email: mEmail, role: "store_manager", status: "active" } as never, ...sys })) as unknown as Doc;
  cleanup.unshift(() => payload.delete({ collection: "store-memberships", id: Number(m.id), overrideAccess: true, context: { system: true } }));
  const M = { ...((await payload.findByID({ collection: "users", id: Number(manager.id), depth: 0, overrideAccess: true })) as object), collection: "users", twoFactor: { enabled: true } } as never;
  const account = (await payload.find({ collection: "loyalty-accounts" as never, where: { customer: { equals: userId } } as never, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc;
  await payload.update({ collection: "loyalty-accounts" as never, id: Number(account.id), data: { adjustBy: 25, adjustNote: "Sorry for the wait", balance: 99999 } as never, user: M, overrideAccess: false, depth: 0 });
  const fixed = (await payload.findByID({ collection: "loyalty-accounts" as never, id: Number(account.id), depth: 0, overrideAccess: true })) as unknown as Doc;
  const last = (fixed.ledger as { points: number; note: string }[]).at(-1);
  check(Number(fixed.balance) === 25 && last?.points === 25 && last.note === "Sorry for the wait", `a manager adds 25 points with a reason (balance ${String(fixed.balance)}; a typed balance is ignored)`);
  check(fixed.customerEmail === email, "the account shows the customer's email");

  // ── switched off ──
  await setLoyalty({ enabled: false, pointsPer100: 10, pointValue: 1, minRedeem: 50 });
  const b = await order("B");
  await move(b, "confirmed");
  await move(b, "dispatched");
  await move(b, "delivered");
  check((await balance()) === 25, "with loyalty off a delivered order earns nothing");
} catch (e) {
  console.error(e);
  failed++;
} finally {
  for (const fn of cleanup) await fn().catch((e) => console.error("cleanup:", e instanceof Error ? e.message : e));
}

console.log(failed ? `\n${failed} check(s) failed` : "\nAll loyalty checks passed");
process.exit(failed ? 1 : 0);
