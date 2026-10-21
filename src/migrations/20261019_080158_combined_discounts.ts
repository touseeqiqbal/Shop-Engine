import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_orders" ADD COLUMN "extra_coupon_code" varchar;
  CREATE INDEX "cms_orders_extra_coupon_code_idx" ON "payload"."cms_orders" USING btree ("extra_coupon_code");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "payload"."cms_orders_extra_coupon_code_idx";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN "extra_coupon_code";`)
}
