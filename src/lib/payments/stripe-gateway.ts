import { gatewayInfo } from "./catalog";
import { GatewayError, type PaymentGateway, type WebhookEvent, type WebhookResult } from "./gateway-types";
import { StripeError, stripeConfigured, verifyStripeWebhook } from "./stripe";
import { failCheckout, markCheckoutPaid, openCheckoutUrl, paymentsOnboardingLink, reconcileCardPayments, refreshPaymentsAccount, refundCardOrder, startCardPayment, storeCanTakeCards } from "./index";

/**
 * Stripe as a payment provider plugin: Stripe Connect (each store's own Express account), hosted Checkout for
 * shoppers, refunds, and its webhooks – connected-account events settle orders; the platform account's events are
 * ShopEngine's own billing (lib/billing.ts).
 *
 *   STRIPE_SECRET_KEY                 platform secret key
 *   STRIPE_WEBHOOK_SECRET             signing secret of the platform endpoint
 *   STRIPE_CONNECT_WEBHOOK_SECRET     signing secret of the "connected accounts" endpoint (either may sign)
 * Both endpoints may point at /api/webhooks/stripe (or /api/webhooks/payments/stripe – the same handler).
 */

type Doc = Record<string, unknown>;
type StripeEvent = ReturnType<typeof verifyStripeWebhook>;

function verify(raw: string, header: string | null): StripeEvent {
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter((s): s is string => Boolean(s));
  if (!secrets.length) throw new GatewayError("Webhook secret not set", 503);
  let last: unknown;
  for (const secret of secrets) {
    try {
      return verifyStripeWebhook(raw, header, secret);
    } catch (e) {
      last = e;
    }
  }
  throw last instanceof StripeError ? new GatewayError(last.message, last.status) : last;
}

async function handle(payload: Parameters<PaymentGateway["handleWebhook"]>[0], event: StripeEvent): Promise<WebhookResult> {
  const o = event.data.object;
  const storeOf = () => Number((o.metadata as Doc | undefined)?.storeId) || null;
  if (event.account) {
    const sessionId = String(o.id ?? "");
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        if (o.mode !== "payment") return { status: "ignored", summary: { reason: "not a payment" } };
        // completed but not paid yet (a delayed payment method): wait for async_payment_succeeded
        if (o.payment_status !== "paid") return { status: "ignored", summary: { session: sessionId, reason: `payment_status ${String(o.payment_status)}` } };
        const r = await markCheckoutPaid(payload, { sessionId, paymentIntent: (o.payment_intent as string) ?? null, amountMinor: Number(o.amount_total), currency: String(o.currency ?? ""), account: event.account });
        return { status: r === "paid" ? "processed" : "ignored", store: storeOf(), summary: { session: sessionId, result: r, amount: o.amount_total, currency: o.currency } };
      }
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired": {
        const r = await failCheckout(payload, sessionId, event.type.endsWith("expired") ? "expired" : "payment failed");
        return { status: r === "cancelled" ? "processed" : "ignored", store: storeOf(), summary: { session: sessionId, result: r } };
      }
      case "account.updated": {
        const store = (await payload.find({ collection: "stores", where: { paymentsAccountId: { equals: event.account } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined;
        if (!store) return { status: "ignored", summary: { reason: "unknown account" } };
        const ready = await refreshPaymentsAccount(payload, Number(store.id));
        return { status: "processed", store: Number(store.id), summary: { chargesEnabled: ready } };
      }
    }
    return { status: "ignored", summary: { reason: "not handled" } };
  }
  // the platform's own account: merchants paying ShopEngine
  const { handleBillingEvent } = await import("@/lib/billing");
  const ours = await handleBillingEvent(payload, event);
  return { status: ours ? "processed" : "ignored", store: storeOf(), summary: { object: o.id ?? null } };
}

export const stripeGateway: PaymentGateway = {
  ...gatewayInfo("stripe")!,
  configured: stripeConfigured,
  ready: (store) => storeCanTakeCards(store),
  start: (payload, input) => startCardPayment(payload, input),
  resumeUrl: (payload, orderId) => openCheckoutUrl(payload, orderId),
  verifyWebhook(raw, headers): WebhookEvent {
    const event = verify(raw, headers.get("stripe-signature"));
    return { id: event.id, type: event.type, data: event };
  },
  handleWebhook: (payload, event) => handle(payload, event.data as StripeEvent),
  refund: (payload, req, input) => refundCardOrder(payload, req, input),
  reconcile: (payload, limit) => reconcileCardPayments(payload, limit),
  connectLink: (payload, input) => paymentsOnboardingLink(payload, input),
  refreshAccount: (payload, storeId) => refreshPaymentsAccount(payload, storeId),
};
