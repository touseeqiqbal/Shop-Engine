import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import type { Payload, PayloadRequest } from "payload";
import type { Order, OrderStatus, StoreSettings, WholesaleInquiry } from "@/lib/types";
import { absoluteUrl as mainSiteUrl, waLink } from "@/lib/site";
import { DEFAULT_SITE_INFO, type SiteInfo } from "@/lib/site-info";
import { getSiteInfo } from "@/lib/repo/site-content";
import { currentStoreId, runInStore, storeDirectory, storeOrigin } from "@/lib/tenant";
import { isCmsConfigured } from "@/lib/db/config";
import { DEFAULT_LOCALE, type StoreLocale } from "@/lib/locale";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/time";
import { intlDigits } from "@/lib/phone";
import { storeLocaleOf } from "@/payload/store-locale";
import { courierInfo, courierTrackingUrl } from "@/lib/couriers";
import { cityLine, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, paymentAccountLines, paymentLabel } from "@/lib/order-display";
import { findCheckoutMethod } from "@/lib/payments/methods";
import { deliveryEstimate } from "@/lib/cities";
import { getStoreSettings } from "@/lib/repo/catalog";
import { getNotifySettings } from "@/lib/cms/notify-settings";
import { deliverEmail, isEmailConfigured } from "@/lib/mailer";
import { amountToCollect, paidOnDelivery } from "@/lib/order-money";
import { log } from "@/lib/log";

/**
 * Order notifications (email + WhatsApp/SMS). Integration-ready: each channel is a no-op until its env vars are set.
 *
 *   SMTP_* or RESEND_API_KEY    – email (see src/lib/mailer.ts; sender EMAIL_FROM)
 *   ADMIN_ALERT_EMAIL           – the original (default) store's new-order alerts (default: that store's own email)
 *   WHATSAPP_TOKEN              – WhatsApp Cloud API permanent token
 *   WHATSAPP_PHONE_NUMBER_ID    – WhatsApp Cloud API sender phone number id
 *   WHATSAPP_TEMPLATE_ORDER     – optional approved template for new orders (body params: name, order number, total)
 *   WHATSAPP_TEMPLATE_STATUS    – optional approved template for status updates (body params: name, order number, status)
 *   WHATSAPP_TEMPLATE_LANG      – template language code (default "en")
 *   SMS_WEBHOOK_URL             – generic SMS gateway; receives POST JSON { to, message }
 *
 * Multi-store: every message is written for ONE store – its name, address, phone numbers, links (its own web address),
 * currency, time zone, phone country and notification settings. Messages are queued in the outbox (src/lib/outbox.ts)
 * and delivered by the worker:
 * `queueNotification()` → one "notify.<kind>" event → one "message.send" event per channel and recipient, each retried
 * on its own. `notifyNow()` sends straight away (scripts only).
 */

type Ctx = { site: SiteInfo; origin: string; storeId: number | null; isDefault: boolean; locale: StoreLocale };
const ctxStore = new AsyncLocalStorage<Ctx>();
/** The store this message is for (set by withStore); the original shop when nothing is set. */
const ctx = (): Ctx => ctxStore.getStore() ?? { site: DEFAULT_SITE_INFO, origin: mainSiteUrl("").replace(/\/$/, ""), storeId: null, isDefault: true, locale: DEFAULT_LOCALE };
/** A link on the store's own website. */
const absoluteUrl = (path = "/") => `${ctx().origin}${path.startsWith("/") ? path : `/${path}`}`;
/** An amount in the store's currency ("Rs 1,200", "$1,200.00"). */
const money = (n: number) => formatMoney(n, ctx().locale);
/** An order's amounts – in the currency it was placed in (older orders: the store's). */
const moneyOf = (o: Order) => {
  const currency = o.currency || ctx().locale.currency;
  return (n: number) => formatMoney(n, { currency, locale: ctx().locale.locale });
};

/** Runs `fn` for one store: its profile, web address, region and settings (all lookups inside use that store). */
export async function withStore<T>(storeId: number | null | undefined, fn: () => Promise<T>, payload?: Payload | null): Promise<T> {
  const id = storeId ?? null;
  return runInStore(id, async () => {
    const store = id == null ? null : ((await storeDirectory()).find((x) => x.id === id) ?? null);
    const [info, locale] = await Promise.all([getSiteInfo(id).catch(() => DEFAULT_SITE_INFO), payload ? storeLocaleOf(payload, id) : DEFAULT_LOCALE]);
    const origin = (store ? storeOrigin(store) : mainSiteUrl("")).replace(/\/$/, "");
    return ctxStore.run({ site: { ...info, url: origin }, origin, storeId: id, isDefault: !store || store.isDefault, locale }, fn);
  });
}

/** Team alert recipients: the store's Settings → Notifications, else its email (the original shop: ADMIN_ALERT_EMAIL first). */
const staffRecipients = (emails: string[]) => {
  if (emails.length) return emails;
  const fallback = ctx().isDefault ? process.env.ADMIN_ALERT_EMAIL || ctx().site.email : ctx().site.email;
  return fallback ? [fallback] : [];
};
const TIMEOUT = 10_000;
const dev = process.env.NODE_ENV !== "production";

function skip(channel: string, why: string) {
  if (dev) console.info(`[notify] ${channel} skipped – ${why}`);
}

const esc = (s: string | number | null | undefined) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// ───────────────────────────── channels ─────────────────────────────

/**
 * One message to one recipient on one channel – what the outbox stores and retries.
 * `country`: the store's country, for a phone number typed without its country code (older messages: Pakistan).
 */
export type Message =
  | { channel: "email"; to: string; subject: string; html: string; text: string; replyTo?: string }
  | { channel: "whatsapp"; to: string; text: string; template?: { name?: string; params: string[] }; country?: string }
  | { channel: "sms"; to: string; text: string; country?: string };

/** Messages being built for the current notification (collected instead of sent). */
const outbox = new AsyncLocalStorage<Message[]>();
const push = (m: Message) => {
  const list = outbox.getStore();
  if (!list) throw new Error("notify: message built outside a notification");
  list.push(m);
};

