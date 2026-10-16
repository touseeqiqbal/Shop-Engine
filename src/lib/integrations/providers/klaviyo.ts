import { http, httpOk } from "../http";
import { isPurchaseEvent, loadOrder, normEmail, normPhone } from "../order-data";
import type { Ctx, ProviderImpl, StoreEvent } from "../types";

/**
 * Klaviyo: "Placed Order" for every purchase and "Started Checkout" for carts left at checkout (the trigger for
 * abandoned-cart flows); customers who agreed to marketing emails are subscribed to the store's list.
 */

export const KLAVIYO_REVISION = "2026-10-15";
const API = "https://a.klaviyo.com/api";
const headers = (ctx: Ctx) => ({ authorization: `Klaviyo-API-Key ${ctx.connection.secrets.privateKey ?? ""}`, revision: KLAVIYO_REVISION, accept: "application/vnd.api+json", "content-type": "application/vnd.api+json" });

async function track(ctx: Ctx, metric: string, profile: Record<string, unknown>, properties: Record<string, unknown>, value: number | null, uniqueId: string, time: string) {
  await httpOk(`${API}/events`, {
    provider: "Klaviyo",
    method: "POST",
    headers: headers(ctx),
    body: {
      data: {
        type: "event",
        attributes: {
          properties,
          time,
          ...(value != null ? { value } : {}),
          unique_id: uniqueId,
          metric: { data: { type: "metric", attributes: { name: metric } } },
          profile: { data: { type: "profile", attributes: profile } },
        },
      },
    },
  });
}

async function subscribe(ctx: Ctx, email: string) {
  await httpOk(`${API}/profile-subscription-bulk-create-jobs`, {
    provider: "Klaviyo",
    method: "POST",
    headers: headers(ctx),
    body: {
      data: {
        type: "profile-subscription-bulk-create-job",
        attributes: { profiles: { data: [{ type: "profile", attributes: { email, subscriptions: { email: { marketing: { consent: "SUBSCRIBED" } } } } }] } },
        relationships: { list: { data: { type: "list", id: String(ctx.connection.config.listId) } } },
      },
    },
  });
}

async function onEvent(ctx: Ctx, event: StoreEvent) {
  if (event.type === "checkout.started") {
    const d = event.data as { email?: string; name?: string; items?: { title?: string; qty?: number; price?: number }[]; total?: number; currency?: string; restoreUrl?: string; cartId?: string | number };
    const email = normEmail(d.email);
    if (!email) return;
    await track(ctx, "Started Checkout", { email, ...(d.name ? { first_name: d.name.split(" ")[0] } : {}) }, { $value: d.total, Items: (d.items ?? []).map((i) => i.title), ItemCount: (d.items ?? []).reduce((n, i) => n + (i.qty ?? 0), 0), CheckoutURL: d.restoreUrl, Currency: d.currency, Products: d.items }, Number(d.total) || null, `checkout-${d.cartId ?? event.id}`, event.at);
    return;
  }
  if (!isPurchaseEvent(event.type, event.data)) return;
  const order = await loadOrder(ctx.payload, Number(event.data.id));
  const email = normEmail(order?.customer.email);
  if (!order || !email) return;
  const ph = normPhone(order.customer.phone, order.customer.country);
  const [first, ...rest] = order.customer.name.trim().split(/\s+/);
  await track(
    ctx,
    "Placed Order",
    { email, ...(ph ? { phone_number: `+${ph}` } : {}), first_name: first ?? "", last_name: rest.join(" "), location: { city: order.customer.city, country: order.customer.country } },
    { OrderId: order.orderNumber, Currency: order.currency, ItemNames: order.items.map((i) => i.title), Items: order.items.map((i) => ({ ProductID: i.productId, SKU: i.sku, ProductName: i.title, Quantity: i.qty, ItemPrice: i.unitPrice, RowTotal: i.qty * i.unitPrice })), DiscountValue: order.discount, Shipping: order.deliveryCharge },
    order.total,
    `order-${order.orderNumber}`,
    order.placedAt || event.at,
  );
  if (order.marketingConsent) await subscribe(ctx, email);
}

const impl: ProviderImpl = {
  async test(ctx) {
    const r = await http<{ data?: { attributes?: { name?: string } }; errors?: { detail?: string }[] }>(`${API}/lists/${encodeURIComponent(String(ctx.connection.config.listId))}`, { provider: "Klaviyo", headers: headers(ctx) });
    if (!r.ok) return { ok: false, message: `Klaviyo: ${r.data.errors?.[0]?.detail ?? "the private key or list id isn’t right"}` };
    const name = r.data.data?.attributes?.name ?? String(ctx.connection.config.listId);
    return { ok: true, message: `Connected to the list “${name}”. Orders and started checkouts will be sent.`, state: { account: name } };
  },
  onEvent,
};

export default impl;
