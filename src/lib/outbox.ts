import { sql } from "@payloadcms/db-postgres";
import type { Payload, PayloadRequest } from "payload";
import { log } from "@/lib/log";

/**
 * Transactional outbox (see src/payload/collections/outbox.ts).
 *
 *   enqueue()        write an event in the SAME transaction as the change that causes it (pass `req`)
 *   processOutbox()  deliver due events: claim a batch (FOR UPDATE SKIP LOCKED – several instances never take the same
 *                    one), run its handler, mark it Sent; on failure retry later with growing waits (1, 2, 4 … min,
 *                    at most 6 h) and give up after MAX_ATTEMPTS (Dead – visible in /cms → Platform → Background deliveries).
 *
 * Handlers are registered by type (registerOutboxHandler); notification events fan out into one "message" event per
 * channel and recipient, so a retry never re-sends what already went out.
 */

export const MAX_ATTEMPTS = 8;
const STUCK_AFTER_MS = 10 * 60_000;

export type OutboxEvent = { id: number; type: string; store: number | null; data: Record<string, unknown>; attempts: number };
type Handler = (payload: Payload, event: OutboxEvent) => Promise<void>;
const handlers = new Map<string, Handler>();

/** `type` may end in ".*" to handle a family of events (e.g. "notify.*"). */
export function registerOutboxHandler(type: string, handler: Handler) {
  handlers.set(type, handler);
}
const handlerFor = (type: string) => handlers.get(type) ?? handlers.get(`${type.split(".")[0]}.*`);

/** Wait before the next try after `attempts` failures: 1, 2, 4, 8 … minutes, capped at 6 hours. */
export const backoffMs = (attempts: number) => Math.min(6 * 3600_000, 60_000 * 2 ** Math.max(0, attempts - 1));

/**
 * Adds an event. Inside a hook / transaction pass `req` so it commits (or rolls back) with the change.
 * The same dedupeKey is only ever delivered once – enqueueing it again is a no-op.
 */
export async function enqueue(payload: Payload, event: { type: string; storeId?: number | null; data?: Record<string, unknown>; dedupeKey?: string; delayMs?: number }, req?: PayloadRequest): Promise<void> {
  const { conn } = await import("@/payload/stock");
  const db = await conn(payload, req);
  await db.execute(sql`
    INSERT INTO "payload"."cms_outbox_events" ("store_id", "type", "status", "attempts", "data", "dedupe_key", "next_attempt_at", "created_at", "updated_at")
    VALUES (${event.storeId ?? null}, ${event.type}, 'pending', 0, ${JSON.stringify(event.data ?? {})}::jsonb, ${event.dedupeKey ?? null}, now() + make_interval(secs => ${Math.max(0, (event.delayMs ?? 0) / 1000)}), now(), now())
    ON CONFLICT ("dedupe_key") DO NOTHING`);
}

/** Delivers due events (call from housekeeping and right after a request that enqueued some). Returns counts. */
export async function processOutbox(payload: Payload, limit = 25, depth = 0): Promise<{ sent: number; failed: number; dead: number }> {
  await import("./outbox-handlers"); // registers the handlers
  const db = (payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<{ rows: Record<string, unknown>[] }> } }).drizzle;
  // claim a batch (and anything stuck in "processing" after a crash)
  const { rows } = await db.execute(sql`
    UPDATE "payload"."cms_outbox_events" SET "status" = 'processing', "locked_at" = now(), "attempts" = "attempts" + 1, "updated_at" = now()
    WHERE "id" IN (
      SELECT "id" FROM "payload"."cms_outbox_events"
      WHERE ("status" = 'pending' AND ("next_attempt_at" IS NULL OR "next_attempt_at" <= now()))
         OR ("status" = 'processing' AND "locked_at" < now() - make_interval(secs => ${STUCK_AFTER_MS / 1000}))
      ORDER BY "id" LIMIT ${limit} FOR UPDATE SKIP LOCKED
    )
    RETURNING "id", "type", "store_id", "data", "attempts"`);
  const result = { sent: 0, failed: 0, dead: 0 };
  let fannedOut = false;
  for (const r of rows) {
    const event: OutboxEvent = { id: Number(r.id), type: String(r.type), store: r.store_id == null ? null : Number(r.store_id), data: (r.data ?? {}) as Record<string, unknown>, attempts: Number(r.attempts) };
    const handler = handlerFor(event.type);
    try {
      if (!handler) throw new Error(`No handler for "${event.type}"`);
      await handler(payload, event);
      await db.execute(sql`UPDATE "payload"."cms_outbox_events" SET "status" = 'sent', "sent_at" = now(), "last_error" = NULL, "updated_at" = now() WHERE "id" = ${event.id}`);
      result.sent++;
      if (event.type.startsWith("notify.")) fannedOut = true;
    } catch (e) {
      const dead = event.attempts >= MAX_ATTEMPTS;
      const message = (e instanceof Error ? e.message : String(e)).slice(0, 1000);
      await db.execute(sql`
        UPDATE "payload"."cms_outbox_events" SET "status" = ${dead ? "dead" : "pending"}::"payload"."enum_cms_outbox_events_status",
          "next_attempt_at" = now() + make_interval(secs => ${backoffMs(event.attempts) / 1000}), "last_error" = ${message}, "updated_at" = now()
        WHERE "id" = ${event.id}`);
      if (dead) {
        result.dead++;
        log.error("outbox.dead", e, { event: event.id, type: event.type, attempts: event.attempts });
      } else {
        result.failed++;
        log.warn("outbox.retry", { event: event.id, type: event.type, attempts: event.attempts, error: message });
      }
    }
  }
  // a notification just became messages: send those too, now (once)
  if (fannedOut && depth === 0) {
    const more = await processOutbox(payload, limit, 1);
    result.sent += more.sent;
    result.failed += more.failed;
    result.dead += more.dead;
  }
  return result;
}

/** Deliver soon after the current response (best effort – housekeeping retries whatever is left). */
export function kickOutbox(payload: Payload) {
  const run = () => processOutbox(payload).catch((e) => log.error("outbox.kick_failed", e));
  import("next/server")
    .then(({ after }) => after(run))
    .catch(() => void run());
}
