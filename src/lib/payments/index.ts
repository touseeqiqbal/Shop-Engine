import { commitTransaction, createLocalReq, initTransaction, killTransaction, type Payload, type PayloadRequest } from "payload";
import { fromMinor, stripe, stripeConfigured, toMinor } from "./stripe";
import { log } from "@/lib/log";
import { dueAfterGiftCard } from "@/lib/order-money";

/**
 * Online card payments through Stripe (customer → merchant) – the Stripe provider plugin (stripe-gateway.ts) calls
 * these; the rest of the shop goes through lib/payments/gateways.ts, which works the same for every provider.
 *
 * The rules that keep money right:
 *  - an order is marked Paid ONLY from the provider (a verified webhook, or asking the provider directly when
 *    reconciling) – never from the browser's redirect back;
 *  - the amount and currency the provider reports must equal the order's total, and the payment must have gone to the
 *    order's own store's account – otherwise nothing is marked paid and the mismatch is logged;
 *  - every provider call carries an idempotency key, every payment / refund has the provider's id (unique), and every
 *    webhook is stored once per event id (src/payload/collections/payments.ts) – retries and replays change nothing;
 *  - a payment that fails or expires cancels the order, which puts the stock back.
 */

type Doc = Record<string, unknown>;
const relId = (v: unknown) => (v && typeof v === "object" ? Number((v as Doc).id) : Number(v));

export const CHECKOUT_MINUTES = 30;

/** Can this store take cards right now? */
export function storeCanTakeCards(store: Doc | null | undefined) {
  return stripeConfigured() && (!store?.paymentsProvider || store.paymentsProvider === "stripe") && Boolean(store?.paymentsAccountId) && store?.paymentsChargesEnabled === true;
}

/**
 * Starts a card payment for a just-placed order: a hosted Stripe Checkout page on the store's connected account.
 * Returns the page to send the shopper to.
 */
export async function startCardPayment(payload: Payload, input: { orderId: number; orderNumber: string; total: number; currency?: string; storeId: number; email?: string | null; origin: string }): Promise<{ url: string }> {
  const store = (await payload.findByID({ collection: "stores", id: input.storeId, depth: 0, overrideAccess: true })) as unknown as Doc;
  if (!storeCanTakeCards(store)) throw new Error("This store can't take card payments right now.");
  const { hasFeature, storeLimits } = await import("@/lib/billing");
  if (!hasFeature(await storeLimits(payload, input.storeId), "online_payments")) throw new Error("This store's plan doesn't include card payments.");
  // the order's currency (the store's when it was placed)
  const currency = String(input.currency || store.currency || "PKR").toLowerCase();
  const account = String(store.paymentsAccountId);
  const feePercent = Number(process.env.PLATFORM_FEE_PERCENT || 0);
  const metadata = { orderId: String(input.orderId), orderNumber: input.orderNumber, storeId: String(input.storeId) };
  const expiresAt = Math.floor(Date.now() / 1000) + CHECKOUT_MINUTES * 60;
  const idempotencyKey = `checkout:${input.orderId}`;
  const session = await stripe<{ id: string; url: string }>(
    "POST",
    "/checkout/sessions",
    {
      mode: "payment",
      client_reference_id: String(input.orderId),
      customer_email: input.email || undefined,
      line_items: [{ quantity: 1, price_data: { currency, unit_amount: toMinor(input.total, currency), product_data: { name: `Order ${input.orderNumber}` } } }],
      metadata,
      payment_intent_data: { metadata, ...(feePercent > 0 ? { application_fee_amount: toMinor((input.total * feePercent) / 100, currency) } : {}) },
      success_url: `${input.origin}/order-confirmation/${encodeURIComponent(input.orderNumber)}?payment=done`,
      cancel_url: `${input.origin}/order-confirmation/${encodeURIComponent(input.orderNumber)}?payment=cancelled`,
      expires_at: expiresAt,
    },
    { account, idempotencyKey },
  );
  await payload.create({
    collection: "payment-transactions",
    data: { store: input.storeId, order: input.orderId, kind: "charge", status: "pending", provider: "stripe", providerRef: session.id, amount: input.total, currency: currency.toUpperCase(), idempotencyKey, checkoutUrl: session.url, expiresAt: new Date(expiresAt * 1000).toISOString() } as never,
    overrideAccess: true,
    context: { storefront: true },
  });
  return { url: session.url };
}

