import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_flash_sales" ADD COLUMN "starts_at" timestamp(3) with time zone;
  ALTER TABLE "payload"."cms_flash_sales" ADD COLUMN "discount_percent" numeric;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_flash_sales" DROP COLUMN IF EXISTS "starts_at";
  ALTER TABLE "payload"."cms_flash_sales" DROP COLUMN IF EXISTS "discount_percent";`)
}
