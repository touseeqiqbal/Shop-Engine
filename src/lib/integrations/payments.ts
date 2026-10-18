import { createHash } from "node:crypto";
import type { Payload, PayloadRequest } from "payload";
import { integrationInfo, INTEGRATIONS, PAYMENT_PAGE_MINUTES } from "./catalog";
import { connectionsOf, getConnection, type Connection } from "./server";
import { openSecrets, sealSecrets } from "./secrets";
import { IntegrationError, type ChargeStatus, type Ctx, type PaymentImpl } from "./types";
import type { StartPaymentInput } from "../payments/gateway-types";
import { log } from "../log";

/**
 * Online payments through a store's OWN provider account (Integrations → Online payments): Safepay, JazzCash,
 * Easypaisa, PayFast, PayPal, Razorpay, Paystack, Flutterwave, Mercado Pago, Tap, PayTabs.
 *
 * The same rules as card payments (lib/payments/index.ts), which settle every provider:
 *  - the order is Paid only when ShopEngine itself asks the provider – with the store's keys, for OUR reference – and
 *    the amount and currency match the order. What comes back in the shopper's address bar, or in an update, only
 *    tells us WHEN to ask;
 *  - each payment attempt has its own reference; payments and provider updates are idempotent (one row per provider id);
 *  - a payment page that expires unpaid cancels the order (its stock goes back) – checked again by housekeeping.
 *
 * Addresses per store and provider (random key, src/app/api/integrations/[provider]/[key]/[[...action]]/route.ts):
 *   …/return?o=<order>   the shopper back from the payment page (GET or POST)
 *   …/webhook            the provider's server-to-server update
 *   …/pay?f=…            an auto-submitting form, for providers whose page is opened with a POST (JazzCash, Easypaisa, PayFast)
 */

type Doc = Record<string, unknown>;
const relId = (v: unknown) => (v && typeof v === "object" ? Number((v as Doc).id) : Number(v));
const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

export type OnlineGateway = { id: string; label: string; needsEmail: boolean; icon: "card" | "wallet" };

/** The payment integrations a store has switched on and that work for its country and currency – offered at checkout. */
export async function storeOnlineGateways(payload: Payload, storeId: number | null, country: string, currency: string): Promise<OnlineGateway[]> {
  if (storeId == null) return [];
  const conns = await connectionsOf(payload, storeId, { category: "payments", fresh: true });
  const out: OnlineGateway[] = [];
  for (const info of INTEGRATIONS) {
    const c = conns.find((x) => x.provider === info.id);
    // a connection whose last check failed is not offered (shoppers would meet an error)
    if (!c || !info.payment || c.status === "error") continue;
    if (info.payment.currencies && !info.payment.currencies.includes(currency.toUpperCase())) continue;
    if (info.countries && !info.countries.includes(country)) continue;
    out.push({ id: info.id, label: info.payment.label ?? info.name, needsEmail: Boolean(info.payment.needsEmail), icon: info.payment.icon });
  }
  if (!out.length) return out;
  const { hasFeature, storeLimits } = await import("../billing");
  return hasFeature(await storeLimits(payload, storeId), "online_payments") ? out : [];
}

async function paymentImpl(provider: string): Promise<PaymentImpl | null> {
  const { providerImpl } = await import("./providers");
  return (await providerImpl(provider))?.payment ?? null;
}

const viaOf = (provider: string) => {
  const info = integrationInfo(provider);
  return info?.payment?.label ?? info?.name ?? provider;
};

/**
 * This payment attempt's own reference: letters and digits, ≤ 20 characters, and the moment it was made –
 * "SE" + order id + "T" + the time in base 36 (lower case, so the upper-case "T" can't appear in it).
 */
export const attemptRef = (orderId: number, at = Date.now()) => `SE${orderId}T${at.toString(36)}`.slice(0, 20);
/** When an attempt reference was made (providers whose status check needs the original date). */
export const attemptTime = (ref: string): Date | null => {
  const t = parseInt(ref.split("T")[1] ?? "", 36);
  return Number.isFinite(t) && t > 0 ? new Date(t) : null;
};

