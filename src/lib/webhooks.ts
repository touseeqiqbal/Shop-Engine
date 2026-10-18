import { createHmac, randomUUID } from "node:crypto";
import type { Payload, PayloadRequest } from "payload";
import { log } from "@/lib/log";
import { isPrivateAddress, publicRequest } from "@/lib/net/public-request";

export { isPrivateAddress };

/**
 * Store webhooks (src/payload/collections/webhooks.ts).
 *   emitStoreEvent()  queue the event for every active endpoint of the store that wants it (in the caller's
 *                     transaction when `req` is given – nothing is sent for a change that rolls back)
 *   deliverWebhook()  the outbox worker's POST: signed, 10 s timeout, no redirects, never to a private address
 */

export type StoreEventType = "order.created" | "order.updated" | "order.paid" | "refund.created" | "checkout.started";

/**
 * Queues a store event for the store's webhook endpoints that want it, and for its connected integrations that use it
 * (email marketing, ad conversions, accounting … – lib/integrations/catalog `events`).
 */
export async function emitStoreEvent(payload: Payload, storeId: number | null | undefined, type: StoreEventType, data: Record<string, unknown>, req?: PayloadRequest): Promise<void> {
  if (storeId == null) return;
  const endpoints = type === "checkout.started" ? [] : ((await payload.find({ collection: "webhook-endpoints", where: { and: [{ store: { equals: storeId } }, { active: { equals: true } }, { events: { contains: type } }] }, limit: 20, depth: 0, overrideAccess: true, ...(req ? { req } : {}) }).catch(() => ({ docs: [] }))).docs as unknown as { id: number }[]);
  const { connectionsOf } = await import("@/lib/integrations/server");
  const { integrationInfo } = await import("@/lib/integrations/catalog");
  // in the caller's transaction when there is one (a second pool connection while it is held can exhaust the pool)
  const listeners = (await connectionsOf(payload, storeId, req ? { req } : {}).catch(() => [])).filter((c) => c.status === "connected" && integrationInfo(c.provider)?.events?.includes(type));
  if (!endpoints.length && !listeners.length) return;
  const { enqueue, kickOutbox } = await import("@/lib/outbox");
  const id = `evt_${randomUUID().replace(/-/g, "")}`;
  const created = new Date().toISOString();
  for (const e of endpoints) await enqueue(payload, { type: "webhook.deliver", storeId, data: { endpointId: e.id, event: { id, type, created, store: storeId, data } }, dedupeKey: `wh:${e.id}:${id}` }, req);
  for (const c of listeners) await enqueue(payload, { type: "integration.event", storeId, data: { connectionId: c.id, provider: c.provider, event: { id, type, at: created, data } }, dedupeKey: `ie:${c.id}:${id}` }, req);
  kickOutbox(payload);
}

export const signWebhook = (body: string, secret: string, t = Math.floor(Date.now() / 1000)) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;

/** One delivery (the outbox retries it when this throws). */
export async function deliverWebhook(payload: Payload, endpointId: number, event: Record<string, unknown>): Promise<void> {
  const ep = (await payload.findByID({ collection: "webhook-endpoints", id: endpointId, depth: 0, overrideAccess: true, showHiddenFields: true }).catch(() => null)) as unknown as { id: number; url?: string; secret?: string; active?: boolean; store?: unknown; failures?: number } | null;
  if (!ep || !ep.active || !ep.url || !ep.secret) return; // removed or switched off meanwhile: nothing to do
  const url = new URL(ep.url);
  const body = JSON.stringify(event);
  let status = "error";
  try {
    // never to an internal address – checked on the address actually connected to (lib/net/public-request); no redirects
    const res = await publicRequest(url, { method: "POST", timeoutMs: 10_000, maxBytes: 64_000, headers: { "content-type": "application/json", "user-agent": "ShopEngine-Webhooks/1", "shopengine-event": String(event.type ?? ""), "shopengine-signature": signWebhook(body, ep.secret) }, body });
    status = String(res.status);
    if (!res.ok) throw new Error(`Endpoint answered ${res.status}`);
    await payload.update({ collection: "webhook-endpoints", id: ep.id, data: { lastStatus: status, lastDeliveryAt: new Date().toISOString(), failures: 0 } as never, overrideAccess: true, context: { system: true } });
  } catch (e) {
    await payload
      .update({ collection: "webhook-endpoints", id: ep.id, data: { lastStatus: status, lastDeliveryAt: new Date().toISOString(), failures: (Number(ep.failures) || 0) + 1 } as never, overrideAccess: true, context: { system: true } })
      .catch((err) => log.error("webhooks.status_save_failed", err));
    throw e;
  }
}
