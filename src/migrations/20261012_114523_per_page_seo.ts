import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_products" ADD COLUMN "meta_noindex" boolean;
  ALTER TABLE "payload"."cms_products" ADD COLUMN "meta_canonical" varchar;
  ALTER TABLE "payload"."_cms_products_v" ADD COLUMN "version_meta_noindex" boolean;
  ALTER TABLE "payload"."_cms_products_v" ADD COLUMN "version_meta_canonical" varchar;
  ALTER TABLE "payload"."cms_collections" ADD COLUMN "meta_noindex" boolean;
  ALTER TABLE "payload"."cms_collections" ADD COLUMN "meta_canonical" varchar;
  ALTER TABLE "payload"."cms_categories" ADD COLUMN "meta_noindex" boolean;
  ALTER TABLE "payload"."cms_categories" ADD COLUMN "meta_canonical" varchar;
  ALTER TABLE "payload"."cms_posts" ADD COLUMN "meta_noindex" boolean;
  ALTER TABLE "payload"."cms_posts" ADD COLUMN "meta_canonical" varchar;
  ALTER TABLE "payload"."_cms_posts_v" ADD COLUMN "version_meta_noindex" boolean;
  ALTER TABLE "payload"."_cms_posts_v" ADD COLUMN "version_meta_canonical" varchar;
  ALTER TABLE "payload"."cms_pages" ADD COLUMN "meta_noindex" boolean;
  ALTER TABLE "payload"."cms_pages" ADD COLUMN "meta_canonical" varchar;
  ALTER TABLE "payload"."_cms_pages_v" ADD COLUMN "version_meta_noindex" boolean;
  ALTER TABLE "payload"."_cms_pages_v" ADD COLUMN "version_meta_canonical" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_products" DROP COLUMN "meta_noindex";
  ALTER TABLE "payload"."cms_products" DROP COLUMN "meta_canonical";
  ALTER TABLE "payload"."_cms_products_v" DROP COLUMN "version_meta_noindex";
  ALTER TABLE "payload"."_cms_products_v" DROP COLUMN "version_meta_canonical";
  ALTER TABLE "payload"."cms_collections" DROP COLUMN "meta_noindex";
  ALTER TABLE "payload"."cms_collections" DROP COLUMN "meta_canonical";
  ALTER TABLE "payload"."cms_categories" DROP COLUMN "meta_noindex";
  ALTER TABLE "payload"."cms_categories" DROP COLUMN "meta_canonical";
  ALTER TABLE "payload"."cms_posts" DROP COLUMN "meta_noindex";
  ALTER TABLE "payload"."cms_posts" DROP COLUMN "meta_canonical";
  ALTER TABLE "payload"."_cms_posts_v" DROP COLUMN "version_meta_noindex";
  ALTER TABLE "payload"."_cms_posts_v" DROP COLUMN "version_meta_canonical";
  ALTER TABLE "payload"."cms_pages" DROP COLUMN "meta_noindex";
  ALTER TABLE "payload"."cms_pages" DROP COLUMN "meta_canonical";
  ALTER TABLE "payload"."_cms_pages_v" DROP COLUMN "version_meta_noindex";
  ALTER TABLE "payload"."_cms_pages_v" DROP COLUMN "version_meta_canonical";`)
}
