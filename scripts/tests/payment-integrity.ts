/**
 * Payment integrity (real database):
 *  - cancelling an order that waits for its card payment queues closing its payment page at the provider;
 *  - a payment that still arrives after cancelling is recorded (the money is real), but the order stays cancelled:
 *    no "order received" message, no download links – the store's team gets an alert to refund it or re-open the order;
 *  - the same payment reported again changes nothing.
 * Creates its own order and payment rows and removes them afterwards.
 *
 *   node --conditions=react-server node_modules/payload/bin.js run scripts/tests/payment-integrity.ts
 */
import { getPayload } from "payload";
import config from "@payload-config";
import { failCheckout, markCheckoutPaid } from "../../src/lib/payments";
import { toMinor } from "../../src/lib/payments/stripe";
import { orderDownloads } from "../../src/payload/downloads";

const payload = await getPayload({ config });
let failed = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) failed++;
};
type Doc = Record<string, unknown>;
const tag = Date.now().toString(36).toUpperCase();
const store = Number(((await payload.find({ collection: "stores", where: { isDefault: { equals: true } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc).id);
const cleanup: (() => Promise<unknown>)[] = [];
const outbox = async (where: Doc) => (await payload.find({ collection: "outbox-events" as never, where: where as never, limit: 10, depth: 0, overrideAccess: true })).docs as unknown as Doc[];

try {
  const order = (await payload.create({
    collection: "orders",
    data: {
      store,
      orderNumber: `PAY-${tag}`,
      placedAt: new Date().toISOString(),
      status: "awaiting-payment",
      customer: { name: "Payment Test", phone: "0300-1112223", city: "Karachi", address: "Street 1, Block 2", email: `pay-${tag.toLowerCase()}@test.local` },
      items: [{ title: "Mouse", qty: 1, unitPrice: 1000 }],
      subtotal: 1000,
      total: 1000,
      paymentMethod: "card",
      paymentStatus: "unpaid",
    } as never,
    overrideAccess: true,
    depth: 0,
    context: { migrating: true },
  })) as unknown as Doc;
  const orderId = Number(order.id);
  cleanup.push(() => payload.delete({ collection: "orders", id: orderId, overrideAccess: true, context: { migrating: true, system: true } }));
  const sessionId = `cs_test_${tag}`;
  const charge = (await payload.create({
    collection: "payment-transactions",
    data: { store, order: orderId, kind: "charge", status: "pending", provider: "stripe", providerRef: sessionId, amount: 1000, currency: "PKR", idempotencyKey: `pay-${tag}`, expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() } as never,
    overrideAccess: true,
    depth: 0,
    context: { storefront: true },
  })) as unknown as Doc;
  cleanup.unshift(() => payload.delete({ collection: "payment-transactions", id: Number(charge.id), overrideAccess: true }));
  cleanup.push(async () => {
    for (const e of await outbox({ or: [{ "data.orderId": { equals: orderId } }, { dedupeKey: { like: `${orderId}` } }] })) await payload.delete({ collection: "outbox-events" as never, id: Number(e.id), overrideAccess: true });
  });

  // the store's team cancels it while the payment page is still open
  await payload.update({ collection: "orders", id: orderId, data: { status: "cancelled" } as never, overrideAccess: true, depth: 0 });
  check((await outbox({ dedupeKey: { equals: `payments.expire:${orderId}` } })).length === 1, "cancelling queues closing the open payment page");

  // the page is closed (or expires) – and then the payment arrives anyway (used late / a delayed bank method)
  await failCheckout(payload, sessionId, "order cancelled by the store");
  const paid = await markCheckoutPaid(payload, { sessionId, paymentIntent: `pi_test_${tag}`, amountMinor: toMinor(1000, "pkr"), currency: "pkr" });
  check(paid === "paid", `the late payment is recorded (${paid})`);
  const after = (await payload.findByID({ collection: "orders", id: orderId, depth: 0, overrideAccess: true })) as unknown as Doc;
  check(after.status === "cancelled" && after.paymentStatus === "paid", `the order stays cancelled, marked paid (${String(after.status)} / ${String(after.paymentStatus)})`);
  const chargeNow = (await payload.findByID({ collection: "payment-transactions", id: Number(charge.id), depth: 0, overrideAccess: true })) as unknown as Doc;
  check(chargeNow.status === "succeeded", "the payment row says the money came in");
  check((await outbox({ dedupeKey: { equals: `order-placed:${orderId}` } })).length === 0, "no 'order received' message for a cancelled order");
  check((await outbox({ dedupeKey: { equals: `paid-after-cancel:${orderId}` } })).length === 1, "the store's team gets an alert to refund it or re-open the order");
  check((await outbox({ dedupeKey: { equals: `downloads:${orderId}` } })).length === 0 && (await orderDownloads(payload, after)).paid === false, "no download links for a cancelled order");
  const again = await markCheckoutPaid(payload, { sessionId, paymentIntent: `pi_test_${tag}`, amountMinor: toMinor(1000, "pkr"), currency: "pkr" });
  check(again === "already", `the same payment reported again changes nothing (${again})`);

  // ── one refund ledger per order: returns (cash …) and refunds through the provider together ≤ the order total ──
  const paidOrder = (await payload.create({
    collection: "orders",
    data: {
      store,
      orderNumber: `REF-${tag}`,
      placedAt: new Date().toISOString(),
      status: "delivered",
      customer: { name: "Refund Test", phone: "0300-1112224", city: "Karachi", address: "Street 1, Block 2" },
      items: [{ title: "Mouse", qty: 2, unitPrice: 500 }],
      subtotal: 1000,
      total: 1000,
      paymentMethod: "card",
      paymentStatus: "paid",
    } as never,
    overrideAccess: true,
    depth: 0,
    context: { migrating: true },
  })) as unknown as Doc;
  const paidId = Number(paidOrder.id);
  cleanup.push(() => payload.delete({ collection: "orders", id: paidId, overrideAccess: true, context: { migrating: true, system: true } }));
  const paidCharge = (await payload.create({
    collection: "payment-transactions",
    data: { store, order: paidId, kind: "charge", status: "succeeded", provider: "stripe", providerRef: `cs_test_ref_${tag}`, paymentIntent: `pi_test_ref_${tag}`, amount: 1000, currency: "PKR", idempotencyKey: `ref-${tag}` } as never,
    overrideAccess: true,
    depth: 0,
  })) as unknown as Doc;
  cleanup.unshift(() => payload.delete({ collection: "payment-transactions", id: Number(paidCharge.id), overrideAccess: true }));
  const returnIds: number[] = [];
  cleanup.unshift(async () => {
    for (const id of returnIds) await payload.delete({ collection: "return-requests", id, overrideAccess: true, context: { system: true } });
  });
  const finishReturn = (n: string, amount: number) =>
    payload
      .create({
        collection: "return-requests",
        data: { store, order: paidId, orderNumber: `REF-${tag}`, status: "refunded", customerName: "Refund Test", customerPhone: "0300-1112224", reason: `test ${n}`, items: [{ title: "Mouse", qty: 1, unitPrice: 500 }], refundMethod: "cash", refundAmount: amount } as never,
        overrideAccess: true,
        depth: 0,
        context: { storeId: store },
      })
      .then((d) => (returnIds.push(Number((d as unknown as Doc).id)), "ok"))
      .catch((e: unknown) => (e instanceof Error ? e.message : String(e)));

  // two returns of 500 finished at the same moment on a 1000 order – then a third: only 1000 in total may go back
  const both = await Promise.all([finishReturn("a", 500), finishReturn("b", 500)]);
  check(both.every((r) => r === "ok"), `two returns that fit are both finished (${both.join(" | ")})`);
  const third = await finishReturn("c", 100);
  check(third !== "ok" && /more than its total/.test(third), `a third return beyond the total is refused (${third.slice(0, 120)})`);
  const { refundCardOrder } = await import("../../src/lib/payments");
  const { createLocalReq } = await import("payload");
  // the card payment itself still shows 1000 unrefunded – but the order has nothing left: the online refund is refused
  // before anything is sent to the provider
  const online = await refundCardOrder(payload, await createLocalReq({}, payload), { orderId: paidId, amount: 300 })
    .then(() => "ok")
    .catch((e: unknown) => (e instanceof Error ? e.message : String(e)));
  check(/at most 0/.test(online), `a card refund after cash refunds of the whole total is refused (${online.slice(0, 120)})`);

  // concurrent: two returns of 600 on a fresh 1000 order – only one may pass (the order row is locked)
  const raceOrder = (await payload.create({
    collection: "orders",
    data: { store, orderNumber: `RACE-${tag}`, placedAt: new Date().toISOString(), status: "delivered", customer: { name: "Race Test", phone: "0300-1112225", city: "Karachi", address: "Street 1, Block 2" }, items: [{ title: "Mouse", qty: 2, unitPrice: 600 }], subtotal: 1000, total: 1000, paymentMethod: "cod", paymentStatus: "paid" } as never,
    overrideAccess: true,
    depth: 0,
    context: { migrating: true },
  })) as unknown as Doc;
  const raceId = Number(raceOrder.id);
  cleanup.push(() => payload.delete({ collection: "orders", id: raceId, overrideAccess: true, context: { migrating: true, system: true } }));
  const raceReturn = (n: string) =>
    payload
      .create({ collection: "return-requests", data: { store, order: raceId, orderNumber: `RACE-${tag}`, status: "refunded", customerName: "Race Test", customerPhone: "0300-1112225", reason: `race ${n}`, items: [{ title: "Mouse", qty: 1, unitPrice: 600 }], refundMethod: "cash", refundAmount: 600 } as never, overrideAccess: true, depth: 0, context: { storeId: store } })
      .then((d) => (returnIds.push(Number((d as unknown as Doc).id)), "ok"))
      .catch((e: unknown) => (e instanceof Error ? e.message : String(e)));
  // ── an order "waiting for online payment" with no payment left is cancelled by housekeeping; one with an open
  //    payment (a voucher paid days later …) is left alone ──
  const { cancelOrphanedPaymentOrders } = await import("../../src/lib/payments");
  const waitingOrder = async (n: string) => {
    const d = (await payload.create({
      collection: "orders",
      data: { store, orderNumber: `ORPH-${tag}-${n}`, placedAt: "2001-01-01T00:00:00.000Z", status: "awaiting-payment", customer: { name: "Orphan Test", phone: "0300-1112226", city: "Karachi", address: "Street 1, Block 2" }, items: [{ title: "Mouse", qty: 1, unitPrice: 500 }], subtotal: 500, total: 500, paymentMethod: "card", paymentStatus: "unpaid" } as never,
      overrideAccess: true,
      depth: 0,
      context: { migrating: true },
    })) as unknown as Doc;
    cleanup.push(() => payload.delete({ collection: "orders", id: Number(d.id), overrideAccess: true, context: { migrating: true, system: true } }));
    return Number(d.id);
  };
  const orphan = await waitingOrder("A");
  const withVoucher = await waitingOrder("B");
  const voucher = (await payload.create({ collection: "payment-transactions", data: { store, order: withVoucher, kind: "charge", status: "pending", provider: "stripe", providerRef: `cs_test_orph_${tag}`, amount: 500, currency: "PKR", idempotencyKey: `orph-${tag}` } as never, overrideAccess: true, depth: 0 })) as unknown as Doc;
  cleanup.unshift(() => payload.delete({ collection: "payment-transactions", id: Number(voucher.id), overrideAccess: true }));
  await cancelOrphanedPaymentOrders(payload, { olderThanMs: 6 * 3600_000 });
  const statusOf = async (id: number) => String(((await payload.findByID({ collection: "orders", id, depth: 0, overrideAccess: true })) as unknown as Doc).status);
  check((await statusOf(orphan)) === "cancelled", "an order waiting for a payment that no longer exists is cancelled (its stock goes back)");
  check((await statusOf(withVoucher)) === "awaiting-payment", "…one with a payment still open is left alone");

  // ── editing an order in /cms keeps what the checkout added on top: tax added on top (follows the goods) and the
  //    cash-on-delivery fee; an order waiting for its online payment can't change its total ──
  const taxed = (await payload.create({
    collection: "orders",
    data: { store, orderNumber: `TAX-${tag}`, placedAt: new Date().toISOString(), status: "pending", customer: { name: "Tax Test", phone: "0300-1112227", city: "Karachi", address: "Street 1, Block 2" }, items: [{ title: "Mouse", qty: 1, unitPrice: 1000 }], subtotal: 1000, discount: 0, deliveryCharge: 200, total: 1350, taxTotal: 100, taxBreakdown: [{ rate: 10, base: 1000, tax: 100 }], paymentMethod: "cod", paymentStatus: "unpaid" } as never,
    overrideAccess: true,
    depth: 0,
    context: { migrating: true },
  })) as unknown as Doc;
  cleanup.push(() => payload.delete({ collection: "orders", id: Number(taxed.id), overrideAccess: true, context: { migrating: true, system: true } }));
  const edited = (await payload.update({ collection: "orders", id: Number(taxed.id), data: { items: [{ title: "Mouse", qty: 2, unitPrice: 1000 }] } as never, overrideAccess: true, depth: 0, context: { skipStock: true } })) as unknown as Doc;
  // the store's own setting decides: tax added on top follows the goods (100 → 200); tax inside the prices (the
  // default) stays inside them – the 150 on top is then the cash-on-delivery fee and is kept as it is
  const { getStoreSettings } = await import("../../src/payload/store-settings");
  const taxOnTop = ((await getStoreSettings<{ tax?: { inclusive?: boolean } }>(payload, "payments", store).catch(() => ({}))) as { tax?: { inclusive?: boolean } }).tax?.inclusive === false;
  const want = taxOnTop ? 2000 + 200 + 50 + 200 : 2000 + 200 + 150;
  check(Number(edited.total) === want && Number(edited.taxTotal) === 200, `an edited order keeps what the checkout added (tax ${taxOnTop ? "added on top" : "inside the prices"}): total ${String(edited.total)} (want ${want}), tax ${String(edited.taxTotal)}`);
  const awaiting = await waitingOrder("C");
  const blocked = await payload
    .update({ collection: "orders", id: awaiting, data: { items: [{ title: "Mouse", qty: 3, unitPrice: 500 }] } as never, overrideAccess: true, depth: 0 })
    .then(() => "saved")
    .catch((e: unknown) => (e instanceof Error ? e.message : String(e)));
  check(/waiting for its online payment/.test(blocked), `an order waiting for its online payment can't change its total (${blocked.slice(0, 80)})`);

  const race = await Promise.all([raceReturn("a"), raceReturn("b")]);
  check(race.filter((r) => r === "ok").length === 1, `two returns of 600 at the same moment on a 1000 order: only one passes (${race.map((r) => (r === "ok" ? "ok" : "refused")).join(", ")})`);
} catch (e) {
  console.error(e);
  failed++;
} finally {
  for (const fn of cleanup) await fn().catch((e) => console.error("cleanup:", e instanceof Error ? e.message : e));
}

console.log(failed ? `\n${failed} check(s) failed` : "\nAll payment integrity checks passed");
process.exit(failed ? 1 : 0);
