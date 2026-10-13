import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_redirects" ADD COLUMN "legacy_id" varchar;
  CREATE UNIQUE INDEX "cms_redirects_legacy_id_idx" ON "payload"."cms_redirects" USING btree ("legacy_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "payload"."cms_redirects_legacy_id_idx";
  ALTER TABLE "payload"."cms_redirects" DROP COLUMN "legacy_id";`)
}
