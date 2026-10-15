import { commitTransaction, createLocalReq, initTransaction, killTransaction, type Payload, type PayloadRequest } from "payload";
import { fromMinor, stripe, stripeConfigured, toMinor } from "./stripe";
import { log } from "@/lib/log";

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

/** The provider says the checkout was paid: check it, record it, move the order on, tell the customer. */
export async function markCheckoutPaid(payload: Payload, s: { sessionId: string; paymentIntent: string | null; amountMinor: number; currency: string; account?: string | null }): Promise<"paid" | "already" | "ignored"> {
  return inTransaction(payload, async (req) => {
    const charge = (await payload.find({ collection: "payment-transactions", where: { and: [{ provider: { equals: "stripe" } }, { providerRef: { equals: s.sessionId } }] }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0] as unknown as Doc | undefined;
    if (!charge) return "ignored"; // not one of ours (another platform on the same account)
    if (charge.status === "succeeded") return "already";
    const orderId = relId(charge.order);
    const order = (await payload.findByID({ collection: "orders", id: orderId, depth: 0, overrideAccess: true, req })) as unknown as Doc;
    const store = (await payload.findByID({ collection: "stores", id: relId(order.store), depth: 0, overrideAccess: true, req })) as unknown as Doc;
    const currency = String(charge.currency).toLowerCase();
    const expected = toMinor(Number(order.total), currency);
    const wrongAccount = s.account && store.paymentsAccountId && s.account !== store.paymentsAccountId;
    if (s.currency.toLowerCase() !== currency || s.amountMinor !== expected || wrongAccount) {
      await payload.update({ collection: "payment-transactions", id: Number(charge.id), data: { status: "failed", failureReason: `Mismatch: got ${s.amountMinor} ${s.currency} on ${s.account ?? "?"}, expected ${expected} ${currency}` } as never, overrideAccess: true, req });
      log.error("payments.mismatch", new Error("payment does not match order"), { order: order.orderNumber, got: s.amountMinor, expected, account: s.account });
      return "ignored";
    }
    await payload.update({ collection: "payment-transactions", id: Number(charge.id), data: { status: "succeeded", paymentIntent: s.paymentIntent } as never, overrideAccess: true, req });
    const was = String(order.status);
    await payload.update({
      collection: "orders",
      id: orderId,
      data: {
        paymentStatus: "paid",
        paymentReference: s.paymentIntent ?? s.sessionId,
        ...(was === "awaiting-payment" ? { status: "confirmed", history: [{ status: "confirmed", at: new Date().toISOString(), note: "Paid by card" }] } : {}),
      } as never,
      overrideAccess: true,
      req,
      context: { system: true, skipNotify: true },
    });
    // the "order received" message goes out now that it is paid (card orders don't get one before)
    const { queueNotification } = await import("@/lib/notify");
    await queueNotification(payload, "order-placed", relId(order.store), { orderId }, { req, dedupeKey: `order-placed:${orderId}` });
    const { emitStoreEvent } = await import("@/lib/webhooks");
    await emitStoreEvent(payload, relId(order.store), "order.paid", { id: orderId, orderNumber: order.orderNumber, total: order.total, currency: currency.toUpperCase(), paymentIntent: s.paymentIntent }, req);
    return "paid";
  });
}

/** The checkout expired or the payment failed: the order is cancelled (its stock goes back) unless it was paid meanwhile. */
export async function failCheckout(payload: Payload, sessionId: string, reason: string): Promise<"cancelled" | "ignored"> {
  return inTransaction(payload, async (req) => {
    const charge = (await payload.find({ collection: "payment-transactions", where: { and: [{ provider: { equals: "stripe" } }, { providerRef: { equals: sessionId } }] }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0] as unknown as Doc | undefined;
    if (!charge || charge.status !== "pending") return "ignored";
    await payload.update({ collection: "payment-transactions", id: Number(charge.id), data: { status: "cancelled", failureReason: reason } as never, overrideAccess: true, req });
    const order = (await payload.findByID({ collection: "orders", id: relId(charge.order), depth: 0, overrideAccess: true, req }).catch(() => null)) as unknown as Doc | null;
    if (order && order.status === "awaiting-payment" && order.paymentStatus !== "paid")
      await payload.update({
        collection: "orders",
        id: Number(order.id),
        data: { status: "cancelled", history: [{ status: "cancelled", at: new Date().toISOString(), note: `Card payment not completed (${reason})` }] } as never,
        overrideAccess: true,
        req,
        context: { system: true, skipNotify: true },
      });
    return "cancelled";
  });
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
  const left = Number(charge.amount) - already;
  const amount = Math.round(input.amount * 100) / 100;
  if (!(amount > 0) || amount > left + 1e-9) throw new Error(`You can refund at most ${left} on this order.`);
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
 * Card payments whose page has expired but that the webhook never reported (it can be missed): ask the provider and
 * settle them – paid ones are marked paid, the rest are cancelled. Run by housekeeping.
 */
export async function reconcileCardPayments(payload: Payload, limit = 20): Promise<{ paid: number; cancelled: number }> {
  if (!stripeConfigured()) return { paid: 0, cancelled: 0 };
  const due = (await payload.find({ collection: "payment-transactions", where: { and: [{ provider: { equals: "stripe" } }, { kind: { equals: "charge" } }, { status: { equals: "pending" } }, { expiresAt: { less_than: new Date(Date.now() - 2 * 60_000).toISOString() } }] }, limit, depth: 0, overrideAccess: true })).docs as unknown as Doc[];
  const out = { paid: 0, cancelled: 0 };
  for (const c of due) {
    try {
      const store = (await payload.findByID({ collection: "stores", id: relId(c.store), depth: 0, overrideAccess: true })) as unknown as Doc;
      const s = await stripe<{ payment_status: string; status: string; amount_total: number; currency: string; payment_intent: string | null }>("GET", `/checkout/sessions/${encodeURIComponent(String(c.providerRef))}`, undefined, { account: String(store.paymentsAccountId) });
      if (s.payment_status === "paid") {
        if ((await markCheckoutPaid(payload, { sessionId: String(c.providerRef), paymentIntent: s.payment_intent, amountMinor: s.amount_total, currency: s.currency, account: String(store.paymentsAccountId) })) === "paid") out.paid++;
      } else if (s.status === "expired" || s.status === "complete") {
        if ((await failCheckout(payload, String(c.providerRef), s.status === "expired" ? "expired" : "not paid")) === "cancelled") out.cancelled++;
      }
    } catch (e) {
      log.error("payments.reconcile_failed", e, { payment: c.id });
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
