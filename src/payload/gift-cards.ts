import type { Payload, PayloadRequest } from "payload";
import { sql } from "@payloadcms/db-postgres";
import { conn } from "./stock";
import { normalizeGiftCardCode } from "./collections/gift-cards";

/**
 * Gift card balances – changed only here, each in ONE statement (two checkouts can never spend the same money twice),
 * inside the caller's transaction when it passes `req` (checkout: together with the order).
 */

export type GiftCardInfo = { id: number; code: string; balance: number; status: string; expiresAt: string | null };

/** A store's card by its code (any spelling), or null. */
export async function findGiftCard(payload: Payload, code: string, storeId: number | null, req?: PayloadRequest): Promise<GiftCardInfo | null> {
  const c = normalizeGiftCardCode(code);
  if (!c) return null;
  const { rows } = await (await conn(payload, req)).execute(sql`
    SELECT "id", "code", COALESCE("balance", 0)::float AS balance, "status"::text AS status, "expires_at" FROM "payload"."cms_gift_cards"
    WHERE upper("code") = ${c} AND "store_id" IS NOT DISTINCT FROM ${storeId} LIMIT 1`);
  const r = rows[0] as { id: number; code: string; balance: number; status: string; expires_at: string | null } | undefined;
  return r ? { id: Number(r.id), code: r.code, balance: Number(r.balance), status: r.status, expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : null } : null;
}

/** Does this store have a card that can pay right now? (Checkout shows its gift card box only then.) */
export async function storeHasGiftCards(payload: Payload, storeId: number | null): Promise<boolean> {
  const { rows } = await (await conn(payload)).execute(sql`
    SELECT 1 FROM "payload"."cms_gift_cards" WHERE "store_id" IS NOT DISTINCT FROM ${storeId} AND "status" = 'active'
      AND COALESCE("balance", 0) > 0 AND ("expires_at" IS NULL OR "expires_at" > now()) LIMIT 1`);
  return rows.length > 0;
}

/** Can it pay right now? A reason for the shopper when it can't. */
export function giftCardProblem(card: GiftCardInfo | null): string | null {
  if (!card) return "We can't find this gift card – check the code.";
  if (card.status !== "active") return "This gift card has been switched off.";
  if (card.expiresAt && Date.parse(card.expiresAt) <= Date.now()) return "This gift card has expired.";
  if (card.balance <= 0) return "This gift card has no balance left.";
  return null;
}

/** Pays `amount` with the card if it still has that much (and is active, not expired). False when it hasn't. */
export async function takeFromGiftCard(payload: Payload, input: { code: string; storeId: number | null; amount: number; orderNumber: string }, req?: PayloadRequest): Promise<boolean> {
  if (!(input.amount > 0)) return true;
  const entry = JSON.stringify([{ at: new Date().toISOString(), amount: -input.amount, order: input.orderNumber, note: "Paid an order" }]);
  const { rows } = await (await conn(payload, req)).execute(sql`
    UPDATE "payload"."cms_gift_cards"
    SET "balance" = "balance" - ${input.amount}, "ledger" = COALESCE("ledger", '[]'::jsonb) || ${entry}::jsonb, "updated_at" = now()
    WHERE upper("code") = ${normalizeGiftCardCode(input.code)} AND "store_id" IS NOT DISTINCT FROM ${input.storeId} AND "status" = 'active'
      AND ("expires_at" IS NULL OR "expires_at" > now()) AND COALESCE("balance", 0) >= ${input.amount}
    RETURNING "id"`);
  return rows.length > 0;
}

/** Gives an amount back to the card (its order was cancelled / refused before delivery). */
export async function giveBackToGiftCard(payload: Payload, input: { code: string; storeId: number | null; amount: number; orderNumber: string; note: string }, req?: PayloadRequest): Promise<void> {
  if (!(input.amount > 0)) return;
  const entry = JSON.stringify([{ at: new Date().toISOString(), amount: input.amount, order: input.orderNumber, note: input.note }]);
  await (await conn(payload, req)).execute(sql`
    UPDATE "payload"."cms_gift_cards"
    SET "balance" = COALESCE("balance", 0) + ${input.amount}, "ledger" = COALESCE("ledger", '[]'::jsonb) || ${entry}::jsonb, "updated_at" = now()
    WHERE upper("code") = ${normalizeGiftCardCode(input.code)} AND "store_id" IS NOT DISTINCT FROM ${input.storeId}`);
}
