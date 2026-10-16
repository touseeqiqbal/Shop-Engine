import { http, httpOk } from "../http";
import { isPurchaseEvent, loadOrder, normEmail, normPhone, purchaseEventId, sha256 } from "../order-data";
import type { Ctx, ProviderImpl, StoreEvent } from "../types";

/**
 * Meta Conversions API: each purchase is sent from the server to the store's dataset (pixel), with the same event id
 * as the storefront's browser pixel ("purchase-<order number>") so Meta counts it once. Personal data is sent only
 * hashed (SHA-256 of the normalised email / phone / city / country), as Meta requires.
 */

export const META_GRAPH_VERSION = "v23.0";
const graph = (path: string) => `https://graph.facebook.com/${META_GRAPH_VERSION}/${path}`;

async function send(ctx: Ctx, events: Record<string, unknown>[]) {
  const { pixelId, testEventCode } = ctx.connection.config;
  const body: Record<string, unknown> = { data: events, access_token: ctx.connection.secrets.accessToken };
  if (testEventCode) body.test_event_code = testEventCode;
  return httpOk<{ events_received?: number; fbtrace_id?: string }>(graph(`${encodeURIComponent(String(pixelId))}/events`), { provider: "Meta", method: "POST", body });
}

async function onEvent(ctx: Ctx, event: StoreEvent) {
  if (!isPurchaseEvent(event.type, event.data)) return;
  const order = await loadOrder(ctx.payload, Number(event.data.id));
  if (!order) return;
  const user: Record<string, string[]> = {};
  const em = normEmail(order.customer.email);
  const ph = normPhone(order.customer.phone, order.customer.country);
  if (em) user.em = [sha256(em)];
  if (ph) user.ph = [sha256(ph)];
  if (order.customer.city) user.ct = [sha256(order.customer.city.toLowerCase().replace(/[^a-z]/g, ""))];
  user.country = [sha256(order.customer.country.toLowerCase())];
  user.external_id = [sha256(`${order.storeId}:${ph || em || order.orderNumber}`)];
  await send(ctx, [
    {
      event_name: "Purchase",
      event_time: Math.floor(Date.parse(order.placedAt) / 1000) || Math.floor(Date.now() / 1000),
      event_id: purchaseEventId(order.orderNumber),
      action_source: "website",
      user_data: user,
      custom_data: {
        currency: order.currency,
        value: order.total,
        order_id: order.orderNumber,
        content_type: "product",
        content_ids: order.items.map((i) => i.sku || i.productId).filter(Boolean),
        contents: order.items.map((i) => ({ id: i.sku || i.productId || i.title, quantity: i.qty, item_price: i.unitPrice })),
        num_items: order.items.reduce((n, i) => n + i.qty, 0),
      },
    },
  ]);
}

const impl: ProviderImpl = {
  async test(ctx) {
    // a pixel read with the token proves both are right (no event is sent)
    const r = await http<{ id?: string; name?: string; error?: { message?: string } }>(graph(`${encodeURIComponent(String(ctx.connection.config.pixelId))}?fields=id,name&access_token=${encodeURIComponent(ctx.connection.secrets.accessToken ?? "")}`), { provider: "Meta" });
    if (!r.ok || !r.data.id) return { ok: false, message: `Meta: ${r.data.error?.message ?? "the pixel id or access token isn’t right"}` };
    return { ok: true, message: `Connected to “${r.data.name ?? r.data.id}”. Purchases will be sent from the server.`, state: { account: r.data.name ?? r.data.id } };
  },
  onEvent,
};

export default impl;