/** Opens the provider's payment page for a just-placed order and records the pending charge. */
export async function startPayment(payload: Payload, provider: string, input: StartPaymentInput): Promise<{ url: string }> {
  const info = integrationInfo(provider);
  const c = await getConnection(payload, input.storeId, provider, { fresh: true });
  const impl = await paymentImpl(provider);
  if (!info?.payment || !c || !impl) throw new IntegrationError(`${info?.name ?? provider} isn’t connected to this store.`);
  const currency = input.currency.toUpperCase();
  if (info.payment.currencies && !info.payment.currencies.includes(currency)) throw new IntegrationError(`${info.name} can’t charge in ${currency}.`);
  if (info.payment.needsEmail && !input.email) throw new IntegrationError(`${info.name} needs the shopper’s email.`);
  const { hasFeature, storeLimits } = await import("../billing");
  if (!hasFeature(await storeLimits(payload, input.storeId), "online_payments")) throw new IntegrationError("This store's plan doesn't include online payments.");

  const order = (await payload.findByID({ collection: "orders", id: input.orderId, depth: 0, overrideAccess: true })) as unknown as Doc;
  const customer = (order.customer ?? {}) as Doc;
  const base = `${input.origin.replace(/\/+$/, "")}/api/integrations/${provider}/${c.webhookKey}`;
  const o = encodeURIComponent(input.orderNumber);
  const now = Date.now();
  const ref = attemptRef(input.orderId, now);
  const expiresAt = new Date(now + PAYMENT_PAGE_MINUTES * 60_000);
  const r = await impl.start(
    { payload, connection: c },
    {
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      total: input.total,
      currency,
      email: input.email ?? null,
      phone: str(customer.phone) || null,
      name: str(customer.name) || null,
      origin: input.origin,
      returnUrl: `${base}/return?o=${o}`,
      cancelUrl: `${base}/return?o=${o}&cancelled=1`,
      notifyUrl: `${base}/webhook`,
      attemptRef: ref,
      expiresAt,
    },
  );
  // a page opened with a POST: our own little page posts the form (sealed, so the address carries nothing readable)
  const url = r.form ? `${base}/pay?f=${sealSecrets({ u: r.url, f: JSON.stringify(r.form), e: String(expiresAt.getTime() + 15 * 60_000) })}` : r.url;
  await payload.create({
    collection: "payment-transactions",
    data: { store: input.storeId, order: input.orderId, kind: "charge", status: "pending", provider, providerRef: r.ref, amount: input.total, currency, idempotencyKey: `${provider}:checkout:${ref}`, checkoutUrl: url, expiresAt: expiresAt.toISOString() } as never,
    overrideAccess: true,
    context: { storefront: true },
  });
  return { url };
}

type Settled = "paid" | "already" | "failed" | "pending" | "ignored";

/** Asks the provider about one charge and settles it (paid → order confirmed; failed → order cancelled). */
async function settle(ctx: Ctx, impl: PaymentImpl, charge: Doc, hints: Record<string, string>, known?: ChargeStatus): Promise<Settled> {
  const { payload, connection: c } = ctx;
  if (["succeeded", "partially_refunded", "refunded"].includes(str(charge.status))) return "already";
  const ref = str(charge.providerRef);
  const currency = str(charge.currency).toUpperCase();
  // PayPal-style providers take an approved payment only while we still want it
  const st: ChargeStatus = known ?? (await impl.status(ctx, ref, { ...hints, ...(charge.status === "pending" ? { capture: "1" } : {}) }, { amount: Number(charge.amount), currency, createdAt: str(charge.createdAt) }));
  const { markCheckoutPaid, failCheckout } = await import("../payments");
  const { toMinor } = await import("../payments/stripe");
  if (st.state === "paid") {
    const cur = (st.currency || currency).toLowerCase();
    // no amount from the provider = it was fixed in our own signed request for this reference
    const amount = st.amount ?? Number(charge.amount);
    const r = await markCheckoutPaid(payload, { provider: c.provider, sessionId: ref, paymentIntent: st.paymentId ?? null, amountMinor: toMinor(amount, cur), currency: cur, via: viaOf(c.provider) });
    return r === "paid" ? "paid" : r === "already" ? "already" : "ignored";
  }
  if (st.state === "failed") {
    if (charge.status === "pending") await failCheckout(payload, ref, (st.detail || "not paid").slice(0, 120), { provider: c.provider, via: viaOf(c.provider) });
    return "failed";
  }
  return "pending";
}

