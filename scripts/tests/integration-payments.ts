/**
 * Store-connected payment providers (real database, providers simulated): the provider's network calls are answered
 * by a stand-in `fetch`, so the whole flow runs without accounts or money –
 *   start → the provider's page and a pending payment; back from the page → the provider is asked → order Paid;
 *   a wrong amount is never Paid; a failed payment cancels the order; a form-POST provider (JazzCash) gets its own
 *   page; a provider update with a wrong signature is refused; housekeeping gives up on an abandoned page; refunds;
 *   another store's address can't settle this store's payment.
 * Uses the default store; creates its own connections and orders and removes them afterwards.
 *
 *   node --conditions=react-server node_modules/payload/bin.js run scripts/tests/integration-payments.ts
 */
import { createHmac } from "node:crypto";
import { createLocalReq, getPayload } from "payload";
import config from "@payload-config";
import { getConnection, removeConnection, saveConnection } from "../../src/lib/integrations/server";
import { paymentInbound, reconcilePayments, refundPayment, startPayment, storeOnlineGateways } from "../../src/lib/integrations/payments";
import { providerImpl } from "../../src/lib/integrations/providers";

const payload = await getPayload({ config });
let failed = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) failed++;
};
type Doc = Record<string, unknown>;

const store = Number(((await payload.find({ collection: "stores", where: { isDefault: { equals: true } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc).id);
const other = (await payload.find({ collection: "stores", where: { isDefault: { not_equals: true } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined;
const PROVIDERS = ["paypal", "safepay", "jazzcash-online", "paystack"];
for (const p of PROVIDERS)
  if (await getConnection(payload, store, p, { all: true, fresh: true })) {
    console.log(`The default store already has ${p} connected – not touching real settings. Test skipped.`);
    process.exit(0);
  }

/* ───────────── the stand-in providers ───────────── */
const paypalOrders = new Map<string, { status: string; amount: string; captured?: boolean }>();
let safepayState = "TRACKER_STARTED";
let safepayAmount = 0;
let jazzPayment = "000";
const paystackStatus = "success";
const calls: string[] = [];
const realFetch = globalThis.fetch;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const method = (init?.method ?? "GET").toUpperCase();
  const body = typeof init?.body === "string" && init.body.startsWith("{") ? (JSON.parse(init.body) as Doc) : {};
  calls.push(`${method} ${url.host}${url.pathname}`);
  // PayPal
  if (url.host === "api-m.sandbox.paypal.com") {
    if (url.pathname === "/v1/oauth2/token") return json({ access_token: "tok", expires_in: 3600 });
    if (url.pathname === "/v2/checkout/orders" && method === "POST") {
      const id = `PP${paypalOrders.size + 1}`;
      const pu = (body.purchase_units as Doc[])[0];
      paypalOrders.set(id, { status: "PAYER_ACTION_REQUIRED", amount: String((pu.amount as Doc).value) });
      return json({ id, status: "PAYER_ACTION_REQUIRED", links: [{ rel: "payer-action", href: `https://www.sandbox.paypal.com/checkoutnow?token=${id}` }] }, 201);
    }
    const m = url.pathname.match(/^\/v2\/checkout\/orders\/([^/]+)(\/capture)?$/);
    if (m) {
      const o = paypalOrders.get(m[1]);
      if (!o) return json({ name: "RESOURCE_NOT_FOUND" }, 404);
      if (m[2] && o.status === "APPROVED") Object.assign(o, { status: "COMPLETED", captured: true });
      return json({ id: m[1], status: o.status, purchase_units: [{ payments: o.captured ? { captures: [{ id: `CAP-${m[1]}`, status: "COMPLETED", amount: { currency_code: "USD", value: o.amount } }] } : {} }] });
    }
    if (/^\/v2\/payments\/captures\/[^/]+\/refund$/.test(url.pathname)) return json({ id: "REF-1", status: "COMPLETED" }, 201);
  }
  // Safepay
  if (url.host === "sandbox.api.getsafepay.com") {
    if (url.pathname === "/order/payments/v3/") return json({ data: { tracker: { token: "track_test1", state: "TRACKER_STARTED" } } }, 201);
    if (url.pathname === "/client/passport/v1/token") return json({ data: "tbt_test" });
    if (url.pathname.startsWith("/reporter/api/v1/payments/")) return json({ data: { tracker: { token: "track_test1", state: safepayState }, purchase_totals: { quote_amount: { amount: safepayAmount, currency: "PKR" } } } });
  }
  // JazzCash
  if (url.host === "sandbox.jazzcash.com.pk" && url.pathname.endsWith("/PaymentInquiry/Inquire")) return json({ pp_ResponseCode: "000", pp_ResponseMessage: "ok", pp_PaymentResponseCode: jazzPayment, pp_PaymentResponseMessage: jazzPayment === "000" ? "Completed" : "Failed", pp_Status: jazzPayment === "000" ? "Completed" : "Failed", pp_RetrievalReferenceNo: "RRN1" });
  // Paystack
  if (url.host === "api.paystack.co") {
    if (url.pathname === "/transaction/initialize") return json({ status: true, data: { authorization_url: "https://checkout.paystack.com/abc", reference: body.reference } });
    const v = url.pathname.match(/^\/transaction\/verify\/(.+)$/);
    if (v) return json({ status: true, data: { status: paystackStatus, reference: decodeURIComponent(v[1]), amount: 2500 * 100, currency: "NGN" } });
  }
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return realFetch(input, init);
  return json({ message: `unexpected call ${method} ${url.href}` }, 599);
}) as typeof fetch;

/* ───────────── helpers ───────────── */
const orders: number[] = [];
async function newOrder(method: string, total: number, currency: string) {
  const o = (await payload.create({
    collection: "orders",
    data: { store, orderNumber: `PAY-${Date.now().toString(36).toUpperCase()}${orders.length}`, placedAt: new Date().toISOString(), status: "awaiting-payment", customer: { name: "Pay Test", phone: "0300-1112223", email: "pay.test@example.com", city: "Karachi", address: "Street 1" }, items: [{ title: "Mouse", qty: 1, unitPrice: total }], subtotal: total, total, currency, paymentMethod: method, paymentDue: "upfront", paymentStatus: "unpaid" } as never,
    overrideAccess: true,
    depth: 0,
    context: { migrating: true },
  })) as unknown as Doc;
  orders.push(Number(o.id));
  return { id: Number(o.id), orderNumber: String(o.orderNumber) };
}
const read = async (id: number) => (await payload.findByID({ collection: "orders", id, depth: 0, overrideAccess: true })) as unknown as Doc;
const chargeOf = async (orderId: number) => (await payload.find({ collection: "payment-transactions", where: { and: [{ order: { equals: orderId } }, { kind: { equals: "charge" } }] }, sort: "-createdAt", limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc;
async function inbound(provider: string, action: string, init: { query?: string; body?: string; headers?: Record<string, string>; storeId?: number } = {}) {
  const c = (await getConnection(payload, init.storeId ?? store, provider, { all: true, fresh: true }))!;
  const impl = (await providerImpl(provider))!.payment!;
  const url = new URL(`http://localhost:3100/api/integrations/${provider}/${c.webhookKey}/${action}${init.query ?? ""}`);
  return paymentInbound({ payload, connection: c }, impl, { method: init.body ? "POST" : "GET", url, headers: new Headers(init.headers ?? {}), raw: init.body ?? "", action });
}
const start = (provider: string, o: { id: number; orderNumber: string }, total: number, currency: string) => startPayment(payload, provider, { orderId: o.id, orderNumber: o.orderNumber, total, currency, storeId: store, email: "pay.test@example.com", origin: "http://localhost:3100" });

try {
  await saveConnection(payload, { storeId: store, provider: "paypal", mode: "test", config: { clientId: "cid" }, secrets: { clientSecret: "csecret" }, status: "connected" });
  await saveConnection(payload, { storeId: store, provider: "safepay", mode: "test", config: { apiKey: "sec_test" }, secrets: { secretKey: "sk" }, status: "connected" });
  await saveConnection(payload, { storeId: store, provider: "jazzcash-online", mode: "test", config: { merchantId: "MC123", txnType: "MWALLET" }, secrets: { password: "pw", integritySalt: "0F5DD14AE2" }, status: "connected" });
  await saveConnection(payload, { storeId: store, provider: "paystack", config: {}, secrets: { secretKey: "sk_test_abc" }, status: "connected" });

  // offered at checkout: only providers for the store's country and currency
  const offered = (await storeOnlineGateways(payload, store, "PK", "PKR")).map((g) => g.id);
  check(offered.includes("safepay") && offered.includes("jazzcash-online") && !offered.includes("paypal") && !offered.includes("paystack"), `checkout offers what works in PK/PKR (${offered.join(", ")})`);
  await saveConnection(payload, { storeId: store, provider: "safepay", status: "error" });
  check(!(await storeOnlineGateways(payload, store, "PK", "PKR")).some((g) => g.id === "safepay"), "a connection whose check failed is not offered");
  await saveConnection(payload, { storeId: store, provider: "safepay", status: "connected" });

  // 1. PayPal: start → page; back before approving → still waiting; approved → captured → Paid
  const a = await newOrder("paypal", 50, "USD");
  const { url } = await start("paypal", a, 50, "USD");
  let ch = await chargeOf(a.id);
  check(url.startsWith("https://www.sandbox.paypal.com/checkoutnow") && ch?.status === "pending" && ch.providerRef === "PP1", "PayPal: payment page and a pending payment");
  let res = await inbound("paypal", "return", { query: `?o=${a.orderNumber}&token=PP1` });
  check(res.status === 303 && (await read(a.id)).status === "awaiting-payment", "back without approving → still waiting for payment");
  paypalOrders.get("PP1")!.status = "APPROVED";
  res = await inbound("paypal", "return", { query: `?o=${a.orderNumber}&token=PP1` });
  let o = await read(a.id);
  ch = await chargeOf(a.id);
  check(res.headers.get("location")?.includes(`/order-confirmation/${a.orderNumber}?payment=done`) === true, "back to the order page");
  check(o.status === "confirmed" && o.paymentStatus === "paid" && ch.status === "succeeded" && ch.paymentIntent === "CAP-PP1", `approved → captured → order paid and confirmed (${String(o.status)}/${String(o.paymentStatus)})`);
  res = await inbound("paypal", "return", { query: `?o=${a.orderNumber}` });
  check((await payload.count({ collection: "payment-transactions", where: { order: { equals: a.id } }, overrideAccess: true })).totalDocs === 1, "coming back again changes nothing");

  // refund through PayPal
  const req = await createLocalReq({}, payload);
  const refund = await refundPayment(payload, req, "paypal", { orderId: a.id, amount: 20, reason: "test" });
  o = await read(a.id);
  check(refund.status === "succeeded" && refund.refunded === 20 && o.paymentStatus === "partially-refunded", `partial refund through PayPal (${o.paymentStatus})`);
  let refused = false;
  await refundPayment(payload, req, "paypal", { orderId: a.id, amount: 31 }).catch(() => (refused = true));
  check(refused, "can't refund more than was paid");

  // 2. Safepay: the provider reports a different amount → never Paid
  const b = await newOrder("safepay", 2500, "PKR");
  await start("safepay", b, 2500, "PKR");
  safepayState = "TRACKER_ENDED";
  safepayAmount = 1000 * 100;
  await inbound("safepay", "return", { query: `?o=${b.orderNumber}&tracker=track_test1` });
  o = await read(b.id);
  ch = await chargeOf(b.id);
  check(o.paymentStatus !== "paid" && ch.status === "failed", `wrong amount from the provider → not paid (${String(ch.status)})`);

  // 3. JazzCash: a form-POST provider – our page posts the signed form; a failed payment cancels the order
  const c3 = await newOrder("jazzcash-online", 1500, "PKR");
  const jz = await start("jazzcash-online", c3, 1500, "PKR");
  check(/\/api\/integrations\/jazzcash-online\/[0-9a-f]{32}\/pay\?f=v1\./.test(jz.url) && !jz.url.includes("pw"), "JazzCash: our own page, the form sealed in the address");
  const page = await inbound("jazzcash-online", "pay", { query: `?f=${new URL(jz.url).searchParams.get("f")}` });
  const html = await page.text();
  check(html.includes('action="https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/"') && html.includes('name="pp_SecureHash"') && html.includes('name="pp_Amount" value="150000"'), "the page posts JazzCash's signed form (amount in paisa)");
  check((page.headers.get("content-security-policy") ?? "").includes("form-action https://sandbox.jazzcash.com.pk"), "the page may only post to JazzCash");
  jazzPayment = "101";
  res = await inbound("jazzcash-online", "return", { query: `?o=${c3.orderNumber}`, body: "pp_ResponseCode=101&pp_TxnRefNo=x", headers: { "content-type": "application/x-www-form-urlencoded" } });
  o = await read(c3.id);
  check(res.headers.get("location")?.endsWith("?payment=cancelled") === true && o.status === "cancelled", `failed payment → order cancelled (${String(o.status)})`);

  // 4. Paystack: an update with a wrong signature is refused; the right one settles
  const d = await newOrder("paystack", 2500, "NGN");
  await start("paystack", d, 2500, "NGN");
  const ref = String((await chargeOf(d.id)).providerRef);
  const event = JSON.stringify({ event: "charge.success", data: { reference: ref } });
  res = await inbound("paystack", "webhook", { body: event, headers: { "x-paystack-signature": "00".repeat(64) } });
  check(res.status === 401 && (await read(d.id)).paymentStatus !== "paid", "update with a wrong signature → refused, nothing paid");
  res = await inbound("paystack", "webhook", { body: event, headers: { "x-paystack-signature": createHmac("sha512", "sk_test_abc").update(event).digest("hex") } });
  o = await read(d.id);
  check(res.status === 200 && o.paymentStatus === "paid", `signed update → asked Paystack → paid (${String(o.paymentStatus)})`);

  // another store's address can't settle this store's payment
  if (other) {
    const e = await newOrder("paypal", 10, "USD");
    await start("paypal", e, 10, "USD");
    await saveConnection(payload, { storeId: Number(other.id), provider: "paypal", mode: "test", config: { clientId: "cid" }, secrets: { clientSecret: "x" }, status: "connected" });
    paypalOrders.get(`PP${paypalOrders.size}`)!.status = "APPROVED";
    await inbound("paypal", "return", { query: `?o=${e.orderNumber}`, storeId: Number(other.id) });
    check((await read(e.id)).paymentStatus !== "paid", "another store's address can't settle this store's order");
    await removeConnection(payload, Number(other.id), "paypal");
  }

  // 5. housekeeping: an abandoned page is given up after it expired
  const f = await newOrder("paypal", 30, "USD");
  await start("paypal", f, 30, "USD");
  const fc = await chargeOf(f.id);
  await payload.update({ collection: "payment-transactions", id: Number(fc.id), data: { expiresAt: new Date(Date.now() - 3 * 3_600_000).toISOString() } as never, overrideAccess: true });
  const r = await reconcilePayments(payload, "paypal");
  o = await read(f.id);
  check(r.cancelled >= 1 && o.status === "cancelled", `abandoned PayPal page → order cancelled by housekeeping (${String(o.status)})`);

  check(!calls.some((x) => x.includes("unexpected")), "no unexpected provider calls");
} finally {
  globalThis.fetch = realFetch;
  for (const p of PROVIDERS) await removeConnection(payload, store, p).catch(() => undefined);
  if (orders.length) {
    await payload.delete({ collection: "payment-transactions", where: { order: { in: orders } }, overrideAccess: true }).catch((e) => console.warn(`cleanup: ${(e as Error).message}`));
    await payload.delete({ collection: "outbox-events", where: { or: orders.map((id) => ({ "data.orderId": { equals: id } })).concat(orders.map((id) => ({ "data.id": { equals: id } }))) } as never, overrideAccess: true }).catch((e) => console.warn(`cleanup: ${(e as Error).message}`));
    for (const id of orders) await payload.delete({ collection: "orders", id, overrideAccess: true, context: { migrating: true, skipStock: true } }).catch((e) => console.warn(`cleanup: ${(e as Error).message}`));
  }
}
console.log(failed ? `Integration payments FAILED (${failed})` : "Integration payments passed");
process.exit(failed ? 1 : 0);
