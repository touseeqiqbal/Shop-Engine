import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/* Integrations (/cms → Integrations): one row per store and provider; keys stored encrypted (lib/integrations/secrets.ts). Adds only. */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_cms_integrations_mode" AS ENUM('live', 'test');
  CREATE TYPE "payload"."enum_cms_integrations_status" AS ENUM('connected', 'error');
  CREATE TABLE "payload"."cms_integrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_id" integer,
  	"provider" varchar NOT NULL,
  	"category" varchar NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"mode" "payload"."enum_cms_integrations_mode" DEFAULT 'live',
  	"config" jsonb,
  	"secrets" varchar,
  	"secret_hints" jsonb,
  	"state" jsonb,
  	"status" "payload"."enum_cms_integrations_status" DEFAULT 'connected',
  	"last_checked_at" timestamp(3) with time zone,
  	"last_error" varchar,
  	"webhook_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_integrations_id" integer;
  ALTER TABLE "payload"."cms_integrations" ADD CONSTRAINT "cms_integrations_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "cms_integrations_store_idx" ON "payload"."cms_integrations" USING btree ("store_id");
  CREATE INDEX "cms_integrations_provider_idx" ON "payload"."cms_integrations" USING btree ("provider");
  CREATE INDEX "cms_integrations_category_idx" ON "payload"."cms_integrations" USING btree ("category");
  CREATE INDEX "cms_integrations_enabled_idx" ON "payload"."cms_integrations" USING btree ("enabled");
  CREATE UNIQUE INDEX "cms_integrations_webhook_key_idx" ON "payload"."cms_integrations" USING btree ("webhook_key");
  CREATE INDEX "cms_integrations_updated_at_idx" ON "payload"."cms_integrations" USING btree ("updated_at");
  CREATE INDEX "cms_integrations_created_at_idx" ON "payload"."cms_integrations" USING btree ("created_at");
  CREATE UNIQUE INDEX "store_provider_idx" ON "payload"."cms_integrations" USING btree ("store_id","provider");
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_integrations_fk" FOREIGN KEY ("cms_integrations_id") REFERENCES "payload"."cms_integrations"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_cms_integrations_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_integrations_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_integrations" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."cms_integrations" CASCADE;
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_integrations_fk";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_integrations_id_idx";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_integrations_id";
  DROP TYPE IF EXISTS "payload"."enum_cms_integrations_mode";
  DROP TYPE IF EXISTS "payload"."enum_cms_integrations_status";`)
}
