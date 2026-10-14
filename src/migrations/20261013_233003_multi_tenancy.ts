import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_cms_stores_status" AS ENUM('draft', 'active', 'suspended', 'closed');
  CREATE TYPE "payload"."enum_cms_stores_subscription_status" AS ENUM('trialing', 'active', 'past_due', 'cancelled', 'expired', 'suspended');
  CREATE TYPE "payload"."enum_cms_stores_payments_provider" AS ENUM('stripe');
  CREATE TYPE "payload"."enum_cms_store_memberships_role" AS ENUM('store_owner', 'store_manager', 'store_staff');
  CREATE TYPE "payload"."enum_cms_store_memberships_status" AS ENUM('invited', 'active', 'suspended');
  CREATE TYPE "payload"."enum_cms_subscription_plans_features" AS ENUM('custom_domain', 'online_payments', 'pos', 'reports', 'discounts', 'abandoned_carts');
  CREATE TYPE "payload"."enum_cms_subscription_plans_status" AS ENUM('active', 'archived');
  CREATE TYPE "payload"."enum_cms_store_subscriptions_status" AS ENUM('trialing', 'active', 'past_due', 'cancelled', 'expired', 'suspended');
  CREATE TYPE "payload"."enum_cms_store_subscriptions_billing_cycle" AS ENUM('monthly', 'annual');
  CREATE TYPE "payload"."enum_cms_store_invoices_status" AS ENUM('draft', 'open', 'paid', 'failed', 'refunded', 'voided');
  CREATE TYPE "payload"."enum_cms_users_platform_role" AS ENUM('customer', 'merchant_owner', 'platform_admin');
  CREATE TYPE "payload"."enum_cms_orders_fulfillment_status" AS ENUM('unfulfilled', 'in_transit', 'delivered', 'returned', 'cancelled');
  CREATE TYPE "payload"."enum_cms_discounts_applies_to" AS ENUM('all', 'products', 'categories', 'collections');
  CREATE TYPE "payload"."enum_cms_ss_theme_settings_body_font" AS ENUM('inter', 'space-grotesk', 'montserrat', 'poppins');
  CREATE TYPE "payload"."enum_cms_ss_theme_settings_heading_font" AS ENUM('inter', 'space-grotesk', 'montserrat', 'poppins');
  CREATE TYPE "payload"."enum_cms_ss_theme_settings_button_style" AS ENUM('pill', 'rounded', 'square');
  CREATE TYPE "payload"."enum_cms_ss_theme_settings_card_radius" AS ENUM('sm', 'md', 'xl', '2xl');
  CREATE TYPE "payload"."enum_cms_ss_theme_settings_default_mode" AS ENUM('dark', 'light');
  CREATE TYPE "payload"."enum__cms_ss_theme_settings_v_version_body_font" AS ENUM('inter', 'space-grotesk', 'montserrat', 'poppins');
  CREATE TYPE "payload"."enum__cms_ss_theme_settings_v_version_heading_font" AS ENUM('inter', 'space-grotesk', 'montserrat', 'poppins');
  CREATE TYPE "payload"."enum__cms_ss_theme_settings_v_version_button_style" AS ENUM('pill', 'rounded', 'square');
  CREATE TYPE "payload"."enum__cms_ss_theme_settings_v_version_card_radius" AS ENUM('sm', 'md', 'xl', '2xl');
  CREATE TYPE "payload"."enum__cms_ss_theme_settings_v_version_default_mode" AS ENUM('dark', 'light');
  CREATE TYPE "payload"."enum_cms_ss_whatsapp_button_position" AS ENUM('right', 'left');
  CREATE TYPE "payload"."enum__cms_ss_whatsapp_button_v_version_position" AS ENUM('right', 'left');
  CREATE TYPE "payload"."enum_cms_ss_shipping_zones_cities" AS ENUM('Abbottabad', 'Ahmadpur East', 'Alipur', 'Arifwala', 'Attock', 'Awaran', 'Badin', 'Bagh', 'Bahawalnagar', 'Bahawalpur', 'Bannu', 'Barkhan', 'Batagram', 'Battagram', 'Bhakkar', 'Bhalwal', 'Bhimber', 'Burewala', 'Chakwal', 'Chaman', 'Charsadda', 'Chichawatni', 'Chiniot', 'Chishtian', 'Chitral', 'Dadu', 'Daska', 'Dera Ghazi Khan', 'Dera Ismail Khan', 'Dera Murad Jamali', 'Dina', 'Dipalpur', 'Faisalabad', 'Fateh Jang', 'Gadoon', 'Gawadar', 'Ghotki', 'Gilgit', 'Gojra', 'Gujar Khan', 'Gujranwala', 'Gujrat', 'Hafizabad', 'Hala', 'Hangu', 'Haripur', 'Haroonabad', 'Hasilpur', 'Hassan Abdal', 'Hub', 'Hunza', 'Hyderabad', 'Islamabad', 'Jacobabad', 'Jalalpur Jattan', 'Jampur', 'Jamshoro', 'Jaranwala', 'Jhang', 'Jhelum', 'Kabirwala', 'Kahror Pakka', 'Kamalia', 'Kamoke', 'Kandhkot', 'Karachi', 'Kasur', 'Khairpur', 'Khanewal', 'Khanpur', 'Kharian', 'Khushab', 'Khuzdar', 'Kohat', 'Kot Addu', 'Kotli', 'Kotri', 'Lahore', 'Lakki Marwat', 'Lalamusa', 'Larkana', 'Layyah', 'Lodhran', 'Loralai', 'Malakand', 'Mandi Bahauddin', 'Mansehra', 'Mardan', 'Matiari', 'Mian Channu', 'Mianwali', 'Mingora', 'Mirpur (AJK)', 'Mirpur Khas', 'Mirpur Mathelo', 'Moro', 'Multan', 'Muridke', 'Murree', 'Muzaffarabad', 'Muzaffargarh', 'Narowal', 'Naushahro Feroze', 'Nawabshah', 'Nowshera', 'Okara', 'Other (mention in address)', 'Pakpattan', 'Pasrur', 'Pattoki', 'Peshawar', 'Pind Dadan Khan', 'Pindi Bhattian', 'Pishin', 'Quetta', 'Rahim Yar Khan', 'Rajanpur', 'Rawalakot', 'Rawalpindi', 'Renala Khurd', 'Sadiqabad', 'Sahiwal', 'Samundri', 'Sanghar', 'Sangla Hill', 'Sargodha', 'Shahdadkot', 'Shahdadpur', 'Sheikhupura', 'Shikarpur', 'Shujabad', 'Sialkot', 'Sibi', 'Skardu', 'Sukkur', 'Swabi', 'Swat', 'Talagang', 'Tando Adam', 'Tando Allahyar', 'Tando Muhammad Khan', 'Taxila', 'Thatta', 'Timergara', 'Toba Tek Singh', 'Turbat', 'Umerkot', 'Vehari', 'Wah Cantt', 'Wazirabad', 'Zhob', 'Ziarat');
  CREATE TYPE "payload"."enum_cms_ss_notifications_status_updates" AS ENUM('confirmed', 'dispatched', 'out-for-delivery', 'delivered');
  CREATE TYPE "payload"."enum_cms_ss_store_info_hours_days" AS ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');
  CREATE TYPE "payload"."enum_cms_ss_seo_settings_pages_page" AS ENUM('/', '/shop', '/category', '/deals', '/find-parts', '/brands', '/wholesale', '/blog', '/about', '/contact', '/faqs', '/track-order', '/shipping-policy', '/warranty-returns', '/privacy-policy', '/terms', '/installments', '/returns', '/sell-your-laptop', '/compare', '/cart', '/laptops-in-{city}', '/brands/{brand}');
  CREATE TYPE "payload"."enum_cms_ss_seo_settings_pages_indexing" AS ENUM('default', 'index', 'noindex');
  CREATE TYPE "payload"."enum_cms_ss_page_texts_pages_page" AS ENUM('/shop', '/category', '/deals', '/find-parts', '/brands', '/blog', '/about', '/shipping-policy', '/warranty-returns', '/privacy-policy', '/terms', '/installments');
  CREATE TYPE "payload"."enum_cms_ss_returns_policy_warranty_by_condition_condition" AS ENUM('new', 'used-a-plus', 'used-a', 'refurbished', 'open-box');
  CREATE TYPE "payload"."enum_cms_outbox_events_status" AS ENUM('pending', 'processing', 'sent', 'dead');
  CREATE TYPE "payload"."enum_cms_payment_transactions_kind" AS ENUM('charge', 'refund');
  CREATE TYPE "payload"."enum_cms_payment_transactions_status" AS ENUM('pending', 'succeeded', 'failed', 'cancelled', 'refunded', 'partially_refunded');
  CREATE TYPE "payload"."enum_cms_payment_transactions_provider" AS ENUM('stripe', 'manual');
  CREATE TYPE "payload"."enum_cms_payment_events_status" AS ENUM('received', 'processed', 'ignored', 'failed');
  ALTER TYPE "payload"."enum_cms_orders_history_status" ADD VALUE 'awaiting-payment' BEFORE 'awaiting-confirmation';
  ALTER TYPE "payload"."enum_cms_orders_status" ADD VALUE 'awaiting-payment' BEFORE 'awaiting-confirmation';
  ALTER TYPE "payload"."enum_cms_orders_payment_status" ADD VALUE 'partially-refunded';
  ALTER TYPE "payload"."enum_cms_discounts_kind" ADD VALUE 'free_shipping';
  CREATE TABLE "payload"."cms_stores" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"business_name" varchar,
  	"status" "payload"."enum_cms_stores_status" DEFAULT 'draft' NOT NULL,
  	"is_default" boolean DEFAULT false,
  	"subdomain" varchar,
  	"custom_domain" varchar,
  	"domain_verification_token" varchar,
  	"domain_verified_at" timestamp(3) with time zone,
  	"country" varchar DEFAULT 'Pakistan',
  	"currency" varchar DEFAULT 'PKR',
  	"timezone" varchar DEFAULT 'Asia/Karachi',
  	"default_language" varchar DEFAULT 'en',
  	"order_prefix" varchar,
  	"owner_id" integer,
  	"plan_id" integer,
  	"subscription_status" "payload"."enum_cms_stores_subscription_status" DEFAULT 'trialing',
  	"trial_ends_at" timestamp(3) with time zone,
  	"trial_used" boolean DEFAULT false,
  	"grace_ends_at" timestamp(3) with time zone,
  	"billing_email" varchar,
  	"payments_provider" "payload"."enum_cms_stores_payments_provider",
  	"payments_account_id" varchar,
  	"payments_charges_enabled" boolean DEFAULT false,
  	"internal_notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_store_memberships" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_id" integer NOT NULL,
  	"user_id" integer,
  	"email" varchar,
  	"role" "payload"."enum_cms_store_memberships_role" DEFAULT 'store_staff' NOT NULL,
  	"status" "payload"."enum_cms_store_memberships_status" DEFAULT 'invited' NOT NULL,
  	"invited_by_id" integer,
  	"invited_at" timestamp(3) with time zone,
  	"invite_expires_at" timestamp(3) with time zone,
  	"accepted_at" timestamp(3) with time zone,
  	"invite_token_hash" varchar,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_subscription_plans_features" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "payload"."enum_cms_subscription_plans_features",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "payload"."cms_subscription_plans" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"status" "payload"."enum_cms_subscription_plans_status" DEFAULT 'active' NOT NULL,
  	"price_monthly" numeric DEFAULT 0 NOT NULL,
  	"price_annual" numeric DEFAULT 0 NOT NULL,
  	"currency" varchar DEFAULT 'PKR',
  	"trial_days" numeric DEFAULT 14,
  	"max_products" numeric DEFAULT 200,
  	"max_staff_members" numeric DEFAULT 5,
  	"max_storage_gb" numeric DEFAULT 10,
  	"highlight" varchar,
  	"provider_price_id_monthly" varchar,
  	"provider_price_id_annual" varchar,
  	"sort_order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_store_subscriptions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_id" integer NOT NULL,
  	"plan_id" integer NOT NULL,
  	"status" "payload"."enum_cms_store_subscriptions_status" DEFAULT 'trialing' NOT NULL,
  	"billing_cycle" "payload"."enum_cms_store_subscriptions_billing_cycle" DEFAULT 'monthly',
  	"trial_ends_at" timestamp(3) with time zone,
  	"current_period_start" timestamp(3) with time zone,
  	"current_period_end" timestamp(3) with time zone,
  	"cancel_at_period_end" boolean DEFAULT false,
  	"grace_ends_at" timestamp(3) with time zone,
  	"amount" numeric DEFAULT 0,
  	"currency" varchar DEFAULT 'PKR',
  	"billing_email" varchar,
  	"payment_provider" varchar,
  	"external_customer_id" varchar,
  	"external_subscription_id" varchar,
  	"last_invoice_at" timestamp(3) with time zone,
  	"last_payment_at" timestamp(3) with time zone,
  	"failed_payments" numeric DEFAULT 0,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_store_invoices" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_id" integer NOT NULL,
  	"subscription_id" integer,
  	"invoice_number" varchar NOT NULL,
  	"status" "payload"."enum_cms_store_invoices_status" DEFAULT 'open' NOT NULL,
  	"amount" numeric DEFAULT 0 NOT NULL,
  	"currency" varchar DEFAULT 'PKR',
  	"issued_at" timestamp(3) with time zone,
  	"due_at" timestamp(3) with time zone,
  	"paid_at" timestamp(3) with time zone,
  	"period_start" timestamp(3) with time zone,
  	"period_end" timestamp(3) with time zone,
  	"provider_invoice_id" varchar,
  	"hosted_invoice_url" varchar,
  	"lines" jsonb DEFAULT '[]'::jsonb,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_users_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"cms_stores_id" integer
  );
  
  CREATE TABLE "payload"."cms_discounts_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"cms_products_id" integer,
  	"cms_categories_id" integer,
  	"cms_collections_id" integer
  );
  
  CREATE TABLE "payload"."cms_ss_theme_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_id" integer,
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
  	"body_font" "payload"."enum_cms_ss_theme_settings_body_font" DEFAULT 'inter',
  	"heading_font" "payload"."enum_cms_ss_theme_settings_heading_font" DEFAULT 'space-grotesk',
  	"button_style" "payload"."enum_cms_ss_theme_settings_button_style" DEFAULT 'pill',
  	"card_radius" "payload"."enum_cms_ss_theme_settings_card_radius" DEFAULT 'xl',
  	"default_mode" "payload"."enum_cms_ss_theme_settings_default_mode" DEFAULT 'dark',
  	"allow_mode_toggle" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."_cms_ss_theme_settings_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_store_id" integer,
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
  	"version_body_font" "payload"."enum__cms_ss_theme_settings_v_version_body_font" DEFAULT 'inter',
  	"version_heading_font" "payload"."enum__cms_ss_theme_settings_v_version_heading_font" DEFAULT 'space-grotesk',
  	"version_button_style" "payload"."enum__cms_ss_theme_settings_v_version_button_style" DEFAULT 'pill',
  	"version_card_radius" "payload"."enum__cms_ss_theme_settings_v_version_card_radius" DEFAULT 'xl',
  	"version_default_mode" "payload"."enum__cms_ss_theme_settings_v_version_default_mode" DEFAULT 'dark',
  	"version_allow_mode_toggle" boolean DEFAULT true,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_ss_announcement_bar" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_id" integer,
  	"enabled" boolean DEFAULT true,
  	"text" varchar DEFAULT 'Free delivery on orders above Rs 15,000 · Cash on Delivery all over Pakistan',
  	"link_url" varchar,
  	"link_label" varchar,
  	"background_color" varchar DEFAULT '',
  	"text_color" varchar DEFAULT '',
  	"starts_at" timestamp(3) with time zone,
  	"ends_at" timestamp(3) with time zone,
  	"show_contact_links" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."_cms_ss_announcement_bar_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_store_id" integer,
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
  
  CREATE TABLE "payload"."cms_ss_header" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_id" integer,
  	"main_menu_id" integer,
  	"mobile_menu_id" integer,
  	"sticky" boolean DEFAULT true,
  	"show_search" boolean DEFAULT true,
  	"show_language_toggle" boolean DEFAULT true,
  	"show_account_links" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."_cms_ss_header_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_store_id" integer,
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
  
  CREATE TABLE "payload"."cms_ss_footer_columns" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"menu_id" integer NOT NULL
  );
  
  CREATE TABLE "payload"."cms_ss_footer" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_id" integer,
  	"about" varchar DEFAULT 'Laptops & Tech Accessories – Delivered All Over Pakistan. New, used & refurbished laptops and computer accessories from Saddar, Karachi.',
  	"show_contact_info" boolean DEFAULT true,
  	"show_social_links" boolean DEFAULT true,
  	"show_city_links" boolean DEFAULT true,
  	"copyright" varchar DEFAULT '© {year} {store}. All rights reserved.',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_ss_footer_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "payload"."_cms_ss_footer_v_version_columns" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"menu_id" integer NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_cms_ss_footer_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_store_id" integer,
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
  
  CREATE TABLE "payload"."_cms_ss_footer_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "payload"."cms_ss_whatsapp_button_contacts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"phone" varchar NOT NULL
  );
  
  CREATE TABLE "payload"."cms_ss_whatsapp_button" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_id" integer,
  	"enabled" boolean DEFAULT true,
  	"message" varchar DEFAULT 'Hi Urko Tech Store! I need help with an order.',
  	"note" varchar,
  	"position" "payload"."enum_cms_ss_whatsapp_button_position" DEFAULT 'right',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."_cms_ss_whatsapp_button_v_version_contacts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"phone" varchar NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_cms_ss_whatsapp_button_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_store_id" integer,
  	"version_enabled" boolean DEFAULT true,
  	"version_message" varchar DEFAULT 'Hi Urko Tech Store! I need help with an order.',
  	"version_note" varchar,
  	"version_position" "payload"."enum__cms_ss_whatsapp_button_v_version_position" DEFAULT 'right',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_ss_shipping_zones_cities" (
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"value" "payload"."enum_cms_ss_shipping_zones_cities",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "payload"."cms_ss_shipping_zones" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"rest" boolean,
  	"charge" numeric NOT NULL,
  	"free_above" numeric,
  	"estimate" varchar
  );
  
  CREATE TABLE "payload"."cms_ss_shipping" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_id" integer,
  	"free_delivery_threshold" numeric DEFAULT 15000,
  	"default_charge" numeric DEFAULT 350,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_ss_payments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_id" integer,
  	"cod_enabled" boolean DEFAULT true,
  	"cod_note" varchar,
  	"cod_fee" numeric DEFAULT 0,
  	"cod_max_order" numeric,
  	"cod_advance_threshold" numeric DEFAULT 100000,
  	"cod_advance_amount" numeric DEFAULT 5000,
  	"jazzcash_enabled" boolean DEFAULT true,
  	"jazzcash_note" varchar,
  	"jazzcash_title" varchar,
  	"jazzcash_number" varchar,
  	"easypaisa_enabled" boolean DEFAULT true,
  	"easypaisa_note" varchar,
  	"easypaisa_title" varchar,
  	"easypaisa_number" varchar,
  	"bank_enabled" boolean DEFAULT true,
  	"bank_note" varchar,
  	"bank_bank_name" varchar,
  	"bank_account_title" varchar,
  	"bank_account_number" varchar,
  	"bank_iban" varchar,
  	"card_enabled" boolean DEFAULT false,
  	"card_note" varchar,
  	"tax_enabled" boolean DEFAULT false,
  	"tax_rate" numeric DEFAULT 0,
  	"tax_inclusive" boolean DEFAULT true,
  	"tax_label" varchar DEFAULT 'Sales tax',
  	"tax_tax_delivery" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_ss_notifications_status_updates" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "payload"."enum_cms_ss_notifications_status_updates",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "payload"."cms_ss_notifications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_id" integer,
  	"alert_new_order" boolean DEFAULT true,
  	"alert_wholesale" boolean DEFAULT true,
  	"alert_contact" boolean DEFAULT false,
  	"customer_email" boolean DEFAULT true,
  	"customer_whats_app" boolean DEFAULT true,
  	"customer_sms" boolean DEFAULT true,
  	"order_confirmation" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_ss_notifications_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "payload"."cms_ss_store_info_phones" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"display" varchar NOT NULL,
  	"tel" varchar,
  	"wa" varchar
  );
  
  CREATE TABLE "payload"."cms_ss_store_info_hours_days" (
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"value" "payload"."enum_cms_ss_store_info_hours_days",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "payload"."cms_ss_store_info_hours" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"opens" varchar,
  	"closes" varchar
  );
  
  CREATE TABLE "payload"."cms_ss_store_info" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_id" integer,
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
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_ss_store_info_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "payload"."cms_ss_seo_settings_pages" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"page" "payload"."enum_cms_ss_seo_settings_pages_page" NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"og_image" varchar,
  	"indexing" "payload"."enum_cms_ss_seo_settings_pages_indexing" DEFAULT 'default'
  );
  
  CREATE TABLE "payload"."cms_ss_seo_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_id" integer,
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
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_ss_seo_settings_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "payload"."cms_ss_page_texts_pages" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"page" "payload"."enum_cms_ss_page_texts_pages_page" NOT NULL,
  	"eyebrow" varchar,
  	"title" varchar,
  	"description" varchar,
  	"intro" varchar,
  	"body" varchar,
  	"seo_copy" varchar,
  	"updated" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload"."cms_ss_page_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_ss_testimonials_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"city" varchar,
  	"rating" numeric DEFAULT 5,
  	"text" varchar NOT NULL,
  	"product" varchar
  );
  
  CREATE TABLE "payload"."cms_ss_testimonials" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_ss_faqs_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"q" varchar NOT NULL,
  	"group" varchar,
  	"a" varchar NOT NULL
  );
  
  CREATE TABLE "payload"."cms_ss_faqs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_ss_order_protection" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_id" integer,
  	"confirm_enabled" boolean DEFAULT true,
  	"confirm_above" numeric DEFAULT 0,
  	"auto_cancel_hours" numeric DEFAULT 24,
  	"skip_with_advance" boolean DEFAULT true,
  	"points_cancelled" numeric DEFAULT 15,
  	"points_refused" numeric DEFAULT 35,
  	"points_delivered" numeric DEFAULT 10,
  	"medium_at" numeric DEFAULT 30,
  	"high_at" numeric DEFAULT 60,
  	"advance_for_high_risk" boolean DEFAULT true,
  	"advance_for_medium_risk" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_ss_order_protection_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "payload"."cms_ss_returns_policy_reasons" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"change_of_mind" boolean
  );
  
  CREATE TABLE "payload"."cms_ss_returns_policy_warranty_by_condition" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"type" varchar NOT NULL,
  	"condition" "payload"."enum_cms_ss_returns_policy_warranty_by_condition_condition",
  	"months" numeric,
  	"text" varchar,
  	"where" varchar
  );
  
  CREATE TABLE "payload"."cms_ss_returns_policy" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_id" integer,
  	"return_days" numeric DEFAULT 3,
  	"restocking_fee_percent" numeric DEFAULT 0,
  	"require_photos" boolean DEFAULT true,
  	"return_rules" varchar DEFAULT 'Items must be in the original box with all accessories.
  Wrong, damaged or faulty items are replaced free of charge.
  Refunds are sent within 3–5 working days after we inspect the item.',
  	"warranty_rules" varchar DEFAULT 'Warranty covers hardware faults, not physical or liquid damage.
  Keep your receipt or order number.
  Most claims are resolved in 3–7 working days.',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_ss_cookie_notice" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_id" integer,
  	"enabled" boolean DEFAULT true,
  	"message" varchar DEFAULT 'We use cookies to keep your cart and sign-in working. With your OK we also measure visits (Google Analytics) and ads (Meta) to improve the shop.',
  	"accept_label" varchar DEFAULT 'Accept',
  	"reject_label" varchar DEFAULT 'Only necessary',
  	"policy_link" varchar DEFAULT '/privacy-policy',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_ss_sales_channels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_id" integer,
  	"google" boolean DEFAULT true,
  	"meta" boolean DEFAULT true,
  	"tiktok" boolean DEFAULT true,
  	"include_out_of_stock" boolean DEFAULT true,
  	"shipping_price" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_ss_sales_channels_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"cms_categories_id" integer,
  	"cms_products_id" integer
  );
  
  CREATE TABLE "payload"."cms_ss_conversion_emi_plans" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"bank" varchar NOT NULL,
  	"months" numeric NOT NULL,
  	"markup_percent" numeric DEFAULT 0,
  	"min_amount" numeric
  );
  
  CREATE TABLE "payload"."cms_ss_conversion" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_id" integer,
  	"emi_enabled" boolean DEFAULT false,
  	"emi_min_price" numeric DEFAULT 30000,
  	"emi_heading" varchar DEFAULT 'Pay in easy installments',
  	"emi_note" varchar DEFAULT 'Available with credit cards of the banks below. Final amount is confirmed by your bank. WhatsApp us to apply.',
  	"cart_enabled" boolean DEFAULT true,
  	"cart_first_hours" numeric DEFAULT 3,
  	"cart_second_hours" numeric DEFAULT 24,
  	"cart_subject" varchar DEFAULT 'You left something in your cart',
  	"cart_message" varchar DEFAULT 'Your items are still waiting – stock is limited, so complete your order before they''re gone. Cash on delivery all over Pakistan.',
  	"cart_coupon" varchar,
  	"alerts_enabled" boolean DEFAULT true,
  	"price_drop_percent" numeric DEFAULT 3,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_outbox_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_id" integer,
  	"type" varchar NOT NULL,
  	"status" "payload"."enum_cms_outbox_events_status" DEFAULT 'pending' NOT NULL,
  	"attempts" numeric DEFAULT 0,
  	"data" jsonb,
  	"dedupe_key" varchar,
  	"next_attempt_at" timestamp(3) with time zone,
  	"locked_at" timestamp(3) with time zone,
  	"sent_at" timestamp(3) with time zone,
  	"last_error" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_payment_transactions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_id" integer,
  	"order_id" integer,
  	"kind" "payload"."enum_cms_payment_transactions_kind" DEFAULT 'charge' NOT NULL,
  	"status" "payload"."enum_cms_payment_transactions_status" DEFAULT 'pending' NOT NULL,
  	"provider" "payload"."enum_cms_payment_transactions_provider" NOT NULL,
  	"provider_ref" varchar NOT NULL,
  	"amount" numeric NOT NULL,
  	"currency" varchar NOT NULL,
  	"refunded_amount" numeric DEFAULT 0,
  	"payment_intent" varchar,
  	"idempotency_key" varchar,
  	"failure_reason" varchar,
  	"checkout_url" varchar,
  	"expires_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_payment_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_id" integer,
  	"provider" varchar NOT NULL,
  	"event_id" varchar NOT NULL,
  	"type" varchar,
  	"status" "payload"."enum_cms_payment_events_status" DEFAULT 'received' NOT NULL,
  	"received_at" timestamp(3) with time zone,
  	"processed_at" timestamp(3) with time zone,
  	"error" varchar,
  	"summary" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  DROP INDEX "payload"."cms_products_sku_idx";
  DROP INDEX "payload"."cms_products_slug_idx";
  DROP INDEX "payload"."cms_collections_slug_idx";
  DROP INDEX "payload"."cms_categories_slug_idx";
  DROP INDEX "payload"."cms_brands_slug_idx";
  DROP INDEX "payload"."cms_laptop_models_slug_idx";
  DROP INDEX "payload"."cms_posts_slug_idx";
  DROP INDEX "payload"."cms_units_serial_idx";
  DROP INDEX "payload"."cms_discounts_code_idx";
  DROP INDEX "payload"."cms_pages_slug_idx";
  DROP INDEX "payload"."cms_menus_handle_idx";
  DROP INDEX "payload"."cms_blocked_phones_phone_idx";
  DROP INDEX "payload"."cms_redirects_from_idx";
  ALTER TABLE "payload"."cms_posts" ALTER COLUMN "author" DROP DEFAULT;
  ALTER TABLE "payload"."_cms_posts_v" ALTER COLUMN "version_author" DROP DEFAULT;
  ALTER TABLE "payload"."cms_discounts" ALTER COLUMN "value" SET DEFAULT 0;
  ALTER TABLE "payload"."cms_payments" ALTER COLUMN "jazzcash_title" DROP DEFAULT;
  ALTER TABLE "payload"."cms_payments" ALTER COLUMN "jazzcash_number" DROP DEFAULT;
  ALTER TABLE "payload"."cms_payments" ALTER COLUMN "easypaisa_title" DROP DEFAULT;
  ALTER TABLE "payload"."cms_payments" ALTER COLUMN "easypaisa_number" DROP DEFAULT;
  ALTER TABLE "payload"."cms_payments" ALTER COLUMN "bank_bank_name" DROP DEFAULT;
  ALTER TABLE "payload"."cms_payments" ALTER COLUMN "bank_account_title" DROP DEFAULT;
  ALTER TABLE "payload"."cms_users" ADD COLUMN "platform_role" "payload"."enum_cms_users_platform_role" DEFAULT 'customer';
  ALTER TABLE "payload"."cms_users" ADD COLUMN "current_store_id" integer;
  ALTER TABLE "payload"."cms_media" ADD COLUMN "store_id" integer;
  ALTER TABLE "payload"."cms_products" ADD COLUMN "store_id" integer;
  ALTER TABLE "payload"."_cms_products_v" ADD COLUMN "version_store_id" integer;
  ALTER TABLE "payload"."cms_collections" ADD COLUMN "store_id" integer;
  ALTER TABLE "payload"."cms_categories" ADD COLUMN "store_id" integer;
  ALTER TABLE "payload"."cms_brands" ADD COLUMN "store_id" integer;
  ALTER TABLE "payload"."cms_laptop_models" ADD COLUMN "store_id" integer;
  ALTER TABLE "payload"."cms_reviews" ADD COLUMN "store_id" integer;
  ALTER TABLE "payload"."cms_posts" ADD COLUMN "store_id" integer;
  ALTER TABLE "payload"."_cms_posts_v" ADD COLUMN "version_store_id" integer;
  ALTER TABLE "payload"."cms_orders_items" ADD COLUMN "sku" varchar;
  ALTER TABLE "payload"."cms_orders_items" ADD COLUMN "options" jsonb;
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "store_id" integer;
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "tax_total" numeric DEFAULT 0;
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "coupon_consumed" boolean DEFAULT false;
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "coupon_returned" boolean DEFAULT false;
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "payment_reference" varchar;
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "fulfillment_status" "payload"."enum_cms_orders_fulfillment_status" DEFAULT 'unfulfilled';
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "customer_note" varchar;
  ALTER TABLE "payload"."cms_return_requests" ADD COLUMN "store_id" integer;
  ALTER TABLE "payload"."cms_warranty_claims" ADD COLUMN "store_id" integer;
  ALTER TABLE "payload"."cms_pos_sales" ADD COLUMN "store_id" integer;
  ALTER TABLE "payload"."cms_pos_sales" ADD COLUMN "client_sale_id" varchar;
  ALTER TABLE "payload"."cms_cash_ups" ADD COLUMN "store_id" integer;
  ALTER TABLE "payload"."cms_units" ADD COLUMN "store_id" integer;
  ALTER TABLE "payload"."cms_discounts" ADD COLUMN "store_id" integer;
  ALTER TABLE "payload"."cms_discounts" ADD COLUMN "automatic" boolean DEFAULT false;
  ALTER TABLE "payload"."cms_discounts" ADD COLUMN "per_customer_limit" numeric;
  ALTER TABLE "payload"."cms_discounts" ADD COLUMN "starts_at" timestamp(3) with time zone;
  ALTER TABLE "payload"."cms_discounts" ADD COLUMN "applies_to" "payload"."enum_cms_discounts_applies_to" DEFAULT 'all';
  ALTER TABLE "payload"."cms_discounts" ADD COLUMN "combinable" boolean DEFAULT false;
  ALTER TABLE "payload"."cms_flash_sales" ADD COLUMN "store_id" integer;
  ALTER TABLE "payload"."cms_wholesale_inquiries" ADD COLUMN "store_id" integer;
  ALTER TABLE "payload"."cms_contact_messages" ADD COLUMN "store_id" integer;
  ALTER TABLE "payload"."cms_pages" ADD COLUMN "store_id" integer;
  ALTER TABLE "payload"."_cms_pages_v" ADD COLUMN "version_store_id" integer;
  ALTER TABLE "payload"."cms_menus" ADD COLUMN "store_id" integer;
  ALTER TABLE "payload"."cms_blocked_phones" ADD COLUMN "store_id" integer;
  ALTER TABLE "payload"."cms_trade_ins" ADD COLUMN "store_id" integer;
  ALTER TABLE "payload"."cms_product_questions" ADD COLUMN "store_id" integer;
  ALTER TABLE "payload"."cms_stock_alerts" ADD COLUMN "store_id" integer;
  ALTER TABLE "payload"."cms_abandoned_carts" ADD COLUMN "store_id" integer;
  ALTER TABLE "payload"."cms_suppliers" ADD COLUMN "store_id" integer;
  ALTER TABLE "payload"."cms_purchases" ADD COLUMN "store_id" integer;
  ALTER TABLE "payload"."cms_stock_counts" ADD COLUMN "store_id" integer;
  ALTER TABLE "payload"."cms_stock_movements" ADD COLUMN "store_id" integer;
  ALTER TABLE "payload"."cms_activity_log" ADD COLUMN "store_id" integer;
  ALTER TABLE "payload"."cms_exports" ADD COLUMN "store_id" integer;
  ALTER TABLE "payload"."cms_imports" ADD COLUMN "store_id" integer;
  ALTER TABLE "payload"."cms_redirects" ADD COLUMN "store_id" integer;
  ALTER TABLE "payload"."payload_folders" ADD COLUMN "store_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_stores_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_store_memberships_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_subscription_plans_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_store_subscriptions_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_store_invoices_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_ss_theme_settings_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_ss_announcement_bar_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_ss_header_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_ss_footer_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_ss_whatsapp_button_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_ss_shipping_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_ss_payments_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_ss_notifications_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_ss_store_info_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_ss_seo_settings_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_ss_page_texts_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_ss_testimonials_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_ss_faqs_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_ss_order_protection_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_ss_returns_policy_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_ss_cookie_notice_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_ss_sales_channels_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_ss_conversion_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_outbox_events_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_payment_transactions_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_payment_events_id" integer;
  ALTER TABLE "payload"."cms_payments" ADD COLUMN "card_enabled" boolean DEFAULT false;
  ALTER TABLE "payload"."cms_payments" ADD COLUMN "card_note" varchar;
  ALTER TABLE "payload"."cms_payments" ADD COLUMN "tax_enabled" boolean DEFAULT false;
  ALTER TABLE "payload"."cms_payments" ADD COLUMN "tax_rate" numeric DEFAULT 0;
  ALTER TABLE "payload"."cms_payments" ADD COLUMN "tax_inclusive" boolean DEFAULT true;
  ALTER TABLE "payload"."cms_payments" ADD COLUMN "tax_label" varchar DEFAULT 'Sales tax';
  ALTER TABLE "payload"."cms_payments" ADD COLUMN "tax_tax_delivery" boolean DEFAULT false;
  ALTER TABLE "payload"."cms_stores" ADD CONSTRAINT "cms_stores_owner_id_cms_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "payload"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_stores" ADD CONSTRAINT "cms_stores_plan_id_cms_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "payload"."cms_subscription_plans"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_store_memberships" ADD CONSTRAINT "cms_store_memberships_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_store_memberships" ADD CONSTRAINT "cms_store_memberships_user_id_cms_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "payload"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_store_memberships" ADD CONSTRAINT "cms_store_memberships_invited_by_id_cms_users_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "payload"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_subscription_plans_features" ADD CONSTRAINT "cms_subscription_plans_features_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_subscription_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_store_subscriptions" ADD CONSTRAINT "cms_store_subscriptions_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_store_subscriptions" ADD CONSTRAINT "cms_store_subscriptions_plan_id_cms_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "payload"."cms_subscription_plans"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_store_invoices" ADD CONSTRAINT "cms_store_invoices_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_store_invoices" ADD CONSTRAINT "cms_store_invoices_subscription_id_cms_store_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "payload"."cms_store_subscriptions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_users_rels" ADD CONSTRAINT "cms_users_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_users_rels" ADD CONSTRAINT "cms_users_rels_stores_fk" FOREIGN KEY ("cms_stores_id") REFERENCES "payload"."cms_stores"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_discounts_rels" ADD CONSTRAINT "cms_discounts_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_discounts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_discounts_rels" ADD CONSTRAINT "cms_discounts_rels_products_fk" FOREIGN KEY ("cms_products_id") REFERENCES "payload"."cms_products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_discounts_rels" ADD CONSTRAINT "cms_discounts_rels_categories_fk" FOREIGN KEY ("cms_categories_id") REFERENCES "payload"."cms_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_discounts_rels" ADD CONSTRAINT "cms_discounts_rels_product_collections_fk" FOREIGN KEY ("cms_collections_id") REFERENCES "payload"."cms_collections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_theme_settings" ADD CONSTRAINT "cms_ss_theme_settings_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_theme_settings" ADD CONSTRAINT "cms_ss_theme_settings_logo_dark_id_cms_media_id_fk" FOREIGN KEY ("logo_dark_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_theme_settings" ADD CONSTRAINT "cms_ss_theme_settings_logo_light_id_cms_media_id_fk" FOREIGN KEY ("logo_light_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_theme_settings" ADD CONSTRAINT "cms_ss_theme_settings_favicon_id_cms_media_id_fk" FOREIGN KEY ("favicon_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_ss_theme_settings_v" ADD CONSTRAINT "_cms_ss_theme_settings_v_parent_id_cms_ss_theme_settings_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_ss_theme_settings"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_ss_theme_settings_v" ADD CONSTRAINT "_cms_ss_theme_settings_v_version_store_id_cms_stores_id_fk" FOREIGN KEY ("version_store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_ss_theme_settings_v" ADD CONSTRAINT "_cms_ss_theme_settings_v_version_logo_dark_id_cms_media_id_fk" FOREIGN KEY ("version_logo_dark_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_ss_theme_settings_v" ADD CONSTRAINT "_cms_ss_theme_settings_v_version_logo_light_id_cms_media_id_fk" FOREIGN KEY ("version_logo_light_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_ss_theme_settings_v" ADD CONSTRAINT "_cms_ss_theme_settings_v_version_favicon_id_cms_media_id_fk" FOREIGN KEY ("version_favicon_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_announcement_bar" ADD CONSTRAINT "cms_ss_announcement_bar_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_ss_announcement_bar_v" ADD CONSTRAINT "_cms_ss_announcement_bar_v_parent_id_cms_ss_announcement_bar_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_ss_announcement_bar"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_ss_announcement_bar_v" ADD CONSTRAINT "_cms_ss_announcement_bar_v_version_store_id_cms_stores_id_fk" FOREIGN KEY ("version_store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_header" ADD CONSTRAINT "cms_ss_header_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_header" ADD CONSTRAINT "cms_ss_header_main_menu_id_cms_menus_id_fk" FOREIGN KEY ("main_menu_id") REFERENCES "payload"."cms_menus"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_header" ADD CONSTRAINT "cms_ss_header_mobile_menu_id_cms_menus_id_fk" FOREIGN KEY ("mobile_menu_id") REFERENCES "payload"."cms_menus"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_ss_header_v" ADD CONSTRAINT "_cms_ss_header_v_parent_id_cms_ss_header_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_ss_header"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_ss_header_v" ADD CONSTRAINT "_cms_ss_header_v_version_store_id_cms_stores_id_fk" FOREIGN KEY ("version_store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_ss_header_v" ADD CONSTRAINT "_cms_ss_header_v_version_main_menu_id_cms_menus_id_fk" FOREIGN KEY ("version_main_menu_id") REFERENCES "payload"."cms_menus"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_ss_header_v" ADD CONSTRAINT "_cms_ss_header_v_version_mobile_menu_id_cms_menus_id_fk" FOREIGN KEY ("version_mobile_menu_id") REFERENCES "payload"."cms_menus"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_footer_columns" ADD CONSTRAINT "cms_ss_footer_columns_menu_id_cms_menus_id_fk" FOREIGN KEY ("menu_id") REFERENCES "payload"."cms_menus"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_footer_columns" ADD CONSTRAINT "cms_ss_footer_columns_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_ss_footer"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_footer" ADD CONSTRAINT "cms_ss_footer_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_footer_texts" ADD CONSTRAINT "cms_ss_footer_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_ss_footer"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_ss_footer_v_version_columns" ADD CONSTRAINT "_cms_ss_footer_v_version_columns_menu_id_cms_menus_id_fk" FOREIGN KEY ("menu_id") REFERENCES "payload"."cms_menus"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_ss_footer_v_version_columns" ADD CONSTRAINT "_cms_ss_footer_v_version_columns_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_cms_ss_footer_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_ss_footer_v" ADD CONSTRAINT "_cms_ss_footer_v_parent_id_cms_ss_footer_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_ss_footer"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_ss_footer_v" ADD CONSTRAINT "_cms_ss_footer_v_version_store_id_cms_stores_id_fk" FOREIGN KEY ("version_store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_ss_footer_v_texts" ADD CONSTRAINT "_cms_ss_footer_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."_cms_ss_footer_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_whatsapp_button_contacts" ADD CONSTRAINT "cms_ss_whatsapp_button_contacts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_ss_whatsapp_button"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_whatsapp_button" ADD CONSTRAINT "cms_ss_whatsapp_button_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_ss_whatsapp_button_v_version_contacts" ADD CONSTRAINT "_cms_ss_whatsapp_button_v_version_contacts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_cms_ss_whatsapp_button_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_cms_ss_whatsapp_button_v" ADD CONSTRAINT "_cms_ss_whatsapp_button_v_parent_id_cms_ss_whatsapp_button_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_ss_whatsapp_button"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_ss_whatsapp_button_v" ADD CONSTRAINT "_cms_ss_whatsapp_button_v_version_store_id_cms_stores_id_fk" FOREIGN KEY ("version_store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_shipping_zones_cities" ADD CONSTRAINT "cms_ss_shipping_zones_cities_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_ss_shipping_zones"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_shipping_zones" ADD CONSTRAINT "cms_ss_shipping_zones_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_ss_shipping"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_shipping" ADD CONSTRAINT "cms_ss_shipping_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_payments" ADD CONSTRAINT "cms_ss_payments_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_notifications_status_updates" ADD CONSTRAINT "cms_ss_notifications_status_updates_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_ss_notifications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_notifications" ADD CONSTRAINT "cms_ss_notifications_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_notifications_texts" ADD CONSTRAINT "cms_ss_notifications_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_ss_notifications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_store_info_phones" ADD CONSTRAINT "cms_ss_store_info_phones_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_ss_store_info"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_store_info_hours_days" ADD CONSTRAINT "cms_ss_store_info_hours_days_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_ss_store_info_hours"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_store_info_hours" ADD CONSTRAINT "cms_ss_store_info_hours_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_ss_store_info"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_store_info" ADD CONSTRAINT "cms_ss_store_info_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_store_info_texts" ADD CONSTRAINT "cms_ss_store_info_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_ss_store_info"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_seo_settings_pages" ADD CONSTRAINT "cms_ss_seo_settings_pages_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_ss_seo_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_seo_settings" ADD CONSTRAINT "cms_ss_seo_settings_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_seo_settings_texts" ADD CONSTRAINT "cms_ss_seo_settings_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_ss_seo_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_page_texts_pages" ADD CONSTRAINT "cms_ss_page_texts_pages_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_ss_page_texts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_page_texts" ADD CONSTRAINT "cms_ss_page_texts_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_testimonials_items" ADD CONSTRAINT "cms_ss_testimonials_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_ss_testimonials"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_testimonials" ADD CONSTRAINT "cms_ss_testimonials_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_faqs_items" ADD CONSTRAINT "cms_ss_faqs_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_ss_faqs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_faqs" ADD CONSTRAINT "cms_ss_faqs_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_order_protection" ADD CONSTRAINT "cms_ss_order_protection_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_order_protection_texts" ADD CONSTRAINT "cms_ss_order_protection_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_ss_order_protection"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_returns_policy_reasons" ADD CONSTRAINT "cms_ss_returns_policy_reasons_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_ss_returns_policy"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_returns_policy_warranty_by_condition" ADD CONSTRAINT "cms_ss_returns_policy_warranty_by_condition_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_ss_returns_policy"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_returns_policy" ADD CONSTRAINT "cms_ss_returns_policy_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_cookie_notice" ADD CONSTRAINT "cms_ss_cookie_notice_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_sales_channels" ADD CONSTRAINT "cms_ss_sales_channels_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_sales_channels_rels" ADD CONSTRAINT "cms_ss_sales_channels_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_ss_sales_channels"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_sales_channels_rels" ADD CONSTRAINT "cms_ss_sales_channels_rels_categories_fk" FOREIGN KEY ("cms_categories_id") REFERENCES "payload"."cms_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_sales_channels_rels" ADD CONSTRAINT "cms_ss_sales_channels_rels_products_fk" FOREIGN KEY ("cms_products_id") REFERENCES "payload"."cms_products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_conversion_emi_plans" ADD CONSTRAINT "cms_ss_conversion_emi_plans_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_ss_conversion"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_ss_conversion" ADD CONSTRAINT "cms_ss_conversion_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_outbox_events" ADD CONSTRAINT "cms_outbox_events_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_payment_transactions" ADD CONSTRAINT "cms_payment_transactions_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_payment_transactions" ADD CONSTRAINT "cms_payment_transactions_order_id_cms_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "payload"."cms_orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_payment_events" ADD CONSTRAINT "cms_payment_events_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "cms_stores_slug_idx" ON "payload"."cms_stores" USING btree ("slug");
  CREATE INDEX "cms_stores_status_idx" ON "payload"."cms_stores" USING btree ("status");
  CREATE UNIQUE INDEX "cms_stores_subdomain_idx" ON "payload"."cms_stores" USING btree ("subdomain");
  CREATE UNIQUE INDEX "cms_stores_custom_domain_idx" ON "payload"."cms_stores" USING btree ("custom_domain");
  CREATE INDEX "cms_stores_owner_idx" ON "payload"."cms_stores" USING btree ("owner_id");
  CREATE INDEX "cms_stores_plan_idx" ON "payload"."cms_stores" USING btree ("plan_id");
  CREATE INDEX "cms_stores_subscription_status_idx" ON "payload"."cms_stores" USING btree ("subscription_status");
  CREATE INDEX "cms_stores_updated_at_idx" ON "payload"."cms_stores" USING btree ("updated_at");
  CREATE INDEX "cms_stores_created_at_idx" ON "payload"."cms_stores" USING btree ("created_at");
  CREATE INDEX "cms_store_memberships_store_idx" ON "payload"."cms_store_memberships" USING btree ("store_id");
  CREATE INDEX "cms_store_memberships_user_idx" ON "payload"."cms_store_memberships" USING btree ("user_id");
  CREATE INDEX "cms_store_memberships_email_idx" ON "payload"."cms_store_memberships" USING btree ("email");
  CREATE INDEX "cms_store_memberships_status_idx" ON "payload"."cms_store_memberships" USING btree ("status");
  CREATE INDEX "cms_store_memberships_invited_by_idx" ON "payload"."cms_store_memberships" USING btree ("invited_by_id");
  CREATE INDEX "cms_store_memberships_invite_token_hash_idx" ON "payload"."cms_store_memberships" USING btree ("invite_token_hash");
  CREATE INDEX "cms_store_memberships_updated_at_idx" ON "payload"."cms_store_memberships" USING btree ("updated_at");
  CREATE INDEX "cms_store_memberships_created_at_idx" ON "payload"."cms_store_memberships" USING btree ("created_at");
  CREATE UNIQUE INDEX "store_user_idx" ON "payload"."cms_store_memberships" USING btree ("store_id","user_id");
  CREATE INDEX "cms_subscription_plans_features_order_idx" ON "payload"."cms_subscription_plans_features" USING btree ("order");
  CREATE INDEX "cms_subscription_plans_features_parent_idx" ON "payload"."cms_subscription_plans_features" USING btree ("parent_id");
  CREATE UNIQUE INDEX "cms_subscription_plans_slug_idx" ON "payload"."cms_subscription_plans" USING btree ("slug");
  CREATE INDEX "cms_subscription_plans_updated_at_idx" ON "payload"."cms_subscription_plans" USING btree ("updated_at");
  CREATE INDEX "cms_subscription_plans_created_at_idx" ON "payload"."cms_subscription_plans" USING btree ("created_at");
  CREATE UNIQUE INDEX "cms_store_subscriptions_store_idx" ON "payload"."cms_store_subscriptions" USING btree ("store_id");
  CREATE INDEX "cms_store_subscriptions_plan_idx" ON "payload"."cms_store_subscriptions" USING btree ("plan_id");
  CREATE INDEX "cms_store_subscriptions_status_idx" ON "payload"."cms_store_subscriptions" USING btree ("status");
  CREATE INDEX "cms_store_subscriptions_external_customer_id_idx" ON "payload"."cms_store_subscriptions" USING btree ("external_customer_id");
  CREATE INDEX "cms_store_subscriptions_external_subscription_id_idx" ON "payload"."cms_store_subscriptions" USING btree ("external_subscription_id");
  CREATE INDEX "cms_store_subscriptions_updated_at_idx" ON "payload"."cms_store_subscriptions" USING btree ("updated_at");
  CREATE INDEX "cms_store_subscriptions_created_at_idx" ON "payload"."cms_store_subscriptions" USING btree ("created_at");
  CREATE INDEX "cms_store_invoices_store_idx" ON "payload"."cms_store_invoices" USING btree ("store_id");
  CREATE INDEX "cms_store_invoices_subscription_idx" ON "payload"."cms_store_invoices" USING btree ("subscription_id");
  CREATE UNIQUE INDEX "cms_store_invoices_invoice_number_idx" ON "payload"."cms_store_invoices" USING btree ("invoice_number");
  CREATE INDEX "cms_store_invoices_status_idx" ON "payload"."cms_store_invoices" USING btree ("status");
  CREATE UNIQUE INDEX "cms_store_invoices_provider_invoice_id_idx" ON "payload"."cms_store_invoices" USING btree ("provider_invoice_id");
  CREATE INDEX "cms_store_invoices_updated_at_idx" ON "payload"."cms_store_invoices" USING btree ("updated_at");
  CREATE INDEX "cms_store_invoices_created_at_idx" ON "payload"."cms_store_invoices" USING btree ("created_at");
  CREATE INDEX "cms_users_rels_order_idx" ON "payload"."cms_users_rels" USING btree ("order");
  CREATE INDEX "cms_users_rels_parent_idx" ON "payload"."cms_users_rels" USING btree ("parent_id");
  CREATE INDEX "cms_users_rels_path_idx" ON "payload"."cms_users_rels" USING btree ("path");
  CREATE INDEX "cms_users_rels_cms_stores_id_idx" ON "payload"."cms_users_rels" USING btree ("cms_stores_id");
  CREATE INDEX "cms_discounts_rels_order_idx" ON "payload"."cms_discounts_rels" USING btree ("order");
  CREATE INDEX "cms_discounts_rels_parent_idx" ON "payload"."cms_discounts_rels" USING btree ("parent_id");
  CREATE INDEX "cms_discounts_rels_path_idx" ON "payload"."cms_discounts_rels" USING btree ("path");
  CREATE INDEX "cms_discounts_rels_cms_products_id_idx" ON "payload"."cms_discounts_rels" USING btree ("cms_products_id");
  CREATE INDEX "cms_discounts_rels_cms_categories_id_idx" ON "payload"."cms_discounts_rels" USING btree ("cms_categories_id");
  CREATE INDEX "cms_discounts_rels_cms_collections_id_idx" ON "payload"."cms_discounts_rels" USING btree ("cms_collections_id");
  CREATE UNIQUE INDEX "cms_ss_theme_settings_store_idx" ON "payload"."cms_ss_theme_settings" USING btree ("store_id");
  CREATE INDEX "cms_ss_theme_settings_logo_dark_idx" ON "payload"."cms_ss_theme_settings" USING btree ("logo_dark_id");
  CREATE INDEX "cms_ss_theme_settings_logo_light_idx" ON "payload"."cms_ss_theme_settings" USING btree ("logo_light_id");
  CREATE INDEX "cms_ss_theme_settings_favicon_idx" ON "payload"."cms_ss_theme_settings" USING btree ("favicon_id");
  CREATE INDEX "cms_ss_theme_settings_updated_at_idx" ON "payload"."cms_ss_theme_settings" USING btree ("updated_at");
  CREATE INDEX "cms_ss_theme_settings_created_at_idx" ON "payload"."cms_ss_theme_settings" USING btree ("created_at");
  CREATE INDEX "_cms_ss_theme_settings_v_parent_idx" ON "payload"."_cms_ss_theme_settings_v" USING btree ("parent_id");
  CREATE INDEX "_cms_ss_theme_settings_v_version_version_store_idx" ON "payload"."_cms_ss_theme_settings_v" USING btree ("version_store_id");
  CREATE INDEX "_cms_ss_theme_settings_v_version_version_logo_dark_idx" ON "payload"."_cms_ss_theme_settings_v" USING btree ("version_logo_dark_id");
  CREATE INDEX "_cms_ss_theme_settings_v_version_version_logo_light_idx" ON "payload"."_cms_ss_theme_settings_v" USING btree ("version_logo_light_id");
  CREATE INDEX "_cms_ss_theme_settings_v_version_version_favicon_idx" ON "payload"."_cms_ss_theme_settings_v" USING btree ("version_favicon_id");
  CREATE INDEX "_cms_ss_theme_settings_v_version_version_updated_at_idx" ON "payload"."_cms_ss_theme_settings_v" USING btree ("version_updated_at");
  CREATE INDEX "_cms_ss_theme_settings_v_version_version_created_at_idx" ON "payload"."_cms_ss_theme_settings_v" USING btree ("version_created_at");
  CREATE INDEX "_cms_ss_theme_settings_v_created_at_idx" ON "payload"."_cms_ss_theme_settings_v" USING btree ("created_at");
  CREATE INDEX "_cms_ss_theme_settings_v_updated_at_idx" ON "payload"."_cms_ss_theme_settings_v" USING btree ("updated_at");
  CREATE UNIQUE INDEX "cms_ss_announcement_bar_store_idx" ON "payload"."cms_ss_announcement_bar" USING btree ("store_id");
  CREATE INDEX "cms_ss_announcement_bar_updated_at_idx" ON "payload"."cms_ss_announcement_bar" USING btree ("updated_at");
  CREATE INDEX "cms_ss_announcement_bar_created_at_idx" ON "payload"."cms_ss_announcement_bar" USING btree ("created_at");
  CREATE INDEX "_cms_ss_announcement_bar_v_parent_idx" ON "payload"."_cms_ss_announcement_bar_v" USING btree ("parent_id");
  CREATE INDEX "_cms_ss_announcement_bar_v_version_version_store_idx" ON "payload"."_cms_ss_announcement_bar_v" USING btree ("version_store_id");
  CREATE INDEX "_cms_ss_announcement_bar_v_version_version_updated_at_idx" ON "payload"."_cms_ss_announcement_bar_v" USING btree ("version_updated_at");
  CREATE INDEX "_cms_ss_announcement_bar_v_version_version_created_at_idx" ON "payload"."_cms_ss_announcement_bar_v" USING btree ("version_created_at");
  CREATE INDEX "_cms_ss_announcement_bar_v_created_at_idx" ON "payload"."_cms_ss_announcement_bar_v" USING btree ("created_at");
  CREATE INDEX "_cms_ss_announcement_bar_v_updated_at_idx" ON "payload"."_cms_ss_announcement_bar_v" USING btree ("updated_at");
  CREATE UNIQUE INDEX "cms_ss_header_store_idx" ON "payload"."cms_ss_header" USING btree ("store_id");
  CREATE INDEX "cms_ss_header_main_menu_idx" ON "payload"."cms_ss_header" USING btree ("main_menu_id");
  CREATE INDEX "cms_ss_header_mobile_menu_idx" ON "payload"."cms_ss_header" USING btree ("mobile_menu_id");
  CREATE INDEX "cms_ss_header_updated_at_idx" ON "payload"."cms_ss_header" USING btree ("updated_at");
  CREATE INDEX "cms_ss_header_created_at_idx" ON "payload"."cms_ss_header" USING btree ("created_at");
  CREATE INDEX "_cms_ss_header_v_parent_idx" ON "payload"."_cms_ss_header_v" USING btree ("parent_id");
  CREATE INDEX "_cms_ss_header_v_version_version_store_idx" ON "payload"."_cms_ss_header_v" USING btree ("version_store_id");
  CREATE INDEX "_cms_ss_header_v_version_version_main_menu_idx" ON "payload"."_cms_ss_header_v" USING btree ("version_main_menu_id");
  CREATE INDEX "_cms_ss_header_v_version_version_mobile_menu_idx" ON "payload"."_cms_ss_header_v" USING btree ("version_mobile_menu_id");
  CREATE INDEX "_cms_ss_header_v_version_version_updated_at_idx" ON "payload"."_cms_ss_header_v" USING btree ("version_updated_at");
  CREATE INDEX "_cms_ss_header_v_version_version_created_at_idx" ON "payload"."_cms_ss_header_v" USING btree ("version_created_at");
  CREATE INDEX "_cms_ss_header_v_created_at_idx" ON "payload"."_cms_ss_header_v" USING btree ("created_at");
  CREATE INDEX "_cms_ss_header_v_updated_at_idx" ON "payload"."_cms_ss_header_v" USING btree ("updated_at");
  CREATE INDEX "cms_ss_footer_columns_order_idx" ON "payload"."cms_ss_footer_columns" USING btree ("_order");
  CREATE INDEX "cms_ss_footer_columns_parent_id_idx" ON "payload"."cms_ss_footer_columns" USING btree ("_parent_id");
  CREATE INDEX "cms_ss_footer_columns_menu_idx" ON "payload"."cms_ss_footer_columns" USING btree ("menu_id");
  CREATE UNIQUE INDEX "cms_ss_footer_store_idx" ON "payload"."cms_ss_footer" USING btree ("store_id");
  CREATE INDEX "cms_ss_footer_updated_at_idx" ON "payload"."cms_ss_footer" USING btree ("updated_at");
  CREATE INDEX "cms_ss_footer_created_at_idx" ON "payload"."cms_ss_footer" USING btree ("created_at");
  CREATE INDEX "cms_ss_footer_texts_order_parent" ON "payload"."cms_ss_footer_texts" USING btree ("order","parent_id");
  CREATE INDEX "_cms_ss_footer_v_version_columns_order_idx" ON "payload"."_cms_ss_footer_v_version_columns" USING btree ("_order");
  CREATE INDEX "_cms_ss_footer_v_version_columns_parent_id_idx" ON "payload"."_cms_ss_footer_v_version_columns" USING btree ("_parent_id");
  CREATE INDEX "_cms_ss_footer_v_version_columns_menu_idx" ON "payload"."_cms_ss_footer_v_version_columns" USING btree ("menu_id");
  CREATE INDEX "_cms_ss_footer_v_parent_idx" ON "payload"."_cms_ss_footer_v" USING btree ("parent_id");
  CREATE INDEX "_cms_ss_footer_v_version_version_store_idx" ON "payload"."_cms_ss_footer_v" USING btree ("version_store_id");
  CREATE INDEX "_cms_ss_footer_v_version_version_updated_at_idx" ON "payload"."_cms_ss_footer_v" USING btree ("version_updated_at");
  CREATE INDEX "_cms_ss_footer_v_version_version_created_at_idx" ON "payload"."_cms_ss_footer_v" USING btree ("version_created_at");
  CREATE INDEX "_cms_ss_footer_v_created_at_idx" ON "payload"."_cms_ss_footer_v" USING btree ("created_at");
  CREATE INDEX "_cms_ss_footer_v_updated_at_idx" ON "payload"."_cms_ss_footer_v" USING btree ("updated_at");
  CREATE INDEX "_cms_ss_footer_v_texts_order_parent" ON "payload"."_cms_ss_footer_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "cms_ss_whatsapp_button_contacts_order_idx" ON "payload"."cms_ss_whatsapp_button_contacts" USING btree ("_order");
  CREATE INDEX "cms_ss_whatsapp_button_contacts_parent_id_idx" ON "payload"."cms_ss_whatsapp_button_contacts" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "cms_ss_whatsapp_button_store_idx" ON "payload"."cms_ss_whatsapp_button" USING btree ("store_id");
  CREATE INDEX "cms_ss_whatsapp_button_updated_at_idx" ON "payload"."cms_ss_whatsapp_button" USING btree ("updated_at");
  CREATE INDEX "cms_ss_whatsapp_button_created_at_idx" ON "payload"."cms_ss_whatsapp_button" USING btree ("created_at");
  CREATE INDEX "_cms_ss_whatsapp_button_v_version_contacts_order_idx" ON "payload"."_cms_ss_whatsapp_button_v_version_contacts" USING btree ("_order");
  CREATE INDEX "_cms_ss_whatsapp_button_v_version_contacts_parent_id_idx" ON "payload"."_cms_ss_whatsapp_button_v_version_contacts" USING btree ("_parent_id");
  CREATE INDEX "_cms_ss_whatsapp_button_v_parent_idx" ON "payload"."_cms_ss_whatsapp_button_v" USING btree ("parent_id");
  CREATE INDEX "_cms_ss_whatsapp_button_v_version_version_store_idx" ON "payload"."_cms_ss_whatsapp_button_v" USING btree ("version_store_id");
  CREATE INDEX "_cms_ss_whatsapp_button_v_version_version_updated_at_idx" ON "payload"."_cms_ss_whatsapp_button_v" USING btree ("version_updated_at");
  CREATE INDEX "_cms_ss_whatsapp_button_v_version_version_created_at_idx" ON "payload"."_cms_ss_whatsapp_button_v" USING btree ("version_created_at");
  CREATE INDEX "_cms_ss_whatsapp_button_v_created_at_idx" ON "payload"."_cms_ss_whatsapp_button_v" USING btree ("created_at");
  CREATE INDEX "_cms_ss_whatsapp_button_v_updated_at_idx" ON "payload"."_cms_ss_whatsapp_button_v" USING btree ("updated_at");
  CREATE INDEX "cms_ss_shipping_zones_cities_order_idx" ON "payload"."cms_ss_shipping_zones_cities" USING btree ("order");
  CREATE INDEX "cms_ss_shipping_zones_cities_parent_idx" ON "payload"."cms_ss_shipping_zones_cities" USING btree ("parent_id");
  CREATE INDEX "cms_ss_shipping_zones_order_idx" ON "payload"."cms_ss_shipping_zones" USING btree ("_order");
  CREATE INDEX "cms_ss_shipping_zones_parent_id_idx" ON "payload"."cms_ss_shipping_zones" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "cms_ss_shipping_store_idx" ON "payload"."cms_ss_shipping" USING btree ("store_id");
  CREATE INDEX "cms_ss_shipping_updated_at_idx" ON "payload"."cms_ss_shipping" USING btree ("updated_at");
  CREATE INDEX "cms_ss_shipping_created_at_idx" ON "payload"."cms_ss_shipping" USING btree ("created_at");
  CREATE UNIQUE INDEX "cms_ss_payments_store_idx" ON "payload"."cms_ss_payments" USING btree ("store_id");
  CREATE INDEX "cms_ss_payments_updated_at_idx" ON "payload"."cms_ss_payments" USING btree ("updated_at");
  CREATE INDEX "cms_ss_payments_created_at_idx" ON "payload"."cms_ss_payments" USING btree ("created_at");
  CREATE INDEX "cms_ss_notifications_status_updates_order_idx" ON "payload"."cms_ss_notifications_status_updates" USING btree ("order");
  CREATE INDEX "cms_ss_notifications_status_updates_parent_idx" ON "payload"."cms_ss_notifications_status_updates" USING btree ("parent_id");
  CREATE UNIQUE INDEX "cms_ss_notifications_store_idx" ON "payload"."cms_ss_notifications" USING btree ("store_id");
  CREATE INDEX "cms_ss_notifications_updated_at_idx" ON "payload"."cms_ss_notifications" USING btree ("updated_at");
  CREATE INDEX "cms_ss_notifications_created_at_idx" ON "payload"."cms_ss_notifications" USING btree ("created_at");
  CREATE INDEX "cms_ss_notifications_texts_order_parent" ON "payload"."cms_ss_notifications_texts" USING btree ("order","parent_id");
  CREATE INDEX "cms_ss_store_info_phones_order_idx" ON "payload"."cms_ss_store_info_phones" USING btree ("_order");
  CREATE INDEX "cms_ss_store_info_phones_parent_id_idx" ON "payload"."cms_ss_store_info_phones" USING btree ("_parent_id");
  CREATE INDEX "cms_ss_store_info_hours_days_order_idx" ON "payload"."cms_ss_store_info_hours_days" USING btree ("order");
  CREATE INDEX "cms_ss_store_info_hours_days_parent_idx" ON "payload"."cms_ss_store_info_hours_days" USING btree ("parent_id");
  CREATE INDEX "cms_ss_store_info_hours_order_idx" ON "payload"."cms_ss_store_info_hours" USING btree ("_order");
  CREATE INDEX "cms_ss_store_info_hours_parent_id_idx" ON "payload"."cms_ss_store_info_hours" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "cms_ss_store_info_store_idx" ON "payload"."cms_ss_store_info" USING btree ("store_id");
  CREATE INDEX "cms_ss_store_info_updated_at_idx" ON "payload"."cms_ss_store_info" USING btree ("updated_at");
  CREATE INDEX "cms_ss_store_info_created_at_idx" ON "payload"."cms_ss_store_info" USING btree ("created_at");
  CREATE INDEX "cms_ss_store_info_texts_order_parent" ON "payload"."cms_ss_store_info_texts" USING btree ("order","parent_id");
  CREATE INDEX "cms_ss_seo_settings_pages_order_idx" ON "payload"."cms_ss_seo_settings_pages" USING btree ("_order");
  CREATE INDEX "cms_ss_seo_settings_pages_parent_id_idx" ON "payload"."cms_ss_seo_settings_pages" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "cms_ss_seo_settings_store_idx" ON "payload"."cms_ss_seo_settings" USING btree ("store_id");
  CREATE INDEX "cms_ss_seo_settings_updated_at_idx" ON "payload"."cms_ss_seo_settings" USING btree ("updated_at");
  CREATE INDEX "cms_ss_seo_settings_created_at_idx" ON "payload"."cms_ss_seo_settings" USING btree ("created_at");
  CREATE INDEX "cms_ss_seo_settings_texts_order_parent" ON "payload"."cms_ss_seo_settings_texts" USING btree ("order","parent_id");
  CREATE INDEX "cms_ss_page_texts_pages_order_idx" ON "payload"."cms_ss_page_texts_pages" USING btree ("_order");
  CREATE INDEX "cms_ss_page_texts_pages_parent_id_idx" ON "payload"."cms_ss_page_texts_pages" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "cms_ss_page_texts_store_idx" ON "payload"."cms_ss_page_texts" USING btree ("store_id");
  CREATE INDEX "cms_ss_page_texts_updated_at_idx" ON "payload"."cms_ss_page_texts" USING btree ("updated_at");
  CREATE INDEX "cms_ss_page_texts_created_at_idx" ON "payload"."cms_ss_page_texts" USING btree ("created_at");
  CREATE INDEX "cms_ss_testimonials_items_order_idx" ON "payload"."cms_ss_testimonials_items" USING btree ("_order");
  CREATE INDEX "cms_ss_testimonials_items_parent_id_idx" ON "payload"."cms_ss_testimonials_items" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "cms_ss_testimonials_store_idx" ON "payload"."cms_ss_testimonials" USING btree ("store_id");
  CREATE INDEX "cms_ss_testimonials_updated_at_idx" ON "payload"."cms_ss_testimonials" USING btree ("updated_at");
  CREATE INDEX "cms_ss_testimonials_created_at_idx" ON "payload"."cms_ss_testimonials" USING btree ("created_at");
  CREATE INDEX "cms_ss_faqs_items_order_idx" ON "payload"."cms_ss_faqs_items" USING btree ("_order");
  CREATE INDEX "cms_ss_faqs_items_parent_id_idx" ON "payload"."cms_ss_faqs_items" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "cms_ss_faqs_store_idx" ON "payload"."cms_ss_faqs" USING btree ("store_id");
  CREATE INDEX "cms_ss_faqs_updated_at_idx" ON "payload"."cms_ss_faqs" USING btree ("updated_at");
  CREATE INDEX "cms_ss_faqs_created_at_idx" ON "payload"."cms_ss_faqs" USING btree ("created_at");
  CREATE UNIQUE INDEX "cms_ss_order_protection_store_idx" ON "payload"."cms_ss_order_protection" USING btree ("store_id");
  CREATE INDEX "cms_ss_order_protection_updated_at_idx" ON "payload"."cms_ss_order_protection" USING btree ("updated_at");
  CREATE INDEX "cms_ss_order_protection_created_at_idx" ON "payload"."cms_ss_order_protection" USING btree ("created_at");
  CREATE INDEX "cms_ss_order_protection_texts_order_parent" ON "payload"."cms_ss_order_protection_texts" USING btree ("order","parent_id");
  CREATE INDEX "cms_ss_returns_policy_reasons_order_idx" ON "payload"."cms_ss_returns_policy_reasons" USING btree ("_order");
  CREATE INDEX "cms_ss_returns_policy_reasons_parent_id_idx" ON "payload"."cms_ss_returns_policy_reasons" USING btree ("_parent_id");
  CREATE INDEX "cms_ss_returns_policy_warranty_by_condition_order_idx" ON "payload"."cms_ss_returns_policy_warranty_by_condition" USING btree ("_order");
  CREATE INDEX "cms_ss_returns_policy_warranty_by_condition_parent_id_idx" ON "payload"."cms_ss_returns_policy_warranty_by_condition" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "cms_ss_returns_policy_store_idx" ON "payload"."cms_ss_returns_policy" USING btree ("store_id");
  CREATE INDEX "cms_ss_returns_policy_updated_at_idx" ON "payload"."cms_ss_returns_policy" USING btree ("updated_at");
  CREATE INDEX "cms_ss_returns_policy_created_at_idx" ON "payload"."cms_ss_returns_policy" USING btree ("created_at");
  CREATE UNIQUE INDEX "cms_ss_cookie_notice_store_idx" ON "payload"."cms_ss_cookie_notice" USING btree ("store_id");
  CREATE INDEX "cms_ss_cookie_notice_updated_at_idx" ON "payload"."cms_ss_cookie_notice" USING btree ("updated_at");
  CREATE INDEX "cms_ss_cookie_notice_created_at_idx" ON "payload"."cms_ss_cookie_notice" USING btree ("created_at");
  CREATE UNIQUE INDEX "cms_ss_sales_channels_store_idx" ON "payload"."cms_ss_sales_channels" USING btree ("store_id");
  CREATE INDEX "cms_ss_sales_channels_updated_at_idx" ON "payload"."cms_ss_sales_channels" USING btree ("updated_at");
  CREATE INDEX "cms_ss_sales_channels_created_at_idx" ON "payload"."cms_ss_sales_channels" USING btree ("created_at");
  CREATE INDEX "cms_ss_sales_channels_rels_order_idx" ON "payload"."cms_ss_sales_channels_rels" USING btree ("order");
  CREATE INDEX "cms_ss_sales_channels_rels_parent_idx" ON "payload"."cms_ss_sales_channels_rels" USING btree ("parent_id");
  CREATE INDEX "cms_ss_sales_channels_rels_path_idx" ON "payload"."cms_ss_sales_channels_rels" USING btree ("path");
  CREATE INDEX "cms_ss_sales_channels_rels_cms_categories_id_idx" ON "payload"."cms_ss_sales_channels_rels" USING btree ("cms_categories_id");
  CREATE INDEX "cms_ss_sales_channels_rels_cms_products_id_idx" ON "payload"."cms_ss_sales_channels_rels" USING btree ("cms_products_id");
  CREATE INDEX "cms_ss_conversion_emi_plans_order_idx" ON "payload"."cms_ss_conversion_emi_plans" USING btree ("_order");
  CREATE INDEX "cms_ss_conversion_emi_plans_parent_id_idx" ON "payload"."cms_ss_conversion_emi_plans" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "cms_ss_conversion_store_idx" ON "payload"."cms_ss_conversion" USING btree ("store_id");
  CREATE INDEX "cms_ss_conversion_updated_at_idx" ON "payload"."cms_ss_conversion" USING btree ("updated_at");
  CREATE INDEX "cms_ss_conversion_created_at_idx" ON "payload"."cms_ss_conversion" USING btree ("created_at");
  CREATE INDEX "cms_outbox_events_store_idx" ON "payload"."cms_outbox_events" USING btree ("store_id");
  CREATE INDEX "cms_outbox_events_type_idx" ON "payload"."cms_outbox_events" USING btree ("type");
  CREATE INDEX "cms_outbox_events_status_idx" ON "payload"."cms_outbox_events" USING btree ("status");
  CREATE UNIQUE INDEX "cms_outbox_events_dedupe_key_idx" ON "payload"."cms_outbox_events" USING btree ("dedupe_key");
  CREATE INDEX "cms_outbox_events_next_attempt_at_idx" ON "payload"."cms_outbox_events" USING btree ("next_attempt_at");
  CREATE INDEX "cms_outbox_events_updated_at_idx" ON "payload"."cms_outbox_events" USING btree ("updated_at");
  CREATE INDEX "cms_outbox_events_created_at_idx" ON "payload"."cms_outbox_events" USING btree ("created_at");
  CREATE INDEX "cms_payment_transactions_store_idx" ON "payload"."cms_payment_transactions" USING btree ("store_id");
  CREATE INDEX "cms_payment_transactions_order_idx" ON "payload"."cms_payment_transactions" USING btree ("order_id");
  CREATE INDEX "cms_payment_transactions_status_idx" ON "payload"."cms_payment_transactions" USING btree ("status");
  CREATE INDEX "cms_payment_transactions_provider_ref_idx" ON "payload"."cms_payment_transactions" USING btree ("provider_ref");
  CREATE INDEX "cms_payment_transactions_payment_intent_idx" ON "payload"."cms_payment_transactions" USING btree ("payment_intent");
  CREATE UNIQUE INDEX "cms_payment_transactions_idempotency_key_idx" ON "payload"."cms_payment_transactions" USING btree ("idempotency_key");
  CREATE INDEX "cms_payment_transactions_expires_at_idx" ON "payload"."cms_payment_transactions" USING btree ("expires_at");
  CREATE INDEX "cms_payment_transactions_updated_at_idx" ON "payload"."cms_payment_transactions" USING btree ("updated_at");
  CREATE INDEX "cms_payment_transactions_created_at_idx" ON "payload"."cms_payment_transactions" USING btree ("created_at");
  CREATE UNIQUE INDEX "provider_providerRef_idx" ON "payload"."cms_payment_transactions" USING btree ("provider","provider_ref");
  CREATE INDEX "cms_payment_events_store_idx" ON "payload"."cms_payment_events" USING btree ("store_id");
  CREATE INDEX "cms_payment_events_event_id_idx" ON "payload"."cms_payment_events" USING btree ("event_id");
  CREATE INDEX "cms_payment_events_type_idx" ON "payload"."cms_payment_events" USING btree ("type");
  CREATE INDEX "cms_payment_events_status_idx" ON "payload"."cms_payment_events" USING btree ("status");
  CREATE INDEX "cms_payment_events_received_at_idx" ON "payload"."cms_payment_events" USING btree ("received_at");
  CREATE INDEX "cms_payment_events_updated_at_idx" ON "payload"."cms_payment_events" USING btree ("updated_at");
  CREATE INDEX "cms_payment_events_created_at_idx" ON "payload"."cms_payment_events" USING btree ("created_at");
  CREATE UNIQUE INDEX "provider_eventId_idx" ON "payload"."cms_payment_events" USING btree ("provider","event_id");
  ALTER TABLE "payload"."cms_users" ADD CONSTRAINT "cms_users_current_store_id_cms_stores_id_fk" FOREIGN KEY ("current_store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_media" ADD CONSTRAINT "cms_media_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_products" ADD CONSTRAINT "cms_products_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_products_v" ADD CONSTRAINT "_cms_products_v_version_store_id_cms_stores_id_fk" FOREIGN KEY ("version_store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_collections" ADD CONSTRAINT "cms_collections_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_categories" ADD CONSTRAINT "cms_categories_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_brands" ADD CONSTRAINT "cms_brands_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_laptop_models" ADD CONSTRAINT "cms_laptop_models_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_reviews" ADD CONSTRAINT "cms_reviews_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_posts" ADD CONSTRAINT "cms_posts_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_posts_v" ADD CONSTRAINT "_cms_posts_v_version_store_id_cms_stores_id_fk" FOREIGN KEY ("version_store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_orders" ADD CONSTRAINT "cms_orders_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_return_requests" ADD CONSTRAINT "cms_return_requests_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_warranty_claims" ADD CONSTRAINT "cms_warranty_claims_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_pos_sales" ADD CONSTRAINT "cms_pos_sales_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_cash_ups" ADD CONSTRAINT "cms_cash_ups_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_units" ADD CONSTRAINT "cms_units_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_discounts" ADD CONSTRAINT "cms_discounts_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_flash_sales" ADD CONSTRAINT "cms_flash_sales_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_wholesale_inquiries" ADD CONSTRAINT "cms_wholesale_inquiries_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_contact_messages" ADD CONSTRAINT "cms_contact_messages_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_pages" ADD CONSTRAINT "cms_pages_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_cms_pages_v" ADD CONSTRAINT "_cms_pages_v_version_store_id_cms_stores_id_fk" FOREIGN KEY ("version_store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_menus" ADD CONSTRAINT "cms_menus_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_blocked_phones" ADD CONSTRAINT "cms_blocked_phones_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_trade_ins" ADD CONSTRAINT "cms_trade_ins_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_product_questions" ADD CONSTRAINT "cms_product_questions_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_stock_alerts" ADD CONSTRAINT "cms_stock_alerts_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_abandoned_carts" ADD CONSTRAINT "cms_abandoned_carts_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_suppliers" ADD CONSTRAINT "cms_suppliers_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_purchases" ADD CONSTRAINT "cms_purchases_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_stock_counts" ADD CONSTRAINT "cms_stock_counts_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_stock_movements" ADD CONSTRAINT "cms_stock_movements_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_activity_log" ADD CONSTRAINT "cms_activity_log_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_exports" ADD CONSTRAINT "cms_exports_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_imports" ADD CONSTRAINT "cms_imports_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_redirects" ADD CONSTRAINT "cms_redirects_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."payload_folders" ADD CONSTRAINT "payload_folders_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_stores_fk" FOREIGN KEY ("cms_stores_id") REFERENCES "payload"."cms_stores"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_store_memberships_fk" FOREIGN KEY ("cms_store_memberships_id") REFERENCES "payload"."cms_store_memberships"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_subscription_plans_fk" FOREIGN KEY ("cms_subscription_plans_id") REFERENCES "payload"."cms_subscription_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_store_subscriptions_fk" FOREIGN KEY ("cms_store_subscriptions_id") REFERENCES "payload"."cms_store_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_store_invoices_fk" FOREIGN KEY ("cms_store_invoices_id") REFERENCES "payload"."cms_store_invoices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_store_theme_settings_fk" FOREIGN KEY ("cms_ss_theme_settings_id") REFERENCES "payload"."cms_ss_theme_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_store_announcement_bar_fk" FOREIGN KEY ("cms_ss_announcement_bar_id") REFERENCES "payload"."cms_ss_announcement_bar"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_store_header_fk" FOREIGN KEY ("cms_ss_header_id") REFERENCES "payload"."cms_ss_header"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_store_footer_fk" FOREIGN KEY ("cms_ss_footer_id") REFERENCES "payload"."cms_ss_footer"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_store_whatsapp_button_fk" FOREIGN KEY ("cms_ss_whatsapp_button_id") REFERENCES "payload"."cms_ss_whatsapp_button"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_store_shipping_fk" FOREIGN KEY ("cms_ss_shipping_id") REFERENCES "payload"."cms_ss_shipping"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_store_payments_fk" FOREIGN KEY ("cms_ss_payments_id") REFERENCES "payload"."cms_ss_payments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_store_notifications_fk" FOREIGN KEY ("cms_ss_notifications_id") REFERENCES "payload"."cms_ss_notifications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_store_store_info_fk" FOREIGN KEY ("cms_ss_store_info_id") REFERENCES "payload"."cms_ss_store_info"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_store_seo_settings_fk" FOREIGN KEY ("cms_ss_seo_settings_id") REFERENCES "payload"."cms_ss_seo_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_store_page_texts_fk" FOREIGN KEY ("cms_ss_page_texts_id") REFERENCES "payload"."cms_ss_page_texts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_store_testimonials_fk" FOREIGN KEY ("cms_ss_testimonials_id") REFERENCES "payload"."cms_ss_testimonials"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_store_faqs_fk" FOREIGN KEY ("cms_ss_faqs_id") REFERENCES "payload"."cms_ss_faqs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_store_order_protection_fk" FOREIGN KEY ("cms_ss_order_protection_id") REFERENCES "payload"."cms_ss_order_protection"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_store_returns_policy_fk" FOREIGN KEY ("cms_ss_returns_policy_id") REFERENCES "payload"."cms_ss_returns_policy"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_store_cookie_notice_fk" FOREIGN KEY ("cms_ss_cookie_notice_id") REFERENCES "payload"."cms_ss_cookie_notice"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_store_sales_channels_fk" FOREIGN KEY ("cms_ss_sales_channels_id") REFERENCES "payload"."cms_ss_sales_channels"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_store_conversion_fk" FOREIGN KEY ("cms_ss_conversion_id") REFERENCES "payload"."cms_ss_conversion"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_outbox_events_fk" FOREIGN KEY ("cms_outbox_events_id") REFERENCES "payload"."cms_outbox_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payment_transactions_fk" FOREIGN KEY ("cms_payment_transactions_id") REFERENCES "payload"."cms_payment_transactions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payment_events_fk" FOREIGN KEY ("cms_payment_events_id") REFERENCES "payload"."cms_payment_events"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "cms_users_current_store_idx" ON "payload"."cms_users" USING btree ("current_store_id");
  CREATE INDEX "cms_media_store_idx" ON "payload"."cms_media" USING btree ("store_id");
  CREATE INDEX "cms_products_store_idx" ON "payload"."cms_products" USING btree ("store_id");
  CREATE UNIQUE INDEX "store_slug_idx" ON "payload"."cms_products" USING btree ("store_id","slug");
  CREATE UNIQUE INDEX "store_sku_idx" ON "payload"."cms_products" USING btree ("store_id","sku");
  CREATE INDEX "_cms_products_v_version_version_store_idx" ON "payload"."_cms_products_v" USING btree ("version_store_id");
  CREATE INDEX "version_store_version_slug_idx" ON "payload"."_cms_products_v" USING btree ("version_store_id","version_slug");
  CREATE INDEX "version_store_version_sku_idx" ON "payload"."_cms_products_v" USING btree ("version_store_id","version_sku");
  CREATE INDEX "cms_collections_store_idx" ON "payload"."cms_collections" USING btree ("store_id");
  CREATE UNIQUE INDEX "store_slug_1_idx" ON "payload"."cms_collections" USING btree ("store_id","slug");
  CREATE INDEX "cms_categories_store_idx" ON "payload"."cms_categories" USING btree ("store_id");
  CREATE UNIQUE INDEX "store_slug_2_idx" ON "payload"."cms_categories" USING btree ("store_id","slug");
  CREATE INDEX "cms_brands_store_idx" ON "payload"."cms_brands" USING btree ("store_id");
  CREATE UNIQUE INDEX "store_slug_3_idx" ON "payload"."cms_brands" USING btree ("store_id","slug");
  CREATE INDEX "cms_laptop_models_store_idx" ON "payload"."cms_laptop_models" USING btree ("store_id");
  CREATE UNIQUE INDEX "store_slug_4_idx" ON "payload"."cms_laptop_models" USING btree ("store_id","slug");
  CREATE INDEX "cms_reviews_store_idx" ON "payload"."cms_reviews" USING btree ("store_id");
  CREATE INDEX "cms_posts_store_idx" ON "payload"."cms_posts" USING btree ("store_id");
  CREATE UNIQUE INDEX "store_slug_5_idx" ON "payload"."cms_posts" USING btree ("store_id","slug");
  CREATE INDEX "_cms_posts_v_version_version_store_idx" ON "payload"."_cms_posts_v" USING btree ("version_store_id");
  CREATE INDEX "version_store_version_slug_1_idx" ON "payload"."_cms_posts_v" USING btree ("version_store_id","version_slug");
  CREATE INDEX "cms_orders_store_idx" ON "payload"."cms_orders" USING btree ("store_id");
  CREATE INDEX "cms_orders_payment_reference_idx" ON "payload"."cms_orders" USING btree ("payment_reference");
  CREATE INDEX "cms_orders_fulfillment_status_idx" ON "payload"."cms_orders" USING btree ("fulfillment_status");
  CREATE UNIQUE INDEX "store_paymentReference_idx" ON "payload"."cms_orders" USING btree ("store_id","payment_reference");
  CREATE INDEX "cms_return_requests_store_idx" ON "payload"."cms_return_requests" USING btree ("store_id");
  CREATE INDEX "cms_warranty_claims_store_idx" ON "payload"."cms_warranty_claims" USING btree ("store_id");
  CREATE INDEX "cms_pos_sales_store_idx" ON "payload"."cms_pos_sales" USING btree ("store_id");
  CREATE UNIQUE INDEX "cms_pos_sales_client_sale_id_idx" ON "payload"."cms_pos_sales" USING btree ("client_sale_id");
  CREATE INDEX "cms_cash_ups_store_idx" ON "payload"."cms_cash_ups" USING btree ("store_id");
  CREATE INDEX "cms_units_store_idx" ON "payload"."cms_units" USING btree ("store_id");
  CREATE UNIQUE INDEX "store_serial_idx" ON "payload"."cms_units" USING btree ("store_id","serial");
  CREATE INDEX "cms_discounts_store_idx" ON "payload"."cms_discounts" USING btree ("store_id");
  CREATE UNIQUE INDEX "store_code_idx" ON "payload"."cms_discounts" USING btree ("store_id","code");
  CREATE INDEX "cms_flash_sales_store_idx" ON "payload"."cms_flash_sales" USING btree ("store_id");
  CREATE INDEX "cms_wholesale_inquiries_store_idx" ON "payload"."cms_wholesale_inquiries" USING btree ("store_id");
  CREATE INDEX "cms_contact_messages_store_idx" ON "payload"."cms_contact_messages" USING btree ("store_id");
  CREATE INDEX "cms_pages_store_idx" ON "payload"."cms_pages" USING btree ("store_id");
  CREATE UNIQUE INDEX "store_slug_6_idx" ON "payload"."cms_pages" USING btree ("store_id","slug");
  CREATE INDEX "_cms_pages_v_version_version_store_idx" ON "payload"."_cms_pages_v" USING btree ("version_store_id");
  CREATE INDEX "version_store_version_slug_2_idx" ON "payload"."_cms_pages_v" USING btree ("version_store_id","version_slug");
  CREATE INDEX "cms_menus_store_idx" ON "payload"."cms_menus" USING btree ("store_id");
  CREATE UNIQUE INDEX "store_handle_idx" ON "payload"."cms_menus" USING btree ("store_id","handle");
  CREATE INDEX "cms_blocked_phones_store_idx" ON "payload"."cms_blocked_phones" USING btree ("store_id");
  CREATE UNIQUE INDEX "store_phone_idx" ON "payload"."cms_blocked_phones" USING btree ("store_id","phone");
  CREATE INDEX "cms_trade_ins_store_idx" ON "payload"."cms_trade_ins" USING btree ("store_id");
  CREATE INDEX "cms_product_questions_store_idx" ON "payload"."cms_product_questions" USING btree ("store_id");
  CREATE INDEX "cms_stock_alerts_store_idx" ON "payload"."cms_stock_alerts" USING btree ("store_id");
  CREATE INDEX "cms_abandoned_carts_store_idx" ON "payload"."cms_abandoned_carts" USING btree ("store_id");
  CREATE INDEX "cms_suppliers_store_idx" ON "payload"."cms_suppliers" USING btree ("store_id");
  CREATE INDEX "cms_purchases_store_idx" ON "payload"."cms_purchases" USING btree ("store_id");
  CREATE INDEX "cms_stock_counts_store_idx" ON "payload"."cms_stock_counts" USING btree ("store_id");
  CREATE INDEX "cms_stock_movements_store_idx" ON "payload"."cms_stock_movements" USING btree ("store_id");
  CREATE INDEX "cms_activity_log_store_idx" ON "payload"."cms_activity_log" USING btree ("store_id");
  CREATE INDEX "cms_exports_store_idx" ON "payload"."cms_exports" USING btree ("store_id");
  CREATE INDEX "cms_imports_store_idx" ON "payload"."cms_imports" USING btree ("store_id");
  CREATE INDEX "cms_redirects_store_idx" ON "payload"."cms_redirects" USING btree ("store_id");
  CREATE UNIQUE INDEX "store_from_idx" ON "payload"."cms_redirects" USING btree ("store_id","from");
  CREATE INDEX "payload_folders_store_idx" ON "payload"."payload_folders" USING btree ("store_id");
  CREATE INDEX "payload_locked_documents_rels_cms_stores_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_stores_id");
  CREATE INDEX "payload_locked_documents_rels_cms_store_memberships_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_store_memberships_id");
  CREATE INDEX "payload_locked_documents_rels_cms_subscription_plans_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_subscription_plans_id");
  CREATE INDEX "payload_locked_documents_rels_cms_store_subscriptions_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_store_subscriptions_id");
  CREATE INDEX "payload_locked_documents_rels_cms_store_invoices_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_store_invoices_id");
  CREATE INDEX "payload_locked_documents_rels_cms_ss_theme_settings_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_ss_theme_settings_id");
  CREATE INDEX "payload_locked_documents_rels_cms_ss_announcement_bar_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_ss_announcement_bar_id");
  CREATE INDEX "payload_locked_documents_rels_cms_ss_header_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_ss_header_id");
  CREATE INDEX "payload_locked_documents_rels_cms_ss_footer_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_ss_footer_id");
  CREATE INDEX "payload_locked_documents_rels_cms_ss_whatsapp_button_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_ss_whatsapp_button_id");
  CREATE INDEX "payload_locked_documents_rels_cms_ss_shipping_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_ss_shipping_id");
  CREATE INDEX "payload_locked_documents_rels_cms_ss_payments_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_ss_payments_id");
  CREATE INDEX "payload_locked_documents_rels_cms_ss_notifications_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_ss_notifications_id");
  CREATE INDEX "payload_locked_documents_rels_cms_ss_store_info_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_ss_store_info_id");
  CREATE INDEX "payload_locked_documents_rels_cms_ss_seo_settings_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_ss_seo_settings_id");
  CREATE INDEX "payload_locked_documents_rels_cms_ss_page_texts_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_ss_page_texts_id");
  CREATE INDEX "payload_locked_documents_rels_cms_ss_testimonials_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_ss_testimonials_id");
  CREATE INDEX "payload_locked_documents_rels_cms_ss_faqs_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_ss_faqs_id");
  CREATE INDEX "payload_locked_documents_rels_cms_ss_order_protection_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_ss_order_protection_id");
  CREATE INDEX "payload_locked_documents_rels_cms_ss_returns_policy_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_ss_returns_policy_id");
  CREATE INDEX "payload_locked_documents_rels_cms_ss_cookie_notice_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_ss_cookie_notice_id");
  CREATE INDEX "payload_locked_documents_rels_cms_ss_sales_channels_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_ss_sales_channels_id");
  CREATE INDEX "payload_locked_documents_rels_cms_ss_conversion_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_ss_conversion_id");
  CREATE INDEX "payload_locked_documents_rels_cms_outbox_events_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_outbox_events_id");
  CREATE INDEX "payload_locked_documents_rels_cms_payment_transactions_i_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_payment_transactions_id");
  CREATE INDEX "payload_locked_documents_rels_cms_payment_events_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_payment_events_id");
  CREATE INDEX "cms_products_sku_idx" ON "payload"."cms_products" USING btree ("sku");
  CREATE INDEX "cms_products_slug_idx" ON "payload"."cms_products" USING btree ("slug");
  CREATE INDEX "cms_collections_slug_idx" ON "payload"."cms_collections" USING btree ("slug");
  CREATE INDEX "cms_categories_slug_idx" ON "payload"."cms_categories" USING btree ("slug");
  CREATE INDEX "cms_brands_slug_idx" ON "payload"."cms_brands" USING btree ("slug");
  CREATE INDEX "cms_laptop_models_slug_idx" ON "payload"."cms_laptop_models" USING btree ("slug");
  CREATE INDEX "cms_posts_slug_idx" ON "payload"."cms_posts" USING btree ("slug");
  CREATE INDEX "cms_units_serial_idx" ON "payload"."cms_units" USING btree ("serial");
  CREATE INDEX "cms_discounts_code_idx" ON "payload"."cms_discounts" USING btree ("code");
  CREATE INDEX "cms_pages_slug_idx" ON "payload"."cms_pages" USING btree ("slug");
  CREATE INDEX "cms_menus_handle_idx" ON "payload"."cms_menus" USING btree ("handle");
  CREATE INDEX "cms_blocked_phones_phone_idx" ON "payload"."cms_blocked_phones" USING btree ("phone");
  CREATE INDEX "cms_redirects_from_idx" ON "payload"."cms_redirects" USING btree ("from");
  -- login_attempts / lock_until are no longer used (no account lock-out) but are KEPT: the previous version still reads
  -- them while this one deploys (migrations only add – see scripts/ci/check-migrations.mjs)
  SELECT 1;`)

  await backfill(db)
}

type Exec = { execute: (q: unknown) => Promise<{ rows: Record<string, unknown>[] }> }

/**
 * Existing data becomes the DEFAULT store (the original shop keeps working exactly as before):
 *  1. the default store (name from DEFAULT_STORE_NAME, else the shop's Store details, else "Main store";
 *     slug DEFAULT_STORE_SLUG or "main"; order numbers keep their prefix – DEFAULT_STORE_ORDER_PREFIX or "UTS");
 *  2. every record with a store column gets that store (records, their versions, logs);
 *  3. the shop's team works in it, its customer accounts become its customers;
 *  4. orders: coupon bookkeeping (consumed / already given back) and fulfilment status;
 *  5. starter plans for new merchants when there are none (prices to be reviewed by the platform admin).
 * Safe to re-run: nothing that is already set is changed.
 */
async function backfill(db: unknown) {
  const x = db as Exec
  const name = process.env.DEFAULT_STORE_NAME?.trim() || null
  const slug = (process.env.DEFAULT_STORE_SLUG?.trim() || 'main').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'main'
  const prefix = (process.env.DEFAULT_STORE_ORDER_PREFIX?.trim() || 'UTS').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'UTS'

  let storeId = Number((await x.execute(sql`SELECT "id" FROM "payload"."cms_stores" WHERE "is_default" = true ORDER BY "id" LIMIT 1`)).rows[0]?.id) || 0
  if (!storeId) {
    const created = await x.execute(sql`
      INSERT INTO "payload"."cms_stores" ("name", "slug", "business_name", "status", "is_default", "subscription_status", "order_prefix", "owner_id", "trial_used")
      VALUES (
        COALESCE(${name}, (SELECT NULLIF("name", '') FROM "payload"."cms_store_info" LIMIT 1), 'Main store'),
        ${slug},
        COALESCE(${name}, (SELECT NULLIF("name", '') FROM "payload"."cms_store_info" LIMIT 1), 'Main store'),
        'active', true, 'active', ${prefix},
        (SELECT "id" FROM "payload"."cms_users" WHERE "role" = 'owner' ORDER BY "id" LIMIT 1),
        true
      )
      RETURNING "id"`)
    storeId = Number(created.rows[0]?.id)
  }
  if (!storeId) throw new Error('backfill: the default store could not be created')

  // 2. every store column (records and their saved versions) – new platform tables start empty and are skipped
  const columns = await x.execute(sql`
    SELECT "table_name", "column_name" FROM information_schema.columns
    WHERE "table_schema" = 'payload' AND "column_name" IN ('store_id', 'version_store_id')
      AND "table_name" NOT IN ('cms_store_memberships', 'cms_store_subscriptions', 'cms_store_invoices', 'cms_payment_events', 'cms_outbox_events', 'cms_payment_transactions')
      AND "table_name" NOT LIKE 'cms\_ss\_%' AND "table_name" NOT LIKE '\_cms\_ss\_%'`)
  for (const c of columns.rows) {
    const table = String(c.table_name).replace(/"/g, '')
    const column = String(c.column_name).replace(/"/g, '')
    await x.execute(sql.raw(`UPDATE "payload"."${table}" SET "${column}" = ${storeId} WHERE "${column}" IS NULL`))
  }

  // 3. the original team works in the default store; its shoppers are its customers
  await x.execute(sql`UPDATE "payload"."cms_users" SET "current_store_id" = ${storeId} WHERE "role" IN ('owner', 'manager', 'staff') AND "current_store_id" IS NULL`)
  await x.execute(sql`
    INSERT INTO "payload"."cms_users_rels" ("order", "parent_id", "path", "cms_stores_id")
    SELECT 1, u."id", 'customerOf', ${storeId} FROM "payload"."cms_users" u
    WHERE u."role" = 'customer'
      AND NOT EXISTS (SELECT 1 FROM "payload"."cms_users_rels" r WHERE r."parent_id" = u."id" AND r."path" = 'customerOf' AND r."cms_stores_id" = ${storeId})`)

  // 4. orders placed before: a coupon on the order was counted when it was placed, and given back if it was cancelled
  await x.execute(sql`
    UPDATE "payload"."cms_orders" SET "coupon_consumed" = true, "coupon_returned" = ("status"::text IN ('cancelled', 'refused', 'returned'))
    WHERE COALESCE("coupon_code", '') <> '' AND "coupon_consumed" IS NOT TRUE`)
  await x.execute(sql`
    UPDATE "payload"."cms_orders" SET "fulfillment_status" = (CASE "status"::text
      WHEN 'dispatched' THEN 'in_transit' WHEN 'out-for-delivery' THEN 'in_transit' WHEN 'delivered' THEN 'delivered'
      WHEN 'cancelled' THEN 'cancelled' WHEN 'refused' THEN 'returned' WHEN 'returned' THEN 'returned' ELSE 'unfulfilled' END)::"payload"."enum_cms_orders_fulfillment_status"`)

  // 5. starter plans (only on a platform without any)
  const plans = Number((await x.execute(sql`SELECT count(*)::int AS n FROM "payload"."cms_subscription_plans"`)).rows[0]?.n) || 0
  if (!plans) {
    const seed: [string, string, string, number, number, number, number, number, string[]][] = [
      ['Starter', 'starter', 'Launch a single storefront with core commerce essentials.', 0, 0, 200, 3, 5, ['discounts']],
      ['Growth', 'growth', 'Scale your storefront with more products, staff, and automation.', 9999, 99990, 2000, 10, 25, ['discounts', 'pos', 'reports', 'abandoned_carts', 'online_payments', 'custom_domain']],
      ['Scale', 'scale', 'Advanced operations for larger merchants and high-volume teams.', 29999, 299990, 10000, 50, 100, ['discounts', 'pos', 'reports', 'abandoned_carts', 'online_payments', 'custom_domain']],
    ]
    let sort = 0
    for (const [planName, planSlug, description, monthly, annual, products, staff, storage, features] of seed) {
      const row = await x.execute(sql`
        INSERT INTO "payload"."cms_subscription_plans" ("name", "slug", "description", "status", "price_monthly", "price_annual", "currency", "trial_days", "max_products", "max_staff_members", "max_storage_gb", "sort_order")
        VALUES (${planName}, ${planSlug}, ${description}, 'active', ${monthly}, ${annual}, 'PKR', 14, ${products}, ${staff}, ${storage}, ${sort++})
        RETURNING "id"`)
      const planId = Number(row.rows[0]?.id)
      let order = 1
      for (const f of features)
        await x.execute(sql`INSERT INTO "payload"."cms_subscription_plans_features" ("order", "parent_id", "value") VALUES (${order++}, ${planId}, ${f}::"payload"."enum_cms_subscription_plans_features")`)
    }
  }
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_stores" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_store_memberships" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_subscription_plans_features" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_subscription_plans" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_store_subscriptions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_store_invoices" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_users_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_discounts_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_theme_settings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_cms_ss_theme_settings_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_announcement_bar" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_cms_ss_announcement_bar_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_header" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_cms_ss_header_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_footer_columns" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_footer" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_footer_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_cms_ss_footer_v_version_columns" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_cms_ss_footer_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_cms_ss_footer_v_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_whatsapp_button_contacts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_whatsapp_button" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_cms_ss_whatsapp_button_v_version_contacts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_cms_ss_whatsapp_button_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_shipping_zones_cities" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_shipping_zones" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_shipping" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_payments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_notifications_status_updates" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_notifications" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_notifications_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_store_info_phones" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_store_info_hours_days" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_store_info_hours" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_store_info" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_store_info_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_seo_settings_pages" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_seo_settings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_seo_settings_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_page_texts_pages" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_page_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_testimonials_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_testimonials" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_faqs_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_faqs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_order_protection" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_order_protection_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_returns_policy_reasons" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_returns_policy_warranty_by_condition" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_returns_policy" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_cookie_notice" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_sales_channels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_sales_channels_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_conversion_emi_plans" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_ss_conversion" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_outbox_events" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_payment_transactions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_payment_events" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."cms_stores" CASCADE;
  DROP TABLE "payload"."cms_store_memberships" CASCADE;
  DROP TABLE "payload"."cms_subscription_plans_features" CASCADE;
  DROP TABLE "payload"."cms_subscription_plans" CASCADE;
  DROP TABLE "payload"."cms_store_subscriptions" CASCADE;
  DROP TABLE "payload"."cms_store_invoices" CASCADE;
  DROP TABLE "payload"."cms_users_rels" CASCADE;
  DROP TABLE "payload"."cms_discounts_rels" CASCADE;
  DROP TABLE "payload"."cms_ss_theme_settings" CASCADE;
  DROP TABLE "payload"."_cms_ss_theme_settings_v" CASCADE;
  DROP TABLE "payload"."cms_ss_announcement_bar" CASCADE;
  DROP TABLE "payload"."_cms_ss_announcement_bar_v" CASCADE;
  DROP TABLE "payload"."cms_ss_header" CASCADE;
  DROP TABLE "payload"."_cms_ss_header_v" CASCADE;
  DROP TABLE "payload"."cms_ss_footer_columns" CASCADE;
  DROP TABLE "payload"."cms_ss_footer" CASCADE;
  DROP TABLE "payload"."cms_ss_footer_texts" CASCADE;
  DROP TABLE "payload"."_cms_ss_footer_v_version_columns" CASCADE;
  DROP TABLE "payload"."_cms_ss_footer_v" CASCADE;
  DROP TABLE "payload"."_cms_ss_footer_v_texts" CASCADE;
  DROP TABLE "payload"."cms_ss_whatsapp_button_contacts" CASCADE;
  DROP TABLE "payload"."cms_ss_whatsapp_button" CASCADE;
  DROP TABLE "payload"."_cms_ss_whatsapp_button_v_version_contacts" CASCADE;
  DROP TABLE "payload"."_cms_ss_whatsapp_button_v" CASCADE;
  DROP TABLE "payload"."cms_ss_shipping_zones_cities" CASCADE;
  DROP TABLE "payload"."cms_ss_shipping_zones" CASCADE;
  DROP TABLE "payload"."cms_ss_shipping" CASCADE;
  DROP TABLE "payload"."cms_ss_payments" CASCADE;
  DROP TABLE "payload"."cms_ss_notifications_status_updates" CASCADE;
  DROP TABLE "payload"."cms_ss_notifications" CASCADE;
  DROP TABLE "payload"."cms_ss_notifications_texts" CASCADE;
  DROP TABLE "payload"."cms_ss_store_info_phones" CASCADE;
  DROP TABLE "payload"."cms_ss_store_info_hours_days" CASCADE;
  DROP TABLE "payload"."cms_ss_store_info_hours" CASCADE;
  DROP TABLE "payload"."cms_ss_store_info" CASCADE;
  DROP TABLE "payload"."cms_ss_store_info_texts" CASCADE;
  DROP TABLE "payload"."cms_ss_seo_settings_pages" CASCADE;
  DROP TABLE "payload"."cms_ss_seo_settings" CASCADE;
  DROP TABLE "payload"."cms_ss_seo_settings_texts" CASCADE;
  DROP TABLE "payload"."cms_ss_page_texts_pages" CASCADE;
  DROP TABLE "payload"."cms_ss_page_texts" CASCADE;
  DROP TABLE "payload"."cms_ss_testimonials_items" CASCADE;
  DROP TABLE "payload"."cms_ss_testimonials" CASCADE;
  DROP TABLE "payload"."cms_ss_faqs_items" CASCADE;
  DROP TABLE "payload"."cms_ss_faqs" CASCADE;
  DROP TABLE "payload"."cms_ss_order_protection" CASCADE;
  DROP TABLE "payload"."cms_ss_order_protection_texts" CASCADE;
  DROP TABLE "payload"."cms_ss_returns_policy_reasons" CASCADE;
  DROP TABLE "payload"."cms_ss_returns_policy_warranty_by_condition" CASCADE;
  DROP TABLE "payload"."cms_ss_returns_policy" CASCADE;
  DROP TABLE "payload"."cms_ss_cookie_notice" CASCADE;
  DROP TABLE "payload"."cms_ss_sales_channels" CASCADE;
  DROP TABLE "payload"."cms_ss_sales_channels_rels" CASCADE;
  DROP TABLE "payload"."cms_ss_conversion_emi_plans" CASCADE;
  DROP TABLE "payload"."cms_ss_conversion" CASCADE;
  DROP TABLE "payload"."cms_outbox_events" CASCADE;
  DROP TABLE "payload"."cms_payment_transactions" CASCADE;
  DROP TABLE "payload"."cms_payment_events" CASCADE;
  ALTER TABLE "payload"."cms_users" DROP CONSTRAINT IF EXISTS "cms_users_current_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."cms_media" DROP CONSTRAINT IF EXISTS "cms_media_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."cms_products" DROP CONSTRAINT IF EXISTS "cms_products_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."_cms_products_v" DROP CONSTRAINT IF EXISTS "_cms_products_v_version_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."cms_collections" DROP CONSTRAINT IF EXISTS "cms_collections_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."cms_categories" DROP CONSTRAINT IF EXISTS "cms_categories_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."cms_brands" DROP CONSTRAINT IF EXISTS "cms_brands_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."cms_laptop_models" DROP CONSTRAINT IF EXISTS "cms_laptop_models_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."cms_reviews" DROP CONSTRAINT IF EXISTS "cms_reviews_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."cms_posts" DROP CONSTRAINT IF EXISTS "cms_posts_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."_cms_posts_v" DROP CONSTRAINT IF EXISTS "_cms_posts_v_version_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."cms_orders" DROP CONSTRAINT IF EXISTS "cms_orders_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."cms_return_requests" DROP CONSTRAINT IF EXISTS "cms_return_requests_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."cms_warranty_claims" DROP CONSTRAINT IF EXISTS "cms_warranty_claims_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."cms_pos_sales" DROP CONSTRAINT IF EXISTS "cms_pos_sales_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."cms_cash_ups" DROP CONSTRAINT IF EXISTS "cms_cash_ups_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."cms_units" DROP CONSTRAINT IF EXISTS "cms_units_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."cms_discounts" DROP CONSTRAINT IF EXISTS "cms_discounts_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."cms_flash_sales" DROP CONSTRAINT IF EXISTS "cms_flash_sales_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."cms_wholesale_inquiries" DROP CONSTRAINT IF EXISTS "cms_wholesale_inquiries_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."cms_contact_messages" DROP CONSTRAINT IF EXISTS "cms_contact_messages_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."cms_pages" DROP CONSTRAINT IF EXISTS "cms_pages_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."_cms_pages_v" DROP CONSTRAINT IF EXISTS "_cms_pages_v_version_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."cms_menus" DROP CONSTRAINT IF EXISTS "cms_menus_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."cms_blocked_phones" DROP CONSTRAINT IF EXISTS "cms_blocked_phones_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."cms_trade_ins" DROP CONSTRAINT IF EXISTS "cms_trade_ins_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."cms_product_questions" DROP CONSTRAINT IF EXISTS "cms_product_questions_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."cms_stock_alerts" DROP CONSTRAINT IF EXISTS "cms_stock_alerts_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."cms_abandoned_carts" DROP CONSTRAINT IF EXISTS "cms_abandoned_carts_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."cms_suppliers" DROP CONSTRAINT IF EXISTS "cms_suppliers_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."cms_purchases" DROP CONSTRAINT IF EXISTS "cms_purchases_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."cms_stock_counts" DROP CONSTRAINT IF EXISTS "cms_stock_counts_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."cms_stock_movements" DROP CONSTRAINT IF EXISTS "cms_stock_movements_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."cms_activity_log" DROP CONSTRAINT IF EXISTS "cms_activity_log_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."cms_exports" DROP CONSTRAINT IF EXISTS "cms_exports_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."cms_imports" DROP CONSTRAINT IF EXISTS "cms_imports_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."cms_redirects" DROP CONSTRAINT IF EXISTS "cms_redirects_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."payload_folders" DROP CONSTRAINT IF EXISTS "payload_folders_store_id_cms_stores_id_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_stores_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_store_memberships_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_subscription_plans_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_store_subscriptions_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_store_invoices_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_store_theme_settings_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_store_announcement_bar_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_store_header_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_store_footer_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_store_whatsapp_button_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_store_shipping_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_store_payments_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_store_notifications_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_store_store_info_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_store_seo_settings_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_store_page_texts_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_store_testimonials_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_store_faqs_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_store_order_protection_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_store_returns_policy_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_store_cookie_notice_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_store_sales_channels_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_store_conversion_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_outbox_events_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_payment_transactions_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_payment_events_fk";
  
  ALTER TABLE "payload"."cms_orders_history" ALTER COLUMN "status" SET DATA TYPE text;
  DROP TYPE "payload"."enum_cms_orders_history_status";
  CREATE TYPE "payload"."enum_cms_orders_history_status" AS ENUM('awaiting-confirmation', 'pending', 'confirmed', 'dispatched', 'out-for-delivery', 'delivered', 'cancelled', 'refused', 'returned');
  ALTER TABLE "payload"."cms_orders_history" ALTER COLUMN "status" SET DATA TYPE "payload"."enum_cms_orders_history_status" USING "status"::"payload"."enum_cms_orders_history_status";
  ALTER TABLE "payload"."cms_orders" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "payload"."cms_orders" ALTER COLUMN "status" SET DEFAULT 'pending'::text;
  DROP TYPE "payload"."enum_cms_orders_status";
  CREATE TYPE "payload"."enum_cms_orders_status" AS ENUM('awaiting-confirmation', 'pending', 'confirmed', 'dispatched', 'out-for-delivery', 'delivered', 'cancelled', 'refused', 'returned');
  ALTER TABLE "payload"."cms_orders" ALTER COLUMN "status" SET DEFAULT 'pending'::"payload"."enum_cms_orders_status";
  ALTER TABLE "payload"."cms_orders" ALTER COLUMN "status" SET DATA TYPE "payload"."enum_cms_orders_status" USING "status"::"payload"."enum_cms_orders_status";
  ALTER TABLE "payload"."cms_orders" ALTER COLUMN "payment_status" SET DATA TYPE text;
  DROP TYPE "payload"."enum_cms_orders_payment_status";
  CREATE TYPE "payload"."enum_cms_orders_payment_status" AS ENUM('unpaid', 'awaiting-verification', 'paid', 'refunded', 'partial');
  ALTER TABLE "payload"."cms_orders" ALTER COLUMN "payment_status" SET DATA TYPE "payload"."enum_cms_orders_payment_status" USING "payment_status"::"payload"."enum_cms_orders_payment_status";
  ALTER TABLE "payload"."cms_discounts" ALTER COLUMN "kind" SET DATA TYPE text;
  ALTER TABLE "payload"."cms_discounts" ALTER COLUMN "kind" SET DEFAULT 'percent'::text;
  DROP TYPE "payload"."enum_cms_discounts_kind";
  CREATE TYPE "payload"."enum_cms_discounts_kind" AS ENUM('percent', 'fixed');
  ALTER TABLE "payload"."cms_discounts" ALTER COLUMN "kind" SET DEFAULT 'percent'::"payload"."enum_cms_discounts_kind";
  ALTER TABLE "payload"."cms_discounts" ALTER COLUMN "kind" SET DATA TYPE "payload"."enum_cms_discounts_kind" USING "kind"::"payload"."enum_cms_discounts_kind";
  DROP INDEX IF EXISTS "payload"."cms_users_current_store_idx";
  DROP INDEX IF EXISTS "payload"."cms_media_store_idx";
  DROP INDEX IF EXISTS "payload"."cms_products_store_idx";
  DROP INDEX IF EXISTS "payload"."store_slug_idx";
  DROP INDEX IF EXISTS "payload"."store_sku_idx";
  DROP INDEX IF EXISTS "payload"."_cms_products_v_version_version_store_idx";
  DROP INDEX IF EXISTS "payload"."version_store_version_slug_idx";
  DROP INDEX IF EXISTS "payload"."version_store_version_sku_idx";
  DROP INDEX IF EXISTS "payload"."cms_collections_store_idx";
  DROP INDEX IF EXISTS "payload"."store_slug_1_idx";
  DROP INDEX IF EXISTS "payload"."cms_categories_store_idx";
  DROP INDEX IF EXISTS "payload"."store_slug_2_idx";
  DROP INDEX IF EXISTS "payload"."cms_brands_store_idx";
  DROP INDEX IF EXISTS "payload"."store_slug_3_idx";
  DROP INDEX IF EXISTS "payload"."cms_laptop_models_store_idx";
  DROP INDEX IF EXISTS "payload"."store_slug_4_idx";
  DROP INDEX IF EXISTS "payload"."cms_reviews_store_idx";
  DROP INDEX IF EXISTS "payload"."cms_posts_store_idx";
  DROP INDEX IF EXISTS "payload"."store_slug_5_idx";
  DROP INDEX IF EXISTS "payload"."_cms_posts_v_version_version_store_idx";
  DROP INDEX IF EXISTS "payload"."version_store_version_slug_1_idx";
  DROP INDEX IF EXISTS "payload"."cms_orders_store_idx";
  DROP INDEX IF EXISTS "payload"."cms_orders_payment_reference_idx";
  DROP INDEX IF EXISTS "payload"."cms_orders_fulfillment_status_idx";
  DROP INDEX IF EXISTS "payload"."store_paymentReference_idx";
  DROP INDEX IF EXISTS "payload"."cms_return_requests_store_idx";
  DROP INDEX IF EXISTS "payload"."cms_warranty_claims_store_idx";
  DROP INDEX IF EXISTS "payload"."cms_pos_sales_store_idx";
  DROP INDEX IF EXISTS "payload"."cms_pos_sales_client_sale_id_idx";
  DROP INDEX IF EXISTS "payload"."cms_cash_ups_store_idx";
  DROP INDEX IF EXISTS "payload"."cms_units_store_idx";
  DROP INDEX IF EXISTS "payload"."store_serial_idx";
  DROP INDEX IF EXISTS "payload"."cms_discounts_store_idx";
  DROP INDEX IF EXISTS "payload"."store_code_idx";
  DROP INDEX IF EXISTS "payload"."cms_flash_sales_store_idx";
  DROP INDEX IF EXISTS "payload"."cms_wholesale_inquiries_store_idx";
  DROP INDEX IF EXISTS "payload"."cms_contact_messages_store_idx";
  DROP INDEX IF EXISTS "payload"."cms_pages_store_idx";
  DROP INDEX IF EXISTS "payload"."store_slug_6_idx";
  DROP INDEX IF EXISTS "payload"."_cms_pages_v_version_version_store_idx";
  DROP INDEX IF EXISTS "payload"."version_store_version_slug_2_idx";
  DROP INDEX IF EXISTS "payload"."cms_menus_store_idx";
  DROP INDEX IF EXISTS "payload"."store_handle_idx";
  DROP INDEX IF EXISTS "payload"."cms_blocked_phones_store_idx";
  DROP INDEX IF EXISTS "payload"."store_phone_idx";
  DROP INDEX IF EXISTS "payload"."cms_trade_ins_store_idx";
  DROP INDEX IF EXISTS "payload"."cms_product_questions_store_idx";
  DROP INDEX IF EXISTS "payload"."cms_stock_alerts_store_idx";
  DROP INDEX IF EXISTS "payload"."cms_abandoned_carts_store_idx";
  DROP INDEX IF EXISTS "payload"."cms_suppliers_store_idx";
  DROP INDEX IF EXISTS "payload"."cms_purchases_store_idx";
  DROP INDEX IF EXISTS "payload"."cms_stock_counts_store_idx";
  DROP INDEX IF EXISTS "payload"."cms_stock_movements_store_idx";
  DROP INDEX IF EXISTS "payload"."cms_activity_log_store_idx";
  DROP INDEX IF EXISTS "payload"."cms_exports_store_idx";
  DROP INDEX IF EXISTS "payload"."cms_imports_store_idx";
  DROP INDEX IF EXISTS "payload"."cms_redirects_store_idx";
  DROP INDEX IF EXISTS "payload"."store_from_idx";
  DROP INDEX IF EXISTS "payload"."payload_folders_store_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_stores_id_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_store_memberships_id_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_subscription_plans_id_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_store_subscriptions_id_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_store_invoices_id_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_ss_theme_settings_id_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_ss_announcement_bar_id_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_ss_header_id_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_ss_footer_id_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_ss_whatsapp_button_id_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_ss_shipping_id_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_ss_payments_id_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_ss_notifications_id_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_ss_store_info_id_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_ss_seo_settings_id_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_ss_page_texts_id_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_ss_testimonials_id_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_ss_faqs_id_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_ss_order_protection_id_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_ss_returns_policy_id_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_ss_cookie_notice_id_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_ss_sales_channels_id_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_ss_conversion_id_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_outbox_events_id_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_payment_transactions_i_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_payment_events_id_idx";
  DROP INDEX IF EXISTS "payload"."cms_products_sku_idx";
  DROP INDEX IF EXISTS "payload"."cms_products_slug_idx";
  DROP INDEX IF EXISTS "payload"."cms_collections_slug_idx";
  DROP INDEX IF EXISTS "payload"."cms_categories_slug_idx";
  DROP INDEX IF EXISTS "payload"."cms_brands_slug_idx";
  DROP INDEX IF EXISTS "payload"."cms_laptop_models_slug_idx";
  DROP INDEX IF EXISTS "payload"."cms_posts_slug_idx";
  DROP INDEX IF EXISTS "payload"."cms_units_serial_idx";
  DROP INDEX IF EXISTS "payload"."cms_discounts_code_idx";
  DROP INDEX IF EXISTS "payload"."cms_pages_slug_idx";
  DROP INDEX IF EXISTS "payload"."cms_menus_handle_idx";
  DROP INDEX IF EXISTS "payload"."cms_blocked_phones_phone_idx";
  DROP INDEX IF EXISTS "payload"."cms_redirects_from_idx";
  ALTER TABLE "payload"."cms_posts" ALTER COLUMN "author" SET DEFAULT 'Urko Tech Team';
  ALTER TABLE "payload"."_cms_posts_v" ALTER COLUMN "version_author" SET DEFAULT 'Urko Tech Team';
  ALTER TABLE "payload"."cms_discounts" ALTER COLUMN "value" DROP DEFAULT;
  ALTER TABLE "payload"."cms_payments" ALTER COLUMN "jazzcash_title" SET DEFAULT 'Urko Tech Store';
  ALTER TABLE "payload"."cms_payments" ALTER COLUMN "jazzcash_number" SET DEFAULT '0342-6693115';
  ALTER TABLE "payload"."cms_payments" ALTER COLUMN "easypaisa_title" SET DEFAULT 'Urko Tech Store';
  ALTER TABLE "payload"."cms_payments" ALTER COLUMN "easypaisa_number" SET DEFAULT '0343-5867409';
  ALTER TABLE "payload"."cms_payments" ALTER COLUMN "bank_bank_name" SET DEFAULT 'Meezan Bank';
  ALTER TABLE "payload"."cms_payments" ALTER COLUMN "bank_account_title" SET DEFAULT 'Urko Tech Store';
  ALTER TABLE "payload"."cms_users" ADD COLUMN IF NOT EXISTS "login_attempts" numeric DEFAULT 0;
  ALTER TABLE "payload"."cms_users" ADD COLUMN IF NOT EXISTS "lock_until" timestamp(3) with time zone;
  CREATE UNIQUE INDEX "cms_products_sku_idx" ON "payload"."cms_products" USING btree ("sku");
  CREATE UNIQUE INDEX "cms_products_slug_idx" ON "payload"."cms_products" USING btree ("slug");
  CREATE UNIQUE INDEX "cms_collections_slug_idx" ON "payload"."cms_collections" USING btree ("slug");
  CREATE UNIQUE INDEX "cms_categories_slug_idx" ON "payload"."cms_categories" USING btree ("slug");
  CREATE UNIQUE INDEX "cms_brands_slug_idx" ON "payload"."cms_brands" USING btree ("slug");
  CREATE UNIQUE INDEX "cms_laptop_models_slug_idx" ON "payload"."cms_laptop_models" USING btree ("slug");
  CREATE UNIQUE INDEX "cms_posts_slug_idx" ON "payload"."cms_posts" USING btree ("slug");
  CREATE UNIQUE INDEX "cms_units_serial_idx" ON "payload"."cms_units" USING btree ("serial");
  CREATE UNIQUE INDEX "cms_discounts_code_idx" ON "payload"."cms_discounts" USING btree ("code");
  CREATE UNIQUE INDEX "cms_pages_slug_idx" ON "payload"."cms_pages" USING btree ("slug");
  CREATE UNIQUE INDEX "cms_menus_handle_idx" ON "payload"."cms_menus" USING btree ("handle");
  CREATE UNIQUE INDEX "cms_blocked_phones_phone_idx" ON "payload"."cms_blocked_phones" USING btree ("phone");
  CREATE UNIQUE INDEX "cms_redirects_from_idx" ON "payload"."cms_redirects" USING btree ("from");
  ALTER TABLE "payload"."cms_users" DROP COLUMN IF EXISTS "platform_role";
  ALTER TABLE "payload"."cms_users" DROP COLUMN IF EXISTS "current_store_id";
  ALTER TABLE "payload"."cms_media" DROP COLUMN IF EXISTS "store_id";
  ALTER TABLE "payload"."cms_products" DROP COLUMN IF EXISTS "store_id";
  ALTER TABLE "payload"."_cms_products_v" DROP COLUMN IF EXISTS "version_store_id";
  ALTER TABLE "payload"."cms_collections" DROP COLUMN IF EXISTS "store_id";
  ALTER TABLE "payload"."cms_categories" DROP COLUMN IF EXISTS "store_id";
  ALTER TABLE "payload"."cms_brands" DROP COLUMN IF EXISTS "store_id";
  ALTER TABLE "payload"."cms_laptop_models" DROP COLUMN IF EXISTS "store_id";
  ALTER TABLE "payload"."cms_reviews" DROP COLUMN IF EXISTS "store_id";
  ALTER TABLE "payload"."cms_posts" DROP COLUMN IF EXISTS "store_id";
  ALTER TABLE "payload"."_cms_posts_v" DROP COLUMN IF EXISTS "version_store_id";
  ALTER TABLE "payload"."cms_orders_items" DROP COLUMN IF EXISTS "sku";
  ALTER TABLE "payload"."cms_orders_items" DROP COLUMN IF EXISTS "options";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN IF EXISTS "store_id";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN IF EXISTS "tax_total";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN IF EXISTS "coupon_consumed";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN IF EXISTS "coupon_returned";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN IF EXISTS "payment_reference";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN IF EXISTS "fulfillment_status";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN IF EXISTS "customer_note";
  ALTER TABLE "payload"."cms_return_requests" DROP COLUMN IF EXISTS "store_id";
  ALTER TABLE "payload"."cms_warranty_claims" DROP COLUMN IF EXISTS "store_id";
  ALTER TABLE "payload"."cms_pos_sales" DROP COLUMN IF EXISTS "store_id";
  ALTER TABLE "payload"."cms_pos_sales" DROP COLUMN IF EXISTS "client_sale_id";
  ALTER TABLE "payload"."cms_cash_ups" DROP COLUMN IF EXISTS "store_id";
  ALTER TABLE "payload"."cms_units" DROP COLUMN IF EXISTS "store_id";
  ALTER TABLE "payload"."cms_discounts" DROP COLUMN IF EXISTS "store_id";
  ALTER TABLE "payload"."cms_discounts" DROP COLUMN IF EXISTS "automatic";
  ALTER TABLE "payload"."cms_discounts" DROP COLUMN IF EXISTS "per_customer_limit";
  ALTER TABLE "payload"."cms_discounts" DROP COLUMN IF EXISTS "starts_at";
  ALTER TABLE "payload"."cms_discounts" DROP COLUMN IF EXISTS "applies_to";
  ALTER TABLE "payload"."cms_discounts" DROP COLUMN IF EXISTS "combinable";
  ALTER TABLE "payload"."cms_flash_sales" DROP COLUMN IF EXISTS "store_id";
  ALTER TABLE "payload"."cms_wholesale_inquiries" DROP COLUMN IF EXISTS "store_id";
  ALTER TABLE "payload"."cms_contact_messages" DROP COLUMN IF EXISTS "store_id";
  ALTER TABLE "payload"."cms_pages" DROP COLUMN IF EXISTS "store_id";
  ALTER TABLE "payload"."_cms_pages_v" DROP COLUMN IF EXISTS "version_store_id";
  ALTER TABLE "payload"."cms_menus" DROP COLUMN IF EXISTS "store_id";
  ALTER TABLE "payload"."cms_blocked_phones" DROP COLUMN IF EXISTS "store_id";
  ALTER TABLE "payload"."cms_trade_ins" DROP COLUMN IF EXISTS "store_id";
  ALTER TABLE "payload"."cms_product_questions" DROP COLUMN IF EXISTS "store_id";
  ALTER TABLE "payload"."cms_stock_alerts" DROP COLUMN IF EXISTS "store_id";
  ALTER TABLE "payload"."cms_abandoned_carts" DROP COLUMN IF EXISTS "store_id";
  ALTER TABLE "payload"."cms_suppliers" DROP COLUMN IF EXISTS "store_id";
  ALTER TABLE "payload"."cms_purchases" DROP COLUMN IF EXISTS "store_id";
  ALTER TABLE "payload"."cms_stock_counts" DROP COLUMN IF EXISTS "store_id";
  ALTER TABLE "payload"."cms_stock_movements" DROP COLUMN IF EXISTS "store_id";
  ALTER TABLE "payload"."cms_activity_log" DROP COLUMN IF EXISTS "store_id";
  ALTER TABLE "payload"."cms_exports" DROP COLUMN IF EXISTS "store_id";
  ALTER TABLE "payload"."cms_imports" DROP COLUMN IF EXISTS "store_id";
  ALTER TABLE "payload"."cms_redirects" DROP COLUMN IF EXISTS "store_id";
  ALTER TABLE "payload"."payload_folders" DROP COLUMN IF EXISTS "store_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_stores_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_store_memberships_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_subscription_plans_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_store_subscriptions_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_store_invoices_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_ss_theme_settings_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_ss_announcement_bar_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_ss_header_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_ss_footer_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_ss_whatsapp_button_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_ss_shipping_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_ss_payments_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_ss_notifications_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_ss_store_info_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_ss_seo_settings_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_ss_page_texts_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_ss_testimonials_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_ss_faqs_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_ss_order_protection_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_ss_returns_policy_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_ss_cookie_notice_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_ss_sales_channels_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_ss_conversion_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_outbox_events_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_payment_transactions_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_payment_events_id";
  ALTER TABLE "payload"."cms_payments" DROP COLUMN IF EXISTS "card_enabled";
  ALTER TABLE "payload"."cms_payments" DROP COLUMN IF EXISTS "card_note";
  ALTER TABLE "payload"."cms_payments" DROP COLUMN IF EXISTS "tax_enabled";
  ALTER TABLE "payload"."cms_payments" DROP COLUMN IF EXISTS "tax_rate";
  ALTER TABLE "payload"."cms_payments" DROP COLUMN IF EXISTS "tax_inclusive";
  ALTER TABLE "payload"."cms_payments" DROP COLUMN IF EXISTS "tax_label";
  ALTER TABLE "payload"."cms_payments" DROP COLUMN IF EXISTS "tax_tax_delivery";
  DROP TYPE "payload"."enum_cms_stores_status";
  DROP TYPE "payload"."enum_cms_stores_subscription_status";
  DROP TYPE "payload"."enum_cms_stores_payments_provider";
  DROP TYPE "payload"."enum_cms_store_memberships_role";
  DROP TYPE "payload"."enum_cms_store_memberships_status";
  DROP TYPE "payload"."enum_cms_subscription_plans_features";
  DROP TYPE "payload"."enum_cms_subscription_plans_status";
  DROP TYPE "payload"."enum_cms_store_subscriptions_status";
  DROP TYPE "payload"."enum_cms_store_subscriptions_billing_cycle";
  DROP TYPE "payload"."enum_cms_store_invoices_status";
  DROP TYPE "payload"."enum_cms_users_platform_role";
  DROP TYPE "payload"."enum_cms_orders_fulfillment_status";
  DROP TYPE "payload"."enum_cms_discounts_applies_to";
  DROP TYPE "payload"."enum_cms_ss_theme_settings_body_font";
  DROP TYPE "payload"."enum_cms_ss_theme_settings_heading_font";
  DROP TYPE "payload"."enum_cms_ss_theme_settings_button_style";
  DROP TYPE "payload"."enum_cms_ss_theme_settings_card_radius";
  DROP TYPE "payload"."enum_cms_ss_theme_settings_default_mode";
  DROP TYPE "payload"."enum__cms_ss_theme_settings_v_version_body_font";
  DROP TYPE "payload"."enum__cms_ss_theme_settings_v_version_heading_font";
  DROP TYPE "payload"."enum__cms_ss_theme_settings_v_version_button_style";
  DROP TYPE "payload"."enum__cms_ss_theme_settings_v_version_card_radius";
  DROP TYPE "payload"."enum__cms_ss_theme_settings_v_version_default_mode";
  DROP TYPE "payload"."enum_cms_ss_whatsapp_button_position";
  DROP TYPE "payload"."enum__cms_ss_whatsapp_button_v_version_position";
  DROP TYPE "payload"."enum_cms_ss_shipping_zones_cities";
  DROP TYPE "payload"."enum_cms_ss_notifications_status_updates";
  DROP TYPE "payload"."enum_cms_ss_store_info_hours_days";
  DROP TYPE "payload"."enum_cms_ss_seo_settings_pages_page";
  DROP TYPE "payload"."enum_cms_ss_seo_settings_pages_indexing";
  DROP TYPE "payload"."enum_cms_ss_page_texts_pages_page";
  DROP TYPE "payload"."enum_cms_ss_returns_policy_warranty_by_condition_condition";
  DROP TYPE "payload"."enum_cms_outbox_events_status";
  DROP TYPE "payload"."enum_cms_payment_transactions_kind";
  DROP TYPE "payload"."enum_cms_payment_transactions_status";
  DROP TYPE "payload"."enum_cms_payment_transactions_provider";
  DROP TYPE "payload"."enum_cms_payment_events_status";`)
}
