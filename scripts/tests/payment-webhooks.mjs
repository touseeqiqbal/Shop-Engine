/**
 * Card payment webhooks, end to end on a running server (no Stripe account needed – events are signed locally):
 * a correct payment marks the order paid, replays change nothing, a wrong amount or another merchant's account never
 * marks paid, bad / old signatures are refused, an expired checkout cancels the order, a refund that fails later
 * puts the order back to Paid.
 *
 *   STRIPE_WEBHOOK_SECRET=whsec_localtest npm run dev        (test database only – it writes orders and payments)
 *   STRIPE_WEBHOOK_SECRET=whsec_localtest BASE_URL=http://localhost:3000 npm run test:webhooks
 */
import { createHmac } from "node:crypto";
import fs from "node:fs";
import pg from "pg";

const fromDotEnv = () => {
  try {
    return Object.fromEntries(fs.readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
  } catch {
    return {};
  }
};
const env = { ...fromDotEnv(), ...process.env };
if (!env.STRIPE_WEBHOOK_SECRET) throw new Error("Set STRIPE_WEBHOOK_SECRET (the same value the server runs with)");
const db = new pg.Client({ connectionString: env.DATABASE_URL });
await db.connect();
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const SECRET = env.STRIPE_WEBHOOK_SECRET;
const URL_ = `${(env.BASE_URL || "http://localhost:3000").replace(/\/+$/, "")}/api/webhooks/stripe`;
let failed = 0;
const check = (ok, what) => { console.log(`${ok ? "✓" : "✗"} ${what}`); if (!ok) failed++; };
const sign = (body, secret = SECRET, t = Math.floor(Date.now() / 1000)) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
const send = async (event, secret) => {
  const body = JSON.stringify(event);
  const r = await fetch(URL_, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": sign(body, secret) }, body });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

const tag = Date.now().toString(36);
await q(`update payload.cms_stores set payments_account_id='acct_local', payments_charges_enabled=true, payments_provider='stripe' where is_default`);
const store = (await q(`select id from payload.cms_stores where is_default`))[0].id;
const mkOrder = async (n, total) => {
  const o = (await q(`insert into payload.cms_orders (order_number, placed_at, customer_name, customer_phone, customer_city, customer_address, subtotal, total, payment_method, payment_status, status, store_id, stock_held)
    values ($1, now(), 'Card Buyer', '0300-5555555', 'Karachi', 'Street 9, area', $2, $2, 'card', 'unpaid', 'awaiting-payment', $3, false) returning id`, [n, total, store]))[0];
  await q(`insert into payload.cms_payment_transactions (store_id, order_id, kind, status, provider, provider_ref, amount, currency, idempotency_key, expires_at)
    values ($1, $2, 'charge', 'pending', 'stripe', $3, $4, 'PKR', $5, now() + interval '30 minutes')`, [store, o.id, `cs_${n}`, total, `checkout:${o.id}`]);
  return o.id;
};
const session = (n, amountMinor, extra = {}) => ({ id: `cs_${n}`, mode: "payment", payment_status: "paid", amount_total: amountMinor, currency: "pkr", payment_intent: `pi_${n}`, metadata: { storeId: String(store) }, ...extra });
const event = (id, type, object, account = "acct_local") => ({ id, type, account, created: Math.floor(Date.now() / 1000), data: { object } });

// 1. a correct payment marks the order paid and moves it on
const n1 = `T${tag}A`;
const o1 = await mkOrder(n1, 2500);
let r = await send(event(`evt_${tag}_1`, "checkout.session.completed", session(n1, 250000)));
check(r.status === 200, `signed event accepted (${r.status})`);
let o = (await q(`select status, payment_status, payment_reference from payload.cms_orders where id=$1`, [o1]))[0];
check(o.payment_status === "paid" && o.status === "confirmed" && o.payment_reference === `pi_${n1}`, `order paid + confirmed (${o.status}/${o.payment_status})`);
const pe = (await q(`select status from payload.cms_payment_events where event_id=$1`, [`evt_${tag}_1`]))[0];
check(pe?.status === "processed", "event stored once as processed");
const placed = (await q(`select count(*)::int n from payload.cms_outbox_events where type='notify.order-placed' and (data->>'orderId')::int=$1`, [o1]))[0].n;
check(placed === 1, "the 'order received' message is queued now that it's paid");

// 2. replaying the same event changes nothing
r = await send(event(`evt_${tag}_1`, "checkout.session.completed", session(n1, 250000)));
check(r.status === 200 && r.json.duplicate === true, "replayed event ignored");

// 2b. the provider-plugin address (/api/webhooks/payments/<provider>) is the same handler: same event = same record
const generic = URL_.replace(/\/stripe$/, "/payments/stripe");
const replayBody = JSON.stringify(event(`evt_${tag}_1`, "checkout.session.completed", session(n1, 250000)));
const g = await fetch(generic, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": sign(replayBody) }, body: replayBody });
check(g.status === 200 && (await g.json().catch(() => ({}))).duplicate === true, "the provider-plugin webhook address shares the stored events (replay ignored there too)");
const unknown = await fetch(URL_.replace(/\/stripe$/, "/payments/no-such-provider"), { method: "POST", body: "{}" });
check(unknown.status === 404, `an unknown payment provider's address answers 404 (${unknown.status})`);

// 3. wrong amount (or another account) never marks paid
const n2 = `T${tag}B`;
const o2 = await mkOrder(n2, 3000);
await send(event(`evt_${tag}_2`, "checkout.session.completed", session(n2, 100)));
o = (await q(`select status, payment_status from payload.cms_orders where id=$1`, [o2]))[0];
check(o.payment_status !== "paid", `underpaid session doesn't pay the order (${o.payment_status})`);
const tx = (await q(`select status, failure_reason from payload.cms_payment_transactions where provider_ref=$1`, [`cs_${n2}`]))[0];
check(tx.status === "failed" && /Mismatch/.test(tx.failure_reason ?? ""), "mismatch recorded on the payment");
const n3 = `T${tag}C`;
const o3 = await mkOrder(n3, 1000);
await send(event(`evt_${tag}_3`, "checkout.session.completed", session(n3, 100000), "acct_someone_else"));
o = (await q(`select payment_status from payload.cms_orders where id=$1`, [o3]))[0];
check(o.payment_status !== "paid", "payment to another merchant's account doesn't pay the order");

// 4. bad signature / stale signature refused
const body = JSON.stringify(event(`evt_${tag}_4`, "checkout.session.completed", session(n3, 100000)));
let res = await fetch(URL_, { method: "POST", headers: { "stripe-signature": sign(body, "whsec_wrong") }, body });
check(res.status === 400, `wrong signature refused (${res.status})`);
res = await fetch(URL_, { method: "POST", headers: { "stripe-signature": sign(body, SECRET, Math.floor(Date.now() / 1000) - 3600) }, body });
check(res.status === 400, `old signature refused (${res.status})`);

// 5. an expired checkout cancels the order and puts it back
const n4 = `T${tag}D`;
const o4 = await mkOrder(n4, 1200);
await send(event(`evt_${tag}_5`, "checkout.session.expired", { id: `cs_${n4}`, mode: "payment", payment_status: "unpaid" }));
o = (await q(`select status from payload.cms_orders where id=$1`, [o4]))[0];
check(o.status === "cancelled", `expired checkout cancels the order (${o.status})`);

// 5b. a refund that was pending fails later at the provider: the order is Paid again (not "refunded")
const n5 = `T${tag}E`;
const o5 = (await q(`insert into payload.cms_orders (order_number, placed_at, customer_name, customer_phone, customer_city, customer_address, subtotal, total, payment_method, payment_status, status, store_id, stock_held)
    values ($1, now(), 'Card Buyer', '0300-5555555', 'Karachi', 'Street 9, area', 1500, 1500, 'card', 'refunded', 'delivered', $2, false) returning id`, [n5, store]))[0].id;
await q(`insert into payload.cms_payment_transactions (store_id, order_id, kind, status, provider, provider_ref, payment_intent, amount, refunded_amount, currency, idempotency_key)
    values ($1, $2, 'charge', 'refunded', 'stripe', $3, $4, 1500, 1500, 'PKR', $5)`, [store, o5, `cs_${n5}`, `pi_${n5}`, `checkout:${o5}`]);
await q(`insert into payload.cms_payment_transactions (store_id, order_id, kind, status, provider, provider_ref, amount, currency, idempotency_key)
    values ($1, $2, 'refund', 'pending', 'stripe', $3, 1500, 'PKR', $4)`, [store, o5, `re_${n5}`, `refund:${o5}:0:1500`]);
let r5 = await send(event(`evt_${tag}_r1`, "charge.refund.updated", { id: `re_${n5}`, object: "refund", status: "failed", failure_reason: "expired_or_canceled_card", amount: 150000 }));
o = (await q(`select payment_status from payload.cms_orders where id=$1`, [o5]))[0];
const rf = (await q(`select status from payload.cms_payment_transactions where provider_ref=$1`, [`re_${n5}`]))[0];
check(r5.status === 200 && rf.status === "failed" && o.payment_status === "paid", `a refund failing later at the provider → refund failed, order Paid again (${rf.status}, ${o.payment_status})`);
r5 = await send(event(`evt_${tag}_r2`, "charge.refund.updated", { id: `re_${n5}`, object: "refund", status: "failed" }));
o = (await q(`select payment_status from payload.cms_orders where id=$1`, [o5]))[0];
check(r5.status === 200 && o.payment_status === "paid", "the same answer in a new event changes nothing more");

// 6. ShopEngine's own billing (platform account events – no `account`)
const plan = (await q(`select id from payload.cms_subscription_plans order by price_monthly desc limit 1`))[0]?.id;
if (plan) {
  const s = (await q(`insert into payload.cms_stores (name, slug, subdomain, status, is_default, subscription_status, plan_id) values ($1, $2, $2, 'active', false, 'active', $3) returning id`, [`Billing ${tag}`, `bill-${tag}`, plan]))[0].id;
  const sub = `sub_${tag}`;
  await q(`insert into payload.cms_store_subscriptions (store_id, plan_id, status, external_subscription_id, payment_provider) values ($1, $2, 'active', $3, 'stripe')`, [s, plan, sub]);
  const invoice = (status, extra = {}) => ({ id: `in_${tag}`, number: `INV-${tag}`, subscription: sub, currency: "pkr", amount_due: 999900, amount_paid: status === "paid" ? 999900 : 0, created: Math.floor(Date.now() / 1000), ...extra });
  await send({ id: `evt_${tag}_b1`, type: "invoice.payment_failed", created: 0, data: { object: invoice("failed") } });
  let st = (await q(`select subscription_status, grace_ends_at from payload.cms_stores where id=$1`, [s]))[0];
  check(st.subscription_status === "past_due" && st.grace_ends_at, `failed invoice → past due with a grace date (${st.subscription_status})`);
  await send({ id: `evt_${tag}_b2`, type: "invoice.paid", created: 0, data: { object: invoice("paid") } });
  st = (await q(`select subscription_status, grace_ends_at from payload.cms_stores where id=$1`, [s]))[0];
  const inv = await q(`select status, amount from payload.cms_store_invoices where store_id=$1 order by id`, [s]);
  check(st.subscription_status === "active" && !st.grace_ends_at, `paid invoice → active again (${st.subscription_status})`);
  check(inv.length === 1 && inv[0].status === "paid" && Number(inv[0].amount) === 9999, `one invoice record, now paid (${inv.map((i) => i.status).join(", ")})`);
  await send({ id: `evt_${tag}_b3`, type: "customer.subscription.deleted", created: 0, data: { object: { id: sub, status: "canceled", customer: "cus_x", metadata: { storeId: String(s) }, current_period_end: Math.floor(Date.now() / 1000) } } });
  st = (await q(`select subscription_status from payload.cms_stores where id=$1`, [s]))[0];
  check(st.subscription_status === "cancelled", `subscription cancelled at the provider → cancelled (${st.subscription_status})`);
}

await db.end();
console.log(failed ? `Webhook test FAILED (${failed})` : "Webhook test passed");
process.exit(failed ? 1 : 0);
