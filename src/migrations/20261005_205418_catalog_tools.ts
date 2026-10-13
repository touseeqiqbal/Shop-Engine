import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_cms_products_stock_status" AS ENUM('in', 'low', 'out');
  CREATE TYPE "payload"."enum__cms_products_v_version_stock_status" AS ENUM('in', 'low', 'out');
  CREATE TYPE "payload"."enum_cms_collections_rules_field" AS ENUM('category', 'brand', 'condition', 'tag', 'priceMax', 'priceMin', 'onSale', 'hotDeal', 'bestSeller', 'featured', 'inStock');
  CREATE TYPE "payload"."enum_cms_collections_type" AS ENUM('manual', 'automatic');
  CREATE TYPE "payload"."enum_cms_collections_match" AS ENUM('all', 'any');
  CREATE TYPE "payload"."enum_cms_collections_sort" AS ENUM('manual', 'popular', 'newest', 'price-asc', 'price-desc');
  CREATE TYPE "payload"."enum_cms_exports_format" AS ENUM('csv', 'json');
  CREATE TYPE "payload"."enum_cms_exports_sort_order" AS ENUM('asc', 'desc');
  CREATE TYPE "payload"."enum_cms_exports_drafts" AS ENUM('yes', 'no');
  CREATE TYPE "payload"."enum_cms_imports_import_mode" AS ENUM('create', 'update', 'upsert');
  CREATE TYPE "payload"."enum_cms_imports_status" AS ENUM('pending', 'completed', 'partial', 'failed');
  ALTER TYPE "payload"."enum_cms_pb_prods_source" ADD VALUE 'collection' BEFORE 'manual';
  ALTER TYPE "payload"."enum__cms_pb_prods_v_source" ADD VALUE 'collection' BEFORE 'manual';
  ALTER TYPE "payload"."enum_payload_jobs_log_task_slug" ADD VALUE 'createCollectionExport' BEFORE 'schedulePublish';
  ALTER TYPE "payload"."enum_payload_jobs_log_task_slug" ADD VALUE 'createCollectionImport' BEFORE 'schedulePublish';
  ALTER TYPE "payload"."enum_payload_jobs_task_slug" ADD VALUE 'createCollectionExport' BEFORE 'schedulePublish';
  ALTER TYPE "payload"."enum_payload_jobs_task_slug" ADD VALUE 'createCollectionImport' BEFORE 'schedulePublish';
  CREATE TABLE "payload"."cms_collections_rules" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"field" "payload"."enum_cms_collections_rules_field",
  	"category_id" integer,
  	"brand_id" integer,
  	"value" varchar
  );
  
  CREATE TABLE "payload"."cms_collections" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"image_id" integer,
  	"type" "payload"."enum_cms_collections_type" DEFAULT 'manual',
  	"match" "payload"."enum_cms_collections_match" DEFAULT 'all',
  	"sort" "payload"."enum_cms_collections_sort" DEFAULT 'manual',
  	"limit" numeric,
  	"published" boolean DEFAULT true,
  	"slug" varchar NOT NULL,
  	"legacy_id" varchar,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"meta_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_collections_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"cms_products_id" integer
  );
  
  CREATE TABLE "payload"."cms_exports" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"format" "payload"."enum_cms_exports_format" DEFAULT 'csv' NOT NULL,
  	"limit" numeric,
  	"page" numeric DEFAULT 1,
  	"sort" varchar,
  	"sort_order" "payload"."enum_cms_exports_sort_order",
  	"drafts" "payload"."enum_cms_exports_drafts" DEFAULT 'yes',
  	"collection_slug" varchar DEFAULT 'products' NOT NULL,
  	"where" jsonb DEFAULT '{}'::jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "payload"."cms_exports_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "payload"."cms_imports" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"collection_slug" varchar DEFAULT 'products' NOT NULL,
  	"import_mode" "payload"."enum_cms_imports_import_mode",
  	"match_field" varchar DEFAULT 'id',
  	"status" "payload"."enum_cms_imports_status" DEFAULT 'pending',
  	"summary_imported" numeric,
  	"summary_updated" numeric,
  	"summary_total" numeric,
  	"summary_issues" numeric,
  	"summary_issue_details" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  ALTER TABLE "payload"."cms_products" ADD COLUMN "unit" varchar;
  ALTER TABLE "payload"."cms_products" ADD COLUMN "stock_status" "payload"."enum_cms_products_stock_status";
  ALTER TABLE "payload"."_cms_products_v" ADD COLUMN "version_unit" varchar;
  ALTER TABLE "payload"."_cms_products_v" ADD COLUMN "version_stock_status" "payload"."enum__cms_products_v_version_stock_status";
  ALTER TABLE "payload"."cms_pb_prods" ADD COLUMN "collection_id" integer;
  ALTER TABLE "payload"."_cms_pb_prods_v" ADD COLUMN "collection_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_collections_id" integer;
  ALTER TABLE "payload"."cms_collections_rules" ADD CONSTRAINT "cms_collections_rules_category_id_cms_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "payload"."cms_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_collections_rules" ADD CONSTRAINT "cms_collections_rules_brand_id_cms_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "payload"."cms_brands"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_collections_rules" ADD CONSTRAINT "cms_collections_rules_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_collections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_collections" ADD CONSTRAINT "cms_collections_image_id_cms_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_collections" ADD CONSTRAINT "cms_collections_meta_image_id_cms_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_collections_rels" ADD CONSTRAINT "cms_collections_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_collections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_collections_rels" ADD CONSTRAINT "cms_collections_rels_products_fk" FOREIGN KEY ("cms_products_id") REFERENCES "payload"."cms_products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_exports_texts" ADD CONSTRAINT "cms_exports_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_exports"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "cms_collections_rules_order_idx" ON "payload"."cms_collections_rules" USING btree ("_order");
  CREATE INDEX "cms_collections_rules_parent_id_idx" ON "payload"."cms_collections_rules" USING btree ("_parent_id");
  CREATE INDEX "cms_collections_rules_category_idx" ON "payload"."cms_collections_rules" USING btree ("category_id");
  CREATE INDEX "cms_collections_rules_brand_idx" ON "payload"."cms_collections_rules" USING btree ("brand_id");
  CREATE INDEX "cms_collections_image_idx" ON "payload"."cms_collections" USING btree ("image_id");
  CREATE UNIQUE INDEX "cms_collections_slug_idx" ON "payload"."cms_collections" USING btree ("slug");
  CREATE UNIQUE INDEX "cms_collections_legacy_id_idx" ON "payload"."cms_collections" USING btree ("legacy_id");
  CREATE INDEX "cms_collections_meta_meta_image_idx" ON "payload"."cms_collections" USING btree ("meta_image_id");
  CREATE INDEX "cms_collections_updated_at_idx" ON "payload"."cms_collections" USING btree ("updated_at");
  CREATE INDEX "cms_collections_created_at_idx" ON "payload"."cms_collections" USING btree ("created_at");
  CREATE INDEX "cms_collections_rels_order_idx" ON "payload"."cms_collections_rels" USING btree ("order");
  CREATE INDEX "cms_collections_rels_parent_idx" ON "payload"."cms_collections_rels" USING btree ("parent_id");
  CREATE INDEX "cms_collections_rels_path_idx" ON "payload"."cms_collections_rels" USING btree ("path");
  CREATE INDEX "cms_collections_rels_cms_products_id_idx" ON "payload"."cms_collections_rels" USING btree ("cms_products_id");
  CREATE INDEX "cms_exports_updated_at_idx" ON "payload"."cms_exports" USING btree ("updated_at");
  CREATE INDEX "cms_exports_created_at_idx" ON "payload"."cms_exports" USING btree ("created_at");
  CREATE UNIQUE INDEX "cms_exports_filename_idx" ON "payload"."cms_exports" USING btree ("filename");
  CREATE INDEX "cms_exports_texts_order_parent" ON "payload"."cms_exports_texts" USING btree ("order","parent_id");
  CREATE INDEX "cms_imports_updated_at_idx" ON "payload"."cms_imports" USING btree ("updated_at");
  CREATE INDEX "cms_imports_created_at_idx" ON "payload"."cms_imports" USING btree ("created_at");
  CREATE UNIQUE INDEX "cms_imports_filename_idx" ON "payload"."cms_imports" USING btree ("filename");
  ALTER TABLE "payload"."cms_pb_prods" ADD CONSTRAINT "cms_pb_prods_collection_id_cms_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "payload"."cms_collections"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_pb_prods_v" ADD CONSTRAINT "_cms_pb_prods_v_collection_id_cms_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "payload"."cms_collections"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_product_collections_fk" FOREIGN KEY ("cms_collections_id") REFERENCES "payload"."cms_collections"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "cms_products_stock_status_idx" ON "payload"."cms_products" USING btree ("stock_status");
  CREATE INDEX "_cms_products_v_version_version_stock_status_idx" ON "payload"."_cms_products_v" USING btree ("version_stock_status");
  CREATE INDEX "cms_pb_prods_collection_idx" ON "payload"."cms_pb_prods" USING btree ("collection_id");
  CREATE INDEX "_cms_pb_prods_v_collection_idx" ON "payload"."_cms_pb_prods_v" USING btree ("collection_id");
  CREATE INDEX "payload_locked_documents_rels_cms_collections_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_collections_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_collections_rules" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_collections" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_collections_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_exports" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_exports_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_imports" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."cms_collections_rules" CASCADE;
  DROP TABLE "payload"."cms_collections" CASCADE;
  DROP TABLE "payload"."cms_collections_rels" CASCADE;
  DROP TABLE "payload"."cms_exports" CASCADE;
  DROP TABLE "payload"."cms_exports_texts" CASCADE;
  DROP TABLE "payload"."cms_imports" CASCADE;
  ALTER TABLE "payload"."cms_pb_prods" DROP CONSTRAINT IF EXISTS "cms_pb_prods_collection_id_cms_collections_id_fk";
  
  ALTER TABLE "payload"."_cms_pb_prods_v" DROP CONSTRAINT IF EXISTS "_cms_pb_prods_v_collection_id_cms_collections_id_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_product_collections_fk";
  
  ALTER TABLE "payload"."cms_pb_prods" ALTER COLUMN "source" SET DATA TYPE text;
  ALTER TABLE "payload"."cms_pb_prods" ALTER COLUMN "source" SET DEFAULT 'newArrivals'::text;
  DROP TYPE "payload"."enum_cms_pb_prods_source";
  CREATE TYPE "payload"."enum_cms_pb_prods_source" AS ENUM('newArrivals', 'bestSellers', 'topAccessories', 'category', 'manual');
  ALTER TABLE "payload"."cms_pb_prods" ALTER COLUMN "source" SET DEFAULT 'newArrivals'::"payload"."enum_cms_pb_prods_source";
  ALTER TABLE "payload"."cms_pb_prods" ALTER COLUMN "source" SET DATA TYPE "payload"."enum_cms_pb_prods_source" USING "source"::"payload"."enum_cms_pb_prods_source";
  ALTER TABLE "payload"."_cms_pb_prods_v" ALTER COLUMN "source" SET DATA TYPE text;
  ALTER TABLE "payload"."_cms_pb_prods_v" ALTER COLUMN "source" SET DEFAULT 'newArrivals'::text;
  DROP TYPE "payload"."enum__cms_pb_prods_v_source";
  CREATE TYPE "payload"."enum__cms_pb_prods_v_source" AS ENUM('newArrivals', 'bestSellers', 'topAccessories', 'category', 'manual');
  ALTER TABLE "payload"."_cms_pb_prods_v" ALTER COLUMN "source" SET DEFAULT 'newArrivals'::"payload"."enum__cms_pb_prods_v_source";
  ALTER TABLE "payload"."_cms_pb_prods_v" ALTER COLUMN "source" SET DATA TYPE "payload"."enum__cms_pb_prods_v_source" USING "source"::"payload"."enum__cms_pb_prods_v_source";
  ALTER TABLE "payload"."payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "payload"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "payload"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'schedulePublish');
  ALTER TABLE "payload"."payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "payload"."enum_payload_jobs_log_task_slug" USING "task_slug"::"payload"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload"."payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "payload"."enum_payload_jobs_task_slug";
  CREATE TYPE "payload"."enum_payload_jobs_task_slug" AS ENUM('inline', 'schedulePublish');
  ALTER TABLE "payload"."payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "payload"."enum_payload_jobs_task_slug" USING "task_slug"::"payload"."enum_payload_jobs_task_slug";
  DROP INDEX "payload"."cms_products_stock_status_idx";
  DROP INDEX "payload"."_cms_products_v_version_version_stock_status_idx";
  DROP INDEX "payload"."cms_pb_prods_collection_idx";
  DROP INDEX "payload"."_cms_pb_prods_v_collection_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_cms_collections_id_idx";
  ALTER TABLE "payload"."cms_products" DROP COLUMN "unit";
  ALTER TABLE "payload"."cms_products" DROP COLUMN "stock_status";
  ALTER TABLE "payload"."_cms_products_v" DROP COLUMN "version_unit";
  ALTER TABLE "payload"."_cms_products_v" DROP COLUMN "version_stock_status";
  ALTER TABLE "payload"."cms_pb_prods" DROP COLUMN "collection_id";
  ALTER TABLE "payload"."_cms_pb_prods_v" DROP COLUMN "collection_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "cms_collections_id";
  DROP TYPE "payload"."enum_cms_products_stock_status";
  DROP TYPE "payload"."enum__cms_products_v_version_stock_status";
  DROP TYPE "payload"."enum_cms_collections_rules_field";
  DROP TYPE "payload"."enum_cms_collections_type";
  DROP TYPE "payload"."enum_cms_collections_match";
  DROP TYPE "payload"."enum_cms_collections_sort";
  DROP TYPE "payload"."enum_cms_exports_format";
  DROP TYPE "payload"."enum_cms_exports_sort_order";
  DROP TYPE "payload"."enum_cms_exports_drafts";
  DROP TYPE "payload"."enum_cms_imports_import_mode";
  DROP TYPE "payload"."enum_cms_imports_status";`)
}
