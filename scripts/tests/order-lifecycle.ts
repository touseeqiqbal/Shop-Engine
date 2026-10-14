/**
 * Order lifecycle (real database): an order placed through the storefront's checkout code (stock + coupon in one
 * transaction), then status changes queue the customer's message in the outbox once per change, cancelling gives the
 * stock and the coupon use back exactly once, and re-opening takes them again.
 * Creates its own product, discount and order in the default store and removes them afterwards.
 *
 *   node --conditions=react-server node_modules/payload/bin.js run scripts/tests/order-lifecycle.ts
 */
import { randomUUID } from "node:crypto";
import { getPayload } from "payload";
import config from "@payload-config";
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
const tag = Date.now().toString(36).toUpperCase();
const store = Number(((await payload.find({ collection: "stores", where: { isDefault: { equals: true } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc).id);

const inStore = { ...sys, context: { ...sys.context, storeId: store } };
const category = (await payload.create({ collection: "categories", data: { store, name: `Lifecycle ${tag}`, slug: `lifecycle-cat-${tag.toLowerCase()}` } as never, ...inStore })) as unknown as Doc;
const brand = (await payload.create({ collection: "brands", data: { store, name: `Lifecycle ${tag}`, slug: `lifecycle-brand-${tag.toLowerCase()}` } as never, ...inStore })) as unknown as Doc;
const product = (await payload.create({ collection: "products", data: { store, title: `Lifecycle ${tag}`, slug: `lifecycle-${tag.toLowerCase()}`, sku: `LC-${tag}`, price: 1000, stock: 5, status: "draft", category: category.id, brand: brand.id } as never, ...inStore })) as unknown as Doc;
const code = `LC${tag}`;
const discount = (await payload.create({ collection: "discounts", data: { store, code, kind: "percent", value: 10, active: true, used: 0, usageLimit: 10 } as never, ...sys, context: { ...sys.context, storeId: store } })) as unknown as Doc;
let id = 0;
try {
  const now = new Date();
  const order: Order = {
    id: randomUUID(),
    orderNumber: `LC-${tag}`,
    createdAt: now.toISOString(),
    status: "pending",
    customer: { name: "Lifecycle Test", phone: "0300-4445556", city: "Karachi", address: "Street 5, Block 6" },
    items: [{ productId: String(product.id), slug: String(product.slug), name: String(product.title), image: "", url: "/", unitPrice: 1000, qty: 1, upgrades: [] }],
    subtotal: 1000,
    discount: 100,
    couponCode: code,
    deliveryCharge: 0,
    total: 900,
    paymentMethod: "cod",
    paymentStatus: "unpaid",
    paymentScreenshotUrl: null,
    courier: null,
    trackingNumber: null,
    notes: null,
    history: [{ status: "pending", at: now.toISOString() }],
    confirmation: null,
    risk: null,
    userId: null,
    storeId: store,
  } as Order;
  const placed = await placeOrderCms(order, [{ id: String(product.id), qty: 1, title: String(product.title) }], { attemptId: `lc-${tag}`, couponCode: code });
  check(placed.ok === true, "order placed through the checkout code");
  if (!placed.ok) throw new Error("could not place the test order");
  id = Number(placed.order.id);

  const stockOf = async () => Number(((await payload.findByID({ collection: "products", id: Number(product.id), depth: 0, overrideAccess: true })) as unknown as Doc).stock);
  const usedOf = async () => Number(((await payload.findByID({ collection: "discounts", id: Number(discount.id), depth: 0, overrideAccess: true })) as unknown as Doc).used);
  const outbox = async (type: string) => (await payload.count({ collection: "outbox-events", where: { and: [{ type: { equals: type } }, { "data.orderId": { equals: id } }] } as never, overrideAccess: true })).totalDocs;

  check((await stockOf()) === 4 && (await usedOf()) === 1, "placing took 1 from stock and counted the coupon");
  check((await outbox("notify.order-placed")) === 1, "the 'order received' message is queued with the order");

  const stock0 = await stockOf();
  const used0 = await usedOf();
  await payload.update({ collection: "orders", id, data: { status: "confirmed" } as never, overrideAccess: true, depth: 0 });
  check((await outbox("notify.order-status")) === 1, "confirming queues one status message");
  const back = (await payload.findByID({ collection: "orders", id, depth: 0, overrideAccess: true })) as unknown as Doc;
  check(back.fulfillmentStatus === "unfulfilled" && back.status === "confirmed", "order confirmed, still unfulfilled");

  await payload.update({ collection: "orders", id, data: { status: "cancelled" } as never, overrideAccess: true, depth: 0 });
  const stock1 = await stockOf();
  const used1 = await usedOf();
  check(stock1 === stock0 + 1, `cancelling puts the stock back (${stock0} → ${stock1})`);
  check(used1 === used0 - 1, `cancelling gives the coupon use back (${used0} → ${used1})`);
  const cancelled = (await payload.findByID({ collection: "orders", id, depth: 0, overrideAccess: true })) as unknown as Doc;
  check(cancelled.fulfillmentStatus === "cancelled", "fulfilment status follows (cancelled)");

  // a second "cancel" (double click, two tabs) changes nothing
  await payload.update({ collection: "orders", id, data: { status: "cancelled", adminNotes: "again" } as never, overrideAccess: true, depth: 0 }).catch(() => null);
  check((await stockOf()) === stock1 && (await usedOf()) === used1, "a repeated cancel doesn't restock or release twice");

  // re-opening (a manager's decision) takes them again
  await payload.update({ collection: "orders", id, data: { status: "pending" } as never, overrideAccess: true, depth: 0 });
  check((await stockOf()) === stock0, "re-opening takes the stock again");
  check((await usedOf()) === used0, "re-opening counts the coupon again");
  check((await outbox("notify.order-status")) === 3, "every status change queued its own message");
  // finish: cancel so the stock goes back before the clean-up
  await payload.update({ collection: "orders", id, data: { status: "cancelled" } as never, overrideAccess: true, depth: 0 });
} finally {
  if (id) await payload.delete({ collection: "orders", id, overrideAccess: true, context: { migrating: true, skipStock: true } }).catch((e) => console.warn(`cleanup order: ${(e as Error).message}`));
  await payload.delete({ collection: "discounts", id: Number(discount.id), ...sys }).catch((e) => console.warn(`cleanup discount: ${(e as Error).message}`));
  await payload.delete({ collection: "products", id: Number(product.id), ...sys }).catch((e) => console.warn(`cleanup product: ${(e as Error).message}`));
  await payload.delete({ collection: "brands", id: Number(brand.id), ...sys }).catch((e) => console.warn(`cleanup brand: ${(e as Error).message}`));
  await payload.delete({ collection: "categories", id: Number(category.id), ...sys }).catch((e) => console.warn(`cleanup category: ${(e as Error).message}`));
}
console.log(failed ? `Order lifecycle FAILED (${failed})` : "Order lifecycle passed");
process.exit(failed ? 1 : 0);
