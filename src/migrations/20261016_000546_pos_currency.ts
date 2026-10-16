import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/* Shop-counter sales keep the currency they were made in (like website orders); existing sales get their store's. */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_pos_sales" ADD COLUMN "currency" varchar;
  UPDATE "payload"."cms_pos_sales" p SET "currency" = upper(s."currency") FROM "payload"."cms_stores" s WHERE p."store_id" = s."id" AND p."currency" IS NULL AND coalesce(trim(s."currency"), '') <> '';
  UPDATE "payload"."cms_pos_sales" SET "currency" = 'PKR' WHERE "currency" IS NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_pos_sales" DROP COLUMN IF EXISTS "currency";`)
}