async function chargeByRef(payload: Payload, c: Connection, ref: string): Promise<Doc | null> {
  const res = await payload.find({ collection: "payment-transactions", where: { and: [{ provider: { equals: c.provider } }, { providerRef: { equals: ref } }, { store: { equals: c.store } }, { kind: { equals: "charge" } }] }, limit: 1, depth: 0, overrideAccess: true });
  return (res.docs[0] as unknown as Doc | undefined) ?? null;
}

async function chargeByOrder(payload: Payload, c: Connection, orderNumber: string): Promise<Doc | null> {
  if (!orderNumber) return null;
  const order = (await payload.find({ collection: "orders", where: { and: [{ orderNumber: { equals: orderNumber } }, { store: { equals: c.store } }] }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined;
  if (!order) return null;
  const res = await payload.find({ collection: "payment-transactions", where: { and: [{ provider: { equals: c.provider } }, { order: { equals: Number(order.id) } }, { kind: { equals: "charge" } }] }, sort: "-createdAt", limit: 1, depth: 0, overrideAccess: true });
  return (res.docs[0] as unknown as Doc | undefined) ?? null;
}

/* ───────────── the provider's page opened with a POST ───────────── */

const PAY_SCRIPT = `document.getElementById("pay").submit();`;
const PAY_SCRIPT_HASH = `sha256-${createHash("sha256").update(PAY_SCRIPT).digest("base64")}`;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function payPage(sealed: string | null): Response {
  const d = openSecrets(sealed);
  if (!d.u || !(Number(d.e) > Date.now())) return new Response("This payment link has expired – go back to the shop and choose “Pay now” on your order.", { status: 410, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  return autoPostPage(d.u, JSON.parse(d.f || "{}") as Record<string, string>);
}

/** A page that posts a form to a payment provider straight away (its CSP allows posting only there). */
export function autoPostPage(actionUrl: string, fields: Record<string, string>): Response {
  let action: URL;
  try {
    action = new URL(actionUrl);
  } catch {
    return new Response("Payment page not available.", { status: 400 });
  }
  if (action.protocol !== "https:") return new Response("Payment page not available.", { status: 400 });
  const inputs = Object.entries(fields)
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(String(v))}">`)
    .join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Opening the payment page…</title><style>body{font:16px system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;color:#334}button{font:inherit;padding:12px 20px;border-radius:10px;border:0;background:#4f46e5;color:#fff}</style></head><body><form id="pay" method="post" action="${esc(action.href)}">${inputs}<p>Opening the secure payment page…</p><noscript><button type="submit">Continue to payment</button></noscript></form><script>${PAY_SCRIPT}</script></body></html>`;
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "x-robots-tag": "noindex",
      // this page may only post its form to the provider
      "content-security-policy": `default-src 'none'; style-src 'unsafe-inline'; script-src '${PAY_SCRIPT_HASH}'; form-action ${action.origin}; base-uri 'none'; frame-ancestors 'none'`,
    },
  });
}

/* ───────────── shopper back / provider updates ───────────── */

/** Everything the provider sent back, as plain strings (query and form fields). */
function paramsOf(url: URL, headers: Headers, raw: string): URLSearchParams {
  const p = new URLSearchParams(url.search);
  if (raw && (headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded")) for (const [k, v] of new URLSearchParams(raw)) if (!p.has(k)) p.set(k, v);
  return p;
}

/** The inbound handler of every payment provider (called by its module's `inbound`). */
export async function paymentInbound(ctx: Ctx, impl: PaymentImpl, req: { method: string; url: URL; headers: Headers; raw: string; action: string }): Promise<Response> {
  const { payload, connection: c } = ctx;
  const params = paramsOf(req.url, req.headers, req.raw);
  if (req.action === "pay") return payPage(params.get("f"));

  if (req.action === "return") {
    // a provider that adds "?token=…" to an address that already has "?o=…"
    const [o, tail] = (params.get("o") ?? "").split("?", 2);
    if (tail) for (const [k, v] of new URLSearchParams(tail)) if (!params.has(k)) params.set(k, v);
    const orderNumber = o.slice(0, 60);
    const store = (await payload.findByID({ collection: "stores", id: c.store, depth: 0, overrideAccess: true }).catch(() => null)) as unknown as Doc | null;
    const { storeOrigin } = await import("../tenant-shared");
    // the store's own address – the one the payment was started from (never an internal host behind a proxy)
    const origin = (store ? storeOrigin({ isDefault: store.isDefault === true, subdomain: str(store.subdomain) || null, customDomain: str(store.customDomain) || null, domainVerified: Boolean(store.domainVerifiedAt) }) : "") || req.url.origin;
    const back = (q: string) => Response.redirect(`${origin}/order-confirmation/${encodeURIComponent(orderNumber)}${q}`, 303);
    if (impl.onReturn) {
      const step = await impl.onReturn(ctx, { params, returnUrl: `${origin}/api/integrations/${c.provider}/${c.webhookKey}/return?o=${encodeURIComponent(orderNumber)}` });
      if (step) return step;
    }
    const charge = await chargeByOrder(payload, c, orderNumber);
    if (!charge) return back("");
    let result: Settled = "pending";
    try {
      result = await settle(ctx, impl, charge, Object.fromEntries(params));
    } catch (e) {
      // the provider couldn't be asked right now – the update or housekeeping settles it
      log.error("payments.return_check_failed", e, { provider: c.provider, order: orderNumber });
    }
    return back(result === "failed" || (result === "pending" && params.get("cancelled")) ? "?payment=cancelled" : "?payment=done");
  }

  // a server-to-server update
  let notice: Awaited<ReturnType<NonNullable<PaymentImpl["notice"]>>> = {};
  try {
    notice = impl.notice ? await impl.notice(ctx, { url: req.url, headers: req.headers, raw: req.raw, params }) : {};
  } catch (e) {
    if (e instanceof IntegrationError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const charge = (notice.ref ? await chargeByRef(payload, c, notice.ref) : null) ?? (notice.orderNumber ? await chargeByOrder(payload, c, notice.orderNumber) : null);
  if (charge) await settle(ctx, impl, charge, notice.hints ?? {});
  return notice.ack ?? new Response("OK", { status: 200 });
}

/* ───────────── refunds and housekeeping ───────────── */

/** Refund (part of) an order paid through a store's provider (from the order in /cms). */
export async function refundPayment(payload: Payload, req: PayloadRequest, provider: string, input: { orderId: number; amount: number; reason?: string }): Promise<{ status: string; refunded: number }> {
  const charge = (await payload.find({ collection: "payment-transactions", where: { and: [{ order: { equals: input.orderId } }, { provider: { equals: provider } }, { kind: { equals: "charge" } }, { status: { in: ["succeeded", "partially_refunded"] } }] }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0] as unknown as Doc | undefined;
  if (!charge) throw new Error("This order has no online payment to refund.");
  const info = integrationInfo(provider);
  const impl = await paymentImpl(provider);
  const c = await getConnection(payload, relId(charge.store), provider, { all: true, fresh: true });
  if (!impl?.refund || !c) throw new Error(`Refund this payment in your ${info?.name ?? provider} account, then record it in Orders → Returns.`);
  const order = (await payload.findByID({ collection: "orders", id: input.orderId, depth: 0, overrideAccess: true, req })) as unknown as Doc;
  const already = Number(charge.refundedAmount) || 0;
  const currency = str(charge.currency).toUpperCase();
  // what the payment has left AND what the order has left after refunds of any kind (returns paid in cash …)
  const { refundableOnOrder } = await import("../../payload/refunds");
  const left = Math.min(Number(charge.amount) - already, await refundableOnOrder(payload, order as { id: number; total?: unknown }, req));
  const { fromMinorUnits, toMinorUnits } = await import("./http");
  const amount = fromMinorUnits(toMinorUnits(input.amount, currency), currency);
  if (!(amount > 0) || amount > left + 1e-9) throw new Error(`You can refund at most ${Math.max(0, left)} on this order.`);
  // the same on a retry (the refunds already recorded don't change): a refund that timed out but was processed isn't
  // made a second time by the provider
  const refundRef = `R${input.orderId}a${toMinorUnits(already, currency)}`.slice(0, 20);
  const r = await impl.refund({ payload, connection: c }, { ref: str(charge.providerRef), paymentId: str(charge.paymentIntent) || null, amount, currency, total: Number(charge.amount), reason: input.reason, refundRef });
  if (r.status === "failed") throw new Error(`${info?.name ?? provider} refused the refund.`);
  const refunded = already + amount;
  const full = refunded >= Number(charge.amount) - 1e-9;
  await payload.create({ collection: "payment-transactions", data: { store: relId(order.store), order: input.orderId, kind: "refund", status: r.status, provider, providerRef: r.id || refundRef, amount, currency, idempotencyKey: `${provider}:refund:${refundRef}` } as never, overrideAccess: true, req });
  await payload.update({ collection: "payment-transactions", id: Number(charge.id), data: { refundedAmount: refunded, status: full ? "refunded" : "partially_refunded" } as never, overrideAccess: true, req });
  await payload.update({ collection: "orders", id: input.orderId, data: { paymentStatus: full ? "refunded" : "partially-refunded", history: [{ status: str(order.status), at: new Date().toISOString(), note: `Refunded ${amount} through ${info?.name ?? provider}${input.reason ? ` – ${input.reason}` : ""}` }] } as never, overrideAccess: true, req, context: { system: true, skipNotify: true, skipStock: true } });
  const { emitStoreEvent } = await import("../webhooks");
  await emitStoreEvent(payload, relId(order.store), "refund.created", { orderId: input.orderId, orderNumber: order.orderNumber, amount, currency, refundId: r.id, status: r.status, fullyRefunded: full, provider }, req).catch((e) => log.error("payments.refund_webhook_failed", e));
  return { status: r.status, refunded };
}

/** Pay-at-a-shop vouchers (Easypaisa / JazzCash) may be paid days later; everything else is given up soon after its page expired. */
const GIVE_UP_AFTER = 30 * 60_000;
const VOUCHER_DAYS = 3;

/**
 * Housekeeping: payments whose page has expired without a final answer – ask the provider; paid ones are settled,
 * unpaid ones cancel their order (stock back).
 */
export async function reconcilePayments(payload: Payload, provider: string, limit = 20): Promise<{ paid: number; cancelled: number }> {
  const out = { paid: 0, cancelled: 0 };
  const due = (await payload.find({ collection: "payment-transactions", where: { and: [{ provider: { equals: provider } }, { kind: { equals: "charge" } }, { status: { equals: "pending" } }, { expiresAt: { less_than: new Date(Date.now() - 2 * 60_000).toISOString() } }] }, sort: "updatedAt", limit, depth: 0, overrideAccess: true })).docs as unknown as Doc[];
  if (!due.length) return out;
  const impl = await paymentImpl(provider);
  const { failCheckout } = await import("../payments");
  // asked: to the back of the line (updatedAt) – vouchers waiting for days and rows whose provider keeps failing used
  // to take the same 20 places at every run, so later payments were never settled
  const later = (charge: Doc) => payload.update({ collection: "payment-transactions", id: Number(charge.id), data: {} as never, overrideAccess: true }).catch(() => undefined);
  for (const charge of due) {
    const ref = str(charge.providerRef);
    try {
      const c = await getConnection(payload, relId(charge.store), provider, { all: true });
      if (!c || !impl) {
        if ((await failCheckout(payload, ref, "payment provider disconnected", { provider, via: viaOf(provider) })) === "cancelled") out.cancelled++;
        continue;
      }
      const ctx = { payload, connection: c };
      const st = await impl.status(ctx, ref, { capture: "1" }, { amount: Number(charge.amount), currency: str(charge.currency), createdAt: str(charge.createdAt) });
      if (st.state !== "pending") {
        const r = await settle(ctx, impl, charge, {}, st);
        if (r === "paid") out.paid++;
        else if (r === "failed") out.cancelled++;
        continue;
      }
      const expired = Date.parse(str(charge.expiresAt)) || 0;
      const limitMs = st.detail === "voucher" ? VOUCHER_DAYS * 86_400_000 : GIVE_UP_AFTER;
      if (Date.now() - expired > limitMs) {
        if ((await failCheckout(payload, ref, "not paid in time", { provider, via: viaOf(provider) })) === "cancelled") out.cancelled++;
      } else await later(charge);
    } catch (e) {
      log.error("payments.reconcile_failed", e, { provider, payment: charge.id });
      await later(charge);
    }
  }
  return out;
}
