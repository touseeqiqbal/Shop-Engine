import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_cms_products_tax_class" AS ENUM('standard', 'reduced', 'exempt');
  CREATE TYPE "payload"."enum__cms_products_v_version_tax_class" AS ENUM('standard', 'reduced', 'exempt');
  ALTER TABLE "payload"."cms_products" ADD COLUMN "tax_class" "payload"."enum_cms_products_tax_class" DEFAULT 'standard';
  ALTER TABLE "payload"."_cms_products_v" ADD COLUMN "version_tax_class" "payload"."enum__cms_products_v_version_tax_class" DEFAULT 'standard';
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "tax_breakdown" jsonb;
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "billing_name" varchar;
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "billing_company" varchar;
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "billing_tax_id" varchar;
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "billing_address" varchar;
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "billing_city" varchar;
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "billing_postal_code" varchar;
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "billing_country" varchar;
  ALTER TABLE "payload"."cms_ss_payments" ADD COLUMN "tax_reduced_rate" numeric;
  ALTER TABLE "payload"."cms_payments" ADD COLUMN "tax_reduced_rate" numeric;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_products" DROP COLUMN IF EXISTS "tax_class";
  ALTER TABLE "payload"."_cms_products_v" DROP COLUMN IF EXISTS "version_tax_class";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN IF EXISTS "tax_breakdown";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN IF EXISTS "billing_name";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN IF EXISTS "billing_company";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN IF EXISTS "billing_tax_id";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN IF EXISTS "billing_address";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN IF EXISTS "billing_city";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN IF EXISTS "billing_postal_code";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN IF EXISTS "billing_country";
  ALTER TABLE "payload"."cms_ss_payments" DROP COLUMN IF EXISTS "tax_reduced_rate";
  ALTER TABLE "payload"."cms_payments" DROP COLUMN IF EXISTS "tax_reduced_rate";
  DROP TYPE IF EXISTS "payload"."enum_cms_products_tax_class";
  DROP TYPE IF EXISTS "payload"."enum__cms_products_v_version_tax_class";`)
}
