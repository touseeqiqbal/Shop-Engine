import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "payload"."cms_staff_guide_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"link" varchar,
  	"steps" varchar NOT NULL,
  	"tip" varchar
  );
  
  CREATE TABLE "payload"."cms_staff_guide" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "payload"."cms_staff_guide_sections" ADD CONSTRAINT "cms_staff_guide_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_staff_guide"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "cms_staff_guide_sections_order_idx" ON "payload"."cms_staff_guide_sections" USING btree ("_order");
  CREATE INDEX "cms_staff_guide_sections_parent_id_idx" ON "payload"."cms_staff_guide_sections" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "payload"."cms_staff_guide_sections" CASCADE;
  DROP TABLE "payload"."cms_staff_guide" CASCADE;`)
}
