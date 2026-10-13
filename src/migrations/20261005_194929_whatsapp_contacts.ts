import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "payload"."cms_whatsapp_button_contacts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"phone" varchar NOT NULL
  );
  
  DROP TABLE "payload"."cms_whatsapp_button_numbers" CASCADE;
  ALTER TABLE "payload"."cms_whatsapp_button_contacts" ADD CONSTRAINT "cms_whatsapp_button_contacts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_whatsapp_button"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "cms_whatsapp_button_contacts_order_idx" ON "payload"."cms_whatsapp_button_contacts" USING btree ("_order");
  CREATE INDEX "cms_whatsapp_button_contacts_parent_id_idx" ON "payload"."cms_whatsapp_button_contacts" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "payload"."cms_whatsapp_button_numbers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"number" varchar NOT NULL
  );
  
  DROP TABLE "payload"."cms_whatsapp_button_contacts" CASCADE;
  ALTER TABLE "payload"."cms_whatsapp_button_numbers" ADD CONSTRAINT "cms_whatsapp_button_numbers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_whatsapp_button"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "cms_whatsapp_button_numbers_order_idx" ON "payload"."cms_whatsapp_button_numbers" USING btree ("_order");
  CREATE INDEX "cms_whatsapp_button_numbers_parent_id_idx" ON "payload"."cms_whatsapp_button_numbers" USING btree ("_parent_id");`)
}
