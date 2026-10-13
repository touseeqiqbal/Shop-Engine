import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_cms_trade_ins_status" AS ENUM('new', 'contacted', 'offered', 'bought', 'declined');
  CREATE TYPE "payload"."enum_cms_trade_ins_condition" AS ENUM('like-new', 'good', 'fair', 'faulty');
  CREATE TYPE "payload"."enum_cms_stock_alerts_kind" AS ENUM('stock', 'price');
  CREATE TYPE "payload"."enum_cms_stock_alerts_status" AS ENUM('waiting', 'sent', 'cancelled');
  CREATE TYPE "payload"."enum_cms_abandoned_carts_status" AS ENUM('open', 'reminded', 'recovered', 'stopped');
  CREATE TABLE "payload"."cms_trade_ins" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"status" "payload"."enum_cms_trade_ins_status" DEFAULT 'new' NOT NULL,
  	"offer_price" numeric,
  	"expected_price" numeric,
  	"summary" varchar,
  	"brand" varchar NOT NULL,
  	"model" varchar NOT NULL,
  	"condition" "payload"."enum_cms_trade_ins_condition",
  	"processor" varchar,
  	"ram" varchar,
  	"storage" varchar,
  	"battery_health" varchar,
  	"accessories" varchar,
  	"faults" varchar,
  	"wants_trade_in" boolean,
  	"photo_keys" jsonb,
  	"name" varchar NOT NULL,
  	"phone" varchar NOT NULL,
  	"city" varchar,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_product_questions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"question" varchar NOT NULL,
  	"answer" varchar,
  	"published" boolean,
  	"name" varchar,
  	"email" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_stock_alerts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"kind" "payload"."enum_cms_stock_alerts_kind" NOT NULL,
  	"status" "payload"."enum_cms_stock_alerts_status" DEFAULT 'waiting' NOT NULL,
  	"contact" varchar NOT NULL,
  	"price_at_signup" numeric,
  	"sent_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_abandoned_carts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"status" "payload"."enum_cms_abandoned_carts_status" DEFAULT 'open' NOT NULL,
  	"total" numeric,
  	"reminders_sent" numeric DEFAULT 0,
  	"contact" varchar NOT NULL,
  	"email" varchar,
  	"phone" varchar,
  	"name" varchar,
  	"items" jsonb NOT NULL,
  	"token" varchar,
  	"last_activity_at" timestamp(3) with time zone,
  	"last_reminder_at" timestamp(3) with time zone,
  	"recovered_order" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_conversion_emi_plans" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"bank" varchar NOT NULL,
  	"months" numeric NOT NULL,
  	"markup_percent" numeric DEFAULT 0,
  	"min_amount" numeric
  );
  
  CREATE TABLE "payload"."cms_conversion" (
  	"id" serial PRIMARY KEY NOT NULL,
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
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "payload"."cms_reviews" ADD COLUMN "photo_keys" jsonb;
  ALTER TABLE "payload"."cms_reviews" ADD COLUMN "photos" jsonb;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_trade_ins_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_product_questions_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_stock_alerts_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_abandoned_carts_id" integer;
  ALTER TABLE "payload"."cms_product_questions" ADD CONSTRAINT "cms_product_questions_product_id_cms_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "payload"."cms_products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_stock_alerts" ADD CONSTRAINT "cms_stock_alerts_product_id_cms_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "payload"."cms_products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_conversion_emi_plans" ADD CONSTRAINT "cms_conversion_emi_plans_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_conversion"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "cms_trade_ins_status_idx" ON "payload"."cms_trade_ins" USING btree ("status");
  CREATE INDEX "cms_trade_ins_phone_idx" ON "payload"."cms_trade_ins" USING btree ("phone");
  CREATE INDEX "cms_trade_ins_updated_at_idx" ON "payload"."cms_trade_ins" USING btree ("updated_at");
  CREATE INDEX "cms_trade_ins_created_at_idx" ON "payload"."cms_trade_ins" USING btree ("created_at");
  CREATE INDEX "cms_product_questions_product_idx" ON "payload"."cms_product_questions" USING btree ("product_id");
  CREATE INDEX "cms_product_questions_published_idx" ON "payload"."cms_product_questions" USING btree ("published");
  CREATE INDEX "cms_product_questions_updated_at_idx" ON "payload"."cms_product_questions" USING btree ("updated_at");
  CREATE INDEX "cms_product_questions_created_at_idx" ON "payload"."cms_product_questions" USING btree ("created_at");
  CREATE INDEX "cms_stock_alerts_product_idx" ON "payload"."cms_stock_alerts" USING btree ("product_id");
  CREATE INDEX "cms_stock_alerts_status_idx" ON "payload"."cms_stock_alerts" USING btree ("status");
  CREATE INDEX "cms_stock_alerts_updated_at_idx" ON "payload"."cms_stock_alerts" USING btree ("updated_at");
  CREATE INDEX "cms_stock_alerts_created_at_idx" ON "payload"."cms_stock_alerts" USING btree ("created_at");
  CREATE INDEX "cms_abandoned_carts_status_idx" ON "payload"."cms_abandoned_carts" USING btree ("status");
  CREATE INDEX "cms_abandoned_carts_contact_idx" ON "payload"."cms_abandoned_carts" USING btree ("contact");
  CREATE INDEX "cms_abandoned_carts_email_idx" ON "payload"."cms_abandoned_carts" USING btree ("email");
  CREATE INDEX "cms_abandoned_carts_phone_idx" ON "payload"."cms_abandoned_carts" USING btree ("phone");
  CREATE UNIQUE INDEX "cms_abandoned_carts_token_idx" ON "payload"."cms_abandoned_carts" USING btree ("token");
  CREATE INDEX "cms_abandoned_carts_last_activity_at_idx" ON "payload"."cms_abandoned_carts" USING btree ("last_activity_at");
  CREATE INDEX "cms_abandoned_carts_updated_at_idx" ON "payload"."cms_abandoned_carts" USING btree ("updated_at");
  CREATE INDEX "cms_abandoned_carts_created_at_idx" ON "payload"."cms_abandoned_carts" USING btree ("created_at");
  CREATE INDEX "cms_conversion_emi_plans_order_idx" ON "payload"."cms_conversion_emi_plans" USING btree ("_order");
  CREATE INDEX "cms_conversion_emi_plans_parent_id_idx" ON "payload"."cms_conversion_emi_plans" USING btree ("_parent_id");
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_trade_ins_fk" FOREIGN KEY ("cms_trade_ins_id") REFERENCES "payload"."cms_trade_ins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_product_questions_fk" FOREIGN KEY ("cms_product_questions_id") REFERENCES "payload"."cms_product_questions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_stock_alerts_fk" FOREIGN KEY ("cms_stock_alerts_id") REFERENCES "payload"."cms_stock_alerts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_abandoned_carts_fk" FOREIGN KEY ("cms_abandoned_carts_id") REFERENCES "payload"."cms_abandoned_carts"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_cms_trade_ins_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_trade_ins_id");
  CREATE INDEX "payload_locked_documents_rels_cms_product_questions_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_product_questions_id");
  CREATE INDEX "payload_locked_documents_rels_cms_stock_alerts_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_stock_alerts_id");
  CREATE INDEX "payload_locked_documents_rels_cms_abandoned_carts_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_abandoned_carts_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_trade_ins" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_product_questions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_stock_alerts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_abandoned_carts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_conversion_emi_plans" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_conversion" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."cms_trade_ins" CASCADE;
  DROP TABLE "payload"."cms_product_questions" CASCADE;
  DROP TABLE "payload"."cms_stock_alerts" CASCADE;
  DROP TABLE "payload"."cms_abandoned_carts" CASCADE;
  DROP TABLE "payload"."cms_conversion_emi_plans" CASCADE;
  DROP TABLE "payload"."cms_conversion" CASCADE;
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_trade_ins_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_product_questions_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_stock_alerts_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_abandoned_carts_fk";
  
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_trade_ins_id_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_product_questions_id_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_stock_alerts_id_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_abandoned_carts_id_idx";
  ALTER TABLE "payload"."cms_reviews" DROP COLUMN "photo_keys";
  ALTER TABLE "payload"."cms_reviews" DROP COLUMN "photos";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "cms_trade_ins_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "cms_product_questions_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "cms_stock_alerts_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "cms_abandoned_carts_id";
  DROP TYPE "payload"."enum_cms_trade_ins_status";
  DROP TYPE "payload"."enum_cms_trade_ins_condition";
  DROP TYPE "payload"."enum_cms_stock_alerts_kind";
  DROP TYPE "payload"."enum_cms_stock_alerts_status";
  DROP TYPE "payload"."enum_cms_abandoned_carts_status";`)
}
