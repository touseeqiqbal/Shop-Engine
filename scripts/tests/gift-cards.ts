/**
 * Gift cards on the real database:
 *  - the team creates a card (code made for it, balance = value) but can't set or change the balance itself;
 *  - two checkouts spending the same balance at the same moment: only one gets it;
 *  - an order paid partly with a card takes the balance with the order; cancelling gives it back exactly once,
 *    re-opening takes it again (and is refused when the card no longer has enough);
 *  - a card without enough balance stops the order (nothing taken from stock);
 *  - a card payment for the rest of an order settles at the amount left after the gift card;
 *  - switched-off and expired cards can't pay; "email it" queues the recipient's message.
 * Creates its own records in the default store and removes them afterwards.
 *
 *   node --conditions=react-server node_modules/payload/bin.js run scripts/tests/gift-cards.ts
 */
import { randomUUID } from "node:crypto";
import { getPayload } from "payload";
import config from "@payload-config";
import { placeOrderCms } from "../../src/lib/cms/sales";
import { amountToCollect } from "../../src/lib/order-money";
import { markCheckoutPaid } from "../../src/lib/payments";
import { findGiftCard, giftCardProblem, giveBackToGiftCard, takeFromGiftCard } from "../../src/payload/gift-cards";
import { normalizeGiftCardCode } from "../../src/payload/collections/gift-cards";
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

const balanceOf = async (id: number) => Number(((await payload.findByID({ collection: "gift-cards" as never, id, depth: 0, overrideAccess: true })) as unknown as Doc).balance);
const readOrder = async (id: number) => (await payload.findByID({ collection: "orders", id, depth: 0, overrideAccess: true })) as unknown as Doc;

