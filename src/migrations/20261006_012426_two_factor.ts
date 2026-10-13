import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_users" ADD COLUMN "two_factor_enabled" boolean;
  ALTER TABLE "payload"."cms_users" ADD COLUMN "two_factor_secret" varchar;
  ALTER TABLE "payload"."cms_users" ADD COLUMN "two_factor_pending_secret" varchar;
  ALTER TABLE "payload"."cms_users" ADD COLUMN "two_factor_last_step" numeric;
  ALTER TABLE "payload"."cms_users" ADD COLUMN "two_factor_backup_codes" jsonb;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_users" DROP COLUMN "two_factor_enabled";
  ALTER TABLE "payload"."cms_users" DROP COLUMN "two_factor_secret";
  ALTER TABLE "payload"."cms_users" DROP COLUMN "two_factor_pending_secret";
  ALTER TABLE "payload"."cms_users" DROP COLUMN "two_factor_last_step";
  ALTER TABLE "payload"."cms_users" DROP COLUMN "two_factor_backup_codes";`)
}
