import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/*
 * Stores in every country (ShopEngine): country / currency / time zone per store without Pakistani defaults, orders
 * keep their currency, payment method name and when it is paid, international addresses, the store's own payment
 * methods, typed shipping places and any payment provider id. Existing rows are filled in (backfill at the end of up).
 */
// allow-destructive: orders.payment_method and payment-transactions.provider become text instead of enums – every stored value is kept (the old version, still serving while this deploys, writes the same strings); only the two enum types they used are dropped. No column, row or table is removed.

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_cms_orders_payment_due" AS ENUM('upfront', 'on-delivery');
  CREATE TYPE "payload"."enum_cms_ss_payments_manual_methods_due" AS ENUM('upfront', 'on-delivery');
  CREATE TYPE "payload"."enum_cms_payments_manual_methods_due" AS ENUM('upfront', 'on-delivery');
  ALTER TYPE "payload"."enum_cms_pos_sales_payments_method" ADD VALUE 'other';
  CREATE TABLE "payload"."cms_ss_shipping_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "payload"."cms_ss_payments_manual_methods_details" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"value" varchar
  );
  
  CREATE TABLE "payload"."cms_ss_payments_manual_methods" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"due" "payload"."enum_cms_ss_payments_manual_methods_due" DEFAULT 'upfront' NOT NULL,
  	"note" varchar,
  	"instructions" varchar,
  	"method_id" varchar
  );
  
  CREATE TABLE "payload"."cms_shipping_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "payload"."cms_payments_manual_methods_details" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"value" varchar
  );
  
  CREATE TABLE "payload"."cms_payments_manual_methods" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"due" "payload"."enum_cms_payments_manual_methods_due" DEFAULT 'upfront' NOT NULL,
  	"note" varchar,
  	"instructions" varchar,
  	"method_id" varchar
  );
  
  ALTER TABLE "payload"."cms_stores" ALTER COLUMN "country" DROP DEFAULT;
  ALTER TABLE "payload"."cms_stores" ALTER COLUMN "currency" DROP DEFAULT;
  ALTER TABLE "payload"."cms_stores" ALTER COLUMN "timezone" DROP DEFAULT;
  ALTER TABLE "payload"."cms_orders" ALTER COLUMN "payment_method" SET DATA TYPE varchar;
  ALTER TABLE "payload"."cms_ss_announcement_bar" ALTER COLUMN "text" DROP DEFAULT;
  ALTER TABLE "payload"."_cms_ss_announcement_bar_v" ALTER COLUMN "version_text" DROP DEFAULT;
  ALTER TABLE "payload"."cms_ss_conversion" ALTER COLUMN "cart_message" SET DEFAULT 'Your items are still waiting – stock is limited, so complete your order before they''re gone.';
  ALTER TABLE "payload"."cms_payment_transactions" ALTER COLUMN "provider" SET DATA TYPE varchar;
  ALTER TABLE "payload"."cms_announcement_bar" ALTER COLUMN "text" DROP DEFAULT;
  ALTER TABLE "payload"."_cms_announcement_bar_v" ALTER COLUMN "version_text" DROP DEFAULT;
  ALTER TABLE "payload"."cms_conversion" ALTER COLUMN "cart_message" SET DEFAULT 'Your items are still waiting – stock is limited, so complete your order before they''re gone.';
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "customer_region" varchar;
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "customer_postal_code" varchar;
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "customer_country" varchar;
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "payment_method_label" varchar;
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "payment_due" "payload"."enum_cms_orders_payment_due";
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "currency" varchar;
  ALTER TABLE "payload"."cms_ss_shipping_texts" ADD CONSTRAINT "cms_ss_shipping_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_ss_shipping"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_payments_manual_methods_details" ADD CONSTRAINT "cms_ss_payments_manual_methods_details_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_ss_payments_manual_methods"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_payments_manual_methods" ADD CONSTRAINT "cms_ss_payments_manual_methods_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_ss_payments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_shipping_texts" ADD CONSTRAINT "cms_shipping_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_shipping"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_payments_manual_methods_details" ADD CONSTRAINT "cms_payments_manual_methods_details_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_payments_manual_methods"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_payments_manual_methods" ADD CONSTRAINT "cms_payments_manual_methods_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_payments"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "cms_ss_shipping_texts_order_parent" ON "payload"."cms_ss_shipping_texts" USING btree ("order","parent_id");
  CREATE INDEX "cms_ss_payments_manual_methods_details_order_idx" ON "payload"."cms_ss_payments_manual_methods_details" USING btree ("_order");
  CREATE INDEX "cms_ss_payments_manual_methods_details_parent_id_idx" ON "payload"."cms_ss_payments_manual_methods_details" USING btree ("_parent_id");
  CREATE INDEX "cms_ss_payments_manual_methods_order_idx" ON "payload"."cms_ss_payments_manual_methods" USING btree ("_order");
  CREATE INDEX "cms_ss_payments_manual_methods_parent_id_idx" ON "payload"."cms_ss_payments_manual_methods" USING btree ("_parent_id");
  CREATE INDEX "cms_shipping_texts_order_parent" ON "payload"."cms_shipping_texts" USING btree ("order","parent_id");
  CREATE INDEX "cms_payments_manual_methods_details_order_idx" ON "payload"."cms_payments_manual_methods_details" USING btree ("_order");
  CREATE INDEX "cms_payments_manual_methods_details_parent_id_idx" ON "payload"."cms_payments_manual_methods_details" USING btree ("_parent_id");
  CREATE INDEX "cms_payments_manual_methods_order_idx" ON "payload"."cms_payments_manual_methods" USING btree ("_order");
  CREATE INDEX "cms_payments_manual_methods_parent_id_idx" ON "payload"."cms_payments_manual_methods" USING btree ("_parent_id");
  CREATE INDEX "cms_orders_payment_method_idx" ON "payload"."cms_orders" USING btree ("payment_method");
  CREATE INDEX "cms_payment_transactions_provider_idx" ON "payload"."cms_payment_transactions" USING btree ("provider");
  UPDATE "payload"."cms_stores" SET "country" = 'PK' WHERE "country" IS NULL OR trim("country") = '' OR lower(trim("country")) IN ('pakistan', 'pk');
  UPDATE "payload"."cms_stores" SET "currency" = 'PKR' WHERE "currency" IS NULL OR trim("currency") = '';
  UPDATE "payload"."cms_stores" SET "timezone" = 'Asia/Karachi' WHERE "timezone" IS NULL OR trim("timezone") = '';
  UPDATE "payload"."cms_orders" o SET "currency" = upper(s."currency") FROM "payload"."cms_stores" s WHERE o."store_id" = s."id" AND o."currency" IS NULL AND coalesce(trim(s."currency"), '') <> '';
  UPDATE "payload"."cms_orders" SET "currency" = 'PKR' WHERE "currency" IS NULL;
  UPDATE "payload"."cms_orders" SET "payment_due" = (CASE WHEN "payment_method" = 'cod' THEN 'on-delivery' ELSE 'upfront' END)::"payload"."enum_cms_orders_payment_due" WHERE "payment_due" IS NULL AND "payment_method" IS NOT NULL;
  UPDATE "payload"."cms_orders" SET "payment_method_label" = CASE "payment_method" WHEN 'cod' THEN 'Cash on Delivery' WHEN 'jazzcash' THEN 'JazzCash' WHEN 'easypaisa' THEN 'EasyPaisa' WHEN 'bank' THEN 'Bank Transfer' WHEN 'card' THEN 'Debit / Credit Card' ELSE "payment_method" END WHERE "payment_method_label" IS NULL AND "payment_method" IS NOT NULL;
  DROP TYPE "payload"."enum_cms_orders_payment_method";
  DROP TYPE "payload"."enum_cms_payment_transactions_provider";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   UPDATE "payload"."cms_orders" SET "payment_method" = 'bank' WHERE "payment_method" NOT IN ('cod', 'jazzcash', 'easypaisa', 'bank', 'card');
  UPDATE "payload"."cms_payment_transactions" SET "provider" = 'manual' WHERE "provider" NOT IN ('stripe', 'manual');
  UPDATE "payload"."cms_pos_sales_payments" SET "method" = 'bank' WHERE "method"::text = 'other';
  CREATE TYPE "payload"."enum_cms_orders_payment_method" AS ENUM('cod', 'jazzcash', 'easypaisa', 'bank', 'card');
  CREATE TYPE "payload"."enum_cms_payment_transactions_provider" AS ENUM('stripe', 'manual');
  ALTER TABLE "payload"."cms_ss_shipping_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_payments_manual_methods_details" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_payments_manual_methods" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_shipping_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_payments_manual_methods_details" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_payments_manual_methods" DISABLE ROW LEVEL SECURITY;
  DROP TABLE IF EXISTS "payload"."cms_ss_shipping_texts" CASCADE;
  DROP TABLE IF EXISTS "payload"."cms_ss_payments_manual_methods_details" CASCADE;
  DROP TABLE IF EXISTS "payload"."cms_ss_payments_manual_methods" CASCADE;
  DROP TABLE IF EXISTS "payload"."cms_shipping_texts" CASCADE;
  DROP TABLE IF EXISTS "payload"."cms_payments_manual_methods_details" CASCADE;
  DROP TABLE IF EXISTS "payload"."cms_payments_manual_methods" CASCADE;
  ALTER TABLE "payload"."cms_pos_sales_payments" ALTER COLUMN "method" SET DATA TYPE text;
  DROP TYPE "payload"."enum_cms_pos_sales_payments_method";
  CREATE TYPE "payload"."enum_cms_pos_sales_payments_method" AS ENUM('cash', 'card', 'bank', 'jazzcash', 'easypaisa');
  ALTER TABLE "payload"."cms_pos_sales_payments" ALTER COLUMN "method" SET DATA TYPE "payload"."enum_cms_pos_sales_payments_method" USING "method"::"payload"."enum_cms_pos_sales_payments_method";
  DROP INDEX IF EXISTS "payload"."cms_orders_payment_method_idx";
  DROP INDEX IF EXISTS "payload"."cms_payment_transactions_provider_idx";
  ALTER TABLE "payload"."cms_stores" ALTER COLUMN "country" SET DEFAULT 'Pakistan';
  UPDATE "payload"."cms_stores" SET "country" = 'Pakistan' WHERE "country" = 'PK';
  ALTER TABLE "payload"."cms_stores" ALTER COLUMN "currency" SET DEFAULT 'PKR';
  ALTER TABLE "payload"."cms_stores" ALTER COLUMN "timezone" SET DEFAULT 'Asia/Karachi';
  ALTER TABLE "payload"."cms_orders" ALTER COLUMN "payment_method" SET DATA TYPE "payload"."enum_cms_orders_payment_method" USING "payment_method"::"payload"."enum_cms_orders_payment_method";
  ALTER TABLE "payload"."cms_ss_announcement_bar" ALTER COLUMN "text" SET DEFAULT 'Free delivery on orders above Rs 15,000 · Cash on Delivery all over Pakistan';
  ALTER TABLE "payload"."_cms_ss_announcement_bar_v" ALTER COLUMN "version_text" SET DEFAULT 'Free delivery on orders above Rs 15,000 · Cash on Delivery all over Pakistan';
  ALTER TABLE "payload"."cms_ss_conversion" ALTER COLUMN "cart_message" SET DEFAULT 'Your items are still waiting – stock is limited, so complete your order before they''re gone. Cash on delivery all over Pakistan.';
  ALTER TABLE "payload"."cms_payment_transactions" ALTER COLUMN "provider" SET DATA TYPE "payload"."enum_cms_payment_transactions_provider" USING "provider"::"payload"."enum_cms_payment_transactions_provider";
  ALTER TABLE "payload"."cms_announcement_bar" ALTER COLUMN "text" SET DEFAULT 'Free delivery on orders above Rs 15,000 · Cash on Delivery all over Pakistan';
  ALTER TABLE "payload"."_cms_announcement_bar_v" ALTER COLUMN "version_text" SET DEFAULT 'Free delivery on orders above Rs 15,000 · Cash on Delivery all over Pakistan';
  ALTER TABLE "payload"."cms_conversion" ALTER COLUMN "cart_message" SET DEFAULT 'Your items are still waiting – stock is limited, so complete your order before they''re gone. Cash on delivery all over Pakistan.';
  ALTER TABLE "payload"."cms_orders" DROP COLUMN IF EXISTS "customer_region";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN IF EXISTS "customer_postal_code";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN IF EXISTS "customer_country";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN IF EXISTS "payment_method_label";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN IF EXISTS "payment_due";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN IF EXISTS "currency";
  DROP TYPE "payload"."enum_cms_orders_payment_due";
  DROP TYPE "payload"."enum_cms_ss_payments_manual_methods_due";
  DROP TYPE "payload"."enum_cms_payments_manual_methods_due";`)
}
