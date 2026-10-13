import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_cms_stock_movements_reason" AS ENUM('order', 'order-edited', 'order-cancelled', 'order-reopened', 'order-deleted', 'return', 'pos-sale', 'pos-void', 'purchase', 'stock-count', 'units', 'edited', 'new-product', 'other');
  CREATE TYPE "payload"."enum_cms_activity_log_action" AS ENUM('create', 'update', 'delete');
  CREATE TABLE "payload"."cms_stock_movements" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"product_id" integer,
  	"product_title" varchar,
  	"change" numeric,
  	"stock_after" numeric,
  	"reason" "payload"."enum_cms_stock_movements_reason",
  	"reference" varchar,
  	"serial" varchar,
  	"by_id" integer,
  	"by_email" varchar,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_activity_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer,
  	"user_email" varchar,
  	"action" "payload"."enum_cms_activity_log_action",
  	"entity" varchar,
  	"entity_label" varchar,
  	"doc_id" varchar,
  	"title" varchar,
  	"summary" varchar,
  	"changes" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload"."cms_orders_items" ADD COLUMN "unit_cost" numeric;
  ALTER TABLE "payload"."cms_pos_sales_items" ADD COLUMN "unit_cost" numeric;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_stock_movements_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_activity_log_id" integer;
  ALTER TABLE "payload"."cms_stock_movements" ADD CONSTRAINT "cms_stock_movements_product_id_cms_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "payload"."cms_products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_stock_movements" ADD CONSTRAINT "cms_stock_movements_by_id_cms_users_id_fk" FOREIGN KEY ("by_id") REFERENCES "payload"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_activity_log" ADD CONSTRAINT "cms_activity_log_user_id_cms_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "payload"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "cms_stock_movements_product_idx" ON "payload"."cms_stock_movements" USING btree ("product_id");
  CREATE INDEX "cms_stock_movements_reason_idx" ON "payload"."cms_stock_movements" USING btree ("reason");
  CREATE INDEX "cms_stock_movements_reference_idx" ON "payload"."cms_stock_movements" USING btree ("reference");
  CREATE INDEX "cms_stock_movements_by_idx" ON "payload"."cms_stock_movements" USING btree ("by_id");
  CREATE INDEX "cms_stock_movements_updated_at_idx" ON "payload"."cms_stock_movements" USING btree ("updated_at");
  CREATE INDEX "cms_stock_movements_created_at_idx" ON "payload"."cms_stock_movements" USING btree ("created_at");
  CREATE INDEX "cms_activity_log_user_idx" ON "payload"."cms_activity_log" USING btree ("user_id");
  CREATE INDEX "cms_activity_log_action_idx" ON "payload"."cms_activity_log" USING btree ("action");
  CREATE INDEX "cms_activity_log_entity_idx" ON "payload"."cms_activity_log" USING btree ("entity");
  CREATE INDEX "cms_activity_log_doc_id_idx" ON "payload"."cms_activity_log" USING btree ("doc_id");
  CREATE INDEX "cms_activity_log_updated_at_idx" ON "payload"."cms_activity_log" USING btree ("updated_at");
  CREATE INDEX "cms_activity_log_created_at_idx" ON "payload"."cms_activity_log" USING btree ("created_at");
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_stock_movements_fk" FOREIGN KEY ("cms_stock_movements_id") REFERENCES "payload"."cms_stock_movements"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_activity_log_fk" FOREIGN KEY ("cms_activity_log_id") REFERENCES "payload"."cms_activity_log"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_cms_stock_movements_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_stock_movements_id");
  CREATE INDEX "payload_locked_documents_rels_cms_activity_log_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_activity_log_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_stock_movements" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_activity_log" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."cms_stock_movements" CASCADE;
  DROP TABLE "payload"."cms_activity_log" CASCADE;
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_stock_movements_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_activity_log_fk";
  
  DROP INDEX "payload"."payload_locked_documents_rels_cms_stock_movements_id_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_cms_activity_log_id_idx";
  ALTER TABLE "payload"."cms_orders_items" DROP COLUMN "unit_cost";
  ALTER TABLE "payload"."cms_pos_sales_items" DROP COLUMN "unit_cost";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "cms_stock_movements_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "cms_activity_log_id";
  DROP TYPE "payload"."enum_cms_stock_movements_reason";
  DROP TYPE "payload"."enum_cms_activity_log_action";`)
}
