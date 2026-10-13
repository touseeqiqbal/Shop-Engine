import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "payload"."enum_cms_seo_settings_pages_page" ADD VALUE '/returns' BEFORE '/compare';
  ALTER TYPE "payload"."enum_cms_seo_settings_pages_page" ADD VALUE '/sell-your-laptop' BEFORE '/compare';
  ALTER TABLE "payload"."cms_pb_installment" ALTER COLUMN "eyebrow" SET DEFAULT 'Easy payments';
  ALTER TABLE "payload"."cms_pb_testimonials" ALTER COLUMN "eyebrow" SET DEFAULT 'Customer reviews';
  ALTER TABLE "payload"."cms_pb_testimonials" ALTER COLUMN "title" SET DEFAULT 'What our customers say';
  ALTER TABLE "payload"."_cms_pb_installment_v" ALTER COLUMN "eyebrow" SET DEFAULT 'Easy payments';
  ALTER TABLE "payload"."_cms_pb_testimonials_v" ALTER COLUMN "eyebrow" SET DEFAULT 'Customer reviews';
  ALTER TABLE "payload"."_cms_pb_testimonials_v" ALTER COLUMN "title" SET DEFAULT 'What our customers say';
  ALTER TABLE "payload"."cms_users" ADD COLUMN "sessions_valid_after" timestamp(3) with time zone;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_seo_settings_pages" ALTER COLUMN "page" SET DATA TYPE text;
  DROP TYPE "payload"."enum_cms_seo_settings_pages_page";
  CREATE TYPE "payload"."enum_cms_seo_settings_pages_page" AS ENUM('/', '/shop', '/category', '/deals', '/find-parts', '/brands', '/wholesale', '/blog', '/about', '/contact', '/faqs', '/track-order', '/shipping-policy', '/warranty-returns', '/privacy-policy', '/terms', '/installments', '/compare', '/cart', '/laptops-in-{city}', '/brands/{brand}');
  ALTER TABLE "payload"."cms_seo_settings_pages" ALTER COLUMN "page" SET DATA TYPE "payload"."enum_cms_seo_settings_pages_page" USING "page"::"payload"."enum_cms_seo_settings_pages_page";
  ALTER TABLE "payload"."cms_pb_installment" ALTER COLUMN "eyebrow" SET DEFAULT 'Coming soon';
  ALTER TABLE "payload"."cms_pb_testimonials" ALTER COLUMN "eyebrow" SET DEFAULT '4.8 ★ average rating';
  ALTER TABLE "payload"."cms_pb_testimonials" ALTER COLUMN "title" SET DEFAULT 'Loved by customers across Pakistan';
  ALTER TABLE "payload"."_cms_pb_installment_v" ALTER COLUMN "eyebrow" SET DEFAULT 'Coming soon';
  ALTER TABLE "payload"."_cms_pb_testimonials_v" ALTER COLUMN "eyebrow" SET DEFAULT '4.8 ★ average rating';
  ALTER TABLE "payload"."_cms_pb_testimonials_v" ALTER COLUMN "title" SET DEFAULT 'Loved by customers across Pakistan';
  ALTER TABLE "payload"."cms_users" DROP COLUMN "sessions_valid_after";`)
}