try {
  // a store manager, as their session sees them
  const email = `gift-${tag.toLowerCase()}@test.local`;
  const manager = (await payload.create({ collection: "users", data: { email, password: `Pw-${tag}-g1!`, name: "Gift Test", role: "customer", currentStore: store } as never, ...sys })) as unknown as Doc;
  cleanup.push(() => payload.delete({ collection: "users", id: Number(manager.id), overrideAccess: true }));
  const membership = (await payload.create({ collection: "store-memberships", data: { store, user: manager.id, email, role: "store_manager", status: "active" } as never, ...sys })) as unknown as Doc;
  cleanup.unshift(() => payload.delete({ collection: "store-memberships", id: Number(membership.id), overrideAccess: true, context: { system: true } }));
  const M = { ...((await payload.findByID({ collection: "users", id: Number(manager.id), depth: 0, overrideAccess: true })) as object), collection: "users", twoFactor: { enabled: true } } as never;

  // ── the team creates a card ──
  const card = (await payload.create({ collection: "gift-cards" as never, data: { initialValue: 100, balance: 999, recipientName: "Test", recipientEmail: `to-${tag.toLowerCase()}@test.local`, sendEmail: true } as never, user: M, overrideAccess: false, depth: 0 })) as unknown as Doc;
  const cardId = Number(card.id);
  cleanup.push(() => payload.delete({ collection: "gift-cards" as never, id: cardId, overrideAccess: true }));
  const code = String(card.code);
  check(/^[A-HJKMNP-Z2-9]{4}(-[A-HJKMNP-Z2-9]{4}){3}$/.test(code), `a code is made for the card (${code.slice(0, 4)}-…)`);
  check(Number(card.store) === store, "the card belongs to the manager's store");
  check((await balanceOf(cardId)) === 100, "its balance is its value – a balance typed by the team is ignored");
  await payload.update({ collection: "gift-cards" as never, id: cardId, data: { balance: 5000, initialValue: 5000 } as never, user: M, overrideAccess: false, depth: 0 });
  const after = (await payload.findByID({ collection: "gift-cards" as never, id: cardId, depth: 0, overrideAccess: true })) as unknown as Doc;
  check(Number(after.balance) === 100 && Number(after.initialValue) === 100, "the team can't change the balance or the value afterwards");
  const queued = (await payload.count({ collection: "outbox-events", where: { and: [{ type: { equals: "notify.gift-card" } }, { "data.giftCardId": { equals: cardId } }] } as never, overrideAccess: true })).totalDocs;
  check(queued === 1, "“email it to the recipient” queues one message");
  cleanup.push(() => payload.delete({ collection: "outbox-events", where: { "data.giftCardId": { equals: cardId } } as never, overrideAccess: true }));

  // ── finding it the way shoppers type it ──
  const typed = code.toLowerCase().replace(/-/g, " ");
  const found = await findGiftCard(payload, typed, store);
  check(found?.id === cardId && normalizeGiftCardCode(typed) === code, "found with lower case and spaces instead of dashes");
  check(giftCardProblem(found) === null, "an active card with a balance can pay");
  check((await findGiftCard(payload, code, null)) === null, "another store's checkout doesn't find it");

  // ── two checkouts spend the same balance at the same moment ──
  const both = await Promise.all([1, 2].map((n) => takeFromGiftCard(payload, { code, storeId: store, amount: 70, orderNumber: `GC-RACE-${n}` })));
  check(both.filter(Boolean).length === 1 && (await balanceOf(cardId)) === 30, `only one of two 70 payments from a 100 card goes through (balance ${await balanceOf(cardId)})`);
  await giveBackToGiftCard(payload, { code, storeId: store, amount: 70, orderNumber: "GC-RACE", note: "test" });
  check((await balanceOf(cardId)) === 100, "giving it back restores the balance");

  // ── an order paid partly with the card ──
  const category = (await payload.create({ collection: "categories", data: { store, name: `Gift ${tag}`, slug: `gift-cat-${tag.toLowerCase()}` } as never, ...inStore })) as unknown as Doc;
  cleanup.push(() => payload.delete({ collection: "categories", id: Number(category.id), overrideAccess: true }));
  const brand = (await payload.create({ collection: "brands", data: { store, name: `Gift ${tag}`, slug: `gift-brand-${tag.toLowerCase()}` } as never, ...inStore })) as unknown as Doc;
  cleanup.push(() => payload.delete({ collection: "brands", id: Number(brand.id), overrideAccess: true }));
  const product = (await payload.create({ collection: "products", data: { store, title: `Gift ${tag}`, slug: `gift-${tag.toLowerCase()}`, sku: `GC-${tag}`, price: 100, stock: 5, status: "draft", category: category.id, brand: brand.id } as never, ...inStore })) as unknown as Doc;
  cleanup.unshift(() => payload.delete({ collection: "products", id: Number(product.id), overrideAccess: true }));
  const stockOf = async () => Number(((await payload.findByID({ collection: "products", id: Number(product.id), depth: 0, overrideAccess: true })) as unknown as Doc).stock);

  const orderOf = (n: string, over: Partial<Order> = {}): Order => {
    const now = new Date().toISOString();
    return {
      id: randomUUID(),
      orderNumber: `GC-${tag}-${n}`,
      createdAt: now,
      status: "pending",
      customer: { name: "Gift Test", phone: "0300-4445557", city: "Karachi", address: "Street 5, Block 6" },
      items: [{ productId: String(product.id), slug: String(product.slug), name: String(product.title), image: "", url: "/", unitPrice: 100, qty: 1, upgrades: [] }],
      subtotal: 100,
      discount: 0,
      couponCode: null,
      deliveryCharge: 0,
      total: 100,
      paymentMethod: "cod",
      paymentStatus: "unpaid",
      paymentScreenshotUrl: null,
      courier: null,
      trackingNumber: null,
      notes: null,
      history: [{ status: "pending", at: now }],
      confirmation: null,
      risk: null,
      userId: null,
      storeId: store,
      ...over,
    } as Order;
  };
  const lines = [{ id: String(product.id), qty: 1, title: String(product.title) }];
  const placed = await placeOrderCms(orderOf("A", { giftCardCode: code, giftCardAmount: 40 }), lines, { attemptId: `gc-${tag}-a`, giftCard: { code, amount: 40 } });
  check(placed.ok === true, "order placed with 40 of 100 paid by the card");
  if (!placed.ok) throw new Error("could not place the test order");
  const orderId = Number(placed.order.id);
  cleanup.unshift(() => payload.delete({ collection: "orders", id: orderId, overrideAccess: true, context: { system: true } }));
  let o = await readOrder(orderId);
  check((await balanceOf(cardId)) === 60 && o.giftCardCharged === true, "the card's balance went down with the order (60 left)");
  check(amountToCollect(o as never) === 60, `the rider collects only the rest (${amountToCollect(o as never)})`);
  const ledger = ((await payload.findByID({ collection: "gift-cards" as never, id: cardId, depth: 0, overrideAccess: true })) as unknown as Doc).ledger as { amount: number; order: string }[];
  check(Array.isArray(ledger) && ledger.some((e) => e.order === `GC-${tag}-A` && e.amount === -40), "the card's history shows the payment and the order");

  // the team cancels it (their own access rules) → back on the card, once
  await payload.update({ collection: "orders", id: orderId, data: { status: "cancelled" } as never, user: M, overrideAccess: false, depth: 0 });
  o = await readOrder(orderId);
  check(o.status === "cancelled" && (await balanceOf(cardId)) === 100 && o.giftCardCharged === false, `cancelling gives the 40 back (balance ${await balanceOf(cardId)})`);
  await payload.update({ collection: "orders", id: orderId, data: { status: "cancelled", adminNotes: "again" } as never, user: M, overrideAccess: false, depth: 0 }).catch(() => null);
  check((await balanceOf(cardId)) === 100, "saving the cancelled order again gives nothing more back");
  // re-opened → taken again
  await payload.update({ collection: "orders", id: orderId, data: { status: "pending" } as never, user: M, overrideAccess: false, depth: 0 });
  o = await readOrder(orderId);
  check(o.status === "pending" && (await balanceOf(cardId)) === 60 && o.giftCardCharged === true, "re-opening takes the 40 again");
  // cancelled again, the card spent elsewhere meanwhile → re-opening is refused
  await payload.update({ collection: "orders", id: orderId, data: { status: "cancelled" } as never, user: M, overrideAccess: false, depth: 0 });
  await takeFromGiftCard(payload, { code, storeId: store, amount: 70, orderNumber: "GC-ELSEWHERE" });
  let refused = false;
  await payload.update({ collection: "orders", id: orderId, data: { status: "pending" } as never, user: M, overrideAccess: false, depth: 0 }).catch(() => (refused = true));
  o = await readOrder(orderId);
  check(refused && o.status === "cancelled" && (await balanceOf(cardId)) === 30, "re-opening is refused when the card no longer has the 40");

  // ── not enough balance at checkout → no order, nothing taken from stock ──
  const stock0 = await stockOf();
  const tooMuch = await placeOrderCms(orderOf("B", { giftCardCode: code, giftCardAmount: 50 }), lines, { attemptId: `gc-${tag}-b`, giftCard: { code, amount: 50 } });
  check(!tooMuch.ok && tooMuch.reason === "gift-card" && (await stockOf()) === stock0 && (await balanceOf(cardId)) === 30, "a card with 30 left can't pay 50 – no order, stock untouched");

  // ── a card payment for the rest settles at what is left after the gift card ──
  const cardOrder = await placeOrderCms(orderOf("C", { status: "awaiting-payment", paymentMethod: "card", giftCardCode: code, giftCardAmount: 30 }), lines, { attemptId: `gc-${tag}-c`, giftCard: { code, amount: 30 } });
  if (!cardOrder.ok) throw new Error("could not place the card test order");
  const cardOrderId = Number(cardOrder.order.id);
  cleanup.unshift(() => payload.delete({ collection: "orders", id: cardOrderId, overrideAccess: true, context: { system: true } }));
  const ref = `cs_test_gc_${tag}`;
  const charge = (await payload.create({ collection: "payment-transactions", data: { store, order: cardOrderId, kind: "charge", status: "pending", provider: "stripe", providerRef: ref, amount: 70, currency: "PKR" } as never, ...sys })) as unknown as Doc;
  cleanup.unshift(() => payload.delete({ collection: "payment-transactions", where: { order: { equals: cardOrderId } }, overrideAccess: true }));
  const paid = await markCheckoutPaid(payload, { sessionId: ref, paymentIntent: `pi_gc_${tag}`, amountMinor: 70 * 100, currency: "pkr" });
  o = await readOrder(cardOrderId);
  check(paid === "paid" && o.paymentStatus === "paid", `70 paid by card for a 100 order with 30 on a gift card → Paid (${paid})`);
  check(Number(charge.id) > 0 && (await balanceOf(cardId)) === 0, "the card is used up");

  // ── switched off / expired ──
  await payload.update({ collection: "gift-cards" as never, id: cardId, data: { status: "disabled" } as never, user: M, overrideAccess: false, depth: 0 });
  await giveBackToGiftCard(payload, { code, storeId: store, amount: 10, orderNumber: "GC-TEST", note: "test" });
  check(giftCardProblem(await findGiftCard(payload, code, store)) === "This gift card has been switched off." && !(await takeFromGiftCard(payload, { code, storeId: store, amount: 5, orderNumber: "GC-OFF" })), "a switched-off card can't pay");
  await payload.update({ collection: "gift-cards" as never, id: cardId, data: { status: "active", expiresAt: new Date(Date.now() - 60_000).toISOString() } as never, user: M, overrideAccess: false, depth: 0 });
  check(giftCardProblem(await findGiftCard(payload, code, store)) === "This gift card has expired." && !(await takeFromGiftCard(payload, { code, storeId: store, amount: 5, orderNumber: "GC-OLD" })), "an expired card can't pay");
} catch (e) {
  console.error(e);
  failed++;
} finally {
  for (const fn of cleanup) await fn().catch((e) => console.error("cleanup:", e instanceof Error ? e.message : e));
}

console.log(failed ? `\n${failed} check(s) failed` : "\nAll gift card checks passed");
process.exit(failed ? 1 : 0);
