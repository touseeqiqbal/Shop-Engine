import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_cms_gift_cards_status" AS ENUM('active', 'disabled');
  CREATE TABLE "payload"."cms_gift_cards" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_id" integer,
  	"code" varchar,
  	"status" "payload"."enum_cms_gift_cards_status" DEFAULT 'active' NOT NULL,
  	"initial_value" numeric NOT NULL,
  	"balance" numeric,
  	"expires_at" timestamp(3) with time zone,
  	"recipient_name" varchar,
  	"recipient_email" varchar,
  	"message" varchar,
  	"send_email" boolean,
  	"issued_for_id" integer,
  	"ledger" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "gift_card_code" varchar;
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "gift_card_amount" numeric;
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "gift_card_charged" boolean DEFAULT false;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_gift_cards_id" integer;
  ALTER TABLE "payload"."cms_gift_cards" ADD CONSTRAINT "cms_gift_cards_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_gift_cards" ADD CONSTRAINT "cms_gift_cards_issued_for_id_cms_orders_id_fk" FOREIGN KEY ("issued_for_id") REFERENCES "payload"."cms_orders"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "cms_gift_cards_store_idx" ON "payload"."cms_gift_cards" USING btree ("store_id");
  CREATE INDEX "cms_gift_cards_code_idx" ON "payload"."cms_gift_cards" USING btree ("code");
  CREATE INDEX "cms_gift_cards_issued_for_idx" ON "payload"."cms_gift_cards" USING btree ("issued_for_id");
  CREATE INDEX "cms_gift_cards_updated_at_idx" ON "payload"."cms_gift_cards" USING btree ("updated_at");
  CREATE INDEX "cms_gift_cards_created_at_idx" ON "payload"."cms_gift_cards" USING btree ("created_at");
  CREATE UNIQUE INDEX "store_code_1_idx" ON "payload"."cms_gift_cards" USING btree ("store_id","code");
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gift_cards_fk" FOREIGN KEY ("cms_gift_cards_id") REFERENCES "payload"."cms_gift_cards"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_cms_gift_cards_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_gift_cards_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_gift_cards_fk";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_gift_cards_id_idx";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_gift_cards_id";
  DROP TABLE IF EXISTS "payload"."cms_gift_cards" CASCADE;
  ALTER TABLE "payload"."cms_orders" DROP COLUMN IF EXISTS "gift_card_code";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN IF EXISTS "gift_card_amount";
  ALTER TABLE "payload"."cms_orders" DROP COLUMN IF EXISTS "gift_card_charged";
  DROP TYPE IF EXISTS "payload"."enum_cms_gift_cards_status";`)
}
