import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_cms_shop_stats_kind" AS ENUM('view', 'cart', 'checkout');
  CREATE TABLE "payload"."cms_shop_stats" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_id" integer,
  	"day" varchar NOT NULL,
  	"kind" "payload"."enum_cms_shop_stats_kind" NOT NULL,
  	"ref" varchar DEFAULT '',
  	"count" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_shop_stats_id" integer;
  ALTER TABLE "payload"."cms_shop_stats" ADD CONSTRAINT "cms_shop_stats_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "cms_shop_stats_store_idx" ON "payload"."cms_shop_stats" USING btree ("store_id");
  CREATE INDEX "cms_shop_stats_day_idx" ON "payload"."cms_shop_stats" USING btree ("day");
  CREATE INDEX "cms_shop_stats_updated_at_idx" ON "payload"."cms_shop_stats" USING btree ("updated_at");
  CREATE INDEX "cms_shop_stats_created_at_idx" ON "payload"."cms_shop_stats" USING btree ("created_at");
  CREATE UNIQUE INDEX "store_day_kind_ref_idx" ON "payload"."cms_shop_stats" USING btree ("store_id","day","kind","ref");
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_shop_stats_fk" FOREIGN KEY ("cms_shop_stats_id") REFERENCES "payload"."cms_shop_stats"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_cms_shop_stats_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_shop_stats_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_shop_stats_fk";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_shop_stats_id_idx";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_shop_stats_id";
  DROP TABLE IF EXISTS "payload"."cms_shop_stats" CASCADE;
  DROP TYPE IF EXISTS "payload"."enum_cms_shop_stats_kind";`)
}
