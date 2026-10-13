import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_cms_menus_items_children_links_type" AS ENUM('category', 'product', 'post', 'custom');
  CREATE TABLE "payload"."cms_menus_items_children_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"type" "payload"."enum_cms_menus_items_children_links_type" DEFAULT 'custom' NOT NULL,
  	"label" varchar,
  	"new_tab" boolean,
  	"category_id" integer,
  	"product_id" integer,
  	"post_id" integer,
  	"url" varchar
  );
  
  DROP TABLE "payload"."cms_menus_items_children_children" CASCADE;
  ALTER TABLE "payload"."cms_menus_items_children_links" ADD CONSTRAINT "cms_menus_items_children_links_category_id_cms_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "payload"."cms_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_menus_items_children_links" ADD CONSTRAINT "cms_menus_items_children_links_product_id_cms_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "payload"."cms_products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_menus_items_children_links" ADD CONSTRAINT "cms_menus_items_children_links_post_id_cms_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "payload"."cms_posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_menus_items_children_links" ADD CONSTRAINT "cms_menus_items_children_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_menus_items_children"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "cms_menus_items_children_links_order_idx" ON "payload"."cms_menus_items_children_links" USING btree ("_order");
  CREATE INDEX "cms_menus_items_children_links_parent_id_idx" ON "payload"."cms_menus_items_children_links" USING btree ("_parent_id");
  CREATE INDEX "cms_menus_items_children_links_category_idx" ON "payload"."cms_menus_items_children_links" USING btree ("category_id");
  CREATE INDEX "cms_menus_items_children_links_product_idx" ON "payload"."cms_menus_items_children_links" USING btree ("product_id");
  CREATE INDEX "cms_menus_items_children_links_post_idx" ON "payload"."cms_menus_items_children_links" USING btree ("post_id");
  DROP TYPE "payload"."enum_cms_menus_items_children_children_type";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_cms_menus_items_children_children_type" AS ENUM('category', 'product', 'post', 'custom');
  CREATE TABLE "payload"."cms_menus_items_children_children" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"type" "payload"."enum_cms_menus_items_children_children_type" DEFAULT 'custom' NOT NULL,
  	"label" varchar,
  	"new_tab" boolean,
  	"category_id" integer,
  	"product_id" integer,
  	"post_id" integer,
  	"url" varchar
  );
  
  DROP TABLE "payload"."cms_menus_items_children_links" CASCADE;
  ALTER TABLE "payload"."cms_menus_items_children_children" ADD CONSTRAINT "cms_menus_items_children_children_category_id_cms_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "payload"."cms_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_menus_items_children_children" ADD CONSTRAINT "cms_menus_items_children_children_product_id_cms_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "payload"."cms_products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_menus_items_children_children" ADD CONSTRAINT "cms_menus_items_children_children_post_id_cms_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "payload"."cms_posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_menus_items_children_children" ADD CONSTRAINT "cms_menus_items_children_children_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_menus_items_children"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "cms_menus_items_children_children_order_idx" ON "payload"."cms_menus_items_children_children" USING btree ("_order");
  CREATE INDEX "cms_menus_items_children_children_parent_id_idx" ON "payload"."cms_menus_items_children_children" USING btree ("_parent_id");
  CREATE INDEX "cms_menus_items_children_children_category_idx" ON "payload"."cms_menus_items_children_children" USING btree ("category_id");
  CREATE INDEX "cms_menus_items_children_children_product_idx" ON "payload"."cms_menus_items_children_children" USING btree ("product_id");
  CREATE INDEX "cms_menus_items_children_children_post_idx" ON "payload"."cms_menus_items_children_children" USING btree ("post_id");
  DROP TYPE "payload"."enum_cms_menus_items_children_links_type";`)
}
