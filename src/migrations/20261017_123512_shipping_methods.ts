import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "payload"."cms_ss_shipping_zones_methods" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"charge" numeric NOT NULL,
  	"per_kg" numeric,
  	"free_above" numeric,
  	"estimate" varchar
  );
  
  CREATE TABLE "payload"."cms_shipping_zones_methods" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"charge" numeric NOT NULL,
  	"per_kg" numeric,
  	"free_above" numeric,
  	"estimate" varchar
  );
  
  ALTER TABLE "payload"."cms_orders" ADD COLUMN "shipping_method" varchar;
  ALTER TABLE "payload"."cms_ss_shipping_zones" ADD COLUMN "included_kg" numeric;
  ALTER TABLE "payload"."cms_ss_shipping_zones" ADD COLUMN "per_kg" numeric;
  ALTER TABLE "payload"."cms_shipping_zones" ADD COLUMN "included_kg" numeric;
  ALTER TABLE "payload"."cms_shipping_zones" ADD COLUMN "per_kg" numeric;
  ALTER TABLE "payload"."cms_ss_shipping_zones_methods" ADD CONSTRAINT "cms_ss_shipping_zones_methods_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_ss_shipping_zones"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_shipping_zones_methods" ADD CONSTRAINT "cms_shipping_zones_methods_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_shipping_zones"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "cms_ss_shipping_zones_methods_order_idx" ON "payload"."cms_ss_shipping_zones_methods" USING btree ("_order");
  CREATE INDEX "cms_ss_shipping_zones_methods_parent_id_idx" ON "payload"."cms_ss_shipping_zones_methods" USING btree ("_parent_id");
  CREATE INDEX "cms_shipping_zones_methods_order_idx" ON "payload"."cms_shipping_zones_methods" USING btree ("_order");
  CREATE INDEX "cms_shipping_zones_methods_parent_id_idx" ON "payload"."cms_shipping_zones_methods" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE IF EXISTS "payload"."cms_ss_shipping_zones_methods" CASCADE;
  DROP TABLE IF EXISTS "payload"."cms_shipping_zones_methods" CASCADE;
  ALTER TABLE "payload"."cms_orders" DROP COLUMN IF EXISTS "shipping_method";
  ALTER TABLE "payload"."cms_ss_shipping_zones" DROP COLUMN IF EXISTS "included_kg";
  ALTER TABLE "payload"."cms_ss_shipping_zones" DROP COLUMN IF EXISTS "per_kg";
  ALTER TABLE "payload"."cms_shipping_zones" DROP COLUMN IF EXISTS "included_kg";
  ALTER TABLE "payload"."cms_shipping_zones" DROP COLUMN IF EXISTS "per_kg";`)
}
