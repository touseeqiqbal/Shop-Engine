import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "payload"."cms_email_optouts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_id" integer,
  	"contact" varchar NOT NULL,
  	"source" varchar DEFAULT 'staff',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_email_optouts_id" integer;
  ALTER TABLE "payload"."cms_email_optouts" ADD CONSTRAINT "cms_email_optouts_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "cms_email_optouts_store_idx" ON "payload"."cms_email_optouts" USING btree ("store_id");
  CREATE INDEX "cms_email_optouts_contact_idx" ON "payload"."cms_email_optouts" USING btree ("contact");
  CREATE INDEX "cms_email_optouts_updated_at_idx" ON "payload"."cms_email_optouts" USING btree ("updated_at");
  CREATE INDEX "cms_email_optouts_created_at_idx" ON "payload"."cms_email_optouts" USING btree ("created_at");
  CREATE UNIQUE INDEX "store_contact_idx" ON "payload"."cms_email_optouts" USING btree ("store_id","contact");
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_email_optouts_fk" FOREIGN KEY ("cms_email_optouts_id") REFERENCES "payload"."cms_email_optouts"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_cms_email_optouts_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_email_optouts_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_email_optouts_fk";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_email_optouts_id_idx";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_email_optouts_id";
  DROP TABLE IF EXISTS "payload"."cms_email_optouts" CASCADE;`)
}
