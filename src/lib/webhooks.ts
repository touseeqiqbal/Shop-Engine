import { createHmac, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { Payload, PayloadRequest } from "payload";
import { log } from "@/lib/log";

/**
 * Store webhooks (src/payload/collections/webhooks.ts).
 *   emitStoreEvent()  queue the event for every active endpoint of the store that wants it (in the caller's
 *                     transaction when `req` is given – nothing is sent for a change that rolls back)
 *   deliverWebhook()  the outbox worker's POST: signed, 10 s timeout, no redirects, never to a private address
 */

export type StoreEventType = "order.created" | "order.updated" | "order.paid" | "refund.created";

export async function emitStoreEvent(payload: Payload, storeId: number | null | undefined, type: StoreEventType, data: Record<string, unknown>, req?: PayloadRequest): Promise<void> {
  if (storeId == null) return;
  const endpoints = (await payload.find({ collection: "webhook-endpoints", where: { and: [{ store: { equals: storeId } }, { active: { equals: true } }, { events: { contains: type } }] }, limit: 20, depth: 0, overrideAccess: true, ...(req ? { req } : {}) }).catch(() => ({ docs: [] }))).docs as unknown as { id: number }[];
  if (!endpoints.length) return;
  const { enqueue, kickOutbox } = await import("@/lib/outbox");
  const id = `evt_${randomUUID().replace(/-/g, "")}`;
  for (const e of endpoints) await enqueue(payload, { type: "webhook.deliver", storeId, data: { endpointId: e.id, event: { id, type, created: new Date().toISOString(), store: storeId, data } }, dedupeKey: `wh:${e.id}:${id}` }, req);
  kickOutbox(payload);
}

/** Loopback, private, link-local (cloud metadata), carrier-grade NAT, multicast and reserved ranges. */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::" || v.startsWith("fe80:") || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("ff")) return true;
    const mapped = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}

export const signWebhook = (body: string, secret: string, t = Math.floor(Date.now() / 1000)) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;

/** One delivery (the outbox retries it when this throws). */
export async function deliverWebhook(payload: Payload, endpointId: number, event: Record<string, unknown>): Promise<void> {
  const ep = (await payload.findByID({ collection: "webhook-endpoints", id: endpointId, depth: 0, overrideAccess: true, showHiddenFields: true }).catch(() => null)) as unknown as { id: number; url?: string; secret?: string; active?: boolean; store?: unknown; failures?: number } | null;
  if (!ep || !ep.active || !ep.url || !ep.secret) return; // removed or switched off meanwhile: nothing to do
  const url = new URL(ep.url);
  const devLocal = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if (!devLocal) {
    // resolve now and refuse internal targets (a store must not reach ShopEngine's own network)
    const addrs = await lookup(url.hostname, { all: true });
    if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new Error(`Refused: ${url.hostname} points to a private address`);
  }
  const body = JSON.stringify(event);
  let status = "error";
  try {
    const res = await fetch(url, { method: "POST", redirect: "manual", signal: AbortSignal.timeout(10_000), headers: { "content-type": "application/json", "user-agent": "ShopEngine-Webhooks/1", "shopengine-event": String(event.type ?? ""), "shopengine-signature": signWebhook(body, ep.secret) }, body });
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
