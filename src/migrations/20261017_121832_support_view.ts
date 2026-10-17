import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "payload"."enum_cms_security_events_kind" ADD VALUE 'support-view';
  ALTER TABLE "payload"."cms_users" ADD COLUMN "support_view" jsonb;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_security_events" ALTER COLUMN "kind" SET DATA TYPE text;
  -- the value didn't exist before: those events go (support views are also in the stores' activity logs)
  DELETE FROM "payload"."cms_security_events" WHERE "kind" = 'support-view';
  DROP TYPE "payload"."enum_cms_security_events_kind";
  CREATE TYPE "payload"."enum_cms_security_events_kind" AS ENUM('sign-in', 'sign-in-failed', 'two-factor-failed', 'two-factor-locked', 'two-factor-on', 'two-factor-off', 'two-factor-reset', 'backup-codes', 'password-reset-requested', 'password-changed', 'rate-limited');
  ALTER TABLE "payload"."cms_security_events" ALTER COLUMN "kind" SET DATA TYPE "payload"."enum_cms_security_events_kind" USING "kind"::"payload"."enum_cms_security_events_kind";
  ALTER TABLE "payload"."cms_users" DROP COLUMN IF EXISTS "support_view";`)
}