/** The pending charge of an order still waiting for its card payment (to send the shopper back to the payment page). */
export async function openCheckoutUrl(payload: Payload, orderId: number): Promise<string | null> {
  const res = await payload.find({ collection: "payment-transactions", where: { and: [{ order: { equals: orderId } }, { kind: { equals: "charge" } }, { status: { equals: "pending" } }, { expiresAt: { greater_than: new Date().toISOString() } }] }, limit: 1, depth: 0, overrideAccess: true });
  return ((res.docs[0] as unknown as Doc | undefined)?.checkoutUrl as string | undefined) ?? null;
}

async function inTransaction<T>(payload: Payload, work: (req: PayloadRequest) => Promise<T>): Promise<T> {
  const req = await createLocalReq({}, payload);
  await initTransaction(req);
  try {
    const out = await work(req);
    await commitTransaction(req);
    return out;
  } catch (e) {
    await killTransaction(req);
    throw e;
  }
}

/**
 * The provider says the checkout was paid: check it, record it, move the order on, tell the customer.
 * Every provider settles through here (`provider` = its id, `via` = "card" / "PayPal" for the order's history).
 */
export async function markCheckoutPaid(payload: Payload, s: { sessionId: string; paymentIntent: string | null; amountMinor: number; currency: string; account?: string | null; provider?: string; via?: string }): Promise<"paid" | "already" | "ignored"> {
  const provider = s.provider ?? "stripe";
  return inTransaction(payload, async (req) => {
    const charge = (await payload.find({ collection: "payment-transactions", where: { and: [{ provider: { equals: provider } }, { providerRef: { equals: s.sessionId } }] }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0] as unknown as Doc | undefined;
    if (!charge) return "ignored"; // not one of ours (another platform on the same account)
    if (["succeeded", "refunded", "partially_refunded"].includes(String(charge.status))) return "already";
    const orderId = relId(charge.order);
    const order = (await payload.findByID({ collection: "orders", id: orderId, depth: 0, overrideAccess: true, req })) as unknown as Doc;
    const store = (await payload.findByID({ collection: "stores", id: relId(order.store), depth: 0, overrideAccess: true, req })) as unknown as Doc;
    const currency = String(charge.currency).toLowerCase();
    // what the payment was for: the order total minus what a gift card already paid
    const expected = toMinor(dueAfterGiftCard(order as { total?: number; giftCardAmount?: number }), currency);
    const wrongAccount = s.account && store.paymentsAccountId && s.account !== store.paymentsAccountId;
    if (s.currency.toLowerCase() !== currency || s.amountMinor !== expected || wrongAccount) {
      await payload.update({ collection: "payment-transactions", id: Number(charge.id), data: { status: "failed", failureReason: `Mismatch: got ${s.amountMinor} ${s.currency} on ${s.account ?? "?"}, expected ${expected} ${currency}` } as never, overrideAccess: true, req });
      log.error("payments.mismatch", new Error("payment does not match order"), { order: order.orderNumber, provider, got: s.amountMinor, expected, account: s.account });
      return "ignored";
    }
    await payload.update({ collection: "payment-transactions", id: Number(charge.id), data: { status: "succeeded", paymentIntent: s.paymentIntent } as never, overrideAccess: true, req });
    const was = String(order.status);
    // paid AFTER the order was cancelled (the page was used late, a bank debit settled days later): its stock, gift card
    // and coupon were already given back – the money is recorded, the order stays cancelled, and the store's team is
    // told to refund it or re-open the order. The shopper gets no "order received" and no download links.
    const afterCancel = was === "cancelled";
    await payload.update({
      collection: "orders",
      id: orderId,
      data: {
        paymentStatus: "paid",
        paymentReference: s.paymentIntent ?? s.sessionId,
        ...(was === "awaiting-payment" ? { status: "confirmed", history: [{ status: "confirmed", at: new Date().toISOString(), note: `Paid by ${s.via ?? "card"}` }] } : {}),
        ...(afterCancel ? { history: [{ status: "cancelled", at: new Date().toISOString(), note: `Paid by ${s.via ?? "card"} AFTER the order was cancelled – refund the payment, or re-open the order if you can still send it` }] } : {}),
      } as never,
      overrideAccess: true,
      req,
      context: { system: true, skipNotify: true, ...(afterCancel ? { paidAfterCancel: true } : {}) },
    });
    const { queueNotification } = await import("@/lib/notify");
    if (afterCancel) {
      log.warn("payments.paid_after_cancel", { order: order.orderNumber, provider });
      await queueNotification(
        payload,
        "staff",
        relId(order.store),
        {
          subject: `Payment received for cancelled order ${String(order.orderNumber)}`,
          lines: [`${String(order.orderNumber)} was cancelled, but its ${s.via ?? "card"} payment has now arrived.`, "Its stock was already put back. Refund the payment, or re-open the order if you can still send it."],
          link: { href: `/cms/collections/orders/${orderId}`, label: "Open the order" },
        },
        { req, dedupeKey: `paid-after-cancel:${orderId}` },
      );
    } else {
      // the "order received" message goes out now that it is paid (card orders don't get one before)
      await queueNotification(payload, "order-placed", relId(order.store), { orderId }, { req, dedupeKey: `order-placed:${orderId}` });
    }
    const { emitStoreEvent } = await import("@/lib/webhooks");
    await emitStoreEvent(payload, relId(order.store), "order.paid", { id: orderId, orderNumber: order.orderNumber, total: order.total, currency: currency.toUpperCase(), paymentIntent: s.paymentIntent, provider, ...(afterCancel ? { orderCancelled: true } : {}) }, req);
    return "paid";
  });
}

/** The checkout expired or the payment failed: the order is cancelled (its stock goes back) unless it was paid meanwhile. */
export async function failCheckout(payload: Payload, sessionId: string, reason: string, opts: { provider?: string; via?: string } = {}): Promise<"cancelled" | "ignored"> {
  const provider = opts.provider ?? "stripe";
  return inTransaction(payload, async (req) => {
    const charge = (await payload.find({ collection: "payment-transactions", where: { and: [{ provider: { equals: provider } }, { providerRef: { equals: sessionId } }] }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0] as unknown as Doc | undefined;
    if (!charge || charge.status !== "pending") return "ignored";
    await payload.update({ collection: "payment-transactions", id: Number(charge.id), data: { status: "cancelled", failureReason: reason } as never, overrideAccess: true, req });
    const order = (await payload.findByID({ collection: "orders", id: relId(charge.order), depth: 0, overrideAccess: true, req }).catch(() => null)) as unknown as Doc | null;
    if (order && order.status === "awaiting-payment" && order.paymentStatus !== "paid")
      await payload.update({
        collection: "orders",
        id: Number(order.id),
        data: { status: "cancelled", history: [{ status: "cancelled", at: new Date().toISOString(), note: `${opts.via ? `${opts.via} payment` : "Card payment"} not completed (${reason})` }] } as never,
        overrideAccess: true,
        req,
        context: { system: true, skipNotify: true },
      });
    return "cancelled";
  });
}

/**
 * The order was cancelled while its payment page was still open (staff cancelled it): close the page at the provider,
 * so it can't be paid any more. A page that can't be closed (already paid) is settled by reconcile / the webhook –
 * a payment after cancelling alerts the store's team (markCheckoutPaid). Run by the outbox ("payments.expire").
 */
export async function expireOpenCheckouts(payload: Payload, orderId: number): Promise<number> {
  const open = (await payload.find({ collection: "payment-transactions", where: { and: [{ order: { equals: orderId } }, { kind: { equals: "charge" } }, { status: { equals: "pending" } }] }, limit: 5, depth: 0, overrideAccess: true })).docs as unknown as Doc[];
  let closed = 0;
  for (const c of open) {
    if (c.provider !== "stripe" || !stripeConfigured()) continue;
    try {
      const store = (await payload.findByID({ collection: "stores", id: relId(c.store), depth: 0, overrideAccess: true })) as unknown as Doc;
      await stripe("POST", `/checkout/sessions/${encodeURIComponent(String(c.providerRef))}/expire`, {}, { account: String(store.paymentsAccountId) });
      if ((await failCheckout(payload, String(c.providerRef), "order cancelled by the store")) === "cancelled") closed++;
    } catch (e) {
      // already paid or closed: reconcile / the webhook settle it
      log.warn("payments.expire_failed", { payment: c.id, error: (e as Error)?.message });
    }
  }
  return closed;
}

/**
 * Refund (part of) a card order through the provider (from the order in /cms). Never more than what was charged
 * minus earlier refunds. Returns the refund's status.
 */
export async function refundCardOrder(payload: Payload, req: PayloadRequest, input: { orderId: number; amount: number; reason?: string }): Promise<{ status: string; refunded: number }> {
  const charge = (await payload.find({ collection: "payment-transactions", where: { and: [{ order: { equals: input.orderId } }, { kind: { equals: "charge" } }, { status: { in: ["succeeded", "partially_refunded"] } }] }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0] as unknown as Doc | undefined;
  if (!charge?.paymentIntent) throw new Error("This order has no card payment to refund.");
  const order = (await payload.findByID({ collection: "orders", id: input.orderId, depth: 0, overrideAccess: true, req })) as unknown as Doc;
  const store = (await payload.findByID({ collection: "stores", id: relId(order.store), depth: 0, overrideAccess: true, req })) as unknown as Doc;
  const already = Number(charge.refundedAmount) || 0;
  // what the card payment has left AND what the order has left after refunds of any kind (returns paid in cash …)
  const { refundableOnOrder } = await import("@/payload/refunds");
  const left = Math.min(Number(charge.amount) - already, await refundableOnOrder(payload, order as { id: number; total?: unknown }, req));
  const amount = Math.round(input.amount * 100) / 100;
  if (!(amount > 0) || amount > left + 1e-9) throw new Error(`You can refund at most ${Math.max(0, left)} on this order.`);
  const currency = String(charge.currency).toLowerCase();
  const idempotencyKey = `refund:${input.orderId}:${already}:${amount}`;
  const refund = await stripe<{ id: string; status: string; amount: number }>(
    "POST",
    "/refunds",
    { payment_intent: String(charge.paymentIntent), amount: toMinor(amount, currency), metadata: { orderId: String(input.orderId), reason: (input.reason ?? "").slice(0, 200) } },
    { account: String(store.paymentsAccountId), idempotencyKey },
  );
  const refunded = already + fromMinor(refund.amount, currency);
  const full = refunded >= Number(charge.amount) - 1e-9;
  await payload.create({ collection: "payment-transactions", data: { store: relId(order.store), order: input.orderId, kind: "refund", status: refund.status === "succeeded" ? "succeeded" : refund.status === "failed" ? "failed" : "pending", provider: "stripe", providerRef: refund.id, amount, currency: currency.toUpperCase(), idempotencyKey } as never, overrideAccess: true, req });
  await payload.update({ collection: "payment-transactions", id: Number(charge.id), data: { refundedAmount: refunded, status: full ? "refunded" : "partially_refunded" } as never, overrideAccess: true, req });
  await payload.update({ collection: "orders", id: input.orderId, data: { paymentStatus: full ? "refunded" : "partially-refunded", history: [{ status: String(order.status), at: new Date().toISOString(), note: `Refunded ${amount} by card${input.reason ? ` – ${input.reason}` : ""}` }] } as never, overrideAccess: true, req, context: { system: true, skipNotify: true, skipStock: true } });
  const { emitStoreEvent } = await import("@/lib/webhooks");
  await emitStoreEvent(payload, relId(order.store), "refund.created", { orderId: input.orderId, orderNumber: order.orderNumber, amount, currency: currency.toUpperCase(), refundId: refund.id, status: refund.status, fullyRefunded: full }, req).catch((e) => log.error("payments.refund_webhook_failed", e));
  return { status: refund.status, refunded };
}

/**
 * Orders still "waiting for online payment" long after checkout that have NO open payment any more (a crash between
 * saving the order and opening the provider's page, a cancel that failed): nothing will ever settle them, and they
 * hold their stock, coupon and gift-card balance. Cancelled here (the shopper was never told about them – card orders
 * are announced once paid). Run by housekeeping.
 */
export async function cancelOrphanedPaymentOrders(payload: Payload, opts: { olderThanMs?: number; limit?: number } = {}): Promise<number> {
  const before = new Date(Date.now() - (opts.olderThanMs ?? 6 * 3600_000)).toISOString();
  const waiting = (await payload.find({ collection: "orders", where: { and: [{ status: { equals: "awaiting-payment" } }, { placedAt: { less_than: before } }] }, sort: "placedAt", limit: opts.limit ?? 50, depth: 0, overrideAccess: true })).docs as unknown as Doc[];
  let cancelled = 0;
  for (const o of waiting) {
    try {
      // a payment still open (a voucher paid at a shop days later …) or already through: not an orphan
      const live = await payload.count({ collection: "payment-transactions", where: { and: [{ order: { equals: Number(o.id) } }, { kind: { equals: "charge" } }, { status: { in: ["pending", "succeeded", "partially_refunded", "refunded"] } }] }, overrideAccess: true });
      if (live.totalDocs) continue;
      await payload.update({
        collection: "orders",
        id: Number(o.id),
        data: { status: "cancelled", history: [{ status: "cancelled", at: new Date().toISOString(), note: "Online payment never started or completed – cancelled automatically" }] } as never,
        overrideAccess: true,
        context: { system: true, skipNotify: true, expectStatus: "awaiting-payment" },
      });
      cancelled++;
    } catch (e) {
      log.error("payments.orphan_cancel_failed", e, { order: o.orderNumber });
    }
  }
  return cancelled;
}

/**
 * Card payments whose page has expired but that the webhook never reported (it can be missed): ask the provider and
 * settle them – paid ones are marked paid, the rest are cancelled. Run by housekeeping.
 */
export async function reconcileCardPayments(payload: Payload, limit = 20): Promise<{ paid: number; cancelled: number }> {
  if (!stripeConfigured()) return { paid: 0, cancelled: 0 };
  const due = (await payload.find({ collection: "payment-transactions", where: { and: [{ provider: { equals: "stripe" } }, { kind: { equals: "charge" } }, { status: { equals: "pending" } }, { expiresAt: { less_than: new Date(Date.now() - 2 * 60_000).toISOString() } }] }, sort: "updatedAt", limit, depth: 0, overrideAccess: true })).docs as unknown as Doc[];
  const out = { paid: 0, cancelled: 0 };
  // checked: to the back of the line (updatedAt), so rows that stay pending or keep failing never block the others
  const later = (c: Doc) => payload.update({ collection: "payment-transactions", id: Number(c.id), data: {} as never, overrideAccess: true }).catch(() => undefined);
  for (const c of due) {
    try {
      const store = (await payload.findByID({ collection: "stores", id: relId(c.store), depth: 0, overrideAccess: true })) as unknown as Doc;
      const s = await stripe<{ payment_status: string; status: string; amount_total: number; currency: string; payment_intent: string | null }>("GET", `/checkout/sessions/${encodeURIComponent(String(c.providerRef))}`, undefined, { account: String(store.paymentsAccountId) });
      if (s.payment_status === "paid") {
        if ((await markCheckoutPaid(payload, { sessionId: String(c.providerRef), paymentIntent: s.payment_intent, amountMinor: s.amount_total, currency: s.currency, account: String(store.paymentsAccountId) })) === "paid") out.paid++;
      } else if (s.status === "expired") {
        if ((await failCheckout(payload, String(c.providerRef), "expired")) === "cancelled") out.cancelled++;
      } else {
        // "complete" but unpaid: a delayed method (bank debit, voucher) is on its way – Stripe reports the outcome
        // (async_payment_succeeded / _failed); ask again later
        await later(c);
      }
    } catch (e) {
      log.error("payments.reconcile_failed", e, { payment: c.id });
      await later(c);
    }
  }
  return out;
}

/* ───────────── merchant onboarding (Stripe Connect) ───────────── */

/** The link where a store's owner connects (or finishes connecting) their payment account. */
export async function paymentsOnboardingLink(payload: Payload, input: { storeId: number; email?: string | null; country?: string | null; returnUrl: string }): Promise<string> {
  const store = (await payload.findByID({ collection: "stores", id: input.storeId, depth: 0, overrideAccess: true })) as unknown as Doc;
  let account = store.paymentsAccountId ? String(store.paymentsAccountId) : "";
  if (!account) {
    const created = await stripe<{ id: string }>(
      "POST",
      "/accounts",
      { type: "express", country: input.country || undefined, email: input.email || undefined, metadata: { storeId: String(input.storeId) }, capabilities: { card_payments: { requested: true }, transfers: { requested: true } } },
      { idempotencyKey: `account:${input.storeId}` },
    );
    account = created.id;
    await payload.update({ collection: "stores", id: input.storeId, data: { paymentsProvider: "stripe", paymentsAccountId: account, paymentsChargesEnabled: false } as never, overrideAccess: true });
  }
  const link = await stripe<{ url: string }>("POST", "/account_links", { account, refresh_url: input.returnUrl, return_url: input.returnUrl, type: "account_onboarding" });
  return link.url;
}

/** Re-reads whether a store's payment account can take charges (after onboarding, or from an account.updated webhook). */
export async function refreshPaymentsAccount(payload: Payload, storeId: number): Promise<boolean> {
  const store = (await payload.findByID({ collection: "stores", id: storeId, depth: 0, overrideAccess: true })) as unknown as Doc;
  if (!store.paymentsAccountId) return false;
  const a = await stripe<{ charges_enabled?: boolean }>("GET", `/accounts/${encodeURIComponent(String(store.paymentsAccountId))}`);
  const enabled = a.charges_enabled === true;
  if (enabled !== (store.paymentsChargesEnabled === true)) await payload.update({ collection: "stores", id: storeId, data: { paymentsChargesEnabled: enabled } as never, overrideAccess: true });
  return enabled;
}
