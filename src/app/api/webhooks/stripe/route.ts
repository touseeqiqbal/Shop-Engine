import { StripeError, verifyStripeWebhook } from "@/lib/payments/stripe";
import { failCheckout, markCheckoutPaid, refreshPaymentsAccount } from "@/lib/payments";
import { handleBillingEvent } from "@/lib/billing";
import { payloadClient } from "@/lib/cms/catalog-source";
import { isCmsConfigured } from "@/lib/db/config";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/stripe – Stripe's events, verified by signature (STRIPE_WEBHOOK_SECRET for the platform account's
 * endpoint, STRIPE_CONNECT_WEBHOOK_SECRET for the "connected accounts" endpoint – either may sign).
 *
 *  - every event is stored once (payment-events, unique per event id): a replay or a retry of an event already handled
 *    changes nothing; a failed one is retried by Stripe and handled again;
 *  - connected-account events (shoppers paying a store): checkout paid → order paid; failed / expired → order cancelled;
 *    account.updated → can the store take cards;
 *  - platform events (merchants paying ShopEngine): subscriptions and invoices → the store's plan.
 */

type Event = ReturnType<typeof verifyStripeWebhook>;
type Doc = Record<string, unknown>;

function verify(raw: string, header: string | null): Event {
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter((s): s is string => Boolean(s));
  if (!secrets.length) throw new StripeError("Webhook secret not set", 503);
  let last: unknown;
  for (const secret of secrets) {
    try {
      return verifyStripeWebhook(raw, header, secret);
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

/** Does the work for one event. Returns what happened (stored on the event). */
async function handle(event: Event): Promise<{ status: "processed" | "ignored"; store?: number | null; summary: Doc }> {
  const payload = await payloadClient();
  const o = event.data.object;
  if (event.account) {
    const sessionId = String(o.id ?? "");
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        if (o.mode !== "payment") return { status: "ignored", summary: { reason: "not a payment" } };
        // completed but not paid yet (a delayed payment method): wait for async_payment_succeeded
        if (o.payment_status !== "paid") return { status: "ignored", summary: { session: sessionId, reason: `payment_status ${String(o.payment_status)}` } };
        const r = await markCheckoutPaid(payload, { sessionId, paymentIntent: (o.payment_intent as string) ?? null, amountMinor: Number(o.amount_total), currency: String(o.currency ?? ""), account: event.account });
        return { status: r === "paid" ? "processed" : "ignored", store: Number((o.metadata as Doc | undefined)?.storeId) || null, summary: { session: sessionId, result: r, amount: o.amount_total, currency: o.currency } };
      }
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired": {
        const r = await failCheckout(payload, sessionId, event.type.endsWith("expired") ? "expired" : "payment failed");
        return { status: r === "cancelled" ? "processed" : "ignored", store: Number((o.metadata as Doc | undefined)?.storeId) || null, summary: { session: sessionId, result: r } };
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
  const ours = await handleBillingEvent(payload, event);
  return { status: ours ? "processed" : "ignored", store: Number((o.metadata as Doc | undefined)?.storeId) || null, summary: { object: o.id ?? null } };
}

export async function POST(req: Request) {
  if (!isCmsConfigured) return new Response("Not found", { status: 404 });
  const raw = await req.text();
  let event: Event;
  try {
    event = verify(raw, req.headers.get("stripe-signature"));
  } catch (e) {
    const status = e instanceof StripeError ? e.status : 400;
    log.warn("stripe.webhook_rejected", { reason: (e as Error)?.message });
    return Response.json({ error: "Invalid signature" }, { status });
  }

  const payload = await payloadClient();
  const existing = (await payload.find({ collection: "payment-events", where: { and: [{ provider: { equals: "stripe" } }, { eventId: { equals: event.id } }] }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined;
  if (existing && (existing.status === "processed" || existing.status === "ignored")) return Response.json({ received: true, duplicate: true });
  let record = existing;
  if (!record) {
    try {
      record = (await payload.create({
        collection: "payment-events",
        data: { provider: "stripe", eventId: event.id, type: event.type, status: "received", receivedAt: new Date().toISOString() } as never,
        overrideAccess: true,
        context: { system: true },
      })) as unknown as Doc;
    } catch {
      // the same event arrived twice at once – the other delivery handles it
      return Response.json({ received: true, duplicate: true });
    }
  }

  try {
    const r = await handle(event);
    await payload.update({ collection: "payment-events", id: Number(record.id), data: { status: r.status, processedAt: new Date().toISOString(), store: r.store ?? null, summary: r.summary, error: null } as never, overrideAccess: true, context: { system: true } });
    return Response.json({ received: true });
  } catch (e) {
    log.error("stripe.webhook_failed", e, { event: event.id, type: event.type });
    await payload.update({ collection: "payment-events", id: Number(record.id), data: { status: "failed", error: String((e as Error)?.message ?? e).slice(0, 500) } as never, overrideAccess: true, context: { system: true } }).catch(() => undefined);
    // 500 → Stripe sends it again later
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}
