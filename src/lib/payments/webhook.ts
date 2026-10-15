import { payloadClient } from "@/lib/cms/catalog-source";
import { isCmsConfigured } from "@/lib/db/config";
import { log } from "@/lib/log";
import { GatewayError, getGateway, type WebhookEvent } from "./gateways";

/**
 * One payment provider's webhook (POST /api/webhooks/payments/<provider>), the same for every provider plugin:
 *  - the provider's signature is checked first (unsigned or forged → refused);
 *  - every event is stored once (payment-events, unique per provider + event id): a replay or a retry of an event
 *    already handled changes nothing; a failed one is retried by the provider (500) and handled again;
 *  - the provider plugin does the work (mark paid, cancel, account updates).
 */

type Doc = Record<string, unknown>;

export async function handleGatewayWebhook(provider: string, req: Request): Promise<Response> {
  if (!isCmsConfigured) return new Response("Not found", { status: 404 });
  const gateway = getGateway(provider);
  if (!gateway) return new Response("Not found", { status: 404 });
  const raw = await req.text();
  let event: WebhookEvent;
  try {
    event = gateway.verifyWebhook(raw, req.headers);
  } catch (e) {
    const status = e instanceof GatewayError ? e.status : 400;
    log.warn("payments.webhook_rejected", { provider, reason: (e as Error)?.message });
    return Response.json({ error: "Invalid signature" }, { status });
  }

  const payload = await payloadClient();
  const existing = (await payload.find({ collection: "payment-events", where: { and: [{ provider: { equals: provider } }, { eventId: { equals: event.id } }] }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined;
  if (existing && (existing.status === "processed" || existing.status === "ignored")) return Response.json({ received: true, duplicate: true });
  let record = existing;
  if (!record) {
    try {
      record = (await payload.create({
        collection: "payment-events",
        data: { provider, eventId: event.id, type: event.type, status: "received", receivedAt: new Date().toISOString() } as never,
        overrideAccess: true,
        context: { system: true },
      })) as unknown as Doc;
    } catch {
      // the same event arrived twice at once – the other delivery handles it
      return Response.json({ received: true, duplicate: true });
    }
  }

  try {
    const r = await gateway.handleWebhook(payload, event);
    await payload.update({ collection: "payment-events", id: Number(record.id), data: { status: r.status, processedAt: new Date().toISOString(), store: r.store ?? null, summary: r.summary, error: null } as never, overrideAccess: true, context: { system: true } });
    return Response.json({ received: true });
  } catch (e) {
    log.error("payments.webhook_failed", e, { provider, event: event.id, type: event.type });
    await payload.update({ collection: "payment-events", id: Number(record.id), data: { status: "failed", error: String((e as Error)?.message ?? e).slice(0, 500) } as never, overrideAccess: true, context: { system: true } }).catch(() => undefined);
    // 500 → the provider sends it again later
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}
