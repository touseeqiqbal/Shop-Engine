import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "payload"."cms_loyalty_accounts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_id" integer,
  	"customer_id" integer,
  	"customer_email" varchar,
  	"balance" numeric DEFAULT 0,
  	"earned" numeric DEFAULT 0,
  	"ledger" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "points_earned" numeric;
  ALTER TABLE "payload"."cms_ss_conversion" ADD COLUMN "loyalty_enabled" boolean DEFAULT false;
  ALTER TABLE "payload"."cms_ss_conversion" ADD COLUMN "loyalty_points_per100" numeric DEFAULT 1;
  ALTER TABLE "payload"."cms_ss_conversion" ADD COLUMN "loyalty_point_value" numeric DEFAULT 1;
  ALTER TABLE "payload"."cms_ss_conversion" ADD COLUMN "loyalty_min_redeem" numeric DEFAULT 100;
  ALTER TABLE "payload"."cms_gift_cards" ADD COLUMN "customer_id" integer;
  ALTER TABLE "payload"."cms_gift_cards" ADD COLUMN "from_points" numeric;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_loyalty_accounts_id" integer;
  ALTER TABLE "payload"."cms_conversion" ADD COLUMN "loyalty_enabled" boolean DEFAULT false;
  ALTER TABLE "payload"."cms_conversion" ADD COLUMN "loyalty_points_per100" numeric DEFAULT 1;
  ALTER TABLE "payload"."cms_conversion" ADD COLUMN "loyalty_point_value" numeric DEFAULT 1;
  ALTER TABLE "payload"."cms_conversion" ADD COLUMN "loyalty_min_redeem" numeric DEFAULT 100;
  ALTER TABLE "payload"."cms_loyalty_accounts" ADD CONSTRAINT "cms_loyalty_accounts_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_loyalty_accounts" ADD CONSTRAINT "cms_loyalty_accounts_customer_id_cms_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "payload"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "cms_loyalty_accounts_store_idx" ON "payload"."cms_loyalty_accounts" USING btree ("store_id");
  CREATE INDEX "cms_loyalty_accounts_customer_idx" ON "payload"."cms_loyalty_accounts" USING btree ("customer_id");
  CREATE INDEX "cms_loyalty_accounts_customer_email_idx" ON "payload"."cms_loyalty_accounts" USING btree ("customer_email");
  CREATE INDEX "cms_loyalty_accounts_updated_at_idx" ON "payload"."cms_loyalty_accounts" USING btree ("updated_at");
  CREATE INDEX "cms_loyalty_accounts_created_at_idx" ON "payload"."cms_loyalty_accounts" USING btree ("created_at");
  CREATE UNIQUE INDEX "store_customer_idx" ON "payload"."cms_loyalty_accounts" USING btree ("store_id","customer_id");
  ALTER TABLE "payload"."cms_gift_cards" ADD CONSTRAINT "cms_gift_cards_customer_id_cms_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "payload"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_loyalty_accounts_fk" FOREIGN KEY ("cms_loyalty_accounts_id") REFERENCES "payload"."cms_loyalty_accounts"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "cms_gift_cards_customer_idx" ON "payload"."cms_gift_cards" USING btree ("customer_id");
  CREATE INDEX "payload_locked_documents_rels_cms_loyalty_accounts_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_loyalty_accounts_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_loyalty_accounts_fk";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_loyalty_accounts_id_idx";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_loyalty_accounts_id";
  DROP TABLE IF EXISTS "payload"."cms_loyalty_accounts" CASCADE;
  ALTER TABLE "payload"."cms_gift_cards" DROP CONSTRAINT IF EXISTS "cms_gift_cards_customer_id_cms_users_id_fk";
  DROP INDEX IF EXISTS "payload"."cms_gift_cards_customer_idx";
  ALTER TABLE "payload"."cms_gift_cards" DROP COLUMN IF EXISTS "customer_id";
  ALTER TABLE "payload"."cms_gift_cards" DROP COLUMN IF EXISTS "from_points";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN IF EXISTS "points_earned";
  ALTER TABLE "payload"."cms_ss_conversion" DROP COLUMN IF EXISTS "loyalty_enabled";
  ALTER TABLE "payload"."cms_ss_conversion" DROP COLUMN IF EXISTS "loyalty_points_per100";
  ALTER TABLE "payload"."cms_ss_conversion" DROP COLUMN IF EXISTS "loyalty_point_value";
  ALTER TABLE "payload"."cms_ss_conversion" DROP COLUMN IF EXISTS "loyalty_min_redeem";
  ALTER TABLE "payload"."cms_conversion" DROP COLUMN IF EXISTS "loyalty_enabled";
  ALTER TABLE "payload"."cms_conversion" DROP COLUMN IF EXISTS "loyalty_points_per100";
  ALTER TABLE "payload"."cms_conversion" DROP COLUMN IF EXISTS "loyalty_point_value";
  ALTER TABLE "payload"."cms_conversion" DROP COLUMN IF EXISTS "loyalty_min_redeem";`)
}
