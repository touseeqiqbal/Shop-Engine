import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "payload"."cms_products_variant_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar
  );
  
  CREATE TABLE "payload"."_cms_products_v_version_variant_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"_uuid" varchar
  );
  
  ALTER TABLE "payload"."cms_products" ADD COLUMN "variant_of_id" integer;
  ALTER TABLE "payload"."cms_products" ADD COLUMN "option_values" jsonb;
  ALTER TABLE "payload"."_cms_products_v" ADD COLUMN "version_variant_of_id" integer;
  ALTER TABLE "payload"."_cms_products_v" ADD COLUMN "version_option_values" jsonb;
  ALTER TABLE "payload"."cms_products_variant_options" ADD CONSTRAINT "cms_products_variant_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_products_v_version_variant_options" ADD CONSTRAINT "_cms_products_v_version_variant_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_cms_products_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "cms_products_variant_options_order_idx" ON "payload"."cms_products_variant_options" USING btree ("_order");
  CREATE INDEX "cms_products_variant_options_parent_id_idx" ON "payload"."cms_products_variant_options" USING btree ("_parent_id");
  CREATE INDEX "_cms_products_v_version_variant_options_order_idx" ON "payload"."_cms_products_v_version_variant_options" USING btree ("_order");
  CREATE INDEX "_cms_products_v_version_variant_options_parent_id_idx" ON "payload"."_cms_products_v_version_variant_options" USING btree ("_parent_id");
  ALTER TABLE "payload"."cms_products" ADD CONSTRAINT "cms_products_variant_of_id_cms_products_id_fk" FOREIGN KEY ("variant_of_id") REFERENCES "payload"."cms_products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_products_v" ADD CONSTRAINT "_cms_products_v_version_variant_of_id_cms_products_id_fk" FOREIGN KEY ("version_variant_of_id") REFERENCES "payload"."cms_products"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "cms_products_variant_of_idx" ON "payload"."cms_products" USING btree ("variant_of_id");
  CREATE INDEX "_cms_products_v_version_version_variant_of_idx" ON "payload"."_cms_products_v" USING btree ("version_variant_of_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_products_variant_options" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_cms_products_v_version_variant_options" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."cms_products_variant_options" CASCADE;
  DROP TABLE "payload"."_cms_products_v_version_variant_options" CASCADE;
  ALTER TABLE "payload"."cms_products" DROP CONSTRAINT "cms_products_variant_of_id_cms_products_id_fk";
  
  ALTER TABLE "payload"."_cms_products_v" DROP CONSTRAINT "_cms_products_v_version_variant_of_id_cms_products_id_fk";
  
  DROP INDEX "payload"."cms_products_variant_of_idx";
  DROP INDEX "payload"."_cms_products_v_version_version_variant_of_idx";
  ALTER TABLE "payload"."cms_products" DROP COLUMN "variant_of_id";
  ALTER TABLE "payload"."cms_products" DROP COLUMN "option_values";
  ALTER TABLE "payload"."_cms_products_v" DROP COLUMN "version_variant_of_id";
  ALTER TABLE "payload"."_cms_products_v" DROP COLUMN "version_option_values";`)
}
