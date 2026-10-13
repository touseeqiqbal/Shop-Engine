import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "payload"."cms_sales_channels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"google" boolean DEFAULT true,
  	"meta" boolean DEFAULT true,
  	"tiktok" boolean DEFAULT true,
  	"include_out_of_stock" boolean DEFAULT true,
  	"shipping_price" numeric,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload"."cms_sales_channels_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"cms_categories_id" integer,
  	"cms_products_id" integer
  );
  
  ALTER TABLE "payload"."cms_sales_channels_rels" ADD CONSTRAINT "cms_sales_channels_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_sales_channels"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_sales_channels_rels" ADD CONSTRAINT "cms_sales_channels_rels_categories_fk" FOREIGN KEY ("cms_categories_id") REFERENCES "payload"."cms_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_sales_channels_rels" ADD CONSTRAINT "cms_sales_channels_rels_products_fk" FOREIGN KEY ("cms_products_id") REFERENCES "payload"."cms_products"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "cms_sales_channels_rels_order_idx" ON "payload"."cms_sales_channels_rels" USING btree ("order");
  CREATE INDEX "cms_sales_channels_rels_parent_idx" ON "payload"."cms_sales_channels_rels" USING btree ("parent_id");
  CREATE INDEX "cms_sales_channels_rels_path_idx" ON "payload"."cms_sales_channels_rels" USING btree ("path");
  CREATE INDEX "cms_sales_channels_rels_cms_categories_id_idx" ON "payload"."cms_sales_channels_rels" USING btree ("cms_categories_id");
  CREATE INDEX "cms_sales_channels_rels_cms_products_id_idx" ON "payload"."cms_sales_channels_rels" USING btree ("cms_products_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "payload"."cms_sales_channels" CASCADE;
  DROP TABLE "payload"."cms_sales_channels_rels" CASCADE;`)
}