async function sendEmail(to: string, subject: string, html: string, text: string) {
  if (!to) return;
  push({ channel: "email", to, subject, html, text, replyTo: ctx().site.email || undefined });
}

async function sendWhatsApp(phone: string, text: string, template?: { name?: string; params: string[] }) {
  if (phone) push({ channel: "whatsapp", to: phone, text, template, country: ctx().locale.country });
}

async function sendSms(phone: string, message: string) {
  if (phone) push({ channel: "sms", to: phone, text: message, country: ctx().locale.country });
}

/** Actually sends one message (the outbox worker calls this; throws so the delivery is retried). */
export async function sendMessage(m: Message): Promise<void> {
  if (m.channel === "email") {
    await deliverEmail({ to: m.to, subject: m.subject, html: m.html, text: m.text, replyTo: m.replyTo });
    return;
  }
  if (m.channel === "whatsapp") return deliverWhatsApp(m.to, m.text, m.template, m.country);
  return deliverSms(m.to, m.text, m.country);
}

async function deliverWhatsApp(phone: string, text: string, template?: { name?: string; params: string[] }, country?: string) {
  if (process.env.STAGING === "true") return skip("whatsapp", "STAGING – notifications disabled");
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return skip("whatsapp", "WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID not set");
  const to = intlDigits(phone, country);
  const body = template?.name
    ? {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: template.name,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "en" },
          components: [{ type: "body", parameters: template.params.map((p) => ({ type: "text", text: p })) }],
        },
      }
    : { messaging_product: "whatsapp", to, type: "text", text: { preview_url: true, body: text } };
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

async function deliverSms(phone: string, message: string, country?: string) {
  if (process.env.STAGING === "true") return skip("sms", "STAGING – notifications disabled");
  const url = process.env.SMS_WEBHOOK_URL;
  if (!url) return skip("sms", "SMS_WEBHOOK_URL not set");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to: intlDigits(phone, country), message }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`SMS webhook ${res.status}`);
}

/**
 * A message couldn't be built (settings unreadable, database busy…): logged, and inside the outbox the error goes up so
 * the whole notification is retried later – never marked "sent" with nothing in it.
 */
function buildFailed(event: string, err: unknown, extra?: Record<string, unknown>): void {
  log.error(event, err, extra);
  if (outbox.getStore()) throw err;
}

/** Collects the messages queued by the builder tasks (builders only push – nothing is sent here). */
async function settle(label: string, tasks: Promise<unknown>[]) {
  const results = await Promise.allSettled(tasks);
  for (const r of results) if (r.status === "rejected") buildFailed("notify.build_failed", r.reason, { label });
}

// ───────────────────────────── templates ─────────────────────────────

const trackUrl = (o: Order) => absoluteUrl(`/track-order?order=${encodeURIComponent(o.orderNumber)}`);
const confirmUrl = (o: Order) => (o.confirmation ? absoluteUrl(`/confirm-order/${o.confirmation.token}`) : trackUrl(o));
const awaiting = (o: Order) => o.status === "awaiting-confirmation" && Boolean(o.confirmation);
/** The confirmation deadline in the store's time zone ("Tue 3:45 pm"). */
const deadline = (o: Order) => (o.confirmation ? formatDate(o.confirmation.expiresAt, ctx().locale, { weekday: "short", hour: "numeric", minute: "2-digit" }) : "");

/** One short message: confirm link + code + deadline (fake-order protection). */
function confirmText(o: Order) {
  return `${ctx().site.shortName}: please confirm your order ${o.orderNumber} (${moneyOf(o)(o.total)}, cash on delivery). Tap ${confirmUrl(o)} or enter code ${o.confirmation?.code} on our website. If it isn't confirmed by ${deadline(o)} it will be cancelled.`;
}

