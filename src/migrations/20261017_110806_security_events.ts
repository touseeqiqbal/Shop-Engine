import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_cms_security_events_kind" AS ENUM('sign-in', 'sign-in-failed', 'two-factor-failed', 'two-factor-locked', 'two-factor-on', 'two-factor-off', 'two-factor-reset', 'backup-codes', 'password-reset-requested', 'password-changed', 'rate-limited');
  CREATE TYPE "payload"."enum_cms_security_events_area" AS ENUM('admin', 'shop');
  CREATE TABLE "payload"."cms_security_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"kind" "payload"."enum_cms_security_events_kind" NOT NULL,
  	"area" "payload"."enum_cms_security_events_area" DEFAULT 'admin' NOT NULL,
  	"email" varchar,
  	"user_id" numeric,
  	"ip" varchar,
  	"detail" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_security_events_id" integer;
  CREATE INDEX "cms_security_events_kind_idx" ON "payload"."cms_security_events" USING btree ("kind");
  CREATE INDEX "cms_security_events_area_idx" ON "payload"."cms_security_events" USING btree ("area");
  CREATE INDEX "cms_security_events_email_idx" ON "payload"."cms_security_events" USING btree ("email");
  CREATE INDEX "cms_security_events_user_id_idx" ON "payload"."cms_security_events" USING btree ("user_id");
  CREATE INDEX "cms_security_events_updated_at_idx" ON "payload"."cms_security_events" USING btree ("updated_at");
  CREATE INDEX "cms_security_events_created_at_idx" ON "payload"."cms_security_events" USING btree ("created_at");
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_security_events_fk" FOREIGN KEY ("cms_security_events_id") REFERENCES "payload"."cms_security_events"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_cms_security_events_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_security_events_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_security_events" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."cms_security_events" CASCADE;
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_security_events_fk";
  
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_security_events_id_idx";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_security_events_id";
  DROP TYPE IF EXISTS "payload"."enum_cms_security_events_kind";
  DROP TYPE IF EXISTS "payload"."enum_cms_security_events_area";`)
}
