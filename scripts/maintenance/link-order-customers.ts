/**
 * Gives every order placed before the October 2026 update a customer in /cms → Customers – the same rule checkout
 * now uses: the customer with the order's email, or a new "no account yet" record (no password; it becomes a real
 * account when they set a password through the emailed link). For privacy an order is only attached to an account
 * whose owner confirmed that email; orders without an email, with an unconfirmed account's email or a staff email
 * are left alone (they still appear under Orders). Orders that already have a customer are never changed.
 *
 *   npm run customers:link              (report only – shows what would happen)
 *   npm run customers:link -- --apply   (writes it; take a backup first – see docs/BACKUP-RESTORE.md)
 *
 * On Railway: run it from your computer with DATABASE_URL set to the database's public URL and PAYLOAD_SECRET set.
 */
import { getPayload } from "payload";
import config from "@payload-config";
import { sql } from "@payloadcms/db-postgres";
import { linkOrderToCustomerCms } from "../../src/lib/cms/sales";

const apply = process.argv.includes("--apply");
const payload = await getPayload({ config });
const db = (payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<{ rows: Record<string, unknown>[] }> } }).drizzle;

const { rows } = await db.execute(sql`
  SELECT o.order_number, o.customer_name, o.customer_phone, LOWER(NULLIF(TRIM(o.customer_email), '')) AS email,
    u.id AS user_id, u.role AS user_role, u.has_account, u.email_verified
  FROM "payload"."cms_orders" o
  LEFT JOIN "payload"."cms_users" u ON LOWER(u.email) = LOWER(NULLIF(TRIM(o.customer_email), ''))
  WHERE o.user_id IS NULL
  ORDER BY o.id`);

const newRecords = new Set<string>();
let toExisting = 0, toNew = 0, staffEmail = 0, noEmail = 0, unconfirmed = 0;
for (const r of rows) {
  if (!r.email) noEmail++;
  else if (r.user_id && r.user_role !== "customer") staffEmail++;
  else if (r.user_id && r.has_account !== false && !r.email_verified) unconfirmed++;
  else if (r.user_id) toExisting++;
  else {
    toNew++;
    newRecords.add(String(r.email));
  }
}
console.log(`Orders without a customer: ${rows.length}`);
console.log(`  → attached to an existing customer (same email, confirmed): ${toExisting}`);
console.log(`  → attached to ${newRecords.size} new "no account yet" customer record(s): ${toNew}`);
console.log(`  → no email – left alone: ${noEmail}`);
console.log(`  → email of an account that never confirmed it – left alone (privacy): ${unconfirmed}`);
console.log(`  → email belongs to a staff account – left alone: ${staffEmail}`);

if (apply) {
  let done = 0;
  for (const r of rows) {
    await linkOrderToCustomerCms(String(r.order_number), { email: (r.email as string | null) ?? null, name: String(r.customer_name ?? ""), phone: String(r.customer_phone ?? "") });
    if (++done % 50 === 0) console.log(`  … ${done}/${rows.length}`);
  }
  const left = await db.execute(sql`SELECT COUNT(*) AS n FROM "payload"."cms_orders" WHERE user_id IS NULL`);
  console.log(`\nDone. Orders still without a customer (no email, unconfirmed account or staff email): ${left.rows[0]?.n ?? "?"}`);
} else {
  console.log(`\nNothing changed – run again with --apply to save.`);
}
process.exit(0);
