import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_cms_purchases_status" AS ENUM('draft', 'received');
  CREATE TYPE "payload"."enum_cms_stock_counts_status" AS ENUM('open', 'finished', 'applied');
  CREATE TABLE "payload"."cms_suppliers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"contact_person" varchar,
  	"phone" varchar,
  	"email" varchar,
  	"city" varchar,
  	"address" varchar,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_purchases_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"qty" numeric DEFAULT 1 NOT NULL,
  	"unit_cost" numeric,
  	"serials" varchar
  );
  
  CREATE TABLE "payload"."cms_purchases" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"supplier_id" integer NOT NULL,
  	"invoice_number" varchar,
  	"date" timestamp(3) with time zone NOT NULL,
  	"status" "payload"."enum_cms_purchases_status" DEFAULT 'draft' NOT NULL,
  	"total" numeric,
  	"update_cost_price" boolean,
  	"notes" varchar,
  	"received_at" timestamp(3) with time zone,
  	"received_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_stock_counts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"status" "payload"."enum_cms_stock_counts_status" DEFAULT 'open' NOT NULL,
  	"category_id" integer,
  	"lines" jsonb,
  	"items_counted" numeric,
  	"variance" numeric,
  	"started_by_id" integer,
  	"finished_at" timestamp(3) with time zone,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_suppliers_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_purchases_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_stock_counts_id" integer;
  ALTER TABLE "payload"."cms_purchases_lines" ADD CONSTRAINT "cms_purchases_lines_product_id_cms_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "payload"."cms_products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_purchases_lines" ADD CONSTRAINT "cms_purchases_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_purchases"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_purchases" ADD CONSTRAINT "cms_purchases_supplier_id_cms_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "payload"."cms_suppliers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_purchases" ADD CONSTRAINT "cms_purchases_received_by_id_cms_users_id_fk" FOREIGN KEY ("received_by_id") REFERENCES "payload"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_stock_counts" ADD CONSTRAINT "cms_stock_counts_category_id_cms_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "payload"."cms_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_stock_counts" ADD CONSTRAINT "cms_stock_counts_started_by_id_cms_users_id_fk" FOREIGN KEY ("started_by_id") REFERENCES "payload"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "cms_suppliers_updated_at_idx" ON "payload"."cms_suppliers" USING btree ("updated_at");
  CREATE INDEX "cms_suppliers_created_at_idx" ON "payload"."cms_suppliers" USING btree ("created_at");
  CREATE INDEX "cms_purchases_lines_order_idx" ON "payload"."cms_purchases_lines" USING btree ("_order");
  CREATE INDEX "cms_purchases_lines_parent_id_idx" ON "payload"."cms_purchases_lines" USING btree ("_parent_id");
  CREATE INDEX "cms_purchases_lines_product_idx" ON "payload"."cms_purchases_lines" USING btree ("product_id");
  CREATE INDEX "cms_purchases_supplier_idx" ON "payload"."cms_purchases" USING btree ("supplier_id");
  CREATE INDEX "cms_purchases_received_by_idx" ON "payload"."cms_purchases" USING btree ("received_by_id");
  CREATE INDEX "cms_purchases_updated_at_idx" ON "payload"."cms_purchases" USING btree ("updated_at");
  CREATE INDEX "cms_purchases_created_at_idx" ON "payload"."cms_purchases" USING btree ("created_at");
  CREATE INDEX "cms_stock_counts_category_idx" ON "payload"."cms_stock_counts" USING btree ("category_id");
  CREATE INDEX "cms_stock_counts_started_by_idx" ON "payload"."cms_stock_counts" USING btree ("started_by_id");
  CREATE INDEX "cms_stock_counts_updated_at_idx" ON "payload"."cms_stock_counts" USING btree ("updated_at");
  CREATE INDEX "cms_stock_counts_created_at_idx" ON "payload"."cms_stock_counts" USING btree ("created_at");
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_suppliers_fk" FOREIGN KEY ("cms_suppliers_id") REFERENCES "payload"."cms_suppliers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_purchases_fk" FOREIGN KEY ("cms_purchases_id") REFERENCES "payload"."cms_purchases"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_stock_counts_fk" FOREIGN KEY ("cms_stock_counts_id") REFERENCES "payload"."cms_stock_counts"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_cms_suppliers_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_suppliers_id");
  CREATE INDEX "payload_locked_documents_rels_cms_purchases_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_purchases_id");
  CREATE INDEX "payload_locked_documents_rels_cms_stock_counts_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_stock_counts_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_suppliers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_purchases_lines" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_purchases" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_stock_counts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."cms_suppliers" CASCADE;
  DROP TABLE "payload"."cms_purchases_lines" CASCADE;
  DROP TABLE "payload"."cms_purchases" CASCADE;
  DROP TABLE "payload"."cms_stock_counts" CASCADE;
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_suppliers_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_purchases_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_stock_counts_fk";
  
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_suppliers_id_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_purchases_id_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_stock_counts_id_idx";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "cms_suppliers_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "cms_purchases_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "cms_stock_counts_id";
  DROP TYPE "payload"."enum_cms_purchases_status";
  DROP TYPE "payload"."enum_cms_stock_counts_status";`)
}
