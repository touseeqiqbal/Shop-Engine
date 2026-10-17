import type { Payload } from "payload";
import { sql } from "@payloadcms/db-postgres";
import { conn } from "./stock";
import { optOutKey } from "./optout-key";

export { optOutKey };

/**
 * A store's unsubscribed contacts (Marketing → Unsubscribed): people who asked for no more cart reminders or
 * marketing messages – the link in a reminder, or their email app's one-click "Unsubscribe". Cart reminders and the
 * subscribers export skip them; ticking "send me offers" at a later checkout takes them off again.
 */

const keys = (contacts: unknown[]) => [...new Set(contacts.map(optOutKey).filter(Boolean))];

export type OptOutSource = "cart-reminder" | "one-click" | "staff";

/** Adds the contacts (a cart's email and phone …) – once each. */
export async function optOut(payload: Payload, storeId: number | null, contacts: unknown[], source: OptOutSource): Promise<void> {
  const db = await conn(payload);
  for (const contact of keys(contacts))
    await db.execute(sql`
      INSERT INTO "payload"."cms_email_optouts" ("store_id", "contact", "source", "updated_at", "created_at")
      SELECT ${storeId}, ${contact}, ${source}, now(), now()
      WHERE NOT EXISTS (SELECT 1 FROM "payload"."cms_email_optouts" WHERE "store_id" IS NOT DISTINCT FROM ${storeId} AND "contact" = ${contact})
      ON CONFLICT DO NOTHING`);
}

/** Has any of these contacts unsubscribed from this store? */
export async function isOptedOut(payload: Payload, storeId: number | null, contacts: unknown[]): Promise<boolean> {
  const list = keys(contacts);
  if (!list.length) return false;
  const { rows } = await (await conn(payload)).execute(sql`
    SELECT 1 FROM "payload"."cms_email_optouts"
    WHERE "store_id" IS NOT DISTINCT FROM ${storeId} AND "contact" IN (${sql.join(list.map((c) => sql`${c}`), sql`, `)}) LIMIT 1`);
  return rows.length > 0;
}

/** Every unsubscribed contact of a store (the subscribers export leaves them out). */
export async function optedOut(payload: Payload, storeId: number | null): Promise<Set<string>> {
  const { rows } = await (await conn(payload)).execute(sql`SELECT "contact" FROM "payload"."cms_email_optouts" WHERE "store_id" IS NOT DISTINCT FROM ${storeId}`);
  return new Set(rows.map((r) => String(r.contact)));
}

/** They agreed to hear from the store again (ticked "send me offers" at checkout). */
export async function clearOptOut(payload: Payload, storeId: number | null, contacts: unknown[]): Promise<void> {
  const list = keys(contacts);
  if (!list.length) return;
  await (await conn(payload)).execute(sql`
    DELETE FROM "payload"."cms_email_optouts" WHERE "store_id" IS NOT DISTINCT FROM ${storeId} AND "contact" IN (${sql.join(list.map((c) => sql`${c}`), sql`, `)})`);
}
