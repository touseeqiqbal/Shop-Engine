import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_cms_orders_risk_level" AS ENUM('low', 'medium', 'high');
  CREATE TYPE "payload"."enum_cms_blocked_phones_action" AS ENUM('block', 'advance');
  ALTER TYPE "payload"."enum_cms_orders_history_status" ADD VALUE 'awaiting-confirmation' BEFORE 'pending';
  ALTER TYPE "payload"."enum_cms_orders_history_status" ADD VALUE 'refused' BEFORE 'returned';
  ALTER TYPE "payload"."enum_cms_orders_status" ADD VALUE 'awaiting-confirmation' BEFORE 'pending';
  ALTER TYPE "payload"."enum_cms_orders_status" ADD VALUE 'refused' BEFORE 'returned';
  CREATE TABLE "payload"."cms_blocked_phones" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"phone" varchar NOT NULL,
  	"action" "payload"."enum_cms_blocked_phones_action" DEFAULT 'block' NOT NULL,
  	"reason" varchar,
  	"name" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_order_protection" (
  	"id" serial PRIMARY KEY NOT NULL,
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
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload"."cms_order_protection_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "confirmation_token" varchar;
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "confirmation_code" varchar;
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "confirmation_expires_at" timestamp(3) with time zone;
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "confirmation_confirmed_at" timestamp(3) with time zone;
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "confirmation_via" varchar;
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "risk_score" numeric;
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "risk_level" "payload"."enum_cms_orders_risk_level";
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "risk_reasons" varchar;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_blocked_phones_id" integer;
  ALTER TABLE "payload"."cms_order_protection_texts" ADD CONSTRAINT "cms_order_protection_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_order_protection"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "cms_blocked_phones_phone_idx" ON "payload"."cms_blocked_phones" USING btree ("phone");
  CREATE INDEX "cms_blocked_phones_updated_at_idx" ON "payload"."cms_blocked_phones" USING btree ("updated_at");
  CREATE INDEX "cms_blocked_phones_created_at_idx" ON "payload"."cms_blocked_phones" USING btree ("created_at");
  CREATE INDEX "cms_order_protection_texts_order_parent" ON "payload"."cms_order_protection_texts" USING btree ("order","parent_id");
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_blocked_phones_fk" FOREIGN KEY ("cms_blocked_phones_id") REFERENCES "payload"."cms_blocked_phones"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "cms_orders_confirmation_confirmation_token_idx" ON "payload"."cms_orders" USING btree ("confirmation_token");
  CREATE INDEX "payload_locked_documents_rels_cms_blocked_phones_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_blocked_phones_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_blocked_phones" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_order_protection" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_order_protection_texts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."cms_blocked_phones" CASCADE;
  DROP TABLE "payload"."cms_order_protection" CASCADE;
  DROP TABLE "payload"."cms_order_protection_texts" CASCADE;
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_blocked_phones_fk";
  
  ALTER TABLE "payload"."cms_orders_history" ALTER COLUMN "status" SET DATA TYPE text;
  DROP TYPE "payload"."enum_cms_orders_history_status";
  CREATE TYPE "payload"."enum_cms_orders_history_status" AS ENUM('pending', 'confirmed', 'dispatched', 'out-for-delivery', 'delivered', 'cancelled', 'returned');
  ALTER TABLE "payload"."cms_orders_history" ALTER COLUMN "status" SET DATA TYPE "payload"."enum_cms_orders_history_status" USING "status"::"payload"."enum_cms_orders_history_status";
  ALTER TABLE "payload"."cms_orders" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "payload"."cms_orders" ALTER COLUMN "status" SET DEFAULT 'pending'::text;
  DROP TYPE "payload"."enum_cms_orders_status";
  CREATE TYPE "payload"."enum_cms_orders_status" AS ENUM('pending', 'confirmed', 'dispatched', 'out-for-delivery', 'delivered', 'cancelled', 'returned');
  ALTER TABLE "payload"."cms_orders" ALTER COLUMN "status" SET DEFAULT 'pending'::"payload"."enum_cms_orders_status";
  ALTER TABLE "payload"."cms_orders" ALTER COLUMN "status" SET DATA TYPE "payload"."enum_cms_orders_status" USING "status"::"payload"."enum_cms_orders_status";
  DROP INDEX IF EXISTS "payload"."cms_orders_confirmation_confirmation_token_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_blocked_phones_id_idx";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN "confirmation_token";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN "confirmation_code";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN "confirmation_expires_at";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN "confirmation_confirmed_at";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN "confirmation_via";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN "risk_score";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN "risk_level";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN "risk_reasons";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "cms_blocked_phones_id";
  DROP TYPE "payload"."enum_cms_orders_risk_level";
  DROP TYPE "payload"."enum_cms_blocked_phones_action";`)
}
