import { enqueue, registerOutboxHandler } from "./outbox";
import type { Message, NotifyKind } from "./notify";

/**
 * What the outbox worker does with each event type:
 *  - notify.<kind>  build the store's messages (email / WhatsApp / SMS) and queue one "message.send" per recipient
 *  - message.send   send one message (retried on its own, so nothing that already went out is sent twice)
 *  - webhook.deliver  POST one event to one of the store's webhook endpoints (signed; retried)
 */
registerOutboxHandler("notify.*", async (payload, event) => {
  const { buildMessages } = await import("./notify");
  const kind = event.type.slice("notify.".length) as NotifyKind;
  const messages = await buildMessages(payload, kind, event.store, event.data);
  let i = 0;
  for (const m of messages) await enqueue(payload, { type: "message.send", storeId: event.store, data: m as unknown as Record<string, unknown>, dedupeKey: `msg:${event.id}:${i++}` });
});

registerOutboxHandler("webhook.deliver", async (payload, event) => {
  const { deliverWebhook } = await import("./webhooks");
  await deliverWebhook(payload, Number(event.data.endpointId), event.data.event as Record<string, unknown>);
});

registerOutboxHandler("message.send", async (_payload, event) => {
  const { sendMessage } = await import("./notify");
  await sendMessage(event.data as unknown as Message);
});
