import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { Where } from "payload";
import { sql } from "@payloadcms/db-postgres";
import { inStore, payloadClient } from "@/lib/cms/catalog-source";
import { currentStoreId } from "@/lib/tenant";
import { toOrder } from "@/lib/cms/sales";
import type { Order } from "@/lib/types";
import { log } from "@/lib/log";

/** Customer confirmation of cash-on-delivery orders (link from WhatsApp / SMS / email, or the 6-digit code). */

type Doc = Record<string, unknown>;

export async function findOrderByConfirmToken(token: string): Promise<(Order & { payloadId: number }) | null> {
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) return null;
  const payload = await payloadClient();
  const res = await payload.find({ collection: "orders", where: { "confirmation.token": { equals: token } }, limit: 1, depth: 0, overrideAccess: true });
  const d = res.docs[0] as unknown as Doc | undefined;
  return d ? { ...toOrder(d), payloadId: Number(d.id) } : null;
}

const sameCode = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export type ConfirmResult = { ok: true; order: Order } | { ok: false; reason: "not-found" | "wrong-code" | "expired" | "not-waiting" | "too-many" };

const MAX_CODE_TRIES = 5;
/** Two changes at the same moment (customer confirms while auto-cancel runs): the second one is refused. */
const changedMeanwhile = (e: unknown) => /changed meanwhile/i.test(String((e as Error)?.message ?? e));

/** Confirm by link (token) or by order number + code. Moves the order to "To ship" (confirmed). */
export async function confirmOrder(args: { token: string } | { orderNumber: string; code: string }, via: string): Promise<ConfirmResult> {
  const payload = await payloadClient();
  // by code: only an order of the store the customer is on
  const where: Where = "token" in args ? { "confirmation.token": { equals: args.token } } : { and: [{ orderNumber: { equals: args.orderNumber } }, inStore(await currentStoreId())] };
  const d = (await payload.find({ collection: "orders", where, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined;
  if (!d) return { ok: false, reason: "not-found" };
  const c = (d.confirmation ?? {}) as Doc;
  if ("code" in args) {
    const tries = Number(c.failedAttempts) || 0;
    if (tries >= MAX_CODE_TRIES) return { ok: false, reason: "too-many" };
    if (!sameCode(String(c.code ?? ""), args.code.trim())) {
      // counted in ONE statement – guesses sent at the same moment can't share a count
      const db = (payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<{ rows: Record<string, unknown>[] }> } }).drizzle;
      const r = await db
        .execute(sql`UPDATE "payload"."cms_orders" SET "confirmation_failed_attempts" = COALESCE("confirmation_failed_attempts", 0) + 1 WHERE "id" = ${Number(d.id)} RETURNING "confirmation_failed_attempts" AS n`)
        .catch((e) => {
          log.error("order.confirm_attempt_save_failed", e);
          return { rows: [{ n: tries + 1 }] };
        });
      const now = Number(r.rows[0]?.n ?? tries + 1);
      return { ok: false, reason: now >= MAX_CODE_TRIES ? "too-many" : "wrong-code" };
    }
  }
  if (d.status !== "awaiting-confirmation") return d.status === "confirmed" || c.confirmedAt ? { ok: true, order: toOrder(d) } : { ok: false, reason: "not-waiting" };
  if (c.expiresAt && Date.parse(String(c.expiresAt)) < Date.now()) return { ok: false, reason: "expired" };
  const now = new Date().toISOString();
  let updated: Doc;
  try {
    updated = (await payload.update({
      collection: "orders",
      id: Number(d.id),
      overrideAccess: true,
      depth: 0,
      context: { expectStatus: "awaiting-confirmation" },
      data: {
        status: "confirmed",
        confirmation: { ...c, confirmedAt: now, via },
        history: [{ status: "confirmed", at: now, note: `Confirmed by customer (${via})` }],
      } as never,
    })) as unknown as Doc;
  } catch (e) {
    if (changedMeanwhile(e)) return { ok: false, reason: "not-waiting" };
    throw e;
  }
  log.info("order.confirmed", { order: d.orderNumber, via });
  return { ok: true, order: toOrder(updated) };
}

/** The customer says "I didn't order this" / "cancel" from the link. Stock goes back automatically. */
export async function cancelByCustomer(token: string): Promise<boolean> {
  const payload = await payloadClient();
  const d = (await payload.find({ collection: "orders", where: { "confirmation.token": { equals: token } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined;
  if (!d || d.status !== "awaiting-confirmation") return false;
  const now = new Date().toISOString();
  try {
    await payload.update({
      collection: "orders",
      id: Number(d.id),
      overrideAccess: true,
      depth: 0,
      context: { skipNotify: true, expectStatus: "awaiting-confirmation" },
      data: { status: "cancelled", history: [{ status: "cancelled", at: now, note: "Cancelled by customer from the confirmation link" }] } as never,
    });
  } catch (e) {
    if (changedMeanwhile(e)) return false;
    throw e;
  }
  log.info("order.cancelled_by_customer", { order: d.orderNumber });
  return true;
}

/** Housekeeping: cancel orders whose confirmation time ran out (the customer is told). Returns the cancelled orders. */
export async function cancelExpiredUnconfirmed(): Promise<Order[]> {
  const payload = await payloadClient();
  const res = await payload.find({
    collection: "orders",
    // an advance screenshot waiting for staff to check it is not cancelled – staff decide
    where: { and: [{ status: { equals: "awaiting-confirmation" } }, { "confirmation.expiresAt": { less_than: new Date().toISOString() } }, { paymentStatus: { not_equals: "awaiting-verification" } }] },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  });
  const out: Order[] = [];
  for (const d of res.docs as unknown as Doc[]) {
    try {
      const now = new Date().toISOString();
      const u = (await payload.update({
        collection: "orders",
        id: Number(d.id),
        overrideAccess: true,
        depth: 0,
        context: { skipNotify: true, expectStatus: "awaiting-confirmation" },
        data: { status: "cancelled", history: [{ status: "cancelled", at: now, note: "Not confirmed in time – cancelled automatically" }] } as never,
      })) as unknown as Doc;
      out.push(toOrder(u));
      const { queueNotification } = await import("@/lib/notify");
      await queueNotification(payload, "unconfirmed-cancelled", u.store && typeof u.store === "object" ? Number((u.store as Doc).id) : u.store == null ? null : Number(u.store), { orderId: Number(d.id) }, { dedupeKey: `unconfirmed-cancelled:${String(d.id)}` });
      log.info("order.auto_cancelled", { order: d.orderNumber });
    } catch (e) {
      if (changedMeanwhile(e)) continue; // the customer confirmed (or staff acted) at that very moment
      log.error("confirm.auto_cancel_failed", e, { order: String(d.orderNumber) });
    }
  }
  return out;
}
