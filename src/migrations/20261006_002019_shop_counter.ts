import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_cms_pos_sales_payments_method" AS ENUM('cash', 'card', 'bank', 'jazzcash', 'easypaisa');
  CREATE TYPE "payload"."enum_cms_pos_sales_status" AS ENUM('completed', 'voided');
  CREATE TYPE "payload"."enum_cms_units_status" AS ENUM('in-stock', 'reserved', 'sold', 'in-repair', 'returned');
  CREATE TABLE "payload"."cms_pos_sales_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" integer,
  	"title" varchar NOT NULL,
  	"unit_id" integer,
  	"serial" varchar,
  	"qty" numeric NOT NULL,
  	"unit_price" numeric NOT NULL
  );
  
  CREATE TABLE "payload"."cms_pos_sales_payments" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"method" "payload"."enum_cms_pos_sales_payments_method" NOT NULL,
  	"amount" numeric NOT NULL
  );
  
  CREATE TABLE "payload"."cms_pos_sales" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"receipt_number" varchar NOT NULL,
  	"status" "payload"."enum_cms_pos_sales_status" DEFAULT 'completed' NOT NULL,
  	"subtotal" numeric NOT NULL,
  	"discount" numeric DEFAULT 0,
  	"total" numeric NOT NULL,
  	"cash_received" numeric,
  	"change" numeric,
  	"customer_name" varchar,
  	"customer_phone" varchar,
  	"cashier_id" integer,
  	"void_reason" varchar,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_cash_ups" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"day" varchar NOT NULL,
  	"opening_float" numeric DEFAULT 0,
  	"expected_cash" numeric,
  	"counted_cash" numeric NOT NULL,
  	"difference" numeric,
  	"by_method" jsonb,
  	"sales_count" numeric,
  	"notes" varchar,
  	"closed_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_units" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"serial" varchar NOT NULL,
  	"product_id" integer NOT NULL,
  	"status" "payload"."enum_cms_units_status" DEFAULT 'in-stock' NOT NULL,
  	"warranty_months" numeric,
  	"condition_notes" varchar,
  	"cost_price" numeric,
  	"received_at" timestamp(3) with time zone,
  	"order_id" integer,
  	"sale_id" integer,
  	"sold_at" timestamp(3) with time zone,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload"."cms_products" ADD COLUMN "track_units" boolean;
  ALTER TABLE "payload"."_cms_products_v" ADD COLUMN "version_track_units" boolean;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_pos_sales_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_cash_ups_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_units_id" integer;
  ALTER TABLE "payload"."cms_pos_sales_items" ADD CONSTRAINT "cms_pos_sales_items_product_id_cms_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "payload"."cms_products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_pos_sales_items" ADD CONSTRAINT "cms_pos_sales_items_unit_id_cms_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "payload"."cms_units"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_pos_sales_items" ADD CONSTRAINT "cms_pos_sales_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_pos_sales"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_pos_sales_payments" ADD CONSTRAINT "cms_pos_sales_payments_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_pos_sales"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_pos_sales" ADD CONSTRAINT "cms_pos_sales_cashier_id_cms_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "payload"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_cash_ups" ADD CONSTRAINT "cms_cash_ups_closed_by_id_cms_users_id_fk" FOREIGN KEY ("closed_by_id") REFERENCES "payload"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_units" ADD CONSTRAINT "cms_units_product_id_cms_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "payload"."cms_products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_units" ADD CONSTRAINT "cms_units_order_id_cms_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "payload"."cms_orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_units" ADD CONSTRAINT "cms_units_sale_id_cms_pos_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "payload"."cms_pos_sales"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "cms_pos_sales_items_order_idx" ON "payload"."cms_pos_sales_items" USING btree ("_order");
  CREATE INDEX "cms_pos_sales_items_parent_id_idx" ON "payload"."cms_pos_sales_items" USING btree ("_parent_id");
  CREATE INDEX "cms_pos_sales_items_product_idx" ON "payload"."cms_pos_sales_items" USING btree ("product_id");
  CREATE INDEX "cms_pos_sales_items_unit_idx" ON "payload"."cms_pos_sales_items" USING btree ("unit_id");
  CREATE INDEX "cms_pos_sales_payments_order_idx" ON "payload"."cms_pos_sales_payments" USING btree ("_order");
  CREATE INDEX "cms_pos_sales_payments_parent_id_idx" ON "payload"."cms_pos_sales_payments" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "cms_pos_sales_receipt_number_idx" ON "payload"."cms_pos_sales" USING btree ("receipt_number");
  CREATE INDEX "cms_pos_sales_status_idx" ON "payload"."cms_pos_sales" USING btree ("status");
  CREATE INDEX "cms_pos_sales_customer_phone_idx" ON "payload"."cms_pos_sales" USING btree ("customer_phone");
  CREATE INDEX "cms_pos_sales_cashier_idx" ON "payload"."cms_pos_sales" USING btree ("cashier_id");
  CREATE INDEX "cms_pos_sales_updated_at_idx" ON "payload"."cms_pos_sales" USING btree ("updated_at");
  CREATE INDEX "cms_pos_sales_created_at_idx" ON "payload"."cms_pos_sales" USING btree ("created_at");
  CREATE INDEX "cms_cash_ups_day_idx" ON "payload"."cms_cash_ups" USING btree ("day");
  CREATE INDEX "cms_cash_ups_closed_by_idx" ON "payload"."cms_cash_ups" USING btree ("closed_by_id");
  CREATE INDEX "cms_cash_ups_updated_at_idx" ON "payload"."cms_cash_ups" USING btree ("updated_at");
  CREATE INDEX "cms_cash_ups_created_at_idx" ON "payload"."cms_cash_ups" USING btree ("created_at");
  CREATE UNIQUE INDEX "cms_units_serial_idx" ON "payload"."cms_units" USING btree ("serial");
  CREATE INDEX "cms_units_product_idx" ON "payload"."cms_units" USING btree ("product_id");
  CREATE INDEX "cms_units_status_idx" ON "payload"."cms_units" USING btree ("status");
  CREATE INDEX "cms_units_order_idx" ON "payload"."cms_units" USING btree ("order_id");
  CREATE INDEX "cms_units_sale_idx" ON "payload"."cms_units" USING btree ("sale_id");
  CREATE INDEX "cms_units_updated_at_idx" ON "payload"."cms_units" USING btree ("updated_at");
  CREATE INDEX "cms_units_created_at_idx" ON "payload"."cms_units" USING btree ("created_at");
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pos_sales_fk" FOREIGN KEY ("cms_pos_sales_id") REFERENCES "payload"."cms_pos_sales"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_cash_ups_fk" FOREIGN KEY ("cms_cash_ups_id") REFERENCES "payload"."cms_cash_ups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_units_fk" FOREIGN KEY ("cms_units_id") REFERENCES "payload"."cms_units"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_cms_pos_sales_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_pos_sales_id");
  CREATE INDEX "payload_locked_documents_rels_cms_cash_ups_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_cash_ups_id");
  CREATE INDEX "payload_locked_documents_rels_cms_units_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_units_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_pos_sales_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_pos_sales_payments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_pos_sales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_cash_ups" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_units" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."cms_pos_sales_items" CASCADE;
  DROP TABLE "payload"."cms_pos_sales_payments" CASCADE;
  DROP TABLE "payload"."cms_pos_sales" CASCADE;
  DROP TABLE "payload"."cms_cash_ups" CASCADE;
  DROP TABLE "payload"."cms_units" CASCADE;
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_pos_sales_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_cash_ups_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_units_fk";
  
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_pos_sales_id_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_cash_ups_id_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_units_id_idx";
  ALTER TABLE "payload"."cms_products" DROP COLUMN "track_units";
  ALTER TABLE "payload"."_cms_products_v" DROP COLUMN "version_track_units";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "cms_pos_sales_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "cms_cash_ups_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "cms_units_id";
  DROP TYPE "payload"."enum_cms_pos_sales_payments_method";
  DROP TYPE "payload"."enum_cms_pos_sales_status";
  DROP TYPE "payload"."enum_cms_units_status";`)
}
