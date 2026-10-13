import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_cms_menus_items_children_children_type" AS ENUM('category', 'product', 'post', 'custom');
  CREATE TYPE "payload"."enum_cms_menus_items_children_type" AS ENUM('category', 'product', 'post', 'custom');
  CREATE TYPE "payload"."enum_cms_menus_items_type" AS ENUM('category', 'product', 'post', 'custom');
  CREATE TYPE "payload"."enum_cms_theme_settings_body_font" AS ENUM('inter', 'space-grotesk', 'montserrat', 'poppins');
  CREATE TYPE "payload"."enum_cms_theme_settings_heading_font" AS ENUM('inter', 'space-grotesk', 'montserrat', 'poppins');
  CREATE TYPE "payload"."enum_cms_theme_settings_button_style" AS ENUM('pill', 'rounded', 'square');
  CREATE TYPE "payload"."enum_cms_theme_settings_card_radius" AS ENUM('sm', 'md', 'xl', '2xl');
  CREATE TYPE "payload"."enum_cms_theme_settings_default_mode" AS ENUM('dark', 'light');
  CREATE TYPE "payload"."enum_cms_whatsapp_button_position" AS ENUM('right', 'left');
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
  
  CREATE TABLE "payload"."cms_menus_items_children" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"type" "payload"."enum_cms_menus_items_children_type" DEFAULT 'custom' NOT NULL,
  	"label" varchar,
  	"new_tab" boolean,
  	"category_id" integer,
  	"product_id" integer,
  	"post_id" integer,
  	"url" varchar
  );
  
  CREATE TABLE "payload"."cms_menus_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"type" "payload"."enum_cms_menus_items_type" DEFAULT 'custom' NOT NULL,
  	"label" varchar,
  	"new_tab" boolean,
  	"category_id" integer,
  	"product_id" integer,
  	"post_id" integer,
  	"url" varchar,
  	"mega_menu" boolean,
  	"icon" varchar,
  	"featured_image_id" integer
  );
  
  CREATE TABLE "payload"."cms_menus" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"handle" varchar NOT NULL,
  	"legacy_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_theme_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"logo_dark_id" integer,
  	"logo_light_id" integer,
  	"favicon_id" integer,
  	"logo_height" numeric DEFAULT 36,
  	"background" varchar DEFAULT '#0a0a0f',
  	"background_light" varchar DEFAULT '#f5f6fa',
  	"accent" varchar DEFAULT '#00d4ff',
  	"gradient_from" varchar DEFAULT '#00b4f0',
  	"gradient_via" varchar DEFAULT '#3b82f6',
  	"gradient_to" varchar DEFAULT '#8b5cf6',
  	"body_font" "payload"."enum_cms_theme_settings_body_font" DEFAULT 'inter',
  	"heading_font" "payload"."enum_cms_theme_settings_heading_font" DEFAULT 'space-grotesk',
  	"button_style" "payload"."enum_cms_theme_settings_button_style" DEFAULT 'pill',
  	"card_radius" "payload"."enum_cms_theme_settings_card_radius" DEFAULT 'xl',
  	"default_mode" "payload"."enum_cms_theme_settings_default_mode" DEFAULT 'dark',
  	"allow_mode_toggle" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload"."cms_announcement_bar" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"text" varchar DEFAULT 'Free delivery on orders above Rs 15,000 · Cash on Delivery all over Pakistan',
  	"link_url" varchar,
  	"link_label" varchar,
  	"background_color" varchar DEFAULT '',
  	"text_color" varchar DEFAULT '',
  	"starts_at" timestamp(3) with time zone,
  	"ends_at" timestamp(3) with time zone,
  	"show_contact_links" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload"."cms_header" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"main_menu_id" integer,
  	"mobile_menu_id" integer,
  	"sticky" boolean DEFAULT true,
  	"show_search" boolean DEFAULT true,
  	"show_language_toggle" boolean DEFAULT true,
  	"show_account_links" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload"."cms_footer_columns" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"menu_id" integer NOT NULL
  );
  
  CREATE TABLE "payload"."cms_footer" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"about" varchar DEFAULT 'Laptops & Tech Accessories – Delivered All Over Pakistan. New, used & refurbished laptops and computer accessories from Saddar, Karachi.',
  	"show_contact_info" boolean DEFAULT true,
  	"show_social_links" boolean DEFAULT true,
  	"show_city_links" boolean DEFAULT true,
  	"copyright" varchar DEFAULT '© {year} {store}. All rights reserved.',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload"."cms_footer_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "payload"."cms_whatsapp_button_numbers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"number" varchar NOT NULL
  );
  
  CREATE TABLE "payload"."cms_whatsapp_button" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"message" varchar DEFAULT 'Hi Urko Tech Store! I need help with an order.',
  	"note" varchar,
  	"position" "payload"."enum_cms_whatsapp_button_position" DEFAULT 'right',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_menus_id" integer;
  ALTER TABLE "payload"."cms_menus_items_children_children" ADD CONSTRAINT "cms_menus_items_children_children_category_id_cms_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "payload"."cms_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_menus_items_children_children" ADD CONSTRAINT "cms_menus_items_children_children_product_id_cms_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "payload"."cms_products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_menus_items_children_children" ADD CONSTRAINT "cms_menus_items_children_children_post_id_cms_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "payload"."cms_posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_menus_items_children_children" ADD CONSTRAINT "cms_menus_items_children_children_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_menus_items_children"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_menus_items_children" ADD CONSTRAINT "cms_menus_items_children_category_id_cms_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "payload"."cms_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_menus_items_children" ADD CONSTRAINT "cms_menus_items_children_product_id_cms_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "payload"."cms_products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_menus_items_children" ADD CONSTRAINT "cms_menus_items_children_post_id_cms_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "payload"."cms_posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_menus_items_children" ADD CONSTRAINT "cms_menus_items_children_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_menus_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_menus_items" ADD CONSTRAINT "cms_menus_items_category_id_cms_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "payload"."cms_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_menus_items" ADD CONSTRAINT "cms_menus_items_product_id_cms_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "payload"."cms_products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_menus_items" ADD CONSTRAINT "cms_menus_items_post_id_cms_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "payload"."cms_posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_menus_items" ADD CONSTRAINT "cms_menus_items_featured_image_id_cms_media_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_menus_items" ADD CONSTRAINT "cms_menus_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_menus"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_theme_settings" ADD CONSTRAINT "cms_theme_settings_logo_dark_id_cms_media_id_fk" FOREIGN KEY ("logo_dark_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_theme_settings" ADD CONSTRAINT "cms_theme_settings_logo_light_id_cms_media_id_fk" FOREIGN KEY ("logo_light_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_theme_settings" ADD CONSTRAINT "cms_theme_settings_favicon_id_cms_media_id_fk" FOREIGN KEY ("favicon_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_header" ADD CONSTRAINT "cms_header_main_menu_id_cms_menus_id_fk" FOREIGN KEY ("main_menu_id") REFERENCES "payload"."cms_menus"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_header" ADD CONSTRAINT "cms_header_mobile_menu_id_cms_menus_id_fk" FOREIGN KEY ("mobile_menu_id") REFERENCES "payload"."cms_menus"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_footer_columns" ADD CONSTRAINT "cms_footer_columns_menu_id_cms_menus_id_fk" FOREIGN KEY ("menu_id") REFERENCES "payload"."cms_menus"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_footer_columns" ADD CONSTRAINT "cms_footer_columns_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_footer"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_footer_texts" ADD CONSTRAINT "cms_footer_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_footer"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_whatsapp_button_numbers" ADD CONSTRAINT "cms_whatsapp_button_numbers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_whatsapp_button"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "cms_menus_items_children_children_order_idx" ON "payload"."cms_menus_items_children_children" USING btree ("_order");
  CREATE INDEX "cms_menus_items_children_children_parent_id_idx" ON "payload"."cms_menus_items_children_children" USING btree ("_parent_id");
  CREATE INDEX "cms_menus_items_children_children_category_idx" ON "payload"."cms_menus_items_children_children" USING btree ("category_id");
  CREATE INDEX "cms_menus_items_children_children_product_idx" ON "payload"."cms_menus_items_children_children" USING btree ("product_id");
  CREATE INDEX "cms_menus_items_children_children_post_idx" ON "payload"."cms_menus_items_children_children" USING btree ("post_id");
  CREATE INDEX "cms_menus_items_children_order_idx" ON "payload"."cms_menus_items_children" USING btree ("_order");
  CREATE INDEX "cms_menus_items_children_parent_id_idx" ON "payload"."cms_menus_items_children" USING btree ("_parent_id");
  CREATE INDEX "cms_menus_items_children_category_idx" ON "payload"."cms_menus_items_children" USING btree ("category_id");
  CREATE INDEX "cms_menus_items_children_product_idx" ON "payload"."cms_menus_items_children" USING btree ("product_id");
  CREATE INDEX "cms_menus_items_children_post_idx" ON "payload"."cms_menus_items_children" USING btree ("post_id");
  CREATE INDEX "cms_menus_items_order_idx" ON "payload"."cms_menus_items" USING btree ("_order");
  CREATE INDEX "cms_menus_items_parent_id_idx" ON "payload"."cms_menus_items" USING btree ("_parent_id");
  CREATE INDEX "cms_menus_items_category_idx" ON "payload"."cms_menus_items" USING btree ("category_id");
  CREATE INDEX "cms_menus_items_product_idx" ON "payload"."cms_menus_items" USING btree ("product_id");
  CREATE INDEX "cms_menus_items_post_idx" ON "payload"."cms_menus_items" USING btree ("post_id");
  CREATE INDEX "cms_menus_items_featured_image_idx" ON "payload"."cms_menus_items" USING btree ("featured_image_id");
  CREATE UNIQUE INDEX "cms_menus_handle_idx" ON "payload"."cms_menus" USING btree ("handle");
  CREATE UNIQUE INDEX "cms_menus_legacy_id_idx" ON "payload"."cms_menus" USING btree ("legacy_id");
  CREATE INDEX "cms_menus_updated_at_idx" ON "payload"."cms_menus" USING btree ("updated_at");
  CREATE INDEX "cms_menus_created_at_idx" ON "payload"."cms_menus" USING btree ("created_at");
  CREATE INDEX "cms_theme_settings_logo_dark_idx" ON "payload"."cms_theme_settings" USING btree ("logo_dark_id");
  CREATE INDEX "cms_theme_settings_logo_light_idx" ON "payload"."cms_theme_settings" USING btree ("logo_light_id");
  CREATE INDEX "cms_theme_settings_favicon_idx" ON "payload"."cms_theme_settings" USING btree ("favicon_id");
  CREATE INDEX "cms_header_main_menu_idx" ON "payload"."cms_header" USING btree ("main_menu_id");
  CREATE INDEX "cms_header_mobile_menu_idx" ON "payload"."cms_header" USING btree ("mobile_menu_id");
  CREATE INDEX "cms_footer_columns_order_idx" ON "payload"."cms_footer_columns" USING btree ("_order");
  CREATE INDEX "cms_footer_columns_parent_id_idx" ON "payload"."cms_footer_columns" USING btree ("_parent_id");
  CREATE INDEX "cms_footer_columns_menu_idx" ON "payload"."cms_footer_columns" USING btree ("menu_id");
  CREATE INDEX "cms_footer_texts_order_parent" ON "payload"."cms_footer_texts" USING btree ("order","parent_id");
  CREATE INDEX "cms_whatsapp_button_numbers_order_idx" ON "payload"."cms_whatsapp_button_numbers" USING btree ("_order");
  CREATE INDEX "cms_whatsapp_button_numbers_parent_id_idx" ON "payload"."cms_whatsapp_button_numbers" USING btree ("_parent_id");
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_menus_fk" FOREIGN KEY ("cms_menus_id") REFERENCES "payload"."cms_menus"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_cms_menus_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_menus_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_menus_items_children_children" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_menus_items_children" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_menus_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_menus" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_theme_settings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_announcement_bar" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_header" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_footer_columns" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_footer" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_footer_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_whatsapp_button_numbers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_whatsapp_button" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."cms_menus_items_children_children" CASCADE;
  DROP TABLE "payload"."cms_menus_items_children" CASCADE;
  DROP TABLE "payload"."cms_menus_items" CASCADE;
  DROP TABLE "payload"."cms_menus" CASCADE;
  DROP TABLE "payload"."cms_theme_settings" CASCADE;
  DROP TABLE "payload"."cms_announcement_bar" CASCADE;
  DROP TABLE "payload"."cms_header" CASCADE;
  DROP TABLE "payload"."cms_footer_columns" CASCADE;
  DROP TABLE "payload"."cms_footer" CASCADE;
  DROP TABLE "payload"."cms_footer_texts" CASCADE;
  DROP TABLE "payload"."cms_whatsapp_button_numbers" CASCADE;
  DROP TABLE "payload"."cms_whatsapp_button" CASCADE;
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_menus_fk";
  
  DROP INDEX "payload"."payload_locked_documents_rels_cms_menus_id_idx";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "cms_menus_id";
  DROP TYPE "payload"."enum_cms_menus_items_children_children_type";
  DROP TYPE "payload"."enum_cms_menus_items_children_type";
  DROP TYPE "payload"."enum_cms_menus_items_type";
  DROP TYPE "payload"."enum_cms_theme_settings_body_font";
  DROP TYPE "payload"."enum_cms_theme_settings_heading_font";
  DROP TYPE "payload"."enum_cms_theme_settings_button_style";
  DROP TYPE "payload"."enum_cms_theme_settings_card_radius";
  DROP TYPE "payload"."enum_cms_theme_settings_default_mode";
  DROP TYPE "payload"."enum_cms_whatsapp_button_position";`)
}
