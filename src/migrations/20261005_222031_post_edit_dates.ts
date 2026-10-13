import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_posts" ADD COLUMN "last_edited" timestamp(3) with time zone;
  ALTER TABLE "payload"."cms_posts" ADD COLUMN "edited_in_cms" boolean;
  ALTER TABLE "payload"."_cms_posts_v" ADD COLUMN "version_last_edited" timestamp(3) with time zone;
  ALTER TABLE "payload"."_cms_posts_v" ADD COLUMN "version_edited_in_cms" boolean;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_posts" DROP COLUMN "last_edited";
  ALTER TABLE "payload"."cms_posts" DROP COLUMN "edited_in_cms";
  ALTER TABLE "payload"."_cms_posts_v" DROP COLUMN "version_last_edited";
  ALTER TABLE "payload"."_cms_posts_v" DROP COLUMN "version_edited_in_cms";`)
}
