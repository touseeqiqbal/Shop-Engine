import { sql } from "@payloadcms/db-postgres";
import { getPayload, type Payload } from "payload";
import config from "@payload-config";
import { hasStoreRole, resolveTenant, storeIdOf, type StoreRole, type Tenant, type TenantUser } from "./tenancy";

/**
 * For the admin's own Next.js routes (print, proof, private files, preview), which read records with overrideAccess:
 * who is asking, and whether a record's store is one they work in.
 */
export async function adminRequest(req: Request): Promise<{ payload: Payload; user: TenantUser | null; t: Tenant }> {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: req.headers });
  const t = await resolveTenant(payload, user as TenantUser | null);
  return { payload, user: user as TenantUser | null, t };
}

/** May see this record: a platform admin, or the record's store team (at least `min`). */
export const canSeeStore = (t: Tenant, store: unknown, min: StoreRole = "store_staff") => t.platformAdmin || hasStoreRole(t, storeIdOf(store), min);

/** Private customer uploads are named by kind, not by store: the store of the record that holds the file. */
const PRIVATE_TABLES: Record<string, string> = {
  returns: "cms_return_requests",
  warranty: "cms_warranty_claims",
  tradein: "cms_trade_ins",
  "reviews-pending": "cms_reviews",
};
export async function storeOfPrivateFile(payload: Payload, key: string): Promise<number | null | undefined> {
  const table = PRIVATE_TABLES[key.split("/")[0]];
  if (!table) return undefined;
  const db = (payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<{ rows: Record<string, unknown>[] }> } }).drizzle;
  const { rows } = await db.execute(sql`SELECT "store_id" FROM ${sql.raw(`"payload"."${table}"`)} WHERE "photo_keys" @> ${JSON.stringify([key])}::jsonb LIMIT 1`);
  return rows.length ? storeIdOf(rows[0].store_id) : undefined;
}
