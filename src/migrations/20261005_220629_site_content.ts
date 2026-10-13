import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_cms_pb_hero_slides_accent" AS ENUM('from-blue-500 to-violet-500', 'from-violet-500 to-fuchsia-500', 'from-cyan-500 to-blue-500');
  CREATE TYPE "payload"."enum__cms_pb_hero_v_slides_accent" AS ENUM('from-blue-500 to-violet-500', 'from-violet-500 to-fuchsia-500', 'from-cyan-500 to-blue-500');
  CREATE TYPE "payload"."enum_cms_store_info_hours_days" AS ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');
  CREATE TYPE "payload"."enum_cms_seo_settings_pages_page" AS ENUM('/', '/shop', '/category', '/deals', '/find-parts', '/brands', '/wholesale', '/blog', '/about', '/contact', '/faqs', '/track-order', '/shipping-policy', '/warranty-returns', '/privacy-policy', '/terms', '/installments', '/compare', '/cart', '/laptops-in-{city}', '/brands/{brand}');
  CREATE TYPE "payload"."enum_cms_seo_settings_pages_indexing" AS ENUM('default', 'index', 'noindex');
  CREATE TYPE "payload"."enum_cms_page_texts_pages_page" AS ENUM('/shop', '/category', '/deals', '/find-parts', '/brands', '/blog', '/about', '/shipping-policy', '/warranty-returns', '/privacy-policy', '/terms', '/installments');
  CREATE TABLE "payload"."cms_store_info_phones" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"display" varchar NOT NULL,
  	"tel" varchar,
  	"wa" varchar
  );
  
  CREATE TABLE "payload"."cms_store_info_hours_days" (
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"value" "payload"."enum_cms_store_info_hours_days",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "payload"."cms_store_info_hours" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"opens" varchar,
  	"closes" varchar
  );
  
  CREATE TABLE "payload"."cms_store_info" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"short_name" varchar,
  	"tagline" varchar,
  	"description" varchar,
  	"email" varchar,
  	"address_street" varchar,
  	"address_area" varchar,
  	"address_city" varchar,
  	"address_region" varchar,
  	"address_postal_code" varchar,
  	"address_country" varchar,
  	"address_country_code" varchar,
  	"address_full" varchar,
  	"geo_lat" numeric,
  	"geo_lng" numeric,
  	"map_link" varchar,
  	"map_embed" varchar,
  	"hours_display" varchar,
  	"whatsapp_note" varchar,
  	"social_facebook" varchar,
  	"social_instagram" varchar,
  	"social_tiktok" varchar,
  	"social_youtube" varchar,
  	"social_x" varchar,
  	"social_linkedin" varchar,
  	"social_pinterest" varchar,
  	"social_threads" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload"."cms_store_info_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "payload"."cms_seo_settings_pages" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"page" "payload"."enum_cms_seo_settings_pages_page" NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"og_image" varchar,
  	"indexing" "payload"."enum_cms_seo_settings_pages_indexing" DEFAULT 'default'
  );
  
  CREATE TABLE "payload"."cms_seo_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title_template" varchar DEFAULT '%s | Urko Tech Store',
  	"default_title" varchar,
  	"default_description" varchar,
  	"default_og_image" varchar,
  	"discourage_indexing" boolean,
  	"google_verification" varchar,
  	"bing_verification" varchar,
  	"facebook_verification" varchar,
  	"ga4_id" varchar,
  	"meta_pixel_id" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload"."cms_seo_settings_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "payload"."cms_page_texts_pages" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"page" "payload"."enum_cms_page_texts_pages_page" NOT NULL,
  	"eyebrow" varchar,
  	"title" varchar,
  	"description" varchar,
  	"intro" varchar,
  	"body" varchar,
  	"seo_copy" varchar,
  	"updated" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload"."cms_page_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload"."cms_testimonials_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"city" varchar,
  	"rating" numeric DEFAULT 5,
  	"text" varchar NOT NULL,
  	"product" varchar
  );
  
  CREATE TABLE "payload"."cms_testimonials" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload"."cms_faqs_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"q" varchar NOT NULL,
  	"group" varchar,
  	"a" varchar NOT NULL
  );
  
  CREATE TABLE "payload"."cms_faqs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "payload"."cms_pb_hero_slides" ADD COLUMN "image_url" varchar;
  ALTER TABLE "payload"."cms_pb_hero_slides" ADD COLUMN "accent" "payload"."enum_cms_pb_hero_slides_accent" DEFAULT 'from-blue-500 to-violet-500';
  ALTER TABLE "payload"."_cms_pb_hero_v_slides" ADD COLUMN "image_url" varchar;
  ALTER TABLE "payload"."_cms_pb_hero_v_slides" ADD COLUMN "accent" "payload"."enum__cms_pb_hero_v_slides_accent" DEFAULT 'from-blue-500 to-violet-500';
  ALTER TABLE "payload"."cms_store_info_phones" ADD CONSTRAINT "cms_store_info_phones_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_store_info"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_store_info_hours_days" ADD CONSTRAINT "cms_store_info_hours_days_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_store_info_hours"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_store_info_hours" ADD CONSTRAINT "cms_store_info_hours_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_store_info"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_store_info_texts" ADD CONSTRAINT "cms_store_info_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_store_info"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_seo_settings_pages" ADD CONSTRAINT "cms_seo_settings_pages_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_seo_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_seo_settings_texts" ADD CONSTRAINT "cms_seo_settings_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_seo_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_page_texts_pages" ADD CONSTRAINT "cms_page_texts_pages_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_page_texts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_testimonials_items" ADD CONSTRAINT "cms_testimonials_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_testimonials"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_faqs_items" ADD CONSTRAINT "cms_faqs_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_faqs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "cms_store_info_phones_order_idx" ON "payload"."cms_store_info_phones" USING btree ("_order");
  CREATE INDEX "cms_store_info_phones_parent_id_idx" ON "payload"."cms_store_info_phones" USING btree ("_parent_id");
  CREATE INDEX "cms_store_info_hours_days_order_idx" ON "payload"."cms_store_info_hours_days" USING btree ("order");
  CREATE INDEX "cms_store_info_hours_days_parent_idx" ON "payload"."cms_store_info_hours_days" USING btree ("parent_id");
  CREATE INDEX "cms_store_info_hours_order_idx" ON "payload"."cms_store_info_hours" USING btree ("_order");
  CREATE INDEX "cms_store_info_hours_parent_id_idx" ON "payload"."cms_store_info_hours" USING btree ("_parent_id");
  CREATE INDEX "cms_store_info_texts_order_parent" ON "payload"."cms_store_info_texts" USING btree ("order","parent_id");
  CREATE INDEX "cms_seo_settings_pages_order_idx" ON "payload"."cms_seo_settings_pages" USING btree ("_order");
  CREATE INDEX "cms_seo_settings_pages_parent_id_idx" ON "payload"."cms_seo_settings_pages" USING btree ("_parent_id");
  CREATE INDEX "cms_seo_settings_texts_order_parent" ON "payload"."cms_seo_settings_texts" USING btree ("order","parent_id");
  CREATE INDEX "cms_page_texts_pages_order_idx" ON "payload"."cms_page_texts_pages" USING btree ("_order");
  CREATE INDEX "cms_page_texts_pages_parent_id_idx" ON "payload"."cms_page_texts_pages" USING btree ("_parent_id");
  CREATE INDEX "cms_testimonials_items_order_idx" ON "payload"."cms_testimonials_items" USING btree ("_order");
  CREATE INDEX "cms_testimonials_items_parent_id_idx" ON "payload"."cms_testimonials_items" USING btree ("_parent_id");
  CREATE INDEX "cms_faqs_items_order_idx" ON "payload"."cms_faqs_items" USING btree ("_order");
  CREATE INDEX "cms_faqs_items_parent_id_idx" ON "payload"."cms_faqs_items" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "payload"."cms_store_info_phones" CASCADE;
  DROP TABLE "payload"."cms_store_info_hours_days" CASCADE;
  DROP TABLE "payload"."cms_store_info_hours" CASCADE;
  DROP TABLE "payload"."cms_store_info" CASCADE;
  DROP TABLE "payload"."cms_store_info_texts" CASCADE;
  DROP TABLE "payload"."cms_seo_settings_pages" CASCADE;
  DROP TABLE "payload"."cms_seo_settings" CASCADE;
  DROP TABLE "payload"."cms_seo_settings_texts" CASCADE;
  DROP TABLE "payload"."cms_page_texts_pages" CASCADE;
  DROP TABLE "payload"."cms_page_texts" CASCADE;
  DROP TABLE "payload"."cms_testimonials_items" CASCADE;
  DROP TABLE "payload"."cms_testimonials" CASCADE;
  DROP TABLE "payload"."cms_faqs_items" CASCADE;
  DROP TABLE "payload"."cms_faqs" CASCADE;
  ALTER TABLE "payload"."cms_pb_hero_slides" DROP COLUMN "image_url";
  ALTER TABLE "payload"."cms_pb_hero_slides" DROP COLUMN "accent";
  ALTER TABLE "payload"."_cms_pb_hero_v_slides" DROP COLUMN "image_url";
  ALTER TABLE "payload"."_cms_pb_hero_v_slides" DROP COLUMN "accent";
  DROP TYPE "payload"."enum_cms_pb_hero_slides_accent";
  DROP TYPE "payload"."enum__cms_pb_hero_v_slides_accent";
  DROP TYPE "payload"."enum_cms_store_info_hours_days";
  DROP TYPE "payload"."enum_cms_seo_settings_pages_page";
  DROP TYPE "payload"."enum_cms_seo_settings_pages_indexing";
  DROP TYPE "payload"."enum_cms_page_texts_pages_page";`)
}
