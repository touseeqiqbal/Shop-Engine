import type { Payload } from "payload";
import { stripe, stripeConfigured, fromMinor } from "@/lib/payments/stripe";
import { log } from "@/lib/log";

/**
 * ShopEngine's own billing (merchant → platform), separate from customers' payments.
 *
 *  - Free plans start straight away. Paid plans: one free trial per store (Stores → trialUsed), then a subscription
 *    through Stripe Billing on the PLATFORM's account (plan → providerPriceIdMonthly / Annual).
 *  - Stripe's webhooks keep store-subscriptions, store-invoices and the store's status in step.
 *  - Lifecycle (housekeeping, daily): a trial that ends unpaid → past due with a grace period (BILLING_GRACE_DAYS,
 *    default 7) → expired: the shop goes offline and its /cms becomes read-only until a plan is paid.
 *    Without Stripe, a platform admin activates paid plans by hand (status Active, provider "manual").
 */

type Doc = Record<string, unknown>;
const relId = (v: unknown) => (v && typeof v === "object" ? Number((v as Doc).id) : Number(v));
const GRACE_DAYS = () => Math.max(0, Number(process.env.BILLING_GRACE_DAYS ?? 7));
const iso = (unix?: number | null) => (unix ? new Date(unix * 1000).toISOString() : null);
const day = (isoDate: string) => new Date(isoDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** Tells the store's team (Settings → Notifications, else the store's email) about its plan – queued, once per event. */
async function planAlert(payload: Payload, storeId: number, kind: "payment-failed" | "trial-ended" | "expired", graceEndsAt?: string | null) {
  const { queueNotification } = await import("@/lib/notify");
  const until = graceEndsAt ? ` Your shop stays open until ${day(graceEndsAt)}.` : "";
  const text = {
    "payment-failed": { subject: "Your ShopEngine payment didn't go through", lines: [`We couldn't take the payment for your plan.${until}`, "Update your payment details or choose the plan again to keep your shop online."] },
    "trial-ended": { subject: "Your ShopEngine free trial has ended", lines: [`Choose how to continue: pay for your plan or switch to a free one.${until}`] },
    expired: { subject: "Your shop is offline", lines: ["Your plan ended, so your shop is offline and /cms is read-only.", "Your data is kept – pay for a plan to open the shop again."] },
  }[kind];
  await queueNotification(payload, "staff", storeId, { ...text, link: { href: "/account/stores", label: "Manage your plan" } }, { dedupeKey: `plan-alert:${storeId}:${kind}:${(graceEndsAt ?? new Date().toISOString()).slice(0, 10)}` }).catch((e) => log.error("billing.alert_failed", e, { store: storeId }));
  // ShopEngine's own team hears about money problems too (not about trials ending – that's normal)
  if (kind !== "trial-ended") {
    const store = (await payload.findByID({ collection: "stores", id: storeId, depth: 0, overrideAccess: true }).catch(() => null)) as unknown as Doc | null;
    const name = String(store?.name ?? `Store #${storeId}`);
    const platform = {
      "payment-failed": { subject: `${name}: plan payment failed`, lines: [`The plan payment of ${name} (store #${storeId}) didn't go through.${until}`, "The store has been asked to update its payment details."] },
      expired: { subject: `${name} is offline – plan ended`, lines: [`${name} (store #${storeId}) went offline because its plan ended. Its /cms is read-only; its data is kept.`] },
    }[kind];
    await queueNotification(payload, "platform", null, { ...platform, link: { href: "/cms/platform", label: "Open the platform overview" } }, { dedupeKey: `platform-alert:${storeId}:${kind}:${new Date().toISOString().slice(0, 10)}` }).catch((e) => log.error("billing.platform_alert_failed", e, { store: storeId }));
  }
}

