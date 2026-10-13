import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_cms_return_requests_history_status" AS ENUM('requested', 'approved', 'rejected', 'received', 'inspected', 'refunded', 'replaced', 'repaired');
  CREATE TYPE "payload"."enum_cms_return_requests_status" AS ENUM('requested', 'approved', 'rejected', 'received', 'inspected', 'refunded', 'replaced', 'repaired');
  CREATE TYPE "payload"."enum_cms_return_requests_refund_method" AS ENUM('cash', 'bank', 'jazzcash', 'easypaisa', 'credit');
  CREATE TYPE "payload"."enum_cms_warranty_claims_history_status" AS ENUM('open', 'received', 'in-repair', 'repaired', 'replaced', 'rejected', 'returned');
  CREATE TYPE "payload"."enum_cms_warranty_claims_status" AS ENUM('open', 'received', 'in-repair', 'repaired', 'replaced', 'rejected', 'returned');
  CREATE TYPE "payload"."enum_cms_warranty_claims_in_warranty" AS ENUM('yes', 'no', 'unknown');
  CREATE TYPE "payload"."enum_cms_returns_policy_warranty_by_condition_condition" AS ENUM('new', 'used-a-plus', 'used-a', 'refurbished', 'open-box');
  CREATE TABLE "payload"."cms_return_requests_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" integer,
  	"title" varchar NOT NULL,
  	"qty" numeric DEFAULT 1,
  	"unit_price" numeric,
  	"serial" varchar
  );
  
  CREATE TABLE "payload"."cms_return_requests_history" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"status" "payload"."enum_cms_return_requests_history_status",
  	"at" timestamp(3) with time zone,
  	"note" varchar
  );
  
  CREATE TABLE "payload"."cms_return_requests" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"request_number" varchar,
  	"status" "payload"."enum_cms_return_requests_status" DEFAULT 'requested' NOT NULL,
  	"order_number" varchar,
  	"order_id" integer,
  	"customer_name" varchar NOT NULL,
  	"customer_phone" varchar NOT NULL,
  	"reason" varchar NOT NULL,
  	"change_of_mind" boolean,
  	"details" varchar,
  	"photo_keys" jsonb,
  	"rejection_reason" varchar,
  	"inspection_notes" varchar,
  	"refund_method" "payload"."enum_cms_return_requests_refund_method",
  	"refund_amount" numeric,
  	"restock" boolean,
  	"restocked" boolean,
  	"credit_note_number" varchar,
  	"credit_note_date" timestamp(3) with time zone,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_warranty_claims_history" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"status" "payload"."enum_cms_warranty_claims_history_status",
  	"at" timestamp(3) with time zone,
  	"note" varchar
  );
  
  CREATE TABLE "payload"."cms_warranty_claims" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"claim_number" varchar,
  	"status" "payload"."enum_cms_warranty_claims_status" DEFAULT 'open' NOT NULL,
  	"serial" varchar,
  	"order_number" varchar,
  	"product_id" integer,
  	"customer_name" varchar NOT NULL,
  	"customer_phone" varchar NOT NULL,
  	"issue" varchar NOT NULL,
  	"photo_keys" jsonb,
  	"in_warranty" "payload"."enum_cms_warranty_claims_in_warranty",
  	"purchased_at" timestamp(3) with time zone,
  	"warranty_ends_at" timestamp(3) with time zone,
  	"warranty_months" numeric,
  	"check_note" varchar,
  	"recheck" boolean,
  	"unit_id" integer,
  	"order_id" integer,
  	"sale_id" integer,
  	"resolution" varchar,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_returns_policy_reasons" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"change_of_mind" boolean
  );
  
  CREATE TABLE "payload"."cms_returns_policy_warranty_by_condition" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"type" varchar NOT NULL,
  	"condition" "payload"."enum_cms_returns_policy_warranty_by_condition_condition",
  	"months" numeric,
  	"text" varchar,
  	"where" varchar
  );
  
  CREATE TABLE "payload"."cms_returns_policy" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"return_days" numeric DEFAULT 3,
  	"restocking_fee_percent" numeric DEFAULT 0,
  	"require_photos" boolean DEFAULT true,
  	"return_rules" varchar DEFAULT 'Items must be in the original box with all accessories.
  Wrong, damaged or faulty items are replaced free of charge.
  Refunds are sent within 3–5 working days after we inspect the item.',
  	"warranty_rules" varchar DEFAULT 'Warranty covers hardware faults, not physical or liquid damage.
  Keep your receipt or order number.
  Most claims are resolved in 3–7 working days.',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_return_requests_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_warranty_claims_id" integer;
  ALTER TABLE "payload"."cms_return_requests_items" ADD CONSTRAINT "cms_return_requests_items_product_id_cms_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "payload"."cms_products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_return_requests_items" ADD CONSTRAINT "cms_return_requests_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_return_requests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_return_requests_history" ADD CONSTRAINT "cms_return_requests_history_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_return_requests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_return_requests" ADD CONSTRAINT "cms_return_requests_order_id_cms_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "payload"."cms_orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_warranty_claims_history" ADD CONSTRAINT "cms_warranty_claims_history_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_warranty_claims"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_warranty_claims" ADD CONSTRAINT "cms_warranty_claims_product_id_cms_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "payload"."cms_products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_warranty_claims" ADD CONSTRAINT "cms_warranty_claims_unit_id_cms_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "payload"."cms_units"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_warranty_claims" ADD CONSTRAINT "cms_warranty_claims_order_id_cms_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "payload"."cms_orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_warranty_claims" ADD CONSTRAINT "cms_warranty_claims_sale_id_cms_pos_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "payload"."cms_pos_sales"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_returns_policy_reasons" ADD CONSTRAINT "cms_returns_policy_reasons_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_returns_policy"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_returns_policy_warranty_by_condition" ADD CONSTRAINT "cms_returns_policy_warranty_by_condition_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_returns_policy"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "cms_return_requests_items_order_idx" ON "payload"."cms_return_requests_items" USING btree ("_order");
  CREATE INDEX "cms_return_requests_items_parent_id_idx" ON "payload"."cms_return_requests_items" USING btree ("_parent_id");
  CREATE INDEX "cms_return_requests_items_product_idx" ON "payload"."cms_return_requests_items" USING btree ("product_id");
  CREATE INDEX "cms_return_requests_history_order_idx" ON "payload"."cms_return_requests_history" USING btree ("_order");
  CREATE INDEX "cms_return_requests_history_parent_id_idx" ON "payload"."cms_return_requests_history" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "cms_return_requests_request_number_idx" ON "payload"."cms_return_requests" USING btree ("request_number");
  CREATE INDEX "cms_return_requests_status_idx" ON "payload"."cms_return_requests" USING btree ("status");
  CREATE INDEX "cms_return_requests_order_number_idx" ON "payload"."cms_return_requests" USING btree ("order_number");
  CREATE INDEX "cms_return_requests_order_idx" ON "payload"."cms_return_requests" USING btree ("order_id");
  CREATE INDEX "cms_return_requests_customer_phone_idx" ON "payload"."cms_return_requests" USING btree ("customer_phone");
  CREATE INDEX "cms_return_requests_updated_at_idx" ON "payload"."cms_return_requests" USING btree ("updated_at");
  CREATE INDEX "cms_return_requests_created_at_idx" ON "payload"."cms_return_requests" USING btree ("created_at");
  CREATE INDEX "cms_warranty_claims_history_order_idx" ON "payload"."cms_warranty_claims_history" USING btree ("_order");
  CREATE INDEX "cms_warranty_claims_history_parent_id_idx" ON "payload"."cms_warranty_claims_history" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "cms_warranty_claims_claim_number_idx" ON "payload"."cms_warranty_claims" USING btree ("claim_number");
  CREATE INDEX "cms_warranty_claims_status_idx" ON "payload"."cms_warranty_claims" USING btree ("status");
  CREATE INDEX "cms_warranty_claims_serial_idx" ON "payload"."cms_warranty_claims" USING btree ("serial");
  CREATE INDEX "cms_warranty_claims_order_number_idx" ON "payload"."cms_warranty_claims" USING btree ("order_number");
  CREATE INDEX "cms_warranty_claims_product_idx" ON "payload"."cms_warranty_claims" USING btree ("product_id");
  CREATE INDEX "cms_warranty_claims_customer_phone_idx" ON "payload"."cms_warranty_claims" USING btree ("customer_phone");
  CREATE INDEX "cms_warranty_claims_unit_idx" ON "payload"."cms_warranty_claims" USING btree ("unit_id");
  CREATE INDEX "cms_warranty_claims_order_idx" ON "payload"."cms_warranty_claims" USING btree ("order_id");
  CREATE INDEX "cms_warranty_claims_sale_idx" ON "payload"."cms_warranty_claims" USING btree ("sale_id");
  CREATE INDEX "cms_warranty_claims_updated_at_idx" ON "payload"."cms_warranty_claims" USING btree ("updated_at");
  CREATE INDEX "cms_warranty_claims_created_at_idx" ON "payload"."cms_warranty_claims" USING btree ("created_at");
  CREATE INDEX "cms_returns_policy_reasons_order_idx" ON "payload"."cms_returns_policy_reasons" USING btree ("_order");
  CREATE INDEX "cms_returns_policy_reasons_parent_id_idx" ON "payload"."cms_returns_policy_reasons" USING btree ("_parent_id");
  CREATE INDEX "cms_returns_policy_warranty_by_condition_order_idx" ON "payload"."cms_returns_policy_warranty_by_condition" USING btree ("_order");
  CREATE INDEX "cms_returns_policy_warranty_by_condition_parent_id_idx" ON "payload"."cms_returns_policy_warranty_by_condition" USING btree ("_parent_id");
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_return_requests_fk" FOREIGN KEY ("cms_return_requests_id") REFERENCES "payload"."cms_return_requests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_warranty_claims_fk" FOREIGN KEY ("cms_warranty_claims_id") REFERENCES "payload"."cms_warranty_claims"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_cms_return_requests_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_return_requests_id");
  CREATE INDEX "payload_locked_documents_rels_cms_warranty_claims_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_warranty_claims_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_return_requests_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_return_requests_history" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_return_requests" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_warranty_claims_history" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_warranty_claims" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_returns_policy_reasons" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_returns_policy_warranty_by_condition" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_returns_policy" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."cms_return_requests_items" CASCADE;
  DROP TABLE "payload"."cms_return_requests_history" CASCADE;
  DROP TABLE "payload"."cms_return_requests" CASCADE;
  DROP TABLE "payload"."cms_warranty_claims_history" CASCADE;
  DROP TABLE "payload"."cms_warranty_claims" CASCADE;
  DROP TABLE "payload"."cms_returns_policy_reasons" CASCADE;
  DROP TABLE "payload"."cms_returns_policy_warranty_by_condition" CASCADE;
  DROP TABLE "payload"."cms_returns_policy" CASCADE;
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_return_requests_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_warranty_claims_fk";
  
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_return_requests_id_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_warranty_claims_id_idx";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "cms_return_requests_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "cms_warranty_claims_id";
  DROP TYPE "payload"."enum_cms_return_requests_history_status";
  DROP TYPE "payload"."enum_cms_return_requests_status";
  DROP TYPE "payload"."enum_cms_return_requests_refund_method";
  DROP TYPE "payload"."enum_cms_warranty_claims_history_status";
  DROP TYPE "payload"."enum_cms_warranty_claims_status";
  DROP TYPE "payload"."enum_cms_warranty_claims_in_warranty";
  DROP TYPE "payload"."enum_cms_returns_policy_warranty_by_condition_condition";`)
}