function itemsTable(o: Order) {
  const price = moneyOf(o);
  const rows = o.items
    .map(
      (i) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827">
          ${esc(i.name)}${i.upgrades.length ? `<br><span style="color:#7c3aed;font-size:12px">+ ${esc(i.upgrades.map((u) => u.label).join(", "))}</span>` : ""}
          <br><span style="color:#6b7280;font-size:12px">Qty ${i.qty} × ${esc(price(i.unitPrice))}</span>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px;text-align:right;white-space:nowrap;color:#111827">${esc(price(i.unitPrice * i.qty))}</td>
      </tr>`
    )
    .join("");
  const line = (label: string, value: string, bold = false) =>
    `<tr><td style="padding:4px 0;font-size:14px;color:${bold ? "#111827" : "#4b5563"};${bold ? "font-weight:700" : ""}">${esc(label)}</td><td style="padding:4px 0;font-size:14px;text-align:right;color:#111827;${bold ? "font-weight:700" : ""}">${esc(value)}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px">
    ${line("Subtotal", price(o.subtotal))}
    ${o.discount ? line(`Discount${o.couponCode ? ` (${o.couponCode})` : ""}`, `− ${price(o.discount)}`) : ""}
    ${line("Delivery", o.deliveryCharge ? price(o.deliveryCharge) : "FREE")}
    ${line("Total", price(o.total), true)}
    ${o.advancePaid ? (o.paymentStatus === "partial" ? line("Advance paid", price(o.advancePaid)) : line("Advance (being checked)", price(o.advancePaid))) + line("Due on delivery", price(Math.max(0, o.total - o.advancePaid))) : ""}
  </table>`;
}

function paymentBlock(o: Order, s: StoreSettings) {
  const lines = paymentAccountLines(o.paymentMethod, s);
  const instructions = lines.length
    ? `<p style="margin:8px 0 0;font-size:13px;color:#4b5563">${o.paymentStatus === "awaiting-verification" ? "We have received your payment screenshot and will verify it shortly." : "Please transfer the amount to:"}</p>
       <p style="margin:6px 0 0;font-size:13px;color:#111827">${lines.map((l) => `${esc(l.label)}: <strong>${esc(l.value)}</strong>`).join("<br>")}</p>`
    : o.paymentMethod === "cod"
      ? `<p style="margin:8px 0 0;font-size:13px;color:#4b5563">Please keep ${esc(moneyOf(o)(o.total))} ready in cash when the rider arrives.</p>`
      : paidOnDelivery(o)
        ? `<p style="margin:8px 0 0;font-size:13px;color:#4b5563">Please keep ${esc(moneyOf(o)(o.total))} ready when your order arrives.</p>`
        : "";
  // the store's own steps for its own methods ("use your order number as the reference")
  const steps = lines.length && o.paymentStatus !== "awaiting-verification" ? findCheckoutMethod(o.paymentMethod, s)?.instructions : undefined;
  return `<p style="margin:0;font-size:14px;color:#111827"><strong>${esc(paymentLabel(o.paymentMethod, o.paymentMethodLabel))}</strong> · ${esc(PAYMENT_STATUS_LABEL[o.paymentStatus])}</p>${instructions}${steps ? `<p style="margin:6px 0 0;font-size:13px;color:#4b5563">${esc(steps)}</p>` : ""}`;
}

function layout(title: string, preheader: string, inner: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden">
  <tr><td style="background:linear-gradient(120deg,#3b82f6,#8b5cf6);background-color:#6366f1;padding:24px 28px">
    <p style="margin:0;color:#ffffff;font-size:20px;font-weight:800">${esc(ctx().site.name)}</p>
    <p style="margin:4px 0 0;color:#e0e7ff;font-size:13px">${esc(ctx().site.tagline)}</p>
  </td></tr>
  <tr><td style="padding:28px">${inner}</td></tr>
  <tr><td style="padding:18px 28px;background:#f9fafb;color:#6b7280;font-size:12px;line-height:1.6">
    ${esc(ctx().site.address.full)}<br>WhatsApp / Call: ${esc(ctx().site.phones.map((p) => p.display).join(" · "))}<br>
    <a href="${esc(ctx().site.url)}" style="color:#6366f1">${esc(ctx().site.url.replace(/^https?:\/\//, ""))}</a>
  </td></tr>
</table></td></tr></table></body></html>`;
}

function button(href: string, label: string) {
  return `<a href="${esc(href)}" style="display:inline-block;margin-top:20px;padding:12px 22px;border-radius:999px;background:#6366f1;color:#ffffff;font-weight:700;font-size:14px;text-decoration:none">${esc(label)}</a>`;
}

function addressBlock(o: Order) {
  const c = o.customer;
  return `<p style="margin:0;font-size:14px;color:#111827;line-height:1.6"><strong>${esc(c.name)}</strong> · ${esc(c.phone)}<br>${esc(c.address)}${c.landmark ? `<br>Near ${esc(c.landmark)}` : ""}<br>${esc(cityLine(c))}</p>`;
}

function section(title: string, body: string) {
  return `<h3 style="margin:24px 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280">${esc(title)}</h3>${body}`;
}

function customerOrderEmail(o: Order, s: StoreSettings) {
  const eta = deliveryEstimate(o.customer.city, s, o.customer.postalCode ?? "").label;
  const inner = `
    <h1 style="margin:0;font-size:22px;color:#111827">Thank you, ${esc(o.customer.name.split(" ")[0])}! 🎉</h1>
    <p style="margin:8px 0 0;font-size:14px;color:#4b5563">We've received your order <strong style="color:#111827">${esc(o.orderNumber)}</strong>. ${
      awaiting(o)
        ? `<strong style="color:#111827">Please confirm it</strong> so we can pack it – tap the button below or enter code <strong style="color:#111827;letter-spacing:.1em">${esc(o.confirmation?.code)}</strong> on our website. Not confirmed by ${esc(deadline(o))} = cancelled.`
        : "Our team will call or WhatsApp you shortly to confirm it."
    } Estimated delivery to ${esc(o.customer.city)}: <strong>${esc(eta)}</strong>.</p>
    ${awaiting(o) ? button(confirmUrl(o), "Confirm my order") : ""}
    ${section("Order summary", itemsTable(o))}
    ${section("Delivery address", addressBlock(o))}
    ${section("Payment", paymentBlock(o, s))}
    ${o.notes ? section("Your notes", `<p style="margin:0;font-size:14px;color:#4b5563">${esc(o.notes)}</p>`) : ""}
    ${button(trackUrl(o), "Track your order")}`;
  return layout(`Order ${o.orderNumber} received`, `Order ${o.orderNumber} – total ${moneyOf(o)(o.total)}`, inner);
}

function adminOrderEmail(o: Order, s: StoreSettings) {
  const total = moneyOf(o)(o.total);
  const inner = `
    <h1 style="margin:0;font-size:20px;color:#111827">New order ${esc(o.orderNumber)} – ${esc(total)}</h1>
    <p style="margin:8px 0 0;font-size:14px;color:#4b5563">${esc(o.items.reduce((n, i) => n + i.qty, 0))} item(s) · ${esc(o.customer.city)} · ${esc(paymentLabel(o.paymentMethod, o.paymentMethodLabel))}${o.paymentScreenshotUrl ? " · payment screenshot attached in admin" : ""}</p>
    ${section("Customer", addressBlock(o) + (o.customer.email ? `<p style="margin:4px 0 0;font-size:13px;color:#4b5563">${esc(o.customer.email)}</p>` : ""))}
    ${section("Items", itemsTable(o))}
    ${section("Payment", paymentBlock(o, s))}
    ${o.notes ? section("Customer notes", `<p style="margin:0;font-size:14px;color:#4b5563">${esc(o.notes)}</p>`) : ""}
    ${button(mainSiteUrl(`/cms/collections/orders?search=${encodeURIComponent(o.orderNumber)}`), "Open in /cms")}
    <a href="${esc(waLink(intlDigits(o.customer.phone, ctx().locale.country), `Hi ${o.customer.name}, this is ${ctx().site.name}. We received your order ${o.orderNumber} (${total}).`))}" style="display:inline-block;margin:20px 0 0 8px;padding:12px 22px;border-radius:999px;background:#16a34a;color:#ffffff;font-weight:700;font-size:14px;text-decoration:none">WhatsApp customer</a>`;
  return layout(`New order ${o.orderNumber}`, `${o.customer.name} · ${o.customer.city} · ${total}`, inner);
}

function plainOrderText(o: Order) {
  const price = moneyOf(o);
  return [
    `Thank you for your order, ${o.customer.name}!`,
    `Order: ${o.orderNumber}`,
    ...o.items.map((i) => `• ${i.name}${i.upgrades.length ? ` (+ ${i.upgrades.map((u) => u.label).join(", ")})` : ""} × ${i.qty} – ${price(i.unitPrice * i.qty)}`),
    `Delivery: ${o.deliveryCharge ? price(o.deliveryCharge) : "FREE"}`,
    o.discount ? `Discount: −${price(o.discount)}` : "",
    `Total: ${price(o.total)} (${paymentLabel(o.paymentMethod, o.paymentMethodLabel)})`,
    `Track: ${trackUrl(o)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

const STATUS_COPY: Partial<Record<OrderStatus, (o: Order) => string>> = {
  confirmed: (o) => `Your order ${o.orderNumber} has been confirmed and is being prepared for dispatch.`,
  dispatched: (o) => {
    const c = courierInfo(o.courier)?.name ?? o.courier;
    return `Your order ${o.orderNumber} has been dispatched${c ? ` via ${c}` : ""}${o.trackingNumber ? ` (tracking no. ${o.trackingNumber})` : ""}.`;
  },
  "out-for-delivery": (o) =>
    `Your order ${o.orderNumber} is out for delivery today. ${amountToCollect(o) > 0 ? `Please keep ${moneyOf(o)(amountToCollect(o))} ready.` : ""}`.trim(),
  delivered: (o) => `Your order ${o.orderNumber} has been delivered. Thank you for shopping with ${ctx().site.name}! We'd love your review.`,
  cancelled: (o) => `Your order ${o.orderNumber} has been cancelled. If you didn't expect this or have already paid, please contact us on WhatsApp ${ctx().site.phones[0]?.display ?? ""}.`.trim(),
};

// ───────────────────────────── public API ─────────────────────────────

/**
 * Can we ask this customer to confirm a cash-on-delivery order? Needs at least one channel that really reaches a
 * new customer: the approved WhatsApp confirm template, an SMS gateway, or email (if they gave one).
 * Checkout only asks for confirmation when this is true – otherwise staff confirm by phone instead.
 */
export function canAskForConfirmation(email?: string | null): boolean {
  if (process.env.STAGING === "true") return true; // nothing is sent on staging anyway; keep the flow testable
  const whatsapp = Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_TEMPLATE_CONFIRM);
  return whatsapp || Boolean(process.env.SMS_WEBHOOK_URL) || Boolean(email && isEmailConfigured());
}

/** Customer confirmation (email + WhatsApp/SMS) and admin alert for a newly placed order. */
export async function notifyNewOrder(order: Order): Promise<void> {
  try {
    const [settings, ns] = await Promise.all([getStoreSettings(ctx().storeId), getNotifySettings(ctx().storeId)]);
    const waiting = awaiting(order);
    const text = waiting ? `${plainOrderText(order)}\n\n${confirmText(order)}` : plainOrderText(order);
    const tasks: Promise<unknown>[] = [];
    if (ns.alertNewOrder)
      for (const to of staffRecipients(ns.staffEmails))
        tasks.push(sendEmail(to, `🛒 New order ${order.orderNumber} – ${moneyOf(order)(order.total)} (${order.customer.city})`, adminOrderEmail(order, settings), text));

    // The order email doubles as the confirmation request (it has the button and the code).
    if (order.customer.email && ns.customerEmail && (ns.orderConfirmation || waiting))
      tasks.push(sendEmail(order.customer.email, waiting ? `Please confirm order ${order.orderNumber} – ${ctx().site.name}` : `Order ${order.orderNumber} received – ${ctx().site.name}`, customerOrderEmail(order, settings), text));

    if (waiting) {
      // Always ask for the confirmation – with the link and the code – whatever the "order received" switches say.
      // WhatsApp only delivers business-started messages through an approved template (WHATSAPP_TEMPLATE_CONFIRM).
      if (process.env.WHATSAPP_TEMPLATE_CONFIRM)
        tasks.push(sendWhatsApp(order.customer.phone, confirmText(order), { name: process.env.WHATSAPP_TEMPLATE_CONFIRM, params: [order.customer.name, order.orderNumber, confirmUrl(order)] }));
      tasks.push(sendSms(order.customer.phone, confirmText(order)));
    } else if (ns.orderConfirmation) {
      if (ns.customerWhatsApp)
        tasks.push(sendWhatsApp(order.customer.phone, text, { name: process.env.WHATSAPP_TEMPLATE_ORDER, params: [order.customer.name, order.orderNumber, moneyOf(order)(order.total)] }));
      if (ns.customerSms) tasks.push(sendSms(order.customer.phone, `${ctx().site.shortName}: order ${order.orderNumber} received, total ${moneyOf(order)(order.total)}. Track: ${trackUrl(order)}`));
    }
    await settle(`new order ${order.orderNumber}`, tasks);
  } catch (err) {
    buildFailed("notify.new_order_failed", err);
  }
}

/** Customer update when an order is confirmed / dispatched / out for delivery / delivered. */
export async function notifyOrderStatusChange(order: Order): Promise<void> {
  try {
    const copy = STATUS_COPY[order.status];
    const ns = await getNotifySettings(ctx().storeId);
    // a cancellation is always sent – the customer must know not to wait for the parcel
    if (!copy || (order.status !== "cancelled" && !ns.statusUpdates.includes(order.status))) return;
    const message = copy(order);
    const statusLabel = ORDER_STATUS_LABEL[order.status];
    const trackLink = courierTrackingUrl(order.courier, order.trackingNumber);
    const text = `${message}\nTrack: ${trackUrl(order)}${trackLink ? `\nCourier tracking: ${trackLink}` : ""}`;
    const tasks: Promise<unknown>[] = [];
    if (order.customer.email && ns.customerEmail) {
      const inner = `
        <h1 style="margin:0;font-size:22px;color:#111827">Order ${esc(statusLabel.toLowerCase())}</h1>
        <p style="margin:8px 0 0;font-size:14px;color:#4b5563">Hi ${esc(order.customer.name.split(" ")[0])}, ${esc(message)}</p>
        ${order.status === "dispatched" && order.trackingNumber ? section("Courier", `<p style="margin:0;font-size:14px;color:#111827">${esc(courierInfo(order.courier)?.name ?? order.courier ?? "Courier")} · <strong>${esc(order.trackingNumber)}</strong>${trackLink ? ` · <a href="${esc(trackLink)}" style="color:#6366f1">Track on courier site</a>` : ""}</p>`) : ""}
        ${section("Order summary", itemsTable(order))}
        ${button(trackUrl(order), "Track your order")}`;
      tasks.push(
        sendEmail(order.customer.email, `${statusLabel}: order ${order.orderNumber} – ${ctx().site.name}`, layout(`Order ${order.orderNumber} ${statusLabel}`, message, inner), text)
      );
    }
    if (ns.customerWhatsApp)
      tasks.push(
        sendWhatsApp(order.customer.phone, text, {
          name: process.env.WHATSAPP_TEMPLATE_STATUS,
          params: [order.customer.name, order.orderNumber, statusLabel],
        })
      );
    if (ns.customerSms) tasks.push(sendSms(order.customer.phone, `${ctx().site.shortName}: ${message}`));
    await settle(`status ${order.orderNumber} → ${order.status}`, tasks);
  } catch (err) {
    buildFailed("notify.status_change_failed", err);
  }
}

// ───────────────────────────── wholesale ─────────────────────────────

/** Admin alert for a new wholesale quote request (email via Resend when configured). Never throws. */
export async function notifyWholesaleInquiry(inquiry: WholesaleInquiry): Promise<void> {
  try {
    const ns = await getNotifySettings(ctx().storeId);
    if (!ns.alertWholesale) return;
    const recipients = staffRecipients(ns.staffEmails);
    const units = inquiry.items.reduce((s, i) => s + i.qty, 0);
    const adminUrl = mainSiteUrl(`/cms/collections/wholesale-inquiries`);
    const rows = inquiry.items
      .map(
        (i) =>
          `<tr><td style="padding:6px 0;font-size:14px;color:#111827">${i.url ? `<a href="${esc(absoluteUrl(i.url))}" style="color:#6366f1">${esc(i.productName)}</a>` : esc(i.productName)}</td><td style="padding:6px 0;font-size:14px;color:#111827;text-align:right;white-space:nowrap"><strong>${esc(i.qty)}</strong> pcs</td></tr>`
      )
      .join("");
    const contact = [
      `<strong>${esc(inquiry.name)}</strong>${inquiry.businessName ? ` · ${esc(inquiry.businessName)}` : ""}`,
      `${esc(inquiry.phone)}${inquiry.email ? ` · ${esc(inquiry.email)}` : ""}`,
      `${esc(inquiry.city)} · ${esc(inquiry.buyerType)}`,
      inquiry.budget ? `Budget: ${esc(inquiry.budget)}` : "",
    ]
      .filter(Boolean)
      .join("<br>");
    const inner = `
      <h1 style="margin:0;font-size:22px;color:#111827">New wholesale quote request</h1>
      <p style="margin:8px 0 0;font-size:14px;color:#4b5563">${esc(units)} unit${units === 1 ? "" : "s"} requested from ${esc(inquiry.source || "/wholesale")}.</p>
      ${section("Customer", `<p style="margin:0;font-size:14px;color:#111827;line-height:1.6">${contact}</p>`)}
      ${section("Items", `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`)}
      ${inquiry.message ? section("Message", `<p style="margin:0;font-size:14px;color:#111827;white-space:pre-wrap">${esc(inquiry.message)}</p>`) : ""}
      ${button(adminUrl, "Open in admin")}`;
    const text = [
      `New wholesale quote request – ${inquiry.name}${inquiry.businessName ? ` (${inquiry.businessName})` : ""}`,
      `${inquiry.phone}${inquiry.email ? ` · ${inquiry.email}` : ""} · ${inquiry.city} · ${inquiry.buyerType}`,
      ...inquiry.items.map((i) => `- ${i.qty} × ${i.productName}`),
      inquiry.budget ? `Budget: ${inquiry.budget}` : "",
      inquiry.message ? `Message: ${inquiry.message}` : "",
      adminUrl,
    ]
      .filter(Boolean)
      .join("\n");
    await settle(
      `wholesale ${inquiry.id}`,
      recipients.map((to) => sendEmail(to, `📦 Wholesale quote: ${units} pcs – ${inquiry.name} (${inquiry.city})`, layout("New wholesale quote request", `${inquiry.name} – ${units} pcs`, inner), text))
    );
  } catch (err) {
    buildFailed("notify.wholesale_inquiry_failed", err);
  }
}

// ───────────────────────────── contact form ─────────────────────────────

/** Team alert for a contact-form message (off by default – Settings → Notifications). Never throws. */
export async function notifyContactMessage(m: { name: string; phone?: string | null; email?: string | null; subject?: string | null; message: string }): Promise<void> {
  try {
    const ns = await getNotifySettings(ctx().storeId);
    if (!ns.alertContact) return;
    const text = [`From: ${m.name}`, m.phone ? `Phone: ${m.phone}` : "", m.email ? `Email: ${m.email}` : "", m.subject ? `Subject: ${m.subject}` : "", "", m.message, "", mainSiteUrl("/cms/collections/contact-messages")].filter((x, i) => x !== "" || i === 4 || i === 6).join("\n");
    const inner = `
      <h1 style="margin:0;font-size:22px;color:#111827">New contact message</h1>
      ${section("From", `<p style="margin:0;font-size:14px;color:#111827;line-height:1.6"><strong>${esc(m.name)}</strong><br>${esc(m.phone ?? "")} ${m.email ? `· ${esc(m.email)}` : ""}</p>`)}
      ${section(m.subject || "Message", `<p style="margin:0;font-size:14px;color:#111827;white-space:pre-wrap">${esc(m.message)}</p>`)}`;
    await settle("contact message", staffRecipients(ns.staffEmails).map((to) => sendEmail(to, `✉️ Contact form: ${m.subject || m.name}`, layout("New contact message", m.name, inner), text)));
  } catch (err) {
    buildFailed("notify.contact_message_failed", err);
  }
}

/** Re-send the confirmation link / code (from the order page in /cms). */
export async function notifyConfirmationReminder(order: Order): Promise<void> {
  if (!awaiting(order)) return;
  try {
    const msg = confirmText(order);
    await settle(`confirm reminder ${order.orderNumber}`, [
      sendWhatsApp(order.customer.phone, msg, { name: process.env.WHATSAPP_TEMPLATE_CONFIRM, params: [order.customer.name, order.orderNumber, confirmUrl(order)] }),
      sendSms(order.customer.phone, msg),
      ...(order.customer.email ? [sendEmail(order.customer.email, `Please confirm order ${order.orderNumber} – ${ctx().site.name}`, layout(`Confirm order ${order.orderNumber}`, msg, `<p style="margin:0;font-size:14px;color:#4b5563">${esc(msg)}</p>${button(confirmUrl(order), "Confirm my order")}`), msg)] : []),
    ]);
  } catch (err) {
    buildFailed("notify.confirmation_reminder_failed", err);
  }
}

/** The customer didn't confirm in time – tell them it was cancelled and how to order again. */
export async function notifyUnconfirmedCancelled(order: Order): Promise<void> {
  try {
    const msg = `${ctx().site.shortName}: your order ${order.orderNumber} was cancelled because it wasn't confirmed in time. Still want it? Order again or WhatsApp us: ${ctx().site.url}`;
    await settle(`unconfirmed cancel ${order.orderNumber}`, [
      sendWhatsApp(order.customer.phone, msg),
      sendSms(order.customer.phone, msg),
      ...(order.customer.email ? [sendEmail(order.customer.email, `Order ${order.orderNumber} cancelled – ${ctx().site.name}`, layout(`Order ${order.orderNumber} cancelled`, msg, `<p style="margin:0;font-size:14px;color:#4b5563">${esc(msg)}</p>`), msg)] : []),
    ]);
  } catch (err) {
    buildFailed("notify.unconfirmed_cancelled_failed", err);
  }
}

/** Short alert to the team (staff emails from Settings → Notifications), e.g. a new return or warranty claim. */
export async function notifyStaff(subject: string, lines: string[], link?: { href: string; label: string }): Promise<void> {
  try {
    const ns = await getNotifySettings(ctx().storeId);
    // staff links open /cms, which lives on the platform's own address
    const adminLink = (href: string) => (/^https?:\/\//.test(href) ? href : href.startsWith("/cms") || href.startsWith("/account/stores") ? mainSiteUrl(href) : absoluteUrl(href));
    const text = [...lines, link ? `${link.label}: ${adminLink(link.href)}` : ""].filter(Boolean).join("\n");
    const inner = `<h1 style="margin:0;font-size:20px;color:#111827">${esc(subject)}</h1>${lines.map((l) => `<p style="margin:8px 0 0;font-size:14px;color:#4b5563">${esc(l)}</p>`).join("")}${link ? button(adminLink(link.href), link.label) : ""}`;
    await settle(`staff: ${subject}`, staffRecipients(ns.staffEmails).map((to) => sendEmail(to, subject, layout(subject, lines[0] ?? subject, inner), text)));
  } catch (err) {
    buildFailed("notify.staff_failed", err);
  }
}

/** Part of an order is on its way (the rest follows) – email and WhatsApp/SMS with the parcel's tracking. */
export async function notifyShipment(order: Order, s: { items?: { title?: string; qty?: number }[]; courier?: string | null; trackingNumber?: string | null }) {
  const what = (s.items ?? []).map((i) => `${i.title ?? "Item"} × ${i.qty ?? 1}`).join(", ");
  const tracking = s.trackingNumber ? `${s.courier ? `${s.courier} ` : ""}tracking: ${s.trackingNumber}` : "";
  const link = absoluteUrl(`/track-order?order=${encodeURIComponent(order.orderNumber)}`);
  const text = `Part of your order ${order.orderNumber} is on its way: ${what}.${tracking ? ` ${tracking}.` : ""} The rest follows soon. Track: ${link}`;
  const subject = `Part of your order ${order.orderNumber} is on its way`;
  const inner = `<h1 style="margin:0;font-size:20px;color:#111827">${esc(subject)}</h1><p style="margin:8px 0 0;font-size:14px;color:#4b5563">${esc(what)}</p>${tracking ? `<p style="margin:8px 0 0;font-size:14px;color:#4b5563">${esc(tracking)}</p>` : ""}${button(link, "Track order")}`;
  if (order.customer.email) await sendEmail(order.customer.email, subject, layout(subject, text, inner), text);
  if (order.customer.phone) await sendWhatsApp(order.customer.phone, text);
}

/** Invitation to join a store's team (the link opens Account → Stores on the platform's own site). */
export async function notifyStoreInvite(i: { email: string; storeName: string; role: string; token: string; invitedBy?: string | null }) {
  const url = mainSiteUrl(`/account/stores?invite=${encodeURIComponent(i.token)}`);
  const role = i.role === "store_manager" ? "a manager" : i.role === "store_owner" ? "the owner" : "a team member";
  const subject = `You're invited to ${i.storeName}`;
  const lines = [`${i.invitedBy ? `${i.invitedBy} invited you` : "You've been invited"} to join ${i.storeName} on ShopEngine as ${role}.`, "Sign in (or create an account) with this email address, then accept the invitation. The link works for 7 days."];
  const inner = `<h1 style="margin:0;font-size:20px;color:#111827">${esc(subject)}</h1>${lines.map((l) => `<p style="margin:8px 0 0;font-size:14px;color:#4b5563">${esc(l)}</p>`).join("")}${button(url, "Accept invitation")}`;
  await sendEmail(i.email, subject, layout(subject, lines[0], inner), `${lines.join("\n")}\n${url}`);
}

/* ───────────── engagement: questions, alerts, abandoned carts ───────────── */

const isEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

/** Can we actually message this contact right now? (email needs SMTP or Resend; a phone needs WhatsApp + an approved template) */
export function canReach(contact: string, whatsappTemplateEnv: string): boolean {
  if (process.env.STAGING === "true") return false;
  if (isEmail(contact)) return isEmailConfigured();
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env[whatsappTemplateEnv]);
}

/** Email when possible; WhatsApp (approved template) for phone numbers once WHATSAPP_TEMPLATE_<KIND> is set. */
async function reach(contact: string, subject: string, message: string, link: { href: string; label: string }, whatsappTemplate?: { env: string; params: string[] }) {
  if (isEmail(contact)) {
    const inner = `<h1 style="margin:0;font-size:20px;color:#111827">${esc(subject)}</h1><p style="margin:8px 0 0;font-size:14px;color:#4b5563">${esc(message)}</p>${button(link.href, link.label)}`;
    return sendEmail(contact, subject, layout(subject, message, inner), `${message}\n${link.href}`);
  }
  const name = whatsappTemplate ? process.env[whatsappTemplate.env] : undefined;
  if (name) return sendWhatsApp(contact, `${message}\n${link.href}`, { name, params: whatsappTemplate!.params });
  return skip("whatsapp", `${whatsappTemplate?.env ?? "template"} not set – phone-only contact not messaged`);
}

// ───────────────────────────── "find my orders" ─────────────────────────────
// Order numbers are sent to the phone itself – never shown to whoever typed the number.

/**
 * Can "find my orders" reach the customer? By email (to the address used on those orders), WhatsApp (approved
 * WHATSAPP_TEMPLATE_ORDER_LOOKUP) or an SMS gateway.
 */
export function canSendOrderLookup(): boolean {
  if (process.env.STAGING === "true") return false;
  return isEmailConfigured() || Boolean(process.env.SMS_WEBHOOK_URL || (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_TEMPLATE_ORDER_LOOKUP));
}

export async function notifyOrderLookup(phone: string, orders: { orderNumber: string; email?: string | null }[]): Promise<void> {
  try {
    const numbers = orders.map((o) => o.orderNumber);
    const list = numbers.slice(0, 5).join(", ");
    const link = absoluteUrl("/track-order");
    const message = `${ctx().site.shortName}: your order number${numbers.length > 1 ? "s" : ""}: ${list}. Track with your phone number at ${link}`;
    const tasks: Promise<unknown>[] = [];
    if (process.env.WHATSAPP_TEMPLATE_ORDER_LOOKUP) tasks.push(sendWhatsApp(phone, message, { name: process.env.WHATSAPP_TEMPLATE_ORDER_LOOKUP, params: [list, link] }));
    else if (process.env.SMS_WEBHOOK_URL) tasks.push(sendSms(phone, message));
    // Email goes only to addresses used on these orders – the people who placed them.
    const emails = [...new Set(orders.map((o) => o.email?.trim().toLowerCase()).filter((e): e is string => Boolean(e)))];
    if (emails.length) {
      const subject = `Your order number${numbers.length > 1 ? "s" : ""} – ${ctx().site.name}`;
      const intro = `You asked for your order number${numbers.length > 1 ? "s" : ""} on our website.`;
      const inner = `<h1 style="margin:0;font-size:20px;color:#111827">${esc(subject)}</h1><p style="margin:8px 0 0;font-size:14px;color:#4b5563">${esc(intro)}</p><p style="margin:12px 0 0;font-size:16px;font-weight:700;color:#111827">${numbers.slice(0, 10).map(esc).join("<br>")}</p><p style="margin:12px 0 0;font-size:13px;color:#6b7280">Track an order with its number and the phone number you used. Didn't ask for this? You can ignore this email.</p>${button(link, "Track my order")}`;
      for (const to of emails) tasks.push(sendEmail(to, subject, layout(subject, intro, inner), `${intro}\n${numbers.join("\n")}\nTrack: ${link}`));
    }
    await settle("order lookup", tasks);
  } catch (err) {
    buildFailed("notify.order_lookup_failed", err);
  }
}

export async function notifyQuestionAnswered(q: { email: string; name: string; question: string; answer: string; productId?: number }) {
  try {
    const { payloadClient } = await import("@/lib/cms/catalog-source");
    const p = q.productId ? ((await (await payloadClient()).findByID({ collection: "products", id: q.productId, depth: 1, overrideAccess: true }).catch(() => null)) as unknown as { title?: string; slug?: string; category?: { slug?: string }; store?: unknown } | null) : null;
    const url = p?.slug && p.category?.slug ? absoluteUrl(`/${p.category.slug}/${p.slug}`) : absoluteUrl("/");
    await settle("question answered", [reach(q.email, `Your question was answered – ${ctx().site.name}`, `You asked: “${q.question}” – Our answer: ${q.answer}`, { href: url, label: p?.title ? `See ${p.title}` : "Visit the shop" })]);
  } catch (err) {
    buildFailed("notify.question_answered_failed", err);
  }
}

export async function notifyStockOrPrice(a: { contact: string; kind: "stock" | "price"; title: string; url: string; price: number; was?: number }) {
  const subject = a.kind === "stock" ? `Back in stock: ${a.title}` : `Price drop: ${a.title}`;
  const message =
    a.kind === "stock"
      ? `Good news – ${a.title} is back in stock at ${money(a.price)}. Stock is limited.`
      : `${a.title} is now ${money(a.price)}${a.was ? ` (was ${money(a.was)})` : ""}.`;
  await reach(a.contact, subject, message, { href: absoluteUrl(a.url), label: "View product" }, { env: a.kind === "stock" ? "WHATSAPP_TEMPLATE_BACK_IN_STOCK" : "WHATSAPP_TEMPLATE_PRICE_DROP", params: [a.title, money(a.price), absoluteUrl(a.url)] });
}

export async function notifyAbandonedCart(c: { contact: string; name: string; items: { name: string; qty: number }[]; total: number; restoreUrl: string; subject: string; message: string; coupon?: string }) {
  const list = c.items.map((i) => `${i.name}${i.qty > 1 ? ` × ${i.qty}` : ""}`).join(", ");
  const message = `${c.name ? `Hi ${c.name.split(" ")[0]}! ` : ""}${c.message} Your cart: ${list} (${money(c.total)}).${c.coupon ? ` Use code ${c.coupon} at checkout.` : ""} No more reminders: ${c.restoreUrl}?stop=1`;
  await reach(c.contact, c.subject, message, { href: c.restoreUrl, label: "Complete my order" }, { env: "WHATSAPP_TEMPLATE_CART", params: [c.name || "there", money(c.total), c.restoreUrl] });
}

/* ───────────────────────────── queueing (outbox) ───────────────────────────── */

export type NotifyKind =
  | "order-placed"
  | "order-status"
  | "confirm-reminder"
  | "unconfirmed-cancelled"
  | "staff"
  | "wholesale"
  | "contact"
  | "order-lookup"
  | "question-answered"
  | "stock-or-price"
  | "abandoned-cart"
  | "store-invite"
  | "shipment";

/** The order a notification is about, read fresh when it is delivered. */
async function loadOrder(payload: Payload, orderId: unknown): Promise<Order | null> {
  const doc = await payload.findByID({ collection: "orders", id: Number(orderId), depth: 0, overrideAccess: true }).catch(() => null);
  if (!doc) return null;
  const { toOrder } = await import("@/lib/cms/sales");
  return toOrder(doc as unknown as Record<string, unknown>);
}

/** Builds the messages of one notification for its store (nothing is sent). */
export async function buildMessages(payload: Payload | null, kind: NotifyKind, storeId: number | null, data: Record<string, unknown>): Promise<Message[]> {
  const list: Message[] = [];
  await withStore(storeId, () =>
    outbox.run(list, async () => {
      switch (kind) {
        case "order-placed":
        case "order-status":
        case "confirm-reminder":
        case "unconfirmed-cancelled": {
          // demo mode (no CMS) passes the order itself
          const order = payload ? await loadOrder(payload, data.orderId) : ((data.order as Order | undefined) ?? null);
          if (!order) return;
          // a status message is only sent while the order still has that status (a quick correction sends nothing stale)
          if (kind === "order-status" && data.status && order.status !== data.status) return;
          if (kind === "order-placed") return notifyNewOrder(order);
          if (kind === "order-status") return notifyOrderStatusChange(order);
          if (kind === "confirm-reminder") return notifyConfirmationReminder(order);
          return notifyUnconfirmedCancelled(order);
        }
        case "staff":
          return notifyStaff(String(data.subject ?? ""), (data.lines as string[]) ?? [], data.link as { href: string; label: string } | undefined);
        case "wholesale":
          return notifyWholesaleInquiry(data.inquiry as WholesaleInquiry);
        case "contact":
          return notifyContactMessage(data.message as Parameters<typeof notifyContactMessage>[0]);
        case "order-lookup":
          return notifyOrderLookup(String(data.phone ?? ""), (data.orders as { orderNumber: string; email?: string | null }[]) ?? []);
        case "question-answered":
          return notifyQuestionAnswered(data as Parameters<typeof notifyQuestionAnswered>[0]);
        case "stock-or-price":
          return notifyStockOrPrice(data as Parameters<typeof notifyStockOrPrice>[0]);
        case "abandoned-cart":
          return notifyAbandonedCart(data as Parameters<typeof notifyAbandonedCart>[0]);
        case "store-invite":
          return notifyStoreInvite(data as Parameters<typeof notifyStoreInvite>[0]);
        case "shipment": {
          const order = payload ? await loadOrder(payload, data.orderId) : null;
          if (order) return notifyShipment(order, data.shipment as Parameters<typeof notifyShipment>[1]);
          return;
        }
      }
    }),
    payload,
  );
  return list;
}

/**
 * Queues a notification for a store. Inside a transaction pass `req` – it is sent only if the change commits.
 * `dedupeKey`: the same notification is never sent twice (e.g. `order-placed:<id>`).
 */
export async function queueNotification(payload: Payload, kind: NotifyKind, storeId: number | null | undefined, data: Record<string, unknown>, opts: { req?: PayloadRequest; dedupeKey?: string } = {}): Promise<void> {
  const { enqueue, kickOutbox } = await import("@/lib/outbox");
  await enqueue(payload, { type: `notify.${kind}`, storeId: storeId ?? null, data, dedupeKey: opts.dedupeKey }, opts.req);
  kickOutbox(payload);
}

/**
 * From the storefront (server actions): queues a notification for the request's store. Demo mode (no CMS, so no outbox)
 * builds and sends it straight away. Never throws – a message must never fail the shopper's action.
 */
export async function notifyFromStorefront(kind: NotifyKind, data: Record<string, unknown>, opts: { storeId?: number | null; dedupeKey?: string } = {}): Promise<void> {
  try {
    if (isCmsConfigured) {
      const { payloadClient } = await import("@/lib/cms/catalog-source");
      const storeId = opts.storeId === undefined ? await currentStoreId() : opts.storeId;
      await queueNotification(await payloadClient(), kind, storeId, data, { dedupeKey: opts.dedupeKey });
      return;
    }
    for (const m of await buildMessages(null, kind, null, data)) await sendMessage(m).catch((e) => log.error("notify.send_failed", e, { channel: m.channel }));
  } catch (e) {
    log.error("notify.queue_failed", e, { kind });
  }
}

/** Sends a notification straight away (scripts / tests – everything else queues). */
export async function notifyNow(payload: Payload, kind: NotifyKind, storeId: number | null, data: Record<string, unknown>) {
  for (const m of await buildMessages(payload, kind, storeId, data)) await sendMessage(m).catch((e) => log.error("notify.send_failed", e, { channel: m.channel }));
}
