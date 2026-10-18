import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_collections" ADD COLUMN "show_from" timestamp(3) with time zone;
  ALTER TABLE "payload"."cms_collections" ADD COLUMN "show_until" timestamp(3) with time zone;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_collections" DROP COLUMN IF EXISTS "show_from";
  ALTER TABLE "payload"."cms_collections" DROP COLUMN IF EXISTS "show_until";`)
}
