import { httpOk } from "../http";
import { isPurchaseEvent, loadOrder, normEmail, normPhone, purchaseEventId, sha256 } from "../order-data";
import type { Ctx, ProviderImpl, StoreEvent } from "../types";

/**
 * TikTok: the pixel runs on the storefront (components/analytics.tsx); with an Events API token each purchase is also
 * sent from the server with the same event id as the browser ("purchase-<order number>") so it is counted once.
 */

const EVENTS_URL = "https://business-api.tiktok.com/open_api/v1.3/event/track/";
export const TIKTOK_PURCHASE = "Purchase"; // renamed from CompletePayment in 2025 (the old name is still accepted)

async function onEvent(ctx: Ctx, event: StoreEvent) {
  if (!ctx.connection.secrets.accessToken || !isPurchaseEvent(event.type, event.data)) return;
  const order = await loadOrder(ctx.payload, Number(event.data.id));
  if (!order) return;
  const em = normEmail(order.customer.email);
  const ph = normPhone(order.customer.phone, order.customer.country);
  const body: Record<string, unknown> = {
    event_source: "web",
    event_source_id: ctx.connection.config.pixelId,
    data: [
      {
        event: TIKTOK_PURCHASE,
        event_time: Math.floor(Date.parse(order.placedAt) / 1000) || Math.floor(Date.now() / 1000),
        event_id: purchaseEventId(order.orderNumber),
        user: { ...(em ? { email: sha256(em) } : {}), ...(ph ? { phone: sha256(`+${ph}`) } : {}), external_id: sha256(`${order.storeId}:${ph || em || order.orderNumber}`) },
        properties: {
          currency: order.currency,
          value: order.total,
          order_id: order.orderNumber,
          content_type: "product",
          contents: order.items.map((i) => ({ content_id: i.sku || i.productId || i.title, content_name: i.title, quantity: i.qty, price: i.unitPrice })),
        },
      },
    ],
  };
  if (ctx.connection.config.testEventCode) body.test_event_code = ctx.connection.config.testEventCode;
  const r = await httpOk<{ code?: number; message?: string }>(EVENTS_URL, { provider: "TikTok", method: "POST", headers: { "Access-Token": ctx.connection.secrets.accessToken }, body });
  if (r.code !== 0) throw new Error(`TikTok: ${r.message ?? "event not accepted"}`);
}

const impl: ProviderImpl = {
  async test(ctx) {
    const id = String(ctx.connection.config.pixelId ?? "");
    if (!/^[A-Z0-9]{10,30}$/i.test(id)) return { ok: false, message: "That doesn’t look like a TikTok pixel id (letters and numbers, e.g. C1ABCDEFGHIJKLMNOPQR)." };
    return { ok: true, message: ctx.connection.secrets.accessToken ? "Saved. The pixel loads on your store and purchases are also sent from the server." : "Saved. The pixel loads on your store." };
  },
  onEvent,
};

export default impl;
