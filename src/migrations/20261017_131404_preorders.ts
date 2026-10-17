import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_cms_products_backorders" AS ENUM('no', 'backorder', 'preorder');
  CREATE TYPE "payload"."enum__cms_products_v_version_backorders" AS ENUM('no', 'backorder', 'preorder');
  CREATE TYPE "payload"."enum_cms_orders_items_availability" AS ENUM('preorder', 'backorder');
  ALTER TABLE "payload"."cms_products" ADD COLUMN "backorders" "payload"."enum_cms_products_backorders" DEFAULT 'no';
  ALTER TABLE "payload"."cms_products" ADD COLUMN "release_date" timestamp(3) with time zone;
  ALTER TABLE "payload"."cms_products" ADD COLUMN "backorder_note" varchar;
  ALTER TABLE "payload"."_cms_products_v" ADD COLUMN "version_backorders" "payload"."enum__cms_products_v_version_backorders" DEFAULT 'no';
  ALTER TABLE "payload"."_cms_products_v" ADD COLUMN "version_release_date" timestamp(3) with time zone;
  ALTER TABLE "payload"."_cms_products_v" ADD COLUMN "version_backorder_note" varchar;
  ALTER TABLE "payload"."cms_orders_items" ADD COLUMN "availability" "payload"."enum_cms_orders_items_availability";
  ALTER TABLE "payload"."cms_orders_items" ADD COLUMN "owed_qty" numeric;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_products" DROP COLUMN IF EXISTS "backorders";
  ALTER TABLE "payload"."cms_products" DROP COLUMN IF EXISTS "release_date";
  ALTER TABLE "payload"."cms_products" DROP COLUMN IF EXISTS "backorder_note";
  ALTER TABLE "payload"."_cms_products_v" DROP COLUMN IF EXISTS "version_backorders";
  ALTER TABLE "payload"."_cms_products_v" DROP COLUMN IF EXISTS "version_release_date";
  ALTER TABLE "payload"."_cms_products_v" DROP COLUMN IF EXISTS "version_backorder_note";
  ALTER TABLE "payload"."cms_orders_items" DROP COLUMN IF EXISTS "availability";
  ALTER TABLE "payload"."cms_orders_items" DROP COLUMN IF EXISTS "owed_qty";
  DROP TYPE IF EXISTS "payload"."enum_cms_products_backorders";
  DROP TYPE IF EXISTS "payload"."enum__cms_products_v_version_backorders";
  DROP TYPE IF EXISTS "payload"."enum_cms_orders_items_availability";`)
}
