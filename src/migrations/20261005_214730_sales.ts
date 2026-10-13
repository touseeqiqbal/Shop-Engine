import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_cms_discounts_kind" AS ENUM('percent', 'fixed');
  CREATE TYPE "payload"."enum_cms_notifications_status_updates" AS ENUM('confirmed', 'dispatched', 'out-for-delivery', 'delivered');
  CREATE TABLE "payload"."cms_discounts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"kind" "payload"."enum_cms_discounts_kind" DEFAULT 'percent' NOT NULL,
  	"value" numeric NOT NULL,
  	"min_order" numeric DEFAULT 0,
  	"usage_limit" numeric,
  	"used" numeric DEFAULT 0,
  	"expires_at" timestamp(3) with time zone,
  	"active" boolean DEFAULT true,
  	"legacy_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_flash_sales" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar DEFAULT 'Weekly Hot Deals' NOT NULL,
  	"ends_at" timestamp(3) with time zone NOT NULL,
  	"active" boolean DEFAULT true,
  	"legacy_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_flash_sales_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"cms_products_id" integer
  );
  
  CREATE TABLE "payload"."cms_notifications_status_updates" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "payload"."enum_cms_notifications_status_updates",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "payload"."cms_notifications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alert_new_order" boolean DEFAULT true,
  	"alert_wholesale" boolean DEFAULT true,
  	"alert_contact" boolean DEFAULT false,
  	"customer_email" boolean DEFAULT true,
  	"customer_whats_app" boolean DEFAULT true,
  	"customer_sms" boolean DEFAULT true,
  	"order_confirmation" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload"."cms_notifications_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  ALTER TABLE "payload"."cms_orders_items" ADD COLUMN "product_legacy_id" varchar;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_discounts_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_flash_sales_id" integer;
  ALTER TABLE "payload"."cms_flash_sales_rels" ADD CONSTRAINT "cms_flash_sales_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_flash_sales"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_flash_sales_rels" ADD CONSTRAINT "cms_flash_sales_rels_products_fk" FOREIGN KEY ("cms_products_id") REFERENCES "payload"."cms_products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_notifications_status_updates" ADD CONSTRAINT "cms_notifications_status_updates_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_notifications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_notifications_texts" ADD CONSTRAINT "cms_notifications_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_notifications"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "cms_discounts_code_idx" ON "payload"."cms_discounts" USING btree ("code");
  CREATE UNIQUE INDEX "cms_discounts_legacy_id_idx" ON "payload"."cms_discounts" USING btree ("legacy_id");
  CREATE INDEX "cms_discounts_updated_at_idx" ON "payload"."cms_discounts" USING btree ("updated_at");
  CREATE INDEX "cms_discounts_created_at_idx" ON "payload"."cms_discounts" USING btree ("created_at");
  CREATE UNIQUE INDEX "cms_flash_sales_legacy_id_idx" ON "payload"."cms_flash_sales" USING btree ("legacy_id");
  CREATE INDEX "cms_flash_sales_updated_at_idx" ON "payload"."cms_flash_sales" USING btree ("updated_at");
  CREATE INDEX "cms_flash_sales_created_at_idx" ON "payload"."cms_flash_sales" USING btree ("created_at");
  CREATE INDEX "cms_flash_sales_rels_order_idx" ON "payload"."cms_flash_sales_rels" USING btree ("order");
  CREATE INDEX "cms_flash_sales_rels_parent_idx" ON "payload"."cms_flash_sales_rels" USING btree ("parent_id");
  CREATE INDEX "cms_flash_sales_rels_path_idx" ON "payload"."cms_flash_sales_rels" USING btree ("path");
  CREATE INDEX "cms_flash_sales_rels_cms_products_id_idx" ON "payload"."cms_flash_sales_rels" USING btree ("cms_products_id");
  CREATE INDEX "cms_notifications_status_updates_order_idx" ON "payload"."cms_notifications_status_updates" USING btree ("order");
  CREATE INDEX "cms_notifications_status_updates_parent_idx" ON "payload"."cms_notifications_status_updates" USING btree ("parent_id");
  CREATE INDEX "cms_notifications_texts_order_parent" ON "payload"."cms_notifications_texts" USING btree ("order","parent_id");
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_discounts_fk" FOREIGN KEY ("cms_discounts_id") REFERENCES "payload"."cms_discounts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_flash_sales_fk" FOREIGN KEY ("cms_flash_sales_id") REFERENCES "payload"."cms_flash_sales"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_cms_discounts_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_discounts_id");
  CREATE INDEX "payload_locked_documents_rels_cms_flash_sales_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_flash_sales_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_discounts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_flash_sales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_flash_sales_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_notifications_status_updates" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_notifications" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_notifications_texts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."cms_discounts" CASCADE;
  DROP TABLE "payload"."cms_flash_sales" CASCADE;
  DROP TABLE "payload"."cms_flash_sales_rels" CASCADE;
  DROP TABLE "payload"."cms_notifications_status_updates" CASCADE;
  DROP TABLE "payload"."cms_notifications" CASCADE;
  DROP TABLE "payload"."cms_notifications_texts" CASCADE;
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_discounts_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_flash_sales_fk";
  
  DROP INDEX "payload"."payload_locked_documents_rels_cms_discounts_id_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_cms_flash_sales_id_idx";
  ALTER TABLE "payload"."cms_orders_items" DROP COLUMN "product_legacy_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "cms_discounts_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "cms_flash_sales_id";
  DROP TYPE "payload"."enum_cms_discounts_kind";
  DROP TYPE "payload"."enum_cms_notifications_status_updates";`)
}
