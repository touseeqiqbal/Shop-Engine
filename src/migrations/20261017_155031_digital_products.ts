import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "payload"."cms_digital_files" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_id" integer,
  	"title" varchar NOT NULL,
  	"prefix" varchar DEFAULT 'downloads',
  	"_objectkey" varchar,
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
  
  ALTER TABLE "payload"."cms_products" ADD COLUMN "digital_no_shipping" boolean;
  ALTER TABLE "payload"."cms_products" ADD COLUMN "digital_download_limit" numeric DEFAULT 5;
  ALTER TABLE "payload"."cms_products" ADD COLUMN "digital_download_days" numeric DEFAULT 30;
  ALTER TABLE "payload"."cms_products_rels" ADD COLUMN "cms_digital_files_id" integer;
  ALTER TABLE "payload"."_cms_products_v" ADD COLUMN "version_digital_no_shipping" boolean;
  ALTER TABLE "payload"."_cms_products_v" ADD COLUMN "version_digital_download_limit" numeric DEFAULT 5;
  ALTER TABLE "payload"."_cms_products_v" ADD COLUMN "version_digital_download_days" numeric DEFAULT 30;
  ALTER TABLE "payload"."_cms_products_v_rels" ADD COLUMN "cms_digital_files_id" integer;
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "download_counts" jsonb;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_digital_files_id" integer;
  ALTER TABLE "payload"."cms_digital_files" ADD CONSTRAINT "cms_digital_files_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "cms_digital_files_store_idx" ON "payload"."cms_digital_files" USING btree ("store_id");
  CREATE INDEX "cms_digital_files_updated_at_idx" ON "payload"."cms_digital_files" USING btree ("updated_at");
  CREATE INDEX "cms_digital_files_created_at_idx" ON "payload"."cms_digital_files" USING btree ("created_at");
  CREATE UNIQUE INDEX "cms_digital_files_filename_idx" ON "payload"."cms_digital_files" USING btree ("filename");
  ALTER TABLE "payload"."cms_products_rels" ADD CONSTRAINT "cms_products_rels_digital_files_fk" FOREIGN KEY ("cms_digital_files_id") REFERENCES "payload"."cms_digital_files"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_products_v_rels" ADD CONSTRAINT "_cms_products_v_rels_digital_files_fk" FOREIGN KEY ("cms_digital_files_id") REFERENCES "payload"."cms_digital_files"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_digital_files_fk" FOREIGN KEY ("cms_digital_files_id") REFERENCES "payload"."cms_digital_files"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "cms_products_rels_cms_digital_files_id_idx" ON "payload"."cms_products_rels" USING btree ("cms_digital_files_id");
  CREATE INDEX "_cms_products_v_rels_cms_digital_files_id_idx" ON "payload"."_cms_products_v_rels" USING btree ("cms_digital_files_id");
  CREATE INDEX "payload_locked_documents_rels_cms_digital_files_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_digital_files_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload"."cms_products_rels" DROP CONSTRAINT IF EXISTS "cms_products_rels_digital_files_fk";
  ALTER TABLE "payload"."_cms_products_v_rels" DROP CONSTRAINT IF EXISTS "_cms_products_v_rels_digital_files_fk";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_digital_files_fk";
  DROP INDEX IF EXISTS "payload"."cms_products_rels_cms_digital_files_id_idx";
  DROP INDEX IF EXISTS "payload"."_cms_products_v_rels_cms_digital_files_id_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_digital_files_id_idx";
  ALTER TABLE "payload"."cms_products" DROP COLUMN IF EXISTS "digital_no_shipping";
  ALTER TABLE "payload"."cms_products" DROP COLUMN IF EXISTS "digital_download_limit";
  ALTER TABLE "payload"."cms_products" DROP COLUMN IF EXISTS "digital_download_days";
  ALTER TABLE "payload"."cms_products_rels" DROP COLUMN IF EXISTS "cms_digital_files_id";
  ALTER TABLE "payload"."_cms_products_v" DROP COLUMN IF EXISTS "version_digital_no_shipping";
  ALTER TABLE "payload"."_cms_products_v" DROP COLUMN IF EXISTS "version_digital_download_limit";
  ALTER TABLE "payload"."_cms_products_v" DROP COLUMN IF EXISTS "version_digital_download_days";
  ALTER TABLE "payload"."_cms_products_v_rels" DROP COLUMN IF EXISTS "cms_digital_files_id";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN IF EXISTS "download_counts";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_digital_files_id";
  DROP TABLE IF EXISTS "payload"."cms_digital_files" CASCADE;`)
}