async function subscriptionOf(payload: Payload, storeId: number): Promise<Doc | null> {
  return ((await payload.find({ collection: "store-subscriptions", where: { store: { equals: storeId } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc) ?? null;
}

/** Writes the plan state to both the store (what access checks read) and its subscription record. */
async function setPlanState(payload: Payload, storeId: number, state: Doc & { status: string }) {
  const sub = await subscriptionOf(payload, storeId);
  const subData = { store: storeId, ...state };
  if (sub) await payload.update({ collection: "store-subscriptions", id: Number(sub.id), data: subData as never, overrideAccess: true });
  else await payload.create({ collection: "store-subscriptions", data: subData as never, overrideAccess: true });
  const storeData: Doc = { subscriptionStatus: state.status };
  if (state.plan) storeData.plan = state.plan;
  if ("trialEndsAt" in state) storeData.trialEndsAt = state.trialEndsAt;
  if ("graceEndsAt" in state) storeData.graceEndsAt = state.graceEndsAt;
  await payload.update({ collection: "stores", id: storeId, data: storeData as never, overrideAccess: true });
}

/**
 * Chooses a plan for a store (owner, Account → Stores). Free plan → active now. Paid plan → its free trial if the
 * store hasn't had one, else a Stripe Checkout page to subscribe (returns its URL).
 */
export async function choosePlan(payload: Payload, input: { storeId: number; planId: number; cycle: "monthly" | "annual"; email?: string | null; returnUrl: string }): Promise<{ ok: true; checkoutUrl?: string } | { ok: false; error: string }> {
  const plan = (await payload.findByID({ collection: "subscription-plans", id: input.planId, depth: 0, overrideAccess: true }).catch(() => null)) as unknown as Doc | null;
  if (!plan || plan.status !== "active") return { ok: false, error: "This plan isn't available." };
  const store = (await payload.findByID({ collection: "stores", id: input.storeId, depth: 0, overrideAccess: true })) as unknown as Doc;
  const price = Number(input.cycle === "annual" ? plan.priceAnnual : plan.priceMonthly) || 0;
  const now = new Date();
  if (price === 0) {
    await setPlanState(payload, input.storeId, { plan: input.planId, status: "active", billingCycle: input.cycle, amount: 0, currency: String(plan.currency || "PKR"), paymentProvider: "free", currentPeriodStart: now.toISOString(), currentPeriodEnd: null, trialEndsAt: null, graceEndsAt: null });
    return { ok: true };
  }
  // the one free trial a store gets
  if (!store.trialUsed && Number(plan.trialDays) > 0) {
    const trialEndsAt = new Date(now.getTime() + Number(plan.trialDays) * 86400_000).toISOString();
    await payload.update({ collection: "stores", id: input.storeId, data: { trialUsed: true } as never, overrideAccess: true });
    await setPlanState(payload, input.storeId, { plan: input.planId, status: "trialing", billingCycle: input.cycle, amount: price, currency: String(plan.currency || "PKR"), paymentProvider: stripeConfigured() ? "stripe" : "manual", trialEndsAt, currentPeriodStart: now.toISOString(), currentPeriodEnd: trialEndsAt, graceEndsAt: null });
    return { ok: true };
  }
  const priceId = String((input.cycle === "annual" ? plan.providerPriceIdAnnual : plan.providerPriceIdMonthly) ?? "");
  if (!stripeConfigured() || !priceId) return { ok: false, error: "Paid plans are activated by ShopEngine support for now – please contact us." };
  const sub = await subscriptionOf(payload, input.storeId);
  // already subscribed: change the plan on the existing subscription (prorated by Stripe)
  if (sub?.externalSubscriptionId && ["active", "trialing", "past_due"].includes(String(sub.status))) {
    const current = await stripe<{ items: { data: { id: string }[] } }>("GET", `/subscriptions/${encodeURIComponent(String(sub.externalSubscriptionId))}`);
    await stripe("POST", `/subscriptions/${encodeURIComponent(String(sub.externalSubscriptionId))}`, { items: [{ id: current.items.data[0]?.id, price: priceId }], proration_behavior: "create_prorations", metadata: { storeId: String(input.storeId), planId: String(input.planId) } }, { idempotencyKey: `plan-change:${input.storeId}:${input.planId}:${input.cycle}:${Date.now() >> 16}` });
    await setPlanState(payload, input.storeId, { plan: input.planId, status: String(sub.status), billingCycle: input.cycle, amount: price });
    return { ok: true };
  }
  const session = await stripe<{ url: string }>("POST", "/checkout/sessions", {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    ...(sub?.externalCustomerId ? { customer: String(sub.externalCustomerId) } : { customer_email: input.email || (store.billingEmail as string) || undefined }),
    metadata: { kind: "saas", storeId: String(input.storeId), planId: String(input.planId), cycle: input.cycle },
    subscription_data: { metadata: { storeId: String(input.storeId), planId: String(input.planId) } },
    success_url: `${input.returnUrl}?billing=done`,
    cancel_url: `${input.returnUrl}?billing=cancelled`,
  });
  return { ok: true, checkoutUrl: session.url };
}

/** Cancels at the end of the paid period (the store keeps working until then). */
export async function cancelPlan(payload: Payload, storeId: number): Promise<{ ok: boolean; error?: string }> {
  const sub = await subscriptionOf(payload, storeId);
  if (!sub) return { ok: false, error: "No plan to cancel." };
  if (sub.externalSubscriptionId && stripeConfigured()) await stripe("POST", `/subscriptions/${encodeURIComponent(String(sub.externalSubscriptionId))}`, { cancel_at_period_end: true });
  await payload.update({ collection: "store-subscriptions", id: Number(sub.id), data: { cancelAtPeriodEnd: true } as never, overrideAccess: true });
  return { ok: true };
}

const STATUS: Record<string, string> = { trialing: "trialing", active: "active", past_due: "past_due", unpaid: "past_due", canceled: "cancelled", incomplete: "past_due", incomplete_expired: "expired", paused: "suspended" };

/** Stripe Billing webhooks on the platform account (no `account` on the event). Returns whether it was ours. */
export async function handleBillingEvent(payload: Payload, event: { type: string; data: { object: Doc } }): Promise<boolean> {
  const o = event.data.object;
  const storeOf = (meta: unknown) => Number((meta as Doc | undefined)?.storeId) || null;
  switch (event.type) {
    case "checkout.session.completed": {
      if (o.mode !== "subscription") return false;
      const storeId = storeOf(o.metadata);
      if (!storeId || !o.subscription) return false;
      await syncSubscription(payload, storeId, String(o.subscription), { customer: String(o.customer ?? ""), planId: Number((o.metadata as Doc)?.planId) || null });
      return true;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const storeId = storeOf(o.metadata);
      if (!storeId) return false;
      await syncSubscription(payload, storeId, String(o.id), { customer: String(o.customer ?? ""), planId: Number((o.metadata as Doc)?.planId) || null, object: o });
      return true;
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const subId = String(o.subscription ?? "");
      const sub = subId ? ((await payload.find({ collection: "store-subscriptions", where: { externalSubscriptionId: { equals: subId } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined) : undefined;
      if (!sub) return false;
      const storeId = relId(sub.store);
      const currency = String(o.currency ?? "pkr");
      const paid = event.type === "invoice.paid";
      const existing = (await payload.find({ collection: "store-invoices", where: { providerInvoiceId: { equals: String(o.id) } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined;
      const data = {
        store: storeId,
        subscription: Number(sub.id),
        invoiceNumber: String(o.number ?? o.id),
        status: paid ? "paid" : "failed",
        amount: fromMinor(Number(paid ? o.amount_paid : o.amount_due) || 0, currency),
        currency: currency.toUpperCase(),
        issuedAt: iso(Number(o.created)),
        paidAt: paid ? new Date().toISOString() : null,
        periodStart: iso(Number(o.period_start)),
        periodEnd: iso(Number(o.period_end)),
        providerInvoiceId: String(o.id),
        hostedInvoiceUrl: (o.hosted_invoice_url as string) ?? null,
      };
      if (existing) await payload.update({ collection: "store-invoices", id: Number(existing.id), data: data as never, overrideAccess: true });
      else await payload.create({ collection: "store-invoices", data: data as never, overrideAccess: true });
      if (paid) await setPlanState(payload, storeId, { status: "active", lastPaymentAt: new Date().toISOString(), lastInvoiceAt: new Date().toISOString(), failedPayments: 0, graceEndsAt: null });
      else {
        const graceEndsAt = new Date(Date.now() + GRACE_DAYS() * 86400_000).toISOString();
        await setPlanState(payload, storeId, { status: "past_due", lastInvoiceAt: new Date().toISOString(), failedPayments: (Number(sub.failedPayments) || 0) + 1, graceEndsAt });
        await planAlert(payload, storeId, "payment-failed", graceEndsAt);
      }
      return true;
    }
  }
  return false;
}

async function syncSubscription(payload: Payload, storeId: number, subscriptionId: string, extra: { customer?: string; planId?: number | null; object?: Doc }) {
  const s = extra.object ?? (await stripe<Doc>("GET", `/subscriptions/${encodeURIComponent(subscriptionId)}`));
  const status = STATUS[String(s.status)] ?? "past_due";
  await setPlanState(payload, storeId, {
    ...(extra.planId ? { plan: extra.planId } : {}),
    status,
    paymentProvider: "stripe",
    externalSubscriptionId: subscriptionId,
    ...(extra.customer ? { externalCustomerId: extra.customer } : {}),
    currentPeriodStart: iso(Number(s.current_period_start)),
    currentPeriodEnd: iso(Number(s.current_period_end)),
    trialEndsAt: iso(Number(s.trial_end)),
    cancelAtPeriodEnd: s.cancel_at_period_end === true,
    graceEndsAt: status === "past_due" ? new Date(Date.now() + GRACE_DAYS() * 86400_000).toISOString() : null,
  });
}

/**
 * Daily: trials that ended unpaid go past due (grace period), past due beyond grace → expired (shop offline, /cms
 * read-only), cancelled plans whose paid period is over → expired. The default store is never touched.
 */
export async function runBillingLifecycle(payload: Payload): Promise<{ pastDue: number; expired: number }> {
  const now = new Date().toISOString();
  const out = { pastDue: 0, expired: 0 };
  const find = (where: object) => payload.find({ collection: "store-subscriptions", where: where as never, limit: 200, depth: 1, overrideAccess: true }).then((r) => r.docs as unknown as Doc[]);
  const isDefault = (sub: Doc) => (sub.store && typeof sub.store === "object" ? (sub.store as Doc).isDefault === true : false);
  for (const sub of await find({ and: [{ status: { equals: "trialing" } }, { trialEndsAt: { less_than: now } }, { externalSubscriptionId: { exists: false } }] })) {
    if (isDefault(sub)) continue;
    const graceEndsAt = new Date(Date.now() + GRACE_DAYS() * 86400_000).toISOString();
    await setPlanState(payload, relId(sub.store), { status: "past_due", graceEndsAt });
    await planAlert(payload, relId(sub.store), "trial-ended", graceEndsAt);
    out.pastDue++;
  }
  for (const sub of await find({ or: [{ and: [{ status: { equals: "past_due" } }, { graceEndsAt: { less_than: now } }] }, { and: [{ status: { equals: "cancelled" } }, { currentPeriodEnd: { less_than: now } }] }] })) {
    if (isDefault(sub)) continue;
    await setPlanState(payload, relId(sub.store), { status: "expired" });
    await planAlert(payload, relId(sub.store), "expired");
    out.expired++;
  }
  if (out.pastDue || out.expired) log.info("billing.lifecycle", out);
  return out;
}

/* ───────────── plan limits (checked by the server when records are created) ───────────── */

/** features: the plan's features; null = no restrictions (the default store, stores without a plan). */
export type Limits = { maxProducts: number; maxStaffMembers: number; maxStorageGb: number; features: string[] | null };

export const hasFeature = (limits: Limits, feature: string) => limits.features == null || limits.features.includes(feature);

/** The limits of a store's plan (0 = unlimited; the default store and stores without a plan: unlimited). */
export async function storeLimits(payload: Payload, storeId: number | null): Promise<Limits> {
  const unlimited: Limits = { maxProducts: 0, maxStaffMembers: 0, maxStorageGb: 0, features: null };
  if (storeId == null) return unlimited;
  const store = (await payload.findByID({ collection: "stores", id: storeId, depth: 1, overrideAccess: true }).catch(() => null)) as unknown as Doc | null;
  if (!store || store.isDefault) return unlimited;
  const plan = store.plan && typeof store.plan === "object" ? (store.plan as Doc) : null;
  if (!plan) return unlimited;
  return { maxProducts: Number(plan.maxProducts) || 0, maxStaffMembers: Number(plan.maxStaffMembers) || 0, maxStorageGb: Number(plan.maxStorageGb) || 0, features: Array.isArray(plan.features) ? (plan.features as string[]) : [] };
}
