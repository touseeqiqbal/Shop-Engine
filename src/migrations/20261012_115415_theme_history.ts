import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum__cms_theme_settings_v_version_body_font" AS ENUM('inter', 'space-grotesk', 'montserrat', 'poppins');
  CREATE TYPE "payload"."enum__cms_theme_settings_v_version_heading_font" AS ENUM('inter', 'space-grotesk', 'montserrat', 'poppins');
  CREATE TYPE "payload"."enum__cms_theme_settings_v_version_button_style" AS ENUM('pill', 'rounded', 'square');
  CREATE TYPE "payload"."enum__cms_theme_settings_v_version_card_radius" AS ENUM('sm', 'md', 'xl', '2xl');
  CREATE TYPE "payload"."enum__cms_theme_settings_v_version_default_mode" AS ENUM('dark', 'light');
  CREATE TYPE "payload"."enum__cms_whatsapp_button_v_version_position" AS ENUM('right', 'left');
  CREATE TABLE "payload"."_cms_theme_settings_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_logo_dark_id" integer,
  	"version_logo_light_id" integer,
  	"version_favicon_id" integer,
  	"version_logo_height" numeric DEFAULT 36,
  	"version_background" varchar DEFAULT '#0a0a0f',
  	"version_background_light" varchar DEFAULT '#f5f6fa',
  	"version_accent" varchar DEFAULT '#00d4ff',
  	"version_gradient_from" varchar DEFAULT '#00b4f0',
  	"version_gradient_via" varchar DEFAULT '#3b82f6',
  	"version_gradient_to" varchar DEFAULT '#8b5cf6',
  	"version_body_font" "payload"."enum__cms_theme_settings_v_version_body_font" DEFAULT 'inter',
  	"version_heading_font" "payload"."enum__cms_theme_settings_v_version_heading_font" DEFAULT 'space-grotesk',
  	"version_button_style" "payload"."enum__cms_theme_settings_v_version_button_style" DEFAULT 'pill',
  	"version_card_radius" "payload"."enum__cms_theme_settings_v_version_card_radius" DEFAULT 'xl',
  	"version_default_mode" "payload"."enum__cms_theme_settings_v_version_default_mode" DEFAULT 'dark',
  	"version_allow_mode_toggle" boolean DEFAULT true,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."_cms_announcement_bar_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_enabled" boolean DEFAULT true,
  	"version_text" varchar DEFAULT 'Free delivery on orders above Rs 15,000 · Cash on Delivery all over Pakistan',
  	"version_link_url" varchar,
  	"version_link_label" varchar,
  	"version_background_color" varchar DEFAULT '',
  	"version_text_color" varchar DEFAULT '',
  	"version_starts_at" timestamp(3) with time zone,
  	"version_ends_at" timestamp(3) with time zone,
  	"version_show_contact_links" boolean DEFAULT true,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."_cms_header_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_main_menu_id" integer,
  	"version_mobile_menu_id" integer,
  	"version_sticky" boolean DEFAULT true,
  	"version_show_search" boolean DEFAULT true,
  	"version_show_language_toggle" boolean DEFAULT true,
  	"version_show_account_links" boolean DEFAULT true,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."_cms_footer_v_version_columns" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"menu_id" integer NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_cms_footer_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_about" varchar DEFAULT 'Laptops & Tech Accessories – Delivered All Over Pakistan. New, used & refurbished laptops and computer accessories from Saddar, Karachi.',
  	"version_show_contact_info" boolean DEFAULT true,
  	"version_show_social_links" boolean DEFAULT true,
  	"version_show_city_links" boolean DEFAULT true,
  	"version_copyright" varchar DEFAULT '© {year} {store}. All rights reserved.',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."_cms_footer_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "payload"."_cms_whatsapp_button_v_version_contacts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"phone" varchar NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_cms_whatsapp_button_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_enabled" boolean DEFAULT true,
  	"version_message" varchar DEFAULT 'Hi Urko Tech Store! I need help with an order.',
  	"version_note" varchar,
  	"version_position" "payload"."enum__cms_whatsapp_button_v_version_position" DEFAULT 'right',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload"."_cms_theme_settings_v" ADD CONSTRAINT "_cms_theme_settings_v_version_logo_dark_id_cms_media_id_fk" FOREIGN KEY ("version_logo_dark_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_theme_settings_v" ADD CONSTRAINT "_cms_theme_settings_v_version_logo_light_id_cms_media_id_fk" FOREIGN KEY ("version_logo_light_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_theme_settings_v" ADD CONSTRAINT "_cms_theme_settings_v_version_favicon_id_cms_media_id_fk" FOREIGN KEY ("version_favicon_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_header_v" ADD CONSTRAINT "_cms_header_v_version_main_menu_id_cms_menus_id_fk" FOREIGN KEY ("version_main_menu_id") REFERENCES "payload"."cms_menus"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_header_v" ADD CONSTRAINT "_cms_header_v_version_mobile_menu_id_cms_menus_id_fk" FOREIGN KEY ("version_mobile_menu_id") REFERENCES "payload"."cms_menus"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_footer_v_version_columns" ADD CONSTRAINT "_cms_footer_v_version_columns_menu_id_cms_menus_id_fk" FOREIGN KEY ("menu_id") REFERENCES "payload"."cms_menus"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_footer_v_version_columns" ADD CONSTRAINT "_cms_footer_v_version_columns_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_cms_footer_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_footer_v_texts" ADD CONSTRAINT "_cms_footer_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."_cms_footer_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_whatsapp_button_v_version_contacts" ADD CONSTRAINT "_cms_whatsapp_button_v_version_contacts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_cms_whatsapp_button_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "_cms_theme_settings_v_version_version_logo_dark_idx" ON "payload"."_cms_theme_settings_v" USING btree ("version_logo_dark_id");
  CREATE INDEX "_cms_theme_settings_v_version_version_logo_light_idx" ON "payload"."_cms_theme_settings_v" USING btree ("version_logo_light_id");
  CREATE INDEX "_cms_theme_settings_v_version_version_favicon_idx" ON "payload"."_cms_theme_settings_v" USING btree ("version_favicon_id");
  CREATE INDEX "_cms_theme_settings_v_created_at_idx" ON "payload"."_cms_theme_settings_v" USING btree ("created_at");
  CREATE INDEX "_cms_theme_settings_v_updated_at_idx" ON "payload"."_cms_theme_settings_v" USING btree ("updated_at");
  CREATE INDEX "_cms_announcement_bar_v_created_at_idx" ON "payload"."_cms_announcement_bar_v" USING btree ("created_at");
  CREATE INDEX "_cms_announcement_bar_v_updated_at_idx" ON "payload"."_cms_announcement_bar_v" USING btree ("updated_at");
  CREATE INDEX "_cms_header_v_version_version_main_menu_idx" ON "payload"."_cms_header_v" USING btree ("version_main_menu_id");
  CREATE INDEX "_cms_header_v_version_version_mobile_menu_idx" ON "payload"."_cms_header_v" USING btree ("version_mobile_menu_id");
  CREATE INDEX "_cms_header_v_created_at_idx" ON "payload"."_cms_header_v" USING btree ("created_at");
  CREATE INDEX "_cms_header_v_updated_at_idx" ON "payload"."_cms_header_v" USING btree ("updated_at");
  CREATE INDEX "_cms_footer_v_version_columns_order_idx" ON "payload"."_cms_footer_v_version_columns" USING btree ("_order");
  CREATE INDEX "_cms_footer_v_version_columns_parent_id_idx" ON "payload"."_cms_footer_v_version_columns" USING btree ("_parent_id");
  CREATE INDEX "_cms_footer_v_version_columns_menu_idx" ON "payload"."_cms_footer_v_version_columns" USING btree ("menu_id");
  CREATE INDEX "_cms_footer_v_created_at_idx" ON "payload"."_cms_footer_v" USING btree ("created_at");
  CREATE INDEX "_cms_footer_v_updated_at_idx" ON "payload"."_cms_footer_v" USING btree ("updated_at");
  CREATE INDEX "_cms_footer_v_texts_order_parent" ON "payload"."_cms_footer_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "_cms_whatsapp_button_v_version_contacts_order_idx" ON "payload"."_cms_whatsapp_button_v_version_contacts" USING btree ("_order");
  CREATE INDEX "_cms_whatsapp_button_v_version_contacts_parent_id_idx" ON "payload"."_cms_whatsapp_button_v_version_contacts" USING btree ("_parent_id");
  CREATE INDEX "_cms_whatsapp_button_v_created_at_idx" ON "payload"."_cms_whatsapp_button_v" USING btree ("created_at");
  CREATE INDEX "_cms_whatsapp_button_v_updated_at_idx" ON "payload"."_cms_whatsapp_button_v" USING btree ("updated_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "payload"."_cms_theme_settings_v" CASCADE;
  DROP TABLE "payload"."_cms_announcement_bar_v" CASCADE;
  DROP TABLE "payload"."_cms_header_v" CASCADE;
  DROP TABLE "payload"."_cms_footer_v_version_columns" CASCADE;
  DROP TABLE "payload"."_cms_footer_v" CASCADE;
  DROP TABLE "payload"."_cms_footer_v_texts" CASCADE;
  DROP TABLE "payload"."_cms_whatsapp_button_v_version_contacts" CASCADE;
  DROP TABLE "payload"."_cms_whatsapp_button_v" CASCADE;
  DROP TYPE "payload"."enum__cms_theme_settings_v_version_body_font";
  DROP TYPE "payload"."enum__cms_theme_settings_v_version_heading_font";
  DROP TYPE "payload"."enum__cms_theme_settings_v_version_button_style";
  DROP TYPE "payload"."enum__cms_theme_settings_v_version_card_radius";
  DROP TYPE "payload"."enum__cms_theme_settings_v_version_default_mode";
  DROP TYPE "payload"."enum__cms_whatsapp_button_v_version_position";`)
}
