import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Payload lives in its own schema, separate from the legacy Prisma tables in `public`.
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS "payload";`)
  await db.execute(sql`
   CREATE TYPE "payload"."enum_cms_users_role" AS ENUM('owner', 'manager', 'staff', 'customer');
  CREATE TYPE "payload"."enum_cms_products_condition" AS ENUM('new', 'used-a-plus', 'used-a', 'refurbished', 'open-box');
  CREATE TYPE "payload"."enum_cms_products_shipping_class" AS ENUM('laptop', 'small', 'large');
  CREATE TYPE "payload"."enum_cms_products_status" AS ENUM('draft', 'active', 'archived');
  CREATE TYPE "payload"."enum__cms_products_v_version_condition" AS ENUM('new', 'used-a-plus', 'used-a', 'refurbished', 'open-box');
  CREATE TYPE "payload"."enum__cms_products_v_version_shipping_class" AS ENUM('laptop', 'small', 'large');
  CREATE TYPE "payload"."enum__cms_products_v_version_status" AS ENUM('draft', 'active', 'archived');
  CREATE TYPE "payload"."enum_cms_categories_attributes_kind" AS ENUM('select', 'boolean', 'range');
  CREATE TYPE "payload"."enum_cms_posts_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum__cms_posts_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum_cms_orders_history_status" AS ENUM('pending', 'confirmed', 'dispatched', 'out-for-delivery', 'delivered', 'cancelled', 'returned');
  CREATE TYPE "payload"."enum_cms_orders_status" AS ENUM('pending', 'confirmed', 'dispatched', 'out-for-delivery', 'delivered', 'cancelled', 'returned');
  CREATE TYPE "payload"."enum_cms_orders_payment_method" AS ENUM('cod', 'jazzcash', 'easypaisa', 'bank', 'card');
  CREATE TYPE "payload"."enum_cms_orders_payment_status" AS ENUM('unpaid', 'awaiting-verification', 'paid', 'refunded', 'partial');
  CREATE TYPE "payload"."enum_cms_wholesale_inquiries_buyer_type" AS ENUM('shop', 'reseller', 'corporate', 'education', 'individual', 'other');
  CREATE TYPE "payload"."enum_cms_wholesale_inquiries_status" AS ENUM('new', 'contacted', 'quoted', 'won', 'lost');
  CREATE TYPE "payload"."enum_cms_redirects_to_type" AS ENUM('reference', 'custom');
  CREATE TYPE "payload"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'schedulePublish');
  CREATE TYPE "payload"."enum_payload_jobs_log_state" AS ENUM('failed', 'succeeded');
  CREATE TYPE "payload"."enum_payload_jobs_task_slug" AS ENUM('inline', 'schedulePublish');
  CREATE TYPE "payload"."enum_payload_folders_folder_type" AS ENUM('media');
  CREATE TABLE "payload"."cms_users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "payload"."cms_users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"phone" varchar,
  	"role" "payload"."enum_cms_users_role" DEFAULT 'customer' NOT NULL,
  	"addresses" jsonb DEFAULT '[]'::jsonb,
  	"wishlist" jsonb DEFAULT '[]'::jsonb,
  	"notes" varchar,
  	"blocked" boolean DEFAULT false,
  	"legacy_password_hash" varchar,
  	"legacy_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload"."cms_users_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "payload"."cms_media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"caption" varchar,
  	"source_url" varchar,
  	"prefix" varchar DEFAULT 'media',
  	"_objectkey" varchar,
  	"folder_id" integer,
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
  	"focal_y" numeric,
  	"sizes_thumbnail_url" varchar,
  	"sizes_thumbnail_width" numeric,
  	"sizes_thumbnail_height" numeric,
  	"sizes_thumbnail_mime_type" varchar,
  	"sizes_thumbnail_filesize" numeric,
  	"sizes_thumbnail_filename" varchar,
  	"sizes_card_url" varchar,
  	"sizes_card_width" numeric,
  	"sizes_card_height" numeric,
  	"sizes_card_mime_type" varchar,
  	"sizes_card_filesize" numeric,
  	"sizes_card_filename" varchar,
  	"sizes_full_url" varchar,
  	"sizes_full_width" numeric,
  	"sizes_full_height" numeric,
  	"sizes_full_mime_type" varchar,
  	"sizes_full_filesize" numeric,
  	"sizes_full_filename" varchar
  );
  
  CREATE TABLE "payload"."cms_media_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "payload"."cms_products_specs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"value" varchar NOT NULL
  );
  
  CREATE TABLE "payload"."cms_products_upgrades" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"option_id" varchar,
  	"group" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"price" numeric NOT NULL
  );
  
  CREATE TABLE "payload"."cms_products" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"brand_id" integer NOT NULL,
  	"model" varchar,
  	"category_id" integer NOT NULL,
  	"short_description" varchar,
  	"description" jsonb,
  	"video" varchar,
  	"price" numeric NOT NULL,
  	"compare_at_price" numeric,
  	"cost_price" numeric,
  	"price_on_request" boolean,
  	"sku" varchar NOT NULL,
  	"stock" numeric DEFAULT 0,
  	"low_stock_threshold" numeric DEFAULT 2,
  	"condition" "payload"."enum_cms_products_condition",
  	"warranty" varchar,
  	"condition_notes" varchar,
  	"in_the_box" varchar,
  	"shipping_class" "payload"."enum_cms_products_shipping_class" DEFAULT 'small',
  	"weight" numeric,
  	"wholesale_available" boolean,
  	"wholesale_min_qty" numeric,
  	"wholesale_lot_size" numeric,
  	"wholesale_grades" varchar,
  	"wholesale_contents" varchar,
  	"wholesale_note" varchar,
  	"attributes" jsonb,
  	"bundle_discount_percent" numeric,
  	"status" "payload"."enum_cms_products_status" DEFAULT 'draft' NOT NULL,
  	"slug" varchar NOT NULL,
  	"featured" boolean,
  	"best_seller" boolean,
  	"hot_deal" boolean,
  	"deal_ends_at" timestamp(3) with time zone,
  	"rating" numeric DEFAULT 0,
  	"review_count" numeric DEFAULT 0,
  	"sold_count" numeric DEFAULT 0,
  	"legacy_id" varchar,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"meta_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_products_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "payload"."cms_products_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"cms_media_id" integer,
  	"cms_laptop_models_id" integer,
  	"cms_products_id" integer
  );
  
  CREATE TABLE "payload"."_cms_products_v_version_specs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"value" varchar NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_cms_products_v_version_upgrades" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"option_id" varchar,
  	"group" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"price" numeric NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_cms_products_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar NOT NULL,
  	"version_brand_id" integer NOT NULL,
  	"version_model" varchar,
  	"version_category_id" integer NOT NULL,
  	"version_short_description" varchar,
  	"version_description" jsonb,
  	"version_video" varchar,
  	"version_price" numeric NOT NULL,
  	"version_compare_at_price" numeric,
  	"version_cost_price" numeric,
  	"version_price_on_request" boolean,
  	"version_sku" varchar NOT NULL,
  	"version_stock" numeric DEFAULT 0,
  	"version_low_stock_threshold" numeric DEFAULT 2,
  	"version_condition" "payload"."enum__cms_products_v_version_condition",
  	"version_warranty" varchar,
  	"version_condition_notes" varchar,
  	"version_in_the_box" varchar,
  	"version_shipping_class" "payload"."enum__cms_products_v_version_shipping_class" DEFAULT 'small',
  	"version_weight" numeric,
  	"version_wholesale_available" boolean,
  	"version_wholesale_min_qty" numeric,
  	"version_wholesale_lot_size" numeric,
  	"version_wholesale_grades" varchar,
  	"version_wholesale_contents" varchar,
  	"version_wholesale_note" varchar,
  	"version_attributes" jsonb,
  	"version_bundle_discount_percent" numeric,
  	"version_status" "payload"."enum__cms_products_v_version_status" DEFAULT 'draft' NOT NULL,
  	"version_slug" varchar NOT NULL,
  	"version_featured" boolean,
  	"version_best_seller" boolean,
  	"version_hot_deal" boolean,
  	"version_deal_ends_at" timestamp(3) with time zone,
  	"version_rating" numeric DEFAULT 0,
  	"version_review_count" numeric DEFAULT 0,
  	"version_sold_count" numeric DEFAULT 0,
  	"version_legacy_id" varchar,
  	"version_meta_title" varchar,
  	"version_meta_description" varchar,
  	"version_meta_image_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."_cms_products_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "payload"."_cms_products_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"cms_media_id" integer,
  	"cms_laptop_models_id" integer,
  	"cms_products_id" integer
  );
  
  CREATE TABLE "payload"."cms_categories_attributes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"kind" "payload"."enum_cms_categories_attributes_kind" DEFAULT 'select' NOT NULL,
  	"unit" varchar
  );
  
  CREATE TABLE "payload"."cms_categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"name_ur" varchar,
  	"slug" varchar NOT NULL,
  	"parent_id" integer,
  	"icon" varchar DEFAULT 'Package',
  	"image_id" integer,
  	"short_description" varchar,
  	"seo_content" varchar,
  	"compatibility" boolean,
  	"featured" boolean,
  	"sort_order" numeric DEFAULT 0,
  	"legacy_id" varchar,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"meta_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_categories_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "payload"."cms_brands" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"logo_id" integer,
  	"legacy_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_laptop_models" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"brand_id" integer NOT NULL,
  	"series" varchar,
  	"slug" varchar NOT NULL,
  	"legacy_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_reviews" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"city" varchar,
  	"rating" numeric NOT NULL,
  	"title" varchar,
  	"body" varchar NOT NULL,
  	"approved" boolean DEFAULT false,
  	"verified" boolean DEFAULT false,
  	"legacy_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_posts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"excerpt" varchar,
  	"cover_id" integer,
  	"content" jsonb,
  	"slug" varchar,
  	"category" varchar,
  	"author" varchar DEFAULT 'Urko Tech Team',
  	"published_at" timestamp(3) with time zone,
  	"legacy_id" varchar,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"meta_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "payload"."enum_cms_posts_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "payload"."cms_posts_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "payload"."cms_posts_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"cms_products_id" integer,
  	"cms_categories_id" integer
  );
  
  CREATE TABLE "payload"."_cms_posts_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_excerpt" varchar,
  	"version_cover_id" integer,
  	"version_content" jsonb,
  	"version_slug" varchar,
  	"version_category" varchar,
  	"version_author" varchar DEFAULT 'Urko Tech Team',
  	"version_published_at" timestamp(3) with time zone,
  	"version_legacy_id" varchar,
  	"version_meta_title" varchar,
  	"version_meta_description" varchar,
  	"version_meta_image_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "payload"."enum__cms_posts_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "payload"."_cms_posts_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "payload"."_cms_posts_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"cms_products_id" integer,
  	"cms_categories_id" integer
  );
  
  CREATE TABLE "payload"."cms_orders_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" integer,
  	"title" varchar NOT NULL,
  	"slug" varchar,
  	"url" varchar,
  	"unit_price" numeric NOT NULL,
  	"qty" numeric NOT NULL,
  	"image" varchar,
  	"upgrades" jsonb
  );
  
  CREATE TABLE "payload"."cms_orders_history" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"status" "payload"."enum_cms_orders_history_status" NOT NULL,
  	"at" timestamp(3) with time zone NOT NULL,
  	"note" varchar
  );
  
  CREATE TABLE "payload"."cms_orders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order_number" varchar NOT NULL,
  	"status" "payload"."enum_cms_orders_status" DEFAULT 'pending' NOT NULL,
  	"placed_at" timestamp(3) with time zone NOT NULL,
  	"customer_name" varchar NOT NULL,
  	"customer_phone" varchar NOT NULL,
  	"customer_email" varchar,
  	"customer_city" varchar NOT NULL,
  	"customer_address" varchar NOT NULL,
  	"customer_landmark" varchar,
  	"subtotal" numeric NOT NULL,
  	"discount" numeric DEFAULT 0,
  	"delivery_charge" numeric DEFAULT 0,
  	"total" numeric NOT NULL,
  	"advance_paid" numeric,
  	"coupon_code" varchar,
  	"payment_method" "payload"."enum_cms_orders_payment_method" NOT NULL,
  	"payment_status" "payload"."enum_cms_orders_payment_status" NOT NULL,
  	"payment_screenshot_key" varchar,
  	"courier" varchar,
  	"tracking_number" varchar,
  	"notes" varchar,
  	"user_id" integer,
  	"legacy_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_wholesale_inquiries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"business_name" varchar,
  	"phone" varchar NOT NULL,
  	"email" varchar,
  	"city" varchar NOT NULL,
  	"buyer_type" "payload"."enum_cms_wholesale_inquiries_buyer_type",
  	"items" jsonb,
  	"message" varchar,
  	"budget" varchar,
  	"admin_notes" varchar,
  	"source" varchar,
  	"status" "payload"."enum_cms_wholesale_inquiries_status" DEFAULT 'new',
  	"received_at" timestamp(3) with time zone,
  	"legacy_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_contact_messages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"phone" varchar,
  	"email" varchar,
  	"subject" varchar,
  	"message" varchar NOT NULL,
  	"handled" boolean DEFAULT false,
  	"received_at" timestamp(3) with time zone,
  	"legacy_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_redirects" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"from" varchar NOT NULL,
  	"to_type" "payload"."enum_cms_redirects_to_type" DEFAULT 'reference',
  	"to_url" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_redirects_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"cms_products_id" integer,
  	"cms_categories_id" integer,
  	"cms_posts_id" integer
  );
  
  CREATE TABLE "payload"."payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload"."payload_jobs_log" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"executed_at" timestamp(3) with time zone NOT NULL,
  	"completed_at" timestamp(3) with time zone NOT NULL,
  	"task_slug" "payload"."enum_payload_jobs_log_task_slug" NOT NULL,
  	"task_i_d" varchar NOT NULL,
  	"input" jsonb,
  	"output" jsonb,
  	"state" "payload"."enum_payload_jobs_log_state" NOT NULL,
  	"error" jsonb
  );
  
  CREATE TABLE "payload"."payload_jobs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"input" jsonb,
  	"completed_at" timestamp(3) with time zone,
  	"total_tried" numeric DEFAULT 0,
  	"has_error" boolean DEFAULT false,
  	"error" jsonb,
  	"task_slug" "payload"."enum_payload_jobs_task_slug",
  	"queue" varchar DEFAULT 'default',
  	"wait_until" timestamp(3) with time zone,
  	"processing" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."payload_folders_folder_type" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "payload"."enum_payload_folders_folder_type",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "payload"."payload_folders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"folder_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"cms_users_id" integer,
  	"cms_media_id" integer,
  	"cms_products_id" integer,
  	"cms_categories_id" integer,
  	"cms_brands_id" integer,
  	"cms_laptop_models_id" integer,
  	"cms_reviews_id" integer,
  	"cms_posts_id" integer,
  	"cms_orders_id" integer,
  	"cms_wholesale_inquiries_id" integer,
  	"cms_contact_messages_id" integer,
  	"cms_redirects_id" integer,
  	"payload_folders_id" integer
  );
  
  CREATE TABLE "payload"."payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"cms_users_id" integer
  );
  
  CREATE TABLE "payload"."payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload"."cms_users_sessions" ADD CONSTRAINT "cms_users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_users_texts" ADD CONSTRAINT "cms_users_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_media" ADD CONSTRAINT "cms_media_folder_id_payload_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "payload"."payload_folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_media_texts" ADD CONSTRAINT "cms_media_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_products_specs" ADD CONSTRAINT "cms_products_specs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_products_upgrades" ADD CONSTRAINT "cms_products_upgrades_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_products" ADD CONSTRAINT "cms_products_brand_id_cms_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "payload"."cms_brands"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_products" ADD CONSTRAINT "cms_products_category_id_cms_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "payload"."cms_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_products" ADD CONSTRAINT "cms_products_meta_image_id_cms_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_products_texts" ADD CONSTRAINT "cms_products_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_products_rels" ADD CONSTRAINT "cms_products_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_products_rels" ADD CONSTRAINT "cms_products_rels_media_fk" FOREIGN KEY ("cms_media_id") REFERENCES "payload"."cms_media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_products_rels" ADD CONSTRAINT "cms_products_rels_laptop_models_fk" FOREIGN KEY ("cms_laptop_models_id") REFERENCES "payload"."cms_laptop_models"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_products_rels" ADD CONSTRAINT "cms_products_rels_products_fk" FOREIGN KEY ("cms_products_id") REFERENCES "payload"."cms_products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_products_v_version_specs" ADD CONSTRAINT "_cms_products_v_version_specs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_cms_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_products_v_version_upgrades" ADD CONSTRAINT "_cms_products_v_version_upgrades_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_cms_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_products_v" ADD CONSTRAINT "_cms_products_v_parent_id_cms_products_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_products_v" ADD CONSTRAINT "_cms_products_v_version_brand_id_cms_brands_id_fk" FOREIGN KEY ("version_brand_id") REFERENCES "payload"."cms_brands"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_products_v" ADD CONSTRAINT "_cms_products_v_version_category_id_cms_categories_id_fk" FOREIGN KEY ("version_category_id") REFERENCES "payload"."cms_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_products_v" ADD CONSTRAINT "_cms_products_v_version_meta_image_id_cms_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_products_v_texts" ADD CONSTRAINT "_cms_products_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."_cms_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_products_v_rels" ADD CONSTRAINT "_cms_products_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."_cms_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_products_v_rels" ADD CONSTRAINT "_cms_products_v_rels_media_fk" FOREIGN KEY ("cms_media_id") REFERENCES "payload"."cms_media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_products_v_rels" ADD CONSTRAINT "_cms_products_v_rels_laptop_models_fk" FOREIGN KEY ("cms_laptop_models_id") REFERENCES "payload"."cms_laptop_models"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_products_v_rels" ADD CONSTRAINT "_cms_products_v_rels_products_fk" FOREIGN KEY ("cms_products_id") REFERENCES "payload"."cms_products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_categories_attributes" ADD CONSTRAINT "cms_categories_attributes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_categories" ADD CONSTRAINT "cms_categories_parent_id_cms_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_categories" ADD CONSTRAINT "cms_categories_image_id_cms_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_categories" ADD CONSTRAINT "cms_categories_meta_image_id_cms_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_categories_texts" ADD CONSTRAINT "cms_categories_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_brands" ADD CONSTRAINT "cms_brands_logo_id_cms_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_laptop_models" ADD CONSTRAINT "cms_laptop_models_brand_id_cms_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "payload"."cms_brands"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_reviews" ADD CONSTRAINT "cms_reviews_product_id_cms_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "payload"."cms_products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_posts" ADD CONSTRAINT "cms_posts_cover_id_cms_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_posts" ADD CONSTRAINT "cms_posts_meta_image_id_cms_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_posts_texts" ADD CONSTRAINT "cms_posts_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_posts_rels" ADD CONSTRAINT "cms_posts_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_posts_rels" ADD CONSTRAINT "cms_posts_rels_products_fk" FOREIGN KEY ("cms_products_id") REFERENCES "payload"."cms_products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_posts_rels" ADD CONSTRAINT "cms_posts_rels_categories_fk" FOREIGN KEY ("cms_categories_id") REFERENCES "payload"."cms_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_posts_v" ADD CONSTRAINT "_cms_posts_v_parent_id_cms_posts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_posts_v" ADD CONSTRAINT "_cms_posts_v_version_cover_id_cms_media_id_fk" FOREIGN KEY ("version_cover_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_posts_v" ADD CONSTRAINT "_cms_posts_v_version_meta_image_id_cms_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_posts_v_texts" ADD CONSTRAINT "_cms_posts_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."_cms_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_posts_v_rels" ADD CONSTRAINT "_cms_posts_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."_cms_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_posts_v_rels" ADD CONSTRAINT "_cms_posts_v_rels_products_fk" FOREIGN KEY ("cms_products_id") REFERENCES "payload"."cms_products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_posts_v_rels" ADD CONSTRAINT "_cms_posts_v_rels_categories_fk" FOREIGN KEY ("cms_categories_id") REFERENCES "payload"."cms_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_orders_items" ADD CONSTRAINT "cms_orders_items_product_id_cms_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "payload"."cms_products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_orders_items" ADD CONSTRAINT "cms_orders_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_orders_history" ADD CONSTRAINT "cms_orders_history_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_orders" ADD CONSTRAINT "cms_orders_user_id_cms_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "payload"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_redirects_rels" ADD CONSTRAINT "cms_redirects_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_redirects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_redirects_rels" ADD CONSTRAINT "cms_redirects_rels_products_fk" FOREIGN KEY ("cms_products_id") REFERENCES "payload"."cms_products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_redirects_rels" ADD CONSTRAINT "cms_redirects_rels_categories_fk" FOREIGN KEY ("cms_categories_id") REFERENCES "payload"."cms_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_redirects_rels" ADD CONSTRAINT "cms_redirects_rels_posts_fk" FOREIGN KEY ("cms_posts_id") REFERENCES "payload"."cms_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_jobs_log" ADD CONSTRAINT "payload_jobs_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_folders_folder_type" ADD CONSTRAINT "payload_folders_folder_type_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."payload_folders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_folders" ADD CONSTRAINT "payload_folders_folder_id_payload_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "payload"."payload_folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("cms_users_id") REFERENCES "payload"."cms_users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("cms_media_id") REFERENCES "payload"."cms_media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_products_fk" FOREIGN KEY ("cms_products_id") REFERENCES "payload"."cms_products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_fk" FOREIGN KEY ("cms_categories_id") REFERENCES "payload"."cms_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_brands_fk" FOREIGN KEY ("cms_brands_id") REFERENCES "payload"."cms_brands"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_laptop_models_fk" FOREIGN KEY ("cms_laptop_models_id") REFERENCES "payload"."cms_laptop_models"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reviews_fk" FOREIGN KEY ("cms_reviews_id") REFERENCES "payload"."cms_reviews"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_posts_fk" FOREIGN KEY ("cms_posts_id") REFERENCES "payload"."cms_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_orders_fk" FOREIGN KEY ("cms_orders_id") REFERENCES "payload"."cms_orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_wholesale_inquiries_fk" FOREIGN KEY ("cms_wholesale_inquiries_id") REFERENCES "payload"."cms_wholesale_inquiries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_contact_messages_fk" FOREIGN KEY ("cms_contact_messages_id") REFERENCES "payload"."cms_contact_messages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_redirects_fk" FOREIGN KEY ("cms_redirects_id") REFERENCES "payload"."cms_redirects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_folders_fk" FOREIGN KEY ("payload_folders_id") REFERENCES "payload"."payload_folders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("cms_users_id") REFERENCES "payload"."cms_users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "cms_users_sessions_order_idx" ON "payload"."cms_users_sessions" USING btree ("_order");
  CREATE INDEX "cms_users_sessions_parent_id_idx" ON "payload"."cms_users_sessions" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "cms_users_legacy_id_idx" ON "payload"."cms_users" USING btree ("legacy_id");
  CREATE INDEX "cms_users_updated_at_idx" ON "payload"."cms_users" USING btree ("updated_at");
  CREATE INDEX "cms_users_created_at_idx" ON "payload"."cms_users" USING btree ("created_at");
  CREATE UNIQUE INDEX "cms_users_email_idx" ON "payload"."cms_users" USING btree ("email");
  CREATE INDEX "cms_users_texts_order_parent" ON "payload"."cms_users_texts" USING btree ("order","parent_id");
  CREATE INDEX "cms_media_source_url_idx" ON "payload"."cms_media" USING btree ("source_url");
  CREATE INDEX "cms_media_folder_idx" ON "payload"."cms_media" USING btree ("folder_id");
  CREATE INDEX "cms_media_updated_at_idx" ON "payload"."cms_media" USING btree ("updated_at");
  CREATE INDEX "cms_media_created_at_idx" ON "payload"."cms_media" USING btree ("created_at");
  CREATE UNIQUE INDEX "cms_media_filename_idx" ON "payload"."cms_media" USING btree ("filename");
  CREATE INDEX "cms_media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "payload"."cms_media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "cms_media_sizes_card_sizes_card_filename_idx" ON "payload"."cms_media" USING btree ("sizes_card_filename");
  CREATE INDEX "cms_media_sizes_full_sizes_full_filename_idx" ON "payload"."cms_media" USING btree ("sizes_full_filename");
  CREATE INDEX "cms_media_texts_order_parent" ON "payload"."cms_media_texts" USING btree ("order","parent_id");
  CREATE INDEX "cms_products_specs_order_idx" ON "payload"."cms_products_specs" USING btree ("_order");
  CREATE INDEX "cms_products_specs_parent_id_idx" ON "payload"."cms_products_specs" USING btree ("_parent_id");
  CREATE INDEX "cms_products_upgrades_order_idx" ON "payload"."cms_products_upgrades" USING btree ("_order");
  CREATE INDEX "cms_products_upgrades_parent_id_idx" ON "payload"."cms_products_upgrades" USING btree ("_parent_id");
  CREATE INDEX "cms_products_brand_idx" ON "payload"."cms_products" USING btree ("brand_id");
  CREATE INDEX "cms_products_category_idx" ON "payload"."cms_products" USING btree ("category_id");
  CREATE UNIQUE INDEX "cms_products_sku_idx" ON "payload"."cms_products" USING btree ("sku");
  CREATE INDEX "cms_products_status_idx" ON "payload"."cms_products" USING btree ("status");
  CREATE UNIQUE INDEX "cms_products_slug_idx" ON "payload"."cms_products" USING btree ("slug");
  CREATE UNIQUE INDEX "cms_products_legacy_id_idx" ON "payload"."cms_products" USING btree ("legacy_id");
  CREATE INDEX "cms_products_meta_meta_image_idx" ON "payload"."cms_products" USING btree ("meta_image_id");
  CREATE INDEX "cms_products_updated_at_idx" ON "payload"."cms_products" USING btree ("updated_at");
  CREATE INDEX "cms_products_created_at_idx" ON "payload"."cms_products" USING btree ("created_at");
  CREATE INDEX "cms_products_texts_order_parent" ON "payload"."cms_products_texts" USING btree ("order","parent_id");
  CREATE INDEX "cms_products_rels_order_idx" ON "payload"."cms_products_rels" USING btree ("order");
  CREATE INDEX "cms_products_rels_parent_idx" ON "payload"."cms_products_rels" USING btree ("parent_id");
  CREATE INDEX "cms_products_rels_path_idx" ON "payload"."cms_products_rels" USING btree ("path");
  CREATE INDEX "cms_products_rels_cms_media_id_idx" ON "payload"."cms_products_rels" USING btree ("cms_media_id");
  CREATE INDEX "cms_products_rels_cms_laptop_models_id_idx" ON "payload"."cms_products_rels" USING btree ("cms_laptop_models_id");
  CREATE INDEX "cms_products_rels_cms_products_id_idx" ON "payload"."cms_products_rels" USING btree ("cms_products_id");
  CREATE INDEX "_cms_products_v_version_specs_order_idx" ON "payload"."_cms_products_v_version_specs" USING btree ("_order");
  CREATE INDEX "_cms_products_v_version_specs_parent_id_idx" ON "payload"."_cms_products_v_version_specs" USING btree ("_parent_id");
  CREATE INDEX "_cms_products_v_version_upgrades_order_idx" ON "payload"."_cms_products_v_version_upgrades" USING btree ("_order");
  CREATE INDEX "_cms_products_v_version_upgrades_parent_id_idx" ON "payload"."_cms_products_v_version_upgrades" USING btree ("_parent_id");
  CREATE INDEX "_cms_products_v_parent_idx" ON "payload"."_cms_products_v" USING btree ("parent_id");
  CREATE INDEX "_cms_products_v_version_version_brand_idx" ON "payload"."_cms_products_v" USING btree ("version_brand_id");
  CREATE INDEX "_cms_products_v_version_version_category_idx" ON "payload"."_cms_products_v" USING btree ("version_category_id");
  CREATE INDEX "_cms_products_v_version_version_sku_idx" ON "payload"."_cms_products_v" USING btree ("version_sku");
  CREATE INDEX "_cms_products_v_version_version_status_idx" ON "payload"."_cms_products_v" USING btree ("version_status");
  CREATE INDEX "_cms_products_v_version_version_slug_idx" ON "payload"."_cms_products_v" USING btree ("version_slug");
  CREATE INDEX "_cms_products_v_version_version_legacy_id_idx" ON "payload"."_cms_products_v" USING btree ("version_legacy_id");
  CREATE INDEX "_cms_products_v_version_meta_version_meta_image_idx" ON "payload"."_cms_products_v" USING btree ("version_meta_image_id");
  CREATE INDEX "_cms_products_v_version_version_updated_at_idx" ON "payload"."_cms_products_v" USING btree ("version_updated_at");
  CREATE INDEX "_cms_products_v_version_version_created_at_idx" ON "payload"."_cms_products_v" USING btree ("version_created_at");
  CREATE INDEX "_cms_products_v_created_at_idx" ON "payload"."_cms_products_v" USING btree ("created_at");
  CREATE INDEX "_cms_products_v_updated_at_idx" ON "payload"."_cms_products_v" USING btree ("updated_at");
  CREATE INDEX "_cms_products_v_texts_order_parent" ON "payload"."_cms_products_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "_cms_products_v_rels_order_idx" ON "payload"."_cms_products_v_rels" USING btree ("order");
  CREATE INDEX "_cms_products_v_rels_parent_idx" ON "payload"."_cms_products_v_rels" USING btree ("parent_id");
  CREATE INDEX "_cms_products_v_rels_path_idx" ON "payload"."_cms_products_v_rels" USING btree ("path");
  CREATE INDEX "_cms_products_v_rels_cms_media_id_idx" ON "payload"."_cms_products_v_rels" USING btree ("cms_media_id");
  CREATE INDEX "_cms_products_v_rels_cms_laptop_models_id_idx" ON "payload"."_cms_products_v_rels" USING btree ("cms_laptop_models_id");
  CREATE INDEX "_cms_products_v_rels_cms_products_id_idx" ON "payload"."_cms_products_v_rels" USING btree ("cms_products_id");
  CREATE INDEX "cms_categories_attributes_order_idx" ON "payload"."cms_categories_attributes" USING btree ("_order");
  CREATE INDEX "cms_categories_attributes_parent_id_idx" ON "payload"."cms_categories_attributes" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "cms_categories_slug_idx" ON "payload"."cms_categories" USING btree ("slug");
  CREATE INDEX "cms_categories_parent_idx" ON "payload"."cms_categories" USING btree ("parent_id");
  CREATE INDEX "cms_categories_image_idx" ON "payload"."cms_categories" USING btree ("image_id");
  CREATE UNIQUE INDEX "cms_categories_legacy_id_idx" ON "payload"."cms_categories" USING btree ("legacy_id");
  CREATE INDEX "cms_categories_meta_meta_image_idx" ON "payload"."cms_categories" USING btree ("meta_image_id");
  CREATE INDEX "cms_categories_updated_at_idx" ON "payload"."cms_categories" USING btree ("updated_at");
  CREATE INDEX "cms_categories_created_at_idx" ON "payload"."cms_categories" USING btree ("created_at");
  CREATE INDEX "cms_categories_texts_order_parent" ON "payload"."cms_categories_texts" USING btree ("order","parent_id");
  CREATE UNIQUE INDEX "cms_brands_slug_idx" ON "payload"."cms_brands" USING btree ("slug");
  CREATE INDEX "cms_brands_logo_idx" ON "payload"."cms_brands" USING btree ("logo_id");
  CREATE UNIQUE INDEX "cms_brands_legacy_id_idx" ON "payload"."cms_brands" USING btree ("legacy_id");
  CREATE INDEX "cms_brands_updated_at_idx" ON "payload"."cms_brands" USING btree ("updated_at");
  CREATE INDEX "cms_brands_created_at_idx" ON "payload"."cms_brands" USING btree ("created_at");
  CREATE INDEX "cms_laptop_models_brand_idx" ON "payload"."cms_laptop_models" USING btree ("brand_id");
  CREATE UNIQUE INDEX "cms_laptop_models_slug_idx" ON "payload"."cms_laptop_models" USING btree ("slug");
  CREATE UNIQUE INDEX "cms_laptop_models_legacy_id_idx" ON "payload"."cms_laptop_models" USING btree ("legacy_id");
  CREATE INDEX "cms_laptop_models_updated_at_idx" ON "payload"."cms_laptop_models" USING btree ("updated_at");
  CREATE INDEX "cms_laptop_models_created_at_idx" ON "payload"."cms_laptop_models" USING btree ("created_at");
  CREATE INDEX "cms_reviews_product_idx" ON "payload"."cms_reviews" USING btree ("product_id");
  CREATE UNIQUE INDEX "cms_reviews_legacy_id_idx" ON "payload"."cms_reviews" USING btree ("legacy_id");
  CREATE INDEX "cms_reviews_updated_at_idx" ON "payload"."cms_reviews" USING btree ("updated_at");
  CREATE INDEX "cms_reviews_created_at_idx" ON "payload"."cms_reviews" USING btree ("created_at");
  CREATE INDEX "cms_posts_cover_idx" ON "payload"."cms_posts" USING btree ("cover_id");
  CREATE UNIQUE INDEX "cms_posts_slug_idx" ON "payload"."cms_posts" USING btree ("slug");
  CREATE UNIQUE INDEX "cms_posts_legacy_id_idx" ON "payload"."cms_posts" USING btree ("legacy_id");
  CREATE INDEX "cms_posts_meta_meta_image_idx" ON "payload"."cms_posts" USING btree ("meta_image_id");
  CREATE INDEX "cms_posts_updated_at_idx" ON "payload"."cms_posts" USING btree ("updated_at");
  CREATE INDEX "cms_posts_created_at_idx" ON "payload"."cms_posts" USING btree ("created_at");
  CREATE INDEX "cms_posts__status_idx" ON "payload"."cms_posts" USING btree ("_status");
  CREATE INDEX "cms_posts_texts_order_parent" ON "payload"."cms_posts_texts" USING btree ("order","parent_id");
  CREATE INDEX "cms_posts_rels_order_idx" ON "payload"."cms_posts_rels" USING btree ("order");
  CREATE INDEX "cms_posts_rels_parent_idx" ON "payload"."cms_posts_rels" USING btree ("parent_id");
  CREATE INDEX "cms_posts_rels_path_idx" ON "payload"."cms_posts_rels" USING btree ("path");
  CREATE INDEX "cms_posts_rels_cms_products_id_idx" ON "payload"."cms_posts_rels" USING btree ("cms_products_id");
  CREATE INDEX "cms_posts_rels_cms_categories_id_idx" ON "payload"."cms_posts_rels" USING btree ("cms_categories_id");
  CREATE INDEX "_cms_posts_v_parent_idx" ON "payload"."_cms_posts_v" USING btree ("parent_id");
  CREATE INDEX "_cms_posts_v_version_version_cover_idx" ON "payload"."_cms_posts_v" USING btree ("version_cover_id");
  CREATE INDEX "_cms_posts_v_version_version_slug_idx" ON "payload"."_cms_posts_v" USING btree ("version_slug");
  CREATE INDEX "_cms_posts_v_version_version_legacy_id_idx" ON "payload"."_cms_posts_v" USING btree ("version_legacy_id");
  CREATE INDEX "_cms_posts_v_version_meta_version_meta_image_idx" ON "payload"."_cms_posts_v" USING btree ("version_meta_image_id");
  CREATE INDEX "_cms_posts_v_version_version_updated_at_idx" ON "payload"."_cms_posts_v" USING btree ("version_updated_at");
  CREATE INDEX "_cms_posts_v_version_version_created_at_idx" ON "payload"."_cms_posts_v" USING btree ("version_created_at");
  CREATE INDEX "_cms_posts_v_version_version__status_idx" ON "payload"."_cms_posts_v" USING btree ("version__status");
  CREATE INDEX "_cms_posts_v_created_at_idx" ON "payload"."_cms_posts_v" USING btree ("created_at");
  CREATE INDEX "_cms_posts_v_updated_at_idx" ON "payload"."_cms_posts_v" USING btree ("updated_at");
  CREATE INDEX "_cms_posts_v_latest_idx" ON "payload"."_cms_posts_v" USING btree ("latest");
  CREATE INDEX "_cms_posts_v_texts_order_parent" ON "payload"."_cms_posts_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "_cms_posts_v_rels_order_idx" ON "payload"."_cms_posts_v_rels" USING btree ("order");
  CREATE INDEX "_cms_posts_v_rels_parent_idx" ON "payload"."_cms_posts_v_rels" USING btree ("parent_id");
  CREATE INDEX "_cms_posts_v_rels_path_idx" ON "payload"."_cms_posts_v_rels" USING btree ("path");
  CREATE INDEX "_cms_posts_v_rels_cms_products_id_idx" ON "payload"."_cms_posts_v_rels" USING btree ("cms_products_id");
  CREATE INDEX "_cms_posts_v_rels_cms_categories_id_idx" ON "payload"."_cms_posts_v_rels" USING btree ("cms_categories_id");
  CREATE INDEX "cms_orders_items_order_idx" ON "payload"."cms_orders_items" USING btree ("_order");
  CREATE INDEX "cms_orders_items_parent_id_idx" ON "payload"."cms_orders_items" USING btree ("_parent_id");
  CREATE INDEX "cms_orders_items_product_idx" ON "payload"."cms_orders_items" USING btree ("product_id");
  CREATE INDEX "cms_orders_history_order_idx" ON "payload"."cms_orders_history" USING btree ("_order");
  CREATE INDEX "cms_orders_history_parent_id_idx" ON "payload"."cms_orders_history" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "cms_orders_order_number_idx" ON "payload"."cms_orders" USING btree ("order_number");
  CREATE INDEX "cms_orders_status_idx" ON "payload"."cms_orders" USING btree ("status");
  CREATE INDEX "cms_orders_placed_at_idx" ON "payload"."cms_orders" USING btree ("placed_at");
  CREATE INDEX "cms_orders_customer_customer_phone_idx" ON "payload"."cms_orders" USING btree ("customer_phone");
  CREATE INDEX "cms_orders_customer_customer_city_idx" ON "payload"."cms_orders" USING btree ("customer_city");
  CREATE INDEX "cms_orders_user_idx" ON "payload"."cms_orders" USING btree ("user_id");
  CREATE UNIQUE INDEX "cms_orders_legacy_id_idx" ON "payload"."cms_orders" USING btree ("legacy_id");
  CREATE INDEX "cms_orders_updated_at_idx" ON "payload"."cms_orders" USING btree ("updated_at");
  CREATE INDEX "cms_orders_created_at_idx" ON "payload"."cms_orders" USING btree ("created_at");
  CREATE INDEX "cms_wholesale_inquiries_status_idx" ON "payload"."cms_wholesale_inquiries" USING btree ("status");
  CREATE INDEX "cms_wholesale_inquiries_received_at_idx" ON "payload"."cms_wholesale_inquiries" USING btree ("received_at");
  CREATE UNIQUE INDEX "cms_wholesale_inquiries_legacy_id_idx" ON "payload"."cms_wholesale_inquiries" USING btree ("legacy_id");
  CREATE INDEX "cms_wholesale_inquiries_updated_at_idx" ON "payload"."cms_wholesale_inquiries" USING btree ("updated_at");
  CREATE INDEX "cms_wholesale_inquiries_created_at_idx" ON "payload"."cms_wholesale_inquiries" USING btree ("created_at");
  CREATE UNIQUE INDEX "cms_contact_messages_legacy_id_idx" ON "payload"."cms_contact_messages" USING btree ("legacy_id");
  CREATE INDEX "cms_contact_messages_updated_at_idx" ON "payload"."cms_contact_messages" USING btree ("updated_at");
  CREATE INDEX "cms_contact_messages_created_at_idx" ON "payload"."cms_contact_messages" USING btree ("created_at");
  CREATE UNIQUE INDEX "cms_redirects_from_idx" ON "payload"."cms_redirects" USING btree ("from");
  CREATE INDEX "cms_redirects_updated_at_idx" ON "payload"."cms_redirects" USING btree ("updated_at");
  CREATE INDEX "cms_redirects_created_at_idx" ON "payload"."cms_redirects" USING btree ("created_at");
  CREATE INDEX "cms_redirects_rels_order_idx" ON "payload"."cms_redirects_rels" USING btree ("order");
  CREATE INDEX "cms_redirects_rels_parent_idx" ON "payload"."cms_redirects_rels" USING btree ("parent_id");
  CREATE INDEX "cms_redirects_rels_path_idx" ON "payload"."cms_redirects_rels" USING btree ("path");
  CREATE INDEX "cms_redirects_rels_cms_products_id_idx" ON "payload"."cms_redirects_rels" USING btree ("cms_products_id");
  CREATE INDEX "cms_redirects_rels_cms_categories_id_idx" ON "payload"."cms_redirects_rels" USING btree ("cms_categories_id");
  CREATE INDEX "cms_redirects_rels_cms_posts_id_idx" ON "payload"."cms_redirects_rels" USING btree ("cms_posts_id");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload"."payload_kv" USING btree ("key");
  CREATE INDEX "payload_jobs_log_order_idx" ON "payload"."payload_jobs_log" USING btree ("_order");
  CREATE INDEX "payload_jobs_log_parent_id_idx" ON "payload"."payload_jobs_log" USING btree ("_parent_id");
  CREATE INDEX "payload_jobs_completed_at_idx" ON "payload"."payload_jobs" USING btree ("completed_at");
  CREATE INDEX "payload_jobs_total_tried_idx" ON "payload"."payload_jobs" USING btree ("total_tried");
  CREATE INDEX "payload_jobs_has_error_idx" ON "payload"."payload_jobs" USING btree ("has_error");
  CREATE INDEX "payload_jobs_task_slug_idx" ON "payload"."payload_jobs" USING btree ("task_slug");
  CREATE INDEX "payload_jobs_queue_idx" ON "payload"."payload_jobs" USING btree ("queue");
  CREATE INDEX "payload_jobs_wait_until_idx" ON "payload"."payload_jobs" USING btree ("wait_until");
  CREATE INDEX "payload_jobs_processing_idx" ON "payload"."payload_jobs" USING btree ("processing");
  CREATE INDEX "payload_jobs_updated_at_idx" ON "payload"."payload_jobs" USING btree ("updated_at");
  CREATE INDEX "payload_jobs_created_at_idx" ON "payload"."payload_jobs" USING btree ("created_at");
  CREATE INDEX "payload_folders_folder_type_order_idx" ON "payload"."payload_folders_folder_type" USING btree ("order");
  CREATE INDEX "payload_folders_folder_type_parent_idx" ON "payload"."payload_folders_folder_type" USING btree ("parent_id");
  CREATE INDEX "payload_folders_name_idx" ON "payload"."payload_folders" USING btree ("name");
  CREATE INDEX "payload_folders_folder_idx" ON "payload"."payload_folders" USING btree ("folder_id");
  CREATE INDEX "payload_folders_updated_at_idx" ON "payload"."payload_folders" USING btree ("updated_at");
  CREATE INDEX "payload_folders_created_at_idx" ON "payload"."payload_folders" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload"."payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload"."payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload"."payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload"."payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload"."payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload"."payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_cms_users_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_users_id");
  CREATE INDEX "payload_locked_documents_rels_cms_media_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_media_id");
  CREATE INDEX "payload_locked_documents_rels_cms_products_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_products_id");
  CREATE INDEX "payload_locked_documents_rels_cms_categories_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_categories_id");
  CREATE INDEX "payload_locked_documents_rels_cms_brands_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_brands_id");
  CREATE INDEX "payload_locked_documents_rels_cms_laptop_models_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_laptop_models_id");
  CREATE INDEX "payload_locked_documents_rels_cms_reviews_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_reviews_id");
  CREATE INDEX "payload_locked_documents_rels_cms_posts_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_posts_id");
  CREATE INDEX "payload_locked_documents_rels_cms_orders_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_orders_id");
  CREATE INDEX "payload_locked_documents_rels_cms_wholesale_inquiries_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_wholesale_inquiries_id");
  CREATE INDEX "payload_locked_documents_rels_cms_contact_messages_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_contact_messages_id");
  CREATE INDEX "payload_locked_documents_rels_cms_redirects_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_redirects_id");
  CREATE INDEX "payload_locked_documents_rels_payload_folders_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("payload_folders_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload"."payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload"."payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload"."payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload"."payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload"."payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload"."payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_cms_users_id_idx" ON "payload"."payload_preferences_rels" USING btree ("cms_users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload"."payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload"."payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "payload"."cms_users_sessions" CASCADE;
  DROP TABLE "payload"."cms_users" CASCADE;
  DROP TABLE "payload"."cms_users_texts" CASCADE;
  DROP TABLE "payload"."cms_media" CASCADE;
  DROP TABLE "payload"."cms_media_texts" CASCADE;
  DROP TABLE "payload"."cms_products_specs" CASCADE;
  DROP TABLE "payload"."cms_products_upgrades" CASCADE;
  DROP TABLE "payload"."cms_products" CASCADE;
  DROP TABLE "payload"."cms_products_texts" CASCADE;
  DROP TABLE "payload"."cms_products_rels" CASCADE;
  DROP TABLE "payload"."_cms_products_v_version_specs" CASCADE;
  DROP TABLE "payload"."_cms_products_v_version_upgrades" CASCADE;
  DROP TABLE "payload"."_cms_products_v" CASCADE;
  DROP TABLE "payload"."_cms_products_v_texts" CASCADE;
  DROP TABLE "payload"."_cms_products_v_rels" CASCADE;
  DROP TABLE "payload"."cms_categories_attributes" CASCADE;
  DROP TABLE "payload"."cms_categories" CASCADE;
  DROP TABLE "payload"."cms_categories_texts" CASCADE;
  DROP TABLE "payload"."cms_brands" CASCADE;
  DROP TABLE "payload"."cms_laptop_models" CASCADE;
  DROP TABLE "payload"."cms_reviews" CASCADE;
  DROP TABLE "payload"."cms_posts" CASCADE;
  DROP TABLE "payload"."cms_posts_texts" CASCADE;
  DROP TABLE "payload"."cms_posts_rels" CASCADE;
  DROP TABLE "payload"."_cms_posts_v" CASCADE;
  DROP TABLE "payload"."_cms_posts_v_texts" CASCADE;
  DROP TABLE "payload"."_cms_posts_v_rels" CASCADE;
  DROP TABLE "payload"."cms_orders_items" CASCADE;
  DROP TABLE "payload"."cms_orders_history" CASCADE;
  DROP TABLE "payload"."cms_orders" CASCADE;
  DROP TABLE "payload"."cms_wholesale_inquiries" CASCADE;
  DROP TABLE "payload"."cms_contact_messages" CASCADE;
  DROP TABLE "payload"."cms_redirects" CASCADE;
  DROP TABLE "payload"."cms_redirects_rels" CASCADE;
  DROP TABLE "payload"."payload_kv" CASCADE;
  DROP TABLE "payload"."payload_jobs_log" CASCADE;
  DROP TABLE "payload"."payload_jobs" CASCADE;
  DROP TABLE "payload"."payload_folders_folder_type" CASCADE;
  DROP TABLE "payload"."payload_folders" CASCADE;
  DROP TABLE "payload"."payload_locked_documents" CASCADE;
  DROP TABLE "payload"."payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload"."payload_preferences" CASCADE;
  DROP TABLE "payload"."payload_preferences_rels" CASCADE;
  DROP TABLE "payload"."payload_migrations" CASCADE;
  DROP TYPE "payload"."enum_cms_users_role";
  DROP TYPE "payload"."enum_cms_products_condition";
  DROP TYPE "payload"."enum_cms_products_shipping_class";
  DROP TYPE "payload"."enum_cms_products_status";
  DROP TYPE "payload"."enum__cms_products_v_version_condition";
  DROP TYPE "payload"."enum__cms_products_v_version_shipping_class";
  DROP TYPE "payload"."enum__cms_products_v_version_status";
  DROP TYPE "payload"."enum_cms_categories_attributes_kind";
  DROP TYPE "payload"."enum_cms_posts_status";
  DROP TYPE "payload"."enum__cms_posts_v_version_status";
  DROP TYPE "payload"."enum_cms_orders_history_status";
  DROP TYPE "payload"."enum_cms_orders_status";
  DROP TYPE "payload"."enum_cms_orders_payment_method";
  DROP TYPE "payload"."enum_cms_orders_payment_status";
  DROP TYPE "payload"."enum_cms_wholesale_inquiries_buyer_type";
  DROP TYPE "payload"."enum_cms_wholesale_inquiries_status";
  DROP TYPE "payload"."enum_cms_redirects_to_type";
  DROP TYPE "payload"."enum_payload_jobs_log_task_slug";
  DROP TYPE "payload"."enum_payload_jobs_log_state";
  DROP TYPE "payload"."enum_payload_jobs_task_slug";
  DROP TYPE "payload"."enum_payload_folders_folder_type";`)
}
