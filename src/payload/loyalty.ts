import type { Payload, PayloadRequest } from "payload";
import { sql } from "@payloadcms/db-postgres";
import { conn } from "./stock";

/**
 * Loyalty points (Marketing → Loyalty points): signed-in customers earn points on what they spent once an order is
 * DELIVERED (a returned / refused order takes them back) and turn them into a voucher – a gift card in their name –
 * on their account page, which pays at checkout like any gift card. Balances change only here, each in ONE statement,
 * inside the caller's transaction when it passes `req`.
 */

export type LoyaltySettings = {
  enabled: boolean;
  /** points per 100 of the store's currency spent (items after discount, without delivery) */
  pointsPer100: number;
  /** what one point is worth when turned into a voucher */
  pointValue: number;
  /** the fewest points that can be turned into a voucher */
  minRedeem: number;
};
export const LOYALTY_DEFAULTS: LoyaltySettings = { enabled: false, pointsPer100: 1, pointValue: 1, minRedeem: 100 };

/** The store's loyalty settings (Settings → Installments & reminders → Loyalty points). */
export async function loyaltySettings(payload: Payload, storeId: number | null, req?: PayloadRequest): Promise<LoyaltySettings> {
  const { getStoreSettings } = await import("./store-settings");
  const doc = await getStoreSettings<{ loyalty?: Partial<LoyaltySettings> | null }>(payload, "conversion", storeId, req ? { req } : {}).catch(() => ({ loyalty: null }));
  const l = doc?.loyalty ?? {};
  const n = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : d);
  return {
    enabled: l.enabled === true,
    pointsPer100: n(l.pointsPer100, LOYALTY_DEFAULTS.pointsPer100),
    pointValue: n(l.pointValue, LOYALTY_DEFAULTS.pointValue),
    minRedeem: Math.max(1, Math.floor(n(l.minRedeem, LOYALTY_DEFAULTS.minRedeem))),
  };
}

/** Points an order earns: what was paid for the goods (not delivery, not the part a voucher paid) – whole points. */
export function pointsFor(o: { subtotal?: number; discount?: number; giftCardAmount?: number | null }, s: LoyaltySettings): number {
  if (!s.enabled || !(s.pointsPer100 > 0)) return 0;
  const goods = Math.max(0, (o.subtotal ?? 0) - (o.discount ?? 0) - (Number(o.giftCardAmount) || 0));
  return Math.floor((goods / 100) * s.pointsPer100);
}

/** A voucher's value for `points` (to the cent; whole amounts stay whole). */
export function voucherValue(points: number, s: LoyaltySettings): number {
  const v = points * s.pointValue;
  return Number.isInteger(s.pointValue) ? Math.round(v) : Math.round(v * 100) / 100;
}

type Entry = { at: string; points: number; note: string; order?: string };

/** Adds points (an order delivered, a correction by the team) – the account is made on first use. */
export async function addPoints(payload: Payload, input: { storeId: number | null; userId: number; points: number; note: string; order?: string }, req?: PayloadRequest): Promise<number> {
  const entry = JSON.stringify([{ at: new Date().toISOString(), points: input.points, note: input.note, ...(input.order ? { order: input.order } : {}) } satisfies Entry]);
  const earned = Math.max(0, input.points);
  const { rows } = await (await conn(payload, req)).execute(sql`
    INSERT INTO "payload"."cms_loyalty_accounts" ("store_id", "customer_id", "balance", "earned", "ledger", "updated_at", "created_at")
    VALUES (${input.storeId}, ${input.userId}, GREATEST(0, ${input.points}), ${earned}, ${entry}::jsonb, now(), now())
    ON CONFLICT ("store_id", "customer_id") DO UPDATE
      SET "balance" = GREATEST(0, "payload"."cms_loyalty_accounts"."balance" + ${input.points}),
          "earned" = COALESCE("payload"."cms_loyalty_accounts"."earned", 0) + ${earned},
          "ledger" = COALESCE("payload"."cms_loyalty_accounts"."ledger", '[]'::jsonb) || ${entry}::jsonb,
          "updated_at" = now()
    RETURNING "balance"`);
  return Number(rows[0]?.balance ?? 0);
}

/** Takes `points` if the customer still has that many (turned into a voucher). False when they haven't. */
export async function takePoints(payload: Payload, input: { storeId: number | null; userId: number; points: number; note: string }, req?: PayloadRequest): Promise<boolean> {
  if (!(input.points > 0)) return false;
  const entry = JSON.stringify([{ at: new Date().toISOString(), points: -input.points, note: input.note } satisfies Entry]);
  const { rows } = await (await conn(payload, req)).execute(sql`
    UPDATE "payload"."cms_loyalty_accounts"
    SET "balance" = "balance" - ${input.points}, "ledger" = COALESCE("ledger", '[]'::jsonb) || ${entry}::jsonb, "updated_at" = now()
    WHERE "store_id" IS NOT DISTINCT FROM ${input.storeId} AND "customer_id" = ${input.userId} AND "balance" >= ${input.points}
    RETURNING "balance"`);
  return rows.length > 0;
}

/**
 * Takes back the points of a delivered order that came back. All of them – also when they were already turned into a
 * voucher: the balance then goes below 0 (points owed), so no new voucher until later orders have earned it back (it
 * used to stop at 0, and the returned order's points were kept as a voucher). Returns how many were taken.
 */
export async function takeBackPoints(payload: Payload, input: { storeId: number | null; userId: number; points: number; note: string; order?: string }, req?: PayloadRequest): Promise<number> {
  if (!(input.points > 0)) return 0;
  const entry = JSON.stringify([{ at: new Date().toISOString(), points: -input.points, note: input.note, ...(input.order ? { order: input.order } : {}) } satisfies Entry]);
  const { rows } = await (await conn(payload, req)).execute(sql`
    UPDATE "payload"."cms_loyalty_accounts"
    SET "balance" = "balance" - ${input.points}, "ledger" = COALESCE("ledger", '[]'::jsonb) || ${entry}::jsonb, "updated_at" = now()
    WHERE "store_id" IS NOT DISTINCT FROM ${input.storeId} AND "customer_id" = ${input.userId}
    RETURNING "balance"`);
  return rows.length ? input.points : 0;
}

/** A customer's balance in a store (0 without an account). */
export async function pointsBalance(payload: Payload, storeId: number | null, userId: number): Promise<number> {
  const { rows } = await (await conn(payload)).execute(sql`
    SELECT "balance" FROM "payload"."cms_loyalty_accounts" WHERE "store_id" IS NOT DISTINCT FROM ${storeId} AND "customer_id" = ${userId}`);
  return Number(rows[0]?.balance ?? 0);
}
