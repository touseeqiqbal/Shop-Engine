import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_cms_orders_shipments_cod_status" AS ENUM('pending', 'remitted');
  CREATE TYPE "payload"."enum_cms_api_keys_scopes" AS ENUM('products:read', 'products:write', 'orders:read', 'orders:write');
  ALTER TYPE "payload"."enum_cms_orders_shipments_status" ADD VALUE 'returned' BEFORE 'cancelled';
  CREATE TABLE "payload"."cms_api_keys_scopes" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "payload"."enum_cms_api_keys_scopes",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "payload"."cms_api_keys" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_id" integer,
  	"name" varchar NOT NULL,
  	"prefix" varchar NOT NULL,
  	"hash" varchar NOT NULL,
  	"created_by" varchar,
  	"last_used_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload"."cms_orders_shipments" ADD COLUMN "provider" varchar;
  ALTER TABLE "payload"."cms_orders_shipments" ADD COLUMN "courier_status" varchar;
  ALTER TABLE "payload"."cms_orders_shipments" ADD COLUMN "last_tracked_at" timestamp(3) with time zone;
  ALTER TABLE "payload"."cms_orders_shipments" ADD COLUMN "label_url" varchar;
  ALTER TABLE "payload"."cms_orders_shipments" ADD COLUMN "courier_ref" varchar;
  ALTER TABLE "payload"."cms_orders_shipments" ADD COLUMN "cod_amount" numeric;
  ALTER TABLE "payload"."cms_orders_shipments" ADD COLUMN "cod_status" "payload"."enum_cms_orders_shipments_cod_status";
  ALTER TABLE "payload"."cms_orders_shipments" ADD COLUMN "cod_remitted_at" timestamp(3) with time zone;
  ALTER TABLE "payload"."cms_orders_shipments" ADD COLUMN "cod_remittance_ref" varchar;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_api_keys_id" integer;
  ALTER TABLE "payload"."cms_api_keys_scopes" ADD CONSTRAINT "cms_api_keys_scopes_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_api_keys" ADD CONSTRAINT "cms_api_keys_store_id_cms_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "payload"."cms_stores"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "cms_api_keys_scopes_order_idx" ON "payload"."cms_api_keys_scopes" USING btree ("order");
  CREATE INDEX "cms_api_keys_scopes_parent_idx" ON "payload"."cms_api_keys_scopes" USING btree ("parent_id");
  CREATE INDEX "cms_api_keys_store_idx" ON "payload"."cms_api_keys" USING btree ("store_id");
  CREATE UNIQUE INDEX "cms_api_keys_hash_idx" ON "payload"."cms_api_keys" USING btree ("hash");
  CREATE INDEX "cms_api_keys_updated_at_idx" ON "payload"."cms_api_keys" USING btree ("updated_at");
  CREATE INDEX "cms_api_keys_created_at_idx" ON "payload"."cms_api_keys" USING btree ("created_at");
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_api_keys_fk" FOREIGN KEY ("cms_api_keys_id") REFERENCES "payload"."cms_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_cms_api_keys_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_api_keys_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_api_keys_scopes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_api_keys" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."cms_api_keys_scopes" CASCADE;
  DROP TABLE "payload"."cms_api_keys" CASCADE;
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_api_keys_fk";
  
  ALTER TABLE "payload"."cms_orders_shipments" ALTER COLUMN "status" SET DATA TYPE text;
  -- "returned" did not exist before: closest older value
  UPDATE "payload"."cms_orders_shipments" SET "status" = 'cancelled' WHERE "status" = 'returned';
  ALTER TABLE "payload"."cms_orders_shipments" ALTER COLUMN "status" SET DEFAULT 'shipped'::text;
  DROP TYPE "payload"."enum_cms_orders_shipments_status";
  CREATE TYPE "payload"."enum_cms_orders_shipments_status" AS ENUM('shipped', 'delivered', 'cancelled');
  ALTER TABLE "payload"."cms_orders_shipments" ALTER COLUMN "status" SET DEFAULT 'shipped'::"payload"."enum_cms_orders_shipments_status";
  ALTER TABLE "payload"."cms_orders_shipments" ALTER COLUMN "status" SET DATA TYPE "payload"."enum_cms_orders_shipments_status" USING "status"::"payload"."enum_cms_orders_shipments_status";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_api_keys_id_idx";
  ALTER TABLE "payload"."cms_orders_shipments" DROP COLUMN "provider";
  ALTER TABLE "payload"."cms_orders_shipments" DROP COLUMN "courier_status";
  ALTER TABLE "payload"."cms_orders_shipments" DROP COLUMN "last_tracked_at";
  ALTER TABLE "payload"."cms_orders_shipments" DROP COLUMN "label_url";
  ALTER TABLE "payload"."cms_orders_shipments" DROP COLUMN "courier_ref";
  ALTER TABLE "payload"."cms_orders_shipments" DROP COLUMN "cod_amount";
  ALTER TABLE "payload"."cms_orders_shipments" DROP COLUMN "cod_status";
  ALTER TABLE "payload"."cms_orders_shipments" DROP COLUMN "cod_remitted_at";
  ALTER TABLE "payload"."cms_orders_shipments" DROP COLUMN "cod_remittance_ref";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_api_keys_id";
  DROP TYPE IF EXISTS "payload"."enum_cms_orders_shipments_cod_status";
  DROP TYPE IF EXISTS "payload"."enum_cms_api_keys_scopes";`)
}
