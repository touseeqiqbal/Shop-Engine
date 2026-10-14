import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_cms_orders_shipments_status" AS ENUM('shipped', 'delivered', 'cancelled');
  CREATE TYPE "payload"."enum_cms_webhook_endpoints_events" AS ENUM('order.created', 'order.updated', 'order.paid', 'refund.created');
  ALTER TYPE "payload"."enum_cms_orders_fulfillment_status" ADD VALUE 'partially_fulfilled' BEFORE 'in_transit';
  CREATE TABLE "payload"."cms_orders_shipments" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"items" jsonb,
  	"courier" varchar,
  	"tracking_number" varchar,
  	"status" "payload"."enum_cms_orders_shipments_status" DEFAULT 'shipped',
  	"shipped_at" timestamp(3) with time zone,
  	"delivered_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload"."cms_webhook_endpoints_events" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "payload"."enum_cms_webhook_endpoints_events",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "payload"."cms_webhook_endpoints" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_id" integer,
  	"url" varchar NOT NULL,
  	"active" boolean DEFAULT true,
  	"secret" varchar,
  	"last_status" varchar,
  	"last_delivery_at" timestamp(3) with time zone,
  	"failures" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_customer_carts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_id" integer,
  	"user_id" integer NOT NULL,
  	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload"."cms_pb_deals" ALTER COLUMN "eyebrow" SET DEFAULT '';
  ALTER TABLE "payload"."cms_pb_social" ALTER COLUMN "eyebrow" SET DEFAULT '';
  ALTER TABLE "payload"."_cms_pb_deals_v" ALTER COLUMN "eyebrow" SET DEFAULT '';
  ALTER TABLE "payload"."_cms_pb_social_v" ALTER COLUMN "eyebrow" SET DEFAULT '';
  ALTER TABLE "payload"."cms_ss_whatsapp_button" ALTER COLUMN "message" SET DEFAULT '';
  ALTER TABLE "payload"."_cms_ss_whatsapp_button_v" ALTER COLUMN "version_message" SET DEFAULT '';
  ALTER TABLE "payload"."cms_ss_seo_settings" ALTER COLUMN "title_template" SET DEFAULT '';
  ALTER TABLE "payload"."cms_whatsapp_button" ALTER COLUMN "message" SET DEFAULT '';
  ALTER TABLE "payload"."_cms_whatsapp_button_v" ALTER COLUMN "version_message" SET DEFAULT '';
  ALTER TABLE "payload"."cms_seo_settings" ALTER COLUMN "title_template" SET DEFAULT '';
  ALTER TABLE "payload"."cms_products" ADD COLUMN "barcode" varchar;
  ALTER TABLE "payload"."cms_products" ADD COLUMN "product_type" varchar;
  ALTER TABLE "payload"."_cms_products_v" ADD COLUMN "version_barcode" varchar;
  ALTER TABLE "payload"."_cms_products_v" ADD COLUMN "version_product_type" varchar;
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "marketing_consent" boolean DEFAULT false;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_webhook_endpoints_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_customer_carts_id" integer;
  ALTER TABLE "payload"."cms_orders_shipments" ADD CONSTRAINT "cms_orders_shipments_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_webhook_endpoints_events" ADD CONSTRAINT "cms_webhook_endpoints_events_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_webhook_endpoints"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_webhook_endpoints" ADD CONSTRAINT "cms_webhook_endpoints_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_customer_carts" ADD CONSTRAINT "cms_customer_carts_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_customer_carts" ADD CONSTRAINT "cms_customer_carts_user_id_cms_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "payload"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "cms_orders_shipments_order_idx" ON "payload"."cms_orders_shipments" USING btree ("_order");
  CREATE INDEX "cms_orders_shipments_parent_id_idx" ON "payload"."cms_orders_shipments" USING btree ("_parent_id");
  CREATE INDEX "cms_webhook_endpoints_events_order_idx" ON "payload"."cms_webhook_endpoints_events" USING btree ("order");
  CREATE INDEX "cms_webhook_endpoints_events_parent_idx" ON "payload"."cms_webhook_endpoints_events" USING btree ("parent_id");
  CREATE INDEX "cms_webhook_endpoints_store_idx" ON "payload"."cms_webhook_endpoints" USING btree ("store_id");
  CREATE INDEX "cms_webhook_endpoints_updated_at_idx" ON "payload"."cms_webhook_endpoints" USING btree ("updated_at");
  CREATE INDEX "cms_webhook_endpoints_created_at_idx" ON "payload"."cms_webhook_endpoints" USING btree ("created_at");
  CREATE INDEX "cms_customer_carts_store_idx" ON "payload"."cms_customer_carts" USING btree ("store_id");
  CREATE INDEX "cms_customer_carts_user_idx" ON "payload"."cms_customer_carts" USING btree ("user_id");
  CREATE INDEX "cms_customer_carts_updated_at_idx" ON "payload"."cms_customer_carts" USING btree ("updated_at");
  CREATE INDEX "cms_customer_carts_created_at_idx" ON "payload"."cms_customer_carts" USING btree ("created_at");
  CREATE UNIQUE INDEX "user_store_idx" ON "payload"."cms_customer_carts" USING btree ("user_id","store_id");
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_webhook_endpoints_fk" FOREIGN KEY ("cms_webhook_endpoints_id") REFERENCES "payload"."cms_webhook_endpoints"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_customer_carts_fk" FOREIGN KEY ("cms_customer_carts_id") REFERENCES "payload"."cms_customer_carts"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "cms_products_barcode_idx" ON "payload"."cms_products" USING btree ("barcode");
  CREATE INDEX "cms_products_product_type_idx" ON "payload"."cms_products" USING btree ("product_type");
  CREATE INDEX "_cms_products_v_version_version_barcode_idx" ON "payload"."_cms_products_v" USING btree ("version_barcode");
  CREATE INDEX "_cms_products_v_version_version_product_type_idx" ON "payload"."_cms_products_v" USING btree ("version_product_type");
  CREATE INDEX "payload_locked_documents_rels_cms_webhook_endpoints_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_webhook_endpoints_id");
  CREATE INDEX "payload_locked_documents_rels_cms_customer_carts_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_customer_carts_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_orders_shipments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_webhook_endpoints_events" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_webhook_endpoints" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_customer_carts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."cms_orders_shipments" CASCADE;
  DROP TABLE "payload"."cms_webhook_endpoints_events" CASCADE;
  DROP TABLE "payload"."cms_webhook_endpoints" CASCADE;
  DROP TABLE "payload"."cms_customer_carts" CASCADE;
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_webhook_endpoints_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_customer_carts_fk";
  
  ALTER TABLE "payload"."cms_orders" ALTER COLUMN "fulfillment_status" SET DATA TYPE text;
  ALTER TABLE "payload"."cms_orders" ALTER COLUMN "fulfillment_status" SET DEFAULT 'unfulfilled'::text;
  DROP TYPE "payload"."enum_cms_orders_fulfillment_status";
  CREATE TYPE "payload"."enum_cms_orders_fulfillment_status" AS ENUM('unfulfilled', 'in_transit', 'delivered', 'returned', 'cancelled');
  ALTER TABLE "payload"."cms_orders" ALTER COLUMN "fulfillment_status" SET DEFAULT 'unfulfilled'::"payload"."enum_cms_orders_fulfillment_status";
  ALTER TABLE "payload"."cms_orders" ALTER COLUMN "fulfillment_status" SET DATA TYPE "payload"."enum_cms_orders_fulfillment_status" USING "fulfillment_status"::"payload"."enum_cms_orders_fulfillment_status";
  DROP INDEX IF EXISTS "payload"."cms_products_barcode_idx";
  DROP INDEX IF EXISTS "payload"."cms_products_product_type_idx";
  DROP INDEX IF EXISTS "payload"."_cms_products_v_version_version_barcode_idx";
  DROP INDEX IF EXISTS "payload"."_cms_products_v_version_version_product_type_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_webhook_endpoints_id_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_customer_carts_id_idx";
  ALTER TABLE "payload"."cms_pb_deals" ALTER COLUMN "eyebrow" DROP DEFAULT;
  ALTER TABLE "payload"."cms_pb_social" ALTER COLUMN "eyebrow" SET DEFAULT '@urkotechstore';
  ALTER TABLE "payload"."_cms_pb_deals_v" ALTER COLUMN "eyebrow" DROP DEFAULT;
  ALTER TABLE "payload"."_cms_pb_social_v" ALTER COLUMN "eyebrow" SET DEFAULT '@urkotechstore';
  ALTER TABLE "payload"."cms_ss_whatsapp_button" ALTER COLUMN "message" SET DEFAULT 'Hi Urko Tech Store! I need help with an order.';
  ALTER TABLE "payload"."_cms_ss_whatsapp_button_v" ALTER COLUMN "version_message" SET DEFAULT 'Hi Urko Tech Store! I need help with an order.';
  ALTER TABLE "payload"."cms_ss_seo_settings" ALTER COLUMN "title_template" SET DEFAULT '%s | Urko Tech Store';
  ALTER TABLE "payload"."cms_whatsapp_button" ALTER COLUMN "message" SET DEFAULT 'Hi Urko Tech Store! I need help with an order.';
  ALTER TABLE "payload"."_cms_whatsapp_button_v" ALTER COLUMN "version_message" SET DEFAULT 'Hi Urko Tech Store! I need help with an order.';
  ALTER TABLE "payload"."cms_seo_settings" ALTER COLUMN "title_template" SET DEFAULT '%s | Urko Tech Store';
  ALTER TABLE "payload"."cms_products" DROP COLUMN IF EXISTS "barcode";
  ALTER TABLE "payload"."cms_products" DROP COLUMN IF EXISTS "product_type";
  ALTER TABLE "payload"."_cms_products_v" DROP COLUMN IF EXISTS "version_barcode";
  ALTER TABLE "payload"."_cms_products_v" DROP COLUMN IF EXISTS "version_product_type";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN IF EXISTS "marketing_consent";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_webhook_endpoints_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_customer_carts_id";
  DROP TYPE "payload"."enum_cms_orders_shipments_status";
  DROP TYPE "payload"."enum_cms_webhook_endpoints_events";`)
}
