import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_cms_pb_deals_source" AS ENUM('auto', 'manual');
  CREATE TYPE "payload"."enum_cms_pb_prods_source" AS ENUM('newArrivals', 'bestSellers', 'topAccessories', 'category', 'manual');
  CREATE TYPE "payload"."enum_cms_pb_text_width" AS ENUM('wide', 'narrow');
  CREATE TYPE "payload"."enum_cms_pb_banner_align" AS ENUM('left', 'center');
  CREATE TYPE "payload"."enum_cms_pb_banner_height" AS ENUM('sm', 'md', 'lg');
  CREATE TYPE "payload"."enum_cms_pb_imgtext_image_side" AS ENUM('left', 'right');
  CREATE TYPE "payload"."enum_cms_pb_cta_buttons_style" AS ENUM('primary', 'secondary', 'whatsapp');
  CREATE TYPE "payload"."enum_cms_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum__cms_pb_deals_v_source" AS ENUM('auto', 'manual');
  CREATE TYPE "payload"."enum__cms_pb_prods_v_source" AS ENUM('newArrivals', 'bestSellers', 'topAccessories', 'category', 'manual');
  CREATE TYPE "payload"."enum__cms_pb_text_v_width" AS ENUM('wide', 'narrow');
  CREATE TYPE "payload"."enum__cms_pb_banner_v_align" AS ENUM('left', 'center');
  CREATE TYPE "payload"."enum__cms_pb_banner_v_height" AS ENUM('sm', 'md', 'lg');
  CREATE TYPE "payload"."enum__cms_pb_imgtext_v_image_side" AS ENUM('left', 'right');
  CREATE TYPE "payload"."enum__cms_pb_cta_v_buttons_style" AS ENUM('primary', 'secondary', 'whatsapp');
  CREATE TYPE "payload"."enum__cms_pages_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "payload"."cms_pb_hero_slides" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"eyebrow" varchar,
  	"title" varchar,
  	"subtitle" varchar,
  	"cta_label" varchar DEFAULT 'Shop now',
  	"cta_href" varchar DEFAULT '/shop'
  );
  
  CREATE TABLE "payload"."cms_pb_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."cms_pb_trust_badges" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"text" varchar
  );
  
  CREATE TABLE "payload"."cms_pb_trust" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."cms_pb_cats" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" varchar DEFAULT 'Shop by category',
  	"title" varchar DEFAULT 'Everything tech, one store',
  	"description" varchar DEFAULT 'Laptops, chargers, batteries, peripherals and more – all checked, tested and ready to ship.',
  	"link_label" varchar DEFAULT 'All categories',
  	"link_href" varchar DEFAULT '/category',
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."cms_pb_deals" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"title" varchar DEFAULT 'Hot deals – limited time',
  	"link_label" varchar DEFAULT 'See all deals →',
  	"link_href" varchar DEFAULT '/deals',
  	"source" "payload"."enum_cms_pb_deals_source" DEFAULT 'auto',
  	"limit" numeric,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."cms_pb_prods" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"title" varchar,
  	"link_label" varchar,
  	"link_href" varchar,
  	"source" "payload"."enum_cms_pb_prods_source" DEFAULT 'newArrivals',
  	"category_id" integer,
  	"limit" numeric,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."cms_pb_finder" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar DEFAULT 'Find parts for your laptop',
  	"description" varchar DEFAULT 'Select your laptop and instantly see compatible chargers, batteries, keyboards, RAM and SSDs.',
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."cms_pb_brands" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" varchar DEFAULT 'Top brands',
  	"title" varchar DEFAULT 'Shop by brand',
  	"link_label" varchar DEFAULT 'All brands',
  	"link_href" varchar DEFAULT '/brands',
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."cms_pb_installment" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" varchar DEFAULT 'Coming soon',
  	"title" varchar DEFAULT 'Easy installment plans',
  	"description" varchar DEFAULT 'Buy your next laptop on easy monthly installments with partner banks. Ask us on WhatsApp for current options.',
  	"link_label" varchar DEFAULT 'Installment plan details',
  	"link_href" varchar DEFAULT '/installments',
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."cms_pb_testimonials" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" varchar DEFAULT '4.8 ★ average rating',
  	"title" varchar DEFAULT 'Loved by customers across Pakistan',
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."cms_pb_social" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" varchar DEFAULT '@urkotechstore',
  	"title" varchar DEFAULT 'Follow us on Instagram & TikTok',
  	"description" varchar DEFAULT 'Unboxings, laptop tips and the latest arrivals from our Saddar store.',
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."cms_pb_location" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" varchar DEFAULT 'Visit our store',
  	"title" varchar DEFAULT 'Laptop shop in Saddar, Karachi',
  	"description" varchar DEFAULT 'Come check laptops in person at the heart of Karachi''s **Regal Chowk laptop market**. Free SSD & RAM installation when you buy from us.',
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."cms_pb_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"content" jsonb,
  	"markdown" varchar,
  	"boxed" boolean DEFAULT true,
  	"width" "payload"."enum_cms_pb_text_width" DEFAULT 'wide',
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."cms_pb_banner" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"eyebrow" varchar,
  	"heading" varchar,
  	"text" varchar,
  	"button_label" varchar,
  	"button_href" varchar,
  	"align" "payload"."enum_cms_pb_banner_align" DEFAULT 'left',
  	"height" "payload"."enum_cms_pb_banner_height" DEFAULT 'md',
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."cms_pb_imgtext" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"eyebrow" varchar,
  	"heading" varchar,
  	"content" jsonb,
  	"button_label" varchar,
  	"button_href" varchar,
  	"image_side" "payload"."enum_cms_pb_imgtext_image_side" DEFAULT 'left',
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."cms_pb_faq_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar
  );
  
  CREATE TABLE "payload"."cms_pb_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"title" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."cms_pb_cta_buttons" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"href" varchar,
  	"style" "payload"."enum_cms_pb_cta_buttons_style" DEFAULT 'primary'
  );
  
  CREATE TABLE "payload"."cms_pb_cta" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"text" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."cms_pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"h1_highlight" varchar,
  	"h1_text" varchar,
  	"slug" varchar,
  	"legacy_id" varchar,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"meta_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "payload"."enum_cms_pages_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "payload"."cms_pages_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"cms_categories_id" integer,
  	"cms_products_id" integer
  );
  
  CREATE TABLE "payload"."_cms_pb_hero_v_slides" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"eyebrow" varchar,
  	"title" varchar,
  	"subtitle" varchar,
  	"cta_label" varchar DEFAULT 'Shop now',
  	"cta_href" varchar DEFAULT '/shop',
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_cms_pb_hero_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_cms_pb_trust_v_badges" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_cms_pb_trust_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_cms_pb_cats_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"eyebrow" varchar DEFAULT 'Shop by category',
  	"title" varchar DEFAULT 'Everything tech, one store',
  	"description" varchar DEFAULT 'Laptops, chargers, batteries, peripherals and more – all checked, tested and ready to ship.',
  	"link_label" varchar DEFAULT 'All categories',
  	"link_href" varchar DEFAULT '/category',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_cms_pb_deals_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"title" varchar DEFAULT 'Hot deals – limited time',
  	"link_label" varchar DEFAULT 'See all deals →',
  	"link_href" varchar DEFAULT '/deals',
  	"source" "payload"."enum__cms_pb_deals_v_source" DEFAULT 'auto',
  	"limit" numeric,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_cms_pb_prods_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"title" varchar,
  	"link_label" varchar,
  	"link_href" varchar,
  	"source" "payload"."enum__cms_pb_prods_v_source" DEFAULT 'newArrivals',
  	"category_id" integer,
  	"limit" numeric,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_cms_pb_finder_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar DEFAULT 'Find parts for your laptop',
  	"description" varchar DEFAULT 'Select your laptop and instantly see compatible chargers, batteries, keyboards, RAM and SSDs.',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_cms_pb_brands_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"eyebrow" varchar DEFAULT 'Top brands',
  	"title" varchar DEFAULT 'Shop by brand',
  	"link_label" varchar DEFAULT 'All brands',
  	"link_href" varchar DEFAULT '/brands',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_cms_pb_installment_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"eyebrow" varchar DEFAULT 'Coming soon',
  	"title" varchar DEFAULT 'Easy installment plans',
  	"description" varchar DEFAULT 'Buy your next laptop on easy monthly installments with partner banks. Ask us on WhatsApp for current options.',
  	"link_label" varchar DEFAULT 'Installment plan details',
  	"link_href" varchar DEFAULT '/installments',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_cms_pb_testimonials_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"eyebrow" varchar DEFAULT '4.8 ★ average rating',
  	"title" varchar DEFAULT 'Loved by customers across Pakistan',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_cms_pb_social_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"eyebrow" varchar DEFAULT '@urkotechstore',
  	"title" varchar DEFAULT 'Follow us on Instagram & TikTok',
  	"description" varchar DEFAULT 'Unboxings, laptop tips and the latest arrivals from our Saddar store.',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_cms_pb_location_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"eyebrow" varchar DEFAULT 'Visit our store',
  	"title" varchar DEFAULT 'Laptop shop in Saddar, Karachi',
  	"description" varchar DEFAULT 'Come check laptops in person at the heart of Karachi''s **Regal Chowk laptop market**. Free SSD & RAM installation when you buy from us.',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_cms_pb_text_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"content" jsonb,
  	"markdown" varchar,
  	"boxed" boolean DEFAULT true,
  	"width" "payload"."enum__cms_pb_text_v_width" DEFAULT 'wide',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_cms_pb_banner_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"eyebrow" varchar,
  	"heading" varchar,
  	"text" varchar,
  	"button_label" varchar,
  	"button_href" varchar,
  	"align" "payload"."enum__cms_pb_banner_v_align" DEFAULT 'left',
  	"height" "payload"."enum__cms_pb_banner_v_height" DEFAULT 'md',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_cms_pb_imgtext_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"eyebrow" varchar,
  	"heading" varchar,
  	"content" jsonb,
  	"button_label" varchar,
  	"button_href" varchar,
  	"image_side" "payload"."enum__cms_pb_imgtext_v_image_side" DEFAULT 'left',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_cms_pb_faq_v_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_cms_pb_faq_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"title" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_cms_pb_cta_v_buttons" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"href" varchar,
  	"style" "payload"."enum__cms_pb_cta_v_buttons_style" DEFAULT 'primary',
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_cms_pb_cta_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"text" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "payload"."_cms_pages_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_h1_highlight" varchar,
  	"version_h1_text" varchar,
  	"version_slug" varchar,
  	"version_legacy_id" varchar,
  	"version_meta_title" varchar,
  	"version_meta_description" varchar,
  	"version_meta_image_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "payload"."enum__cms_pages_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "payload"."_cms_pages_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"cms_categories_id" integer,
  	"cms_products_id" integer
  );
  
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_pages_id" integer;
  ALTER TABLE "payload"."cms_pb_hero_slides" ADD CONSTRAINT "cms_pb_hero_slides_image_id_cms_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_pb_hero_slides" ADD CONSTRAINT "cms_pb_hero_slides_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_pb_hero"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_pb_hero" ADD CONSTRAINT "cms_pb_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_pb_trust_badges" ADD CONSTRAINT "cms_pb_trust_badges_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_pb_trust"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_pb_trust" ADD CONSTRAINT "cms_pb_trust_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_pb_cats" ADD CONSTRAINT "cms_pb_cats_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_pb_deals" ADD CONSTRAINT "cms_pb_deals_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_pb_prods" ADD CONSTRAINT "cms_pb_prods_category_id_cms_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "payload"."cms_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_pb_prods" ADD CONSTRAINT "cms_pb_prods_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_pb_finder" ADD CONSTRAINT "cms_pb_finder_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_pb_brands" ADD CONSTRAINT "cms_pb_brands_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_pb_installment" ADD CONSTRAINT "cms_pb_installment_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_pb_testimonials" ADD CONSTRAINT "cms_pb_testimonials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_pb_social" ADD CONSTRAINT "cms_pb_social_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_pb_location" ADD CONSTRAINT "cms_pb_location_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_pb_text" ADD CONSTRAINT "cms_pb_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_pb_banner" ADD CONSTRAINT "cms_pb_banner_image_id_cms_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_pb_banner" ADD CONSTRAINT "cms_pb_banner_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_pb_imgtext" ADD CONSTRAINT "cms_pb_imgtext_image_id_cms_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_pb_imgtext" ADD CONSTRAINT "cms_pb_imgtext_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_pb_faq_items" ADD CONSTRAINT "cms_pb_faq_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_pb_faq"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_pb_faq" ADD CONSTRAINT "cms_pb_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_pb_cta_buttons" ADD CONSTRAINT "cms_pb_cta_buttons_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_pb_cta"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_pb_cta" ADD CONSTRAINT "cms_pb_cta_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_pages" ADD CONSTRAINT "cms_pages_meta_image_id_cms_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_pages_rels" ADD CONSTRAINT "cms_pages_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_pages_rels" ADD CONSTRAINT "cms_pages_rels_categories_fk" FOREIGN KEY ("cms_categories_id") REFERENCES "payload"."cms_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_pages_rels" ADD CONSTRAINT "cms_pages_rels_products_fk" FOREIGN KEY ("cms_products_id") REFERENCES "payload"."cms_products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_pb_hero_v_slides" ADD CONSTRAINT "_cms_pb_hero_v_slides_image_id_cms_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_pb_hero_v_slides" ADD CONSTRAINT "_cms_pb_hero_v_slides_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_cms_pb_hero_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_pb_hero_v" ADD CONSTRAINT "_cms_pb_hero_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_cms_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_pb_trust_v_badges" ADD CONSTRAINT "_cms_pb_trust_v_badges_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_cms_pb_trust_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_pb_trust_v" ADD CONSTRAINT "_cms_pb_trust_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_cms_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_pb_cats_v" ADD CONSTRAINT "_cms_pb_cats_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_cms_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_pb_deals_v" ADD CONSTRAINT "_cms_pb_deals_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_cms_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_pb_prods_v" ADD CONSTRAINT "_cms_pb_prods_v_category_id_cms_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "payload"."cms_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_pb_prods_v" ADD CONSTRAINT "_cms_pb_prods_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_cms_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_pb_finder_v" ADD CONSTRAINT "_cms_pb_finder_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_cms_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_pb_brands_v" ADD CONSTRAINT "_cms_pb_brands_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_cms_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_pb_installment_v" ADD CONSTRAINT "_cms_pb_installment_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_cms_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_pb_testimonials_v" ADD CONSTRAINT "_cms_pb_testimonials_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_cms_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_pb_social_v" ADD CONSTRAINT "_cms_pb_social_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_cms_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_pb_location_v" ADD CONSTRAINT "_cms_pb_location_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_cms_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_pb_text_v" ADD CONSTRAINT "_cms_pb_text_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_cms_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_pb_banner_v" ADD CONSTRAINT "_cms_pb_banner_v_image_id_cms_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_pb_banner_v" ADD CONSTRAINT "_cms_pb_banner_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_cms_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_pb_imgtext_v" ADD CONSTRAINT "_cms_pb_imgtext_v_image_id_cms_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_pb_imgtext_v" ADD CONSTRAINT "_cms_pb_imgtext_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_cms_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_pb_faq_v_items" ADD CONSTRAINT "_cms_pb_faq_v_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_cms_pb_faq_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_pb_faq_v" ADD CONSTRAINT "_cms_pb_faq_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_cms_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_pb_cta_v_buttons" ADD CONSTRAINT "_cms_pb_cta_v_buttons_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_cms_pb_cta_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_pb_cta_v" ADD CONSTRAINT "_cms_pb_cta_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_cms_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_pages_v" ADD CONSTRAINT "_cms_pages_v_parent_id_cms_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_pages_v" ADD CONSTRAINT "_cms_pages_v_version_meta_image_id_cms_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_pages_v_rels" ADD CONSTRAINT "_cms_pages_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."_cms_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_pages_v_rels" ADD CONSTRAINT "_cms_pages_v_rels_categories_fk" FOREIGN KEY ("cms_categories_id") REFERENCES "payload"."cms_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_pages_v_rels" ADD CONSTRAINT "_cms_pages_v_rels_products_fk" FOREIGN KEY ("cms_products_id") REFERENCES "payload"."cms_products"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "cms_pb_hero_slides_order_idx" ON "payload"."cms_pb_hero_slides" USING btree ("_order");
  CREATE INDEX "cms_pb_hero_slides_parent_id_idx" ON "payload"."cms_pb_hero_slides" USING btree ("_parent_id");
  CREATE INDEX "cms_pb_hero_slides_image_idx" ON "payload"."cms_pb_hero_slides" USING btree ("image_id");
  CREATE INDEX "cms_pb_hero_order_idx" ON "payload"."cms_pb_hero" USING btree ("_order");
  CREATE INDEX "cms_pb_hero_parent_id_idx" ON "payload"."cms_pb_hero" USING btree ("_parent_id");
  CREATE INDEX "cms_pb_hero_path_idx" ON "payload"."cms_pb_hero" USING btree ("_path");
  CREATE INDEX "cms_pb_trust_badges_order_idx" ON "payload"."cms_pb_trust_badges" USING btree ("_order");
  CREATE INDEX "cms_pb_trust_badges_parent_id_idx" ON "payload"."cms_pb_trust_badges" USING btree ("_parent_id");
  CREATE INDEX "cms_pb_trust_order_idx" ON "payload"."cms_pb_trust" USING btree ("_order");
  CREATE INDEX "cms_pb_trust_parent_id_idx" ON "payload"."cms_pb_trust" USING btree ("_parent_id");
  CREATE INDEX "cms_pb_trust_path_idx" ON "payload"."cms_pb_trust" USING btree ("_path");
  CREATE INDEX "cms_pb_cats_order_idx" ON "payload"."cms_pb_cats" USING btree ("_order");
  CREATE INDEX "cms_pb_cats_parent_id_idx" ON "payload"."cms_pb_cats" USING btree ("_parent_id");
  CREATE INDEX "cms_pb_cats_path_idx" ON "payload"."cms_pb_cats" USING btree ("_path");
  CREATE INDEX "cms_pb_deals_order_idx" ON "payload"."cms_pb_deals" USING btree ("_order");
  CREATE INDEX "cms_pb_deals_parent_id_idx" ON "payload"."cms_pb_deals" USING btree ("_parent_id");
  CREATE INDEX "cms_pb_deals_path_idx" ON "payload"."cms_pb_deals" USING btree ("_path");
  CREATE INDEX "cms_pb_prods_order_idx" ON "payload"."cms_pb_prods" USING btree ("_order");
  CREATE INDEX "cms_pb_prods_parent_id_idx" ON "payload"."cms_pb_prods" USING btree ("_parent_id");
  CREATE INDEX "cms_pb_prods_path_idx" ON "payload"."cms_pb_prods" USING btree ("_path");
  CREATE INDEX "cms_pb_prods_category_idx" ON "payload"."cms_pb_prods" USING btree ("category_id");
  CREATE INDEX "cms_pb_finder_order_idx" ON "payload"."cms_pb_finder" USING btree ("_order");
  CREATE INDEX "cms_pb_finder_parent_id_idx" ON "payload"."cms_pb_finder" USING btree ("_parent_id");
  CREATE INDEX "cms_pb_finder_path_idx" ON "payload"."cms_pb_finder" USING btree ("_path");
  CREATE INDEX "cms_pb_brands_order_idx" ON "payload"."cms_pb_brands" USING btree ("_order");
  CREATE INDEX "cms_pb_brands_parent_id_idx" ON "payload"."cms_pb_brands" USING btree ("_parent_id");
  CREATE INDEX "cms_pb_brands_path_idx" ON "payload"."cms_pb_brands" USING btree ("_path");
  CREATE INDEX "cms_pb_installment_order_idx" ON "payload"."cms_pb_installment" USING btree ("_order");
  CREATE INDEX "cms_pb_installment_parent_id_idx" ON "payload"."cms_pb_installment" USING btree ("_parent_id");
  CREATE INDEX "cms_pb_installment_path_idx" ON "payload"."cms_pb_installment" USING btree ("_path");
  CREATE INDEX "cms_pb_testimonials_order_idx" ON "payload"."cms_pb_testimonials" USING btree ("_order");
  CREATE INDEX "cms_pb_testimonials_parent_id_idx" ON "payload"."cms_pb_testimonials" USING btree ("_parent_id");
  CREATE INDEX "cms_pb_testimonials_path_idx" ON "payload"."cms_pb_testimonials" USING btree ("_path");
  CREATE INDEX "cms_pb_social_order_idx" ON "payload"."cms_pb_social" USING btree ("_order");
  CREATE INDEX "cms_pb_social_parent_id_idx" ON "payload"."cms_pb_social" USING btree ("_parent_id");
  CREATE INDEX "cms_pb_social_path_idx" ON "payload"."cms_pb_social" USING btree ("_path");
  CREATE INDEX "cms_pb_location_order_idx" ON "payload"."cms_pb_location" USING btree ("_order");
  CREATE INDEX "cms_pb_location_parent_id_idx" ON "payload"."cms_pb_location" USING btree ("_parent_id");
  CREATE INDEX "cms_pb_location_path_idx" ON "payload"."cms_pb_location" USING btree ("_path");
  CREATE INDEX "cms_pb_text_order_idx" ON "payload"."cms_pb_text" USING btree ("_order");
  CREATE INDEX "cms_pb_text_parent_id_idx" ON "payload"."cms_pb_text" USING btree ("_parent_id");
  CREATE INDEX "cms_pb_text_path_idx" ON "payload"."cms_pb_text" USING btree ("_path");
  CREATE INDEX "cms_pb_banner_order_idx" ON "payload"."cms_pb_banner" USING btree ("_order");
  CREATE INDEX "cms_pb_banner_parent_id_idx" ON "payload"."cms_pb_banner" USING btree ("_parent_id");
  CREATE INDEX "cms_pb_banner_path_idx" ON "payload"."cms_pb_banner" USING btree ("_path");
  CREATE INDEX "cms_pb_banner_image_idx" ON "payload"."cms_pb_banner" USING btree ("image_id");
  CREATE INDEX "cms_pb_imgtext_order_idx" ON "payload"."cms_pb_imgtext" USING btree ("_order");
  CREATE INDEX "cms_pb_imgtext_parent_id_idx" ON "payload"."cms_pb_imgtext" USING btree ("_parent_id");
  CREATE INDEX "cms_pb_imgtext_path_idx" ON "payload"."cms_pb_imgtext" USING btree ("_path");
  CREATE INDEX "cms_pb_imgtext_image_idx" ON "payload"."cms_pb_imgtext" USING btree ("image_id");
  CREATE INDEX "cms_pb_faq_items_order_idx" ON "payload"."cms_pb_faq_items" USING btree ("_order");
  CREATE INDEX "cms_pb_faq_items_parent_id_idx" ON "payload"."cms_pb_faq_items" USING btree ("_parent_id");
  CREATE INDEX "cms_pb_faq_order_idx" ON "payload"."cms_pb_faq" USING btree ("_order");
  CREATE INDEX "cms_pb_faq_parent_id_idx" ON "payload"."cms_pb_faq" USING btree ("_parent_id");
  CREATE INDEX "cms_pb_faq_path_idx" ON "payload"."cms_pb_faq" USING btree ("_path");
  CREATE INDEX "cms_pb_cta_buttons_order_idx" ON "payload"."cms_pb_cta_buttons" USING btree ("_order");
  CREATE INDEX "cms_pb_cta_buttons_parent_id_idx" ON "payload"."cms_pb_cta_buttons" USING btree ("_parent_id");
  CREATE INDEX "cms_pb_cta_order_idx" ON "payload"."cms_pb_cta" USING btree ("_order");
  CREATE INDEX "cms_pb_cta_parent_id_idx" ON "payload"."cms_pb_cta" USING btree ("_parent_id");
  CREATE INDEX "cms_pb_cta_path_idx" ON "payload"."cms_pb_cta" USING btree ("_path");
  CREATE UNIQUE INDEX "cms_pages_slug_idx" ON "payload"."cms_pages" USING btree ("slug");
  CREATE UNIQUE INDEX "cms_pages_legacy_id_idx" ON "payload"."cms_pages" USING btree ("legacy_id");
  CREATE INDEX "cms_pages_meta_meta_image_idx" ON "payload"."cms_pages" USING btree ("meta_image_id");
  CREATE INDEX "cms_pages_updated_at_idx" ON "payload"."cms_pages" USING btree ("updated_at");
  CREATE INDEX "cms_pages_created_at_idx" ON "payload"."cms_pages" USING btree ("created_at");
  CREATE INDEX "cms_pages__status_idx" ON "payload"."cms_pages" USING btree ("_status");
  CREATE INDEX "cms_pages_rels_order_idx" ON "payload"."cms_pages_rels" USING btree ("order");
  CREATE INDEX "cms_pages_rels_parent_idx" ON "payload"."cms_pages_rels" USING btree ("parent_id");
  CREATE INDEX "cms_pages_rels_path_idx" ON "payload"."cms_pages_rels" USING btree ("path");
  CREATE INDEX "cms_pages_rels_cms_categories_id_idx" ON "payload"."cms_pages_rels" USING btree ("cms_categories_id");
  CREATE INDEX "cms_pages_rels_cms_products_id_idx" ON "payload"."cms_pages_rels" USING btree ("cms_products_id");
  CREATE INDEX "_cms_pb_hero_v_slides_order_idx" ON "payload"."_cms_pb_hero_v_slides" USING btree ("_order");
  CREATE INDEX "_cms_pb_hero_v_slides_parent_id_idx" ON "payload"."_cms_pb_hero_v_slides" USING btree ("_parent_id");
  CREATE INDEX "_cms_pb_hero_v_slides_image_idx" ON "payload"."_cms_pb_hero_v_slides" USING btree ("image_id");
  CREATE INDEX "_cms_pb_hero_v_order_idx" ON "payload"."_cms_pb_hero_v" USING btree ("_order");
  CREATE INDEX "_cms_pb_hero_v_parent_id_idx" ON "payload"."_cms_pb_hero_v" USING btree ("_parent_id");
  CREATE INDEX "_cms_pb_hero_v_path_idx" ON "payload"."_cms_pb_hero_v" USING btree ("_path");
  CREATE INDEX "_cms_pb_trust_v_badges_order_idx" ON "payload"."_cms_pb_trust_v_badges" USING btree ("_order");
  CREATE INDEX "_cms_pb_trust_v_badges_parent_id_idx" ON "payload"."_cms_pb_trust_v_badges" USING btree ("_parent_id");
  CREATE INDEX "_cms_pb_trust_v_order_idx" ON "payload"."_cms_pb_trust_v" USING btree ("_order");
  CREATE INDEX "_cms_pb_trust_v_parent_id_idx" ON "payload"."_cms_pb_trust_v" USING btree ("_parent_id");
  CREATE INDEX "_cms_pb_trust_v_path_idx" ON "payload"."_cms_pb_trust_v" USING btree ("_path");
  CREATE INDEX "_cms_pb_cats_v_order_idx" ON "payload"."_cms_pb_cats_v" USING btree ("_order");
  CREATE INDEX "_cms_pb_cats_v_parent_id_idx" ON "payload"."_cms_pb_cats_v" USING btree ("_parent_id");
  CREATE INDEX "_cms_pb_cats_v_path_idx" ON "payload"."_cms_pb_cats_v" USING btree ("_path");
  CREATE INDEX "_cms_pb_deals_v_order_idx" ON "payload"."_cms_pb_deals_v" USING btree ("_order");
  CREATE INDEX "_cms_pb_deals_v_parent_id_idx" ON "payload"."_cms_pb_deals_v" USING btree ("_parent_id");
  CREATE INDEX "_cms_pb_deals_v_path_idx" ON "payload"."_cms_pb_deals_v" USING btree ("_path");
  CREATE INDEX "_cms_pb_prods_v_order_idx" ON "payload"."_cms_pb_prods_v" USING btree ("_order");
  CREATE INDEX "_cms_pb_prods_v_parent_id_idx" ON "payload"."_cms_pb_prods_v" USING btree ("_parent_id");
  CREATE INDEX "_cms_pb_prods_v_path_idx" ON "payload"."_cms_pb_prods_v" USING btree ("_path");
  CREATE INDEX "_cms_pb_prods_v_category_idx" ON "payload"."_cms_pb_prods_v" USING btree ("category_id");
  CREATE INDEX "_cms_pb_finder_v_order_idx" ON "payload"."_cms_pb_finder_v" USING btree ("_order");
  CREATE INDEX "_cms_pb_finder_v_parent_id_idx" ON "payload"."_cms_pb_finder_v" USING btree ("_parent_id");
  CREATE INDEX "_cms_pb_finder_v_path_idx" ON "payload"."_cms_pb_finder_v" USING btree ("_path");
  CREATE INDEX "_cms_pb_brands_v_order_idx" ON "payload"."_cms_pb_brands_v" USING btree ("_order");
  CREATE INDEX "_cms_pb_brands_v_parent_id_idx" ON "payload"."_cms_pb_brands_v" USING btree ("_parent_id");
  CREATE INDEX "_cms_pb_brands_v_path_idx" ON "payload"."_cms_pb_brands_v" USING btree ("_path");
  CREATE INDEX "_cms_pb_installment_v_order_idx" ON "payload"."_cms_pb_installment_v" USING btree ("_order");
  CREATE INDEX "_cms_pb_installment_v_parent_id_idx" ON "payload"."_cms_pb_installment_v" USING btree ("_parent_id");
  CREATE INDEX "_cms_pb_installment_v_path_idx" ON "payload"."_cms_pb_installment_v" USING btree ("_path");
  CREATE INDEX "_cms_pb_testimonials_v_order_idx" ON "payload"."_cms_pb_testimonials_v" USING btree ("_order");
  CREATE INDEX "_cms_pb_testimonials_v_parent_id_idx" ON "payload"."_cms_pb_testimonials_v" USING btree ("_parent_id");
  CREATE INDEX "_cms_pb_testimonials_v_path_idx" ON "payload"."_cms_pb_testimonials_v" USING btree ("_path");
  CREATE INDEX "_cms_pb_social_v_order_idx" ON "payload"."_cms_pb_social_v" USING btree ("_order");
  CREATE INDEX "_cms_pb_social_v_parent_id_idx" ON "payload"."_cms_pb_social_v" USING btree ("_parent_id");
  CREATE INDEX "_cms_pb_social_v_path_idx" ON "payload"."_cms_pb_social_v" USING btree ("_path");
  CREATE INDEX "_cms_pb_location_v_order_idx" ON "payload"."_cms_pb_location_v" USING btree ("_order");
  CREATE INDEX "_cms_pb_location_v_parent_id_idx" ON "payload"."_cms_pb_location_v" USING btree ("_parent_id");
  CREATE INDEX "_cms_pb_location_v_path_idx" ON "payload"."_cms_pb_location_v" USING btree ("_path");
  CREATE INDEX "_cms_pb_text_v_order_idx" ON "payload"."_cms_pb_text_v" USING btree ("_order");
  CREATE INDEX "_cms_pb_text_v_parent_id_idx" ON "payload"."_cms_pb_text_v" USING btree ("_parent_id");
  CREATE INDEX "_cms_pb_text_v_path_idx" ON "payload"."_cms_pb_text_v" USING btree ("_path");
  CREATE INDEX "_cms_pb_banner_v_order_idx" ON "payload"."_cms_pb_banner_v" USING btree ("_order");
  CREATE INDEX "_cms_pb_banner_v_parent_id_idx" ON "payload"."_cms_pb_banner_v" USING btree ("_parent_id");
  CREATE INDEX "_cms_pb_banner_v_path_idx" ON "payload"."_cms_pb_banner_v" USING btree ("_path");
  CREATE INDEX "_cms_pb_banner_v_image_idx" ON "payload"."_cms_pb_banner_v" USING btree ("image_id");
  CREATE INDEX "_cms_pb_imgtext_v_order_idx" ON "payload"."_cms_pb_imgtext_v" USING btree ("_order");
  CREATE INDEX "_cms_pb_imgtext_v_parent_id_idx" ON "payload"."_cms_pb_imgtext_v" USING btree ("_parent_id");
  CREATE INDEX "_cms_pb_imgtext_v_path_idx" ON "payload"."_cms_pb_imgtext_v" USING btree ("_path");
  CREATE INDEX "_cms_pb_imgtext_v_image_idx" ON "payload"."_cms_pb_imgtext_v" USING btree ("image_id");
  CREATE INDEX "_cms_pb_faq_v_items_order_idx" ON "payload"."_cms_pb_faq_v_items" USING btree ("_order");
  CREATE INDEX "_cms_pb_faq_v_items_parent_id_idx" ON "payload"."_cms_pb_faq_v_items" USING btree ("_parent_id");
  CREATE INDEX "_cms_pb_faq_v_order_idx" ON "payload"."_cms_pb_faq_v" USING btree ("_order");
  CREATE INDEX "_cms_pb_faq_v_parent_id_idx" ON "payload"."_cms_pb_faq_v" USING btree ("_parent_id");
  CREATE INDEX "_cms_pb_faq_v_path_idx" ON "payload"."_cms_pb_faq_v" USING btree ("_path");
  CREATE INDEX "_cms_pb_cta_v_buttons_order_idx" ON "payload"."_cms_pb_cta_v_buttons" USING btree ("_order");
  CREATE INDEX "_cms_pb_cta_v_buttons_parent_id_idx" ON "payload"."_cms_pb_cta_v_buttons" USING btree ("_parent_id");
  CREATE INDEX "_cms_pb_cta_v_order_idx" ON "payload"."_cms_pb_cta_v" USING btree ("_order");
  CREATE INDEX "_cms_pb_cta_v_parent_id_idx" ON "payload"."_cms_pb_cta_v" USING btree ("_parent_id");
  CREATE INDEX "_cms_pb_cta_v_path_idx" ON "payload"."_cms_pb_cta_v" USING btree ("_path");
  CREATE INDEX "_cms_pages_v_parent_idx" ON "payload"."_cms_pages_v" USING btree ("parent_id");
  CREATE INDEX "_cms_pages_v_version_version_slug_idx" ON "payload"."_cms_pages_v" USING btree ("version_slug");
  CREATE INDEX "_cms_pages_v_version_version_legacy_id_idx" ON "payload"."_cms_pages_v" USING btree ("version_legacy_id");
  CREATE INDEX "_cms_pages_v_version_meta_version_meta_image_idx" ON "payload"."_cms_pages_v" USING btree ("version_meta_image_id");
  CREATE INDEX "_cms_pages_v_version_version_updated_at_idx" ON "payload"."_cms_pages_v" USING btree ("version_updated_at");
  CREATE INDEX "_cms_pages_v_version_version_created_at_idx" ON "payload"."_cms_pages_v" USING btree ("version_created_at");
  CREATE INDEX "_cms_pages_v_version_version__status_idx" ON "payload"."_cms_pages_v" USING btree ("version__status");
  CREATE INDEX "_cms_pages_v_created_at_idx" ON "payload"."_cms_pages_v" USING btree ("created_at");
  CREATE INDEX "_cms_pages_v_updated_at_idx" ON "payload"."_cms_pages_v" USING btree ("updated_at");
  CREATE INDEX "_cms_pages_v_latest_idx" ON "payload"."_cms_pages_v" USING btree ("latest");
  CREATE INDEX "_cms_pages_v_autosave_idx" ON "payload"."_cms_pages_v" USING btree ("autosave");
  CREATE INDEX "_cms_pages_v_rels_order_idx" ON "payload"."_cms_pages_v_rels" USING btree ("order");
  CREATE INDEX "_cms_pages_v_rels_parent_idx" ON "payload"."_cms_pages_v_rels" USING btree ("parent_id");
  CREATE INDEX "_cms_pages_v_rels_path_idx" ON "payload"."_cms_pages_v_rels" USING btree ("path");
  CREATE INDEX "_cms_pages_v_rels_cms_categories_id_idx" ON "payload"."_cms_pages_v_rels" USING btree ("cms_categories_id");
  CREATE INDEX "_cms_pages_v_rels_cms_products_id_idx" ON "payload"."_cms_pages_v_rels" USING btree ("cms_products_id");
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pages_fk" FOREIGN KEY ("cms_pages_id") REFERENCES "payload"."cms_pages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_cms_pages_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_pages_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_pb_hero_slides" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_pb_hero" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_pb_trust_badges" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_pb_trust" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_pb_cats" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_pb_deals" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_pb_prods" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_pb_finder" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_pb_brands" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_pb_installment" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_pb_testimonials" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_pb_social" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_pb_location" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_pb_text" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_pb_banner" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_pb_imgtext" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_pb_faq_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_pb_faq" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_pb_cta_buttons" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_pb_cta" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_pages" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_pages_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_cms_pb_hero_v_slides" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_cms_pb_hero_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_cms_pb_trust_v_badges" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_cms_pb_trust_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_cms_pb_cats_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_cms_pb_deals_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_cms_pb_prods_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_cms_pb_finder_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_cms_pb_brands_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_cms_pb_installment_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_cms_pb_testimonials_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_cms_pb_social_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_cms_pb_location_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_cms_pb_text_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_cms_pb_banner_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_cms_pb_imgtext_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_cms_pb_faq_v_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_cms_pb_faq_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_cms_pb_cta_v_buttons" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_cms_pb_cta_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_cms_pages_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_cms_pages_v_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."cms_pb_hero_slides" CASCADE;
  DROP TABLE "payload"."cms_pb_hero" CASCADE;
  DROP TABLE "payload"."cms_pb_trust_badges" CASCADE;
  DROP TABLE "payload"."cms_pb_trust" CASCADE;
  DROP TABLE "payload"."cms_pb_cats" CASCADE;
  DROP TABLE "payload"."cms_pb_deals" CASCADE;
  DROP TABLE "payload"."cms_pb_prods" CASCADE;
  DROP TABLE "payload"."cms_pb_finder" CASCADE;
  DROP TABLE "payload"."cms_pb_brands" CASCADE;
  DROP TABLE "payload"."cms_pb_installment" CASCADE;
  DROP TABLE "payload"."cms_pb_testimonials" CASCADE;
  DROP TABLE "payload"."cms_pb_social" CASCADE;
  DROP TABLE "payload"."cms_pb_location" CASCADE;
  DROP TABLE "payload"."cms_pb_text" CASCADE;
  DROP TABLE "payload"."cms_pb_banner" CASCADE;
  DROP TABLE "payload"."cms_pb_imgtext" CASCADE;
  DROP TABLE "payload"."cms_pb_faq_items" CASCADE;
  DROP TABLE "payload"."cms_pb_faq" CASCADE;
  DROP TABLE "payload"."cms_pb_cta_buttons" CASCADE;
  DROP TABLE "payload"."cms_pb_cta" CASCADE;
  DROP TABLE "payload"."cms_pages" CASCADE;
  DROP TABLE "payload"."cms_pages_rels" CASCADE;
  DROP TABLE "payload"."_cms_pb_hero_v_slides" CASCADE;
  DROP TABLE "payload"."_cms_pb_hero_v" CASCADE;
  DROP TABLE "payload"."_cms_pb_trust_v_badges" CASCADE;
  DROP TABLE "payload"."_cms_pb_trust_v" CASCADE;
  DROP TABLE "payload"."_cms_pb_cats_v" CASCADE;
  DROP TABLE "payload"."_cms_pb_deals_v" CASCADE;
  DROP TABLE "payload"."_cms_pb_prods_v" CASCADE;
  DROP TABLE "payload"."_cms_pb_finder_v" CASCADE;
  DROP TABLE "payload"."_cms_pb_brands_v" CASCADE;
  DROP TABLE "payload"."_cms_pb_installment_v" CASCADE;
  DROP TABLE "payload"."_cms_pb_testimonials_v" CASCADE;
  DROP TABLE "payload"."_cms_pb_social_v" CASCADE;
  DROP TABLE "payload"."_cms_pb_location_v" CASCADE;
  DROP TABLE "payload"."_cms_pb_text_v" CASCADE;
  DROP TABLE "payload"."_cms_pb_banner_v" CASCADE;
  DROP TABLE "payload"."_cms_pb_imgtext_v" CASCADE;
  DROP TABLE "payload"."_cms_pb_faq_v_items" CASCADE;
  DROP TABLE "payload"."_cms_pb_faq_v" CASCADE;
  DROP TABLE "payload"."_cms_pb_cta_v_buttons" CASCADE;
  DROP TABLE "payload"."_cms_pb_cta_v" CASCADE;
  DROP TABLE "payload"."_cms_pages_v" CASCADE;
  DROP TABLE "payload"."_cms_pages_v_rels" CASCADE;
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_pages_fk";
  
  DROP INDEX "payload"."payload_locked_documents_rels_cms_pages_id_idx";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "cms_pages_id";
  DROP TYPE "payload"."enum_cms_pb_deals_source";
  DROP TYPE "payload"."enum_cms_pb_prods_source";
  DROP TYPE "payload"."enum_cms_pb_text_width";
  DROP TYPE "payload"."enum_cms_pb_banner_align";
  DROP TYPE "payload"."enum_cms_pb_banner_height";
  DROP TYPE "payload"."enum_cms_pb_imgtext_image_side";
  DROP TYPE "payload"."enum_cms_pb_cta_buttons_style";
  DROP TYPE "payload"."enum_cms_pages_status";
  DROP TYPE "payload"."enum__cms_pb_deals_v_source";
  DROP TYPE "payload"."enum__cms_pb_prods_v_source";
  DROP TYPE "payload"."enum__cms_pb_text_v_width";
  DROP TYPE "payload"."enum__cms_pb_banner_v_align";
  DROP TYPE "payload"."enum__cms_pb_banner_v_height";
  DROP TYPE "payload"."enum__cms_pb_imgtext_v_image_side";
  DROP TYPE "payload"."enum__cms_pb_cta_v_buttons_style";
  DROP TYPE "payload"."enum__cms_pages_v_version_status";`)
}
