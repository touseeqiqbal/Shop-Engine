import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_users" ADD COLUMN "two_factor_failed_codes" numeric;
  ALTER TABLE "payload"."cms_users" ADD COLUMN "two_factor_locked_until" timestamp(3) with time zone;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_users" DROP COLUMN "two_factor_failed_codes";
  ALTER TABLE "payload"."cms_users" DROP COLUMN "two_factor_locked_until";`)
}
