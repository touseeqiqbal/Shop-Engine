import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_orders" ADD COLUMN "confirmation_failed_attempts" numeric DEFAULT 0;
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "attempt_id" varchar;
  CREATE INDEX "cms_orders_customer_customer_email_idx" ON "payload"."cms_orders" USING btree ("customer_email");
  CREATE UNIQUE INDEX "cms_orders_attempt_id_idx" ON "payload"."cms_orders" USING btree ("attempt_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "payload"."cms_orders_customer_customer_email_idx";
  DROP INDEX "payload"."cms_orders_attempt_id_idx";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN "confirmation_failed_attempts";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN "attempt_id";`)
}
