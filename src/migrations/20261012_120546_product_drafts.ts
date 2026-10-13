import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Product drafts (Save draft / autosave / scheduled publishing / preview).
 *
 * Hand-written: the generated SQL dropped the product status type, because Payload's draft marker (_status) wants the
 * type name "enum_cms_products_status" that the product's own Status field (Draft / On store / Hidden) used.
 * Here the existing types are RENAMED (no data change, nothing dropped) and every existing product stays published.
 *
 * allow-destructive: renames two enum TYPES only (values and data unchanged) to free the names Payload needs.
 */
// allow-destructive: renames two enum types only (values and data unchanged) – see the comment above
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  -- 1. the product's own Status keeps its values (draft / active / archived) under its own type name
  ALTER TYPE "payload"."enum_cms_products_status" RENAME TO "enum_cms_products_visibility";
  ALTER TYPE "payload"."enum__cms_products_v_version_status" RENAME TO "enum__cms_products_v_version_visibility_old";
  ALTER TABLE "payload"."_cms_products_v" ALTER COLUMN "version_status" DROP DEFAULT;
  ALTER TABLE "payload"."_cms_products_v" ALTER COLUMN "version_status" SET DATA TYPE "payload"."enum_cms_products_visibility" USING "version_status"::text::"payload"."enum_cms_products_visibility";
  ALTER TABLE "payload"."_cms_products_v" ALTER COLUMN "version_status" SET DEFAULT 'draft';

  -- 2. Payload's draft / published marker
  CREATE TYPE "payload"."enum_cms_products_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum__cms_products_v_version_status" AS ENUM('draft', 'published');
  ALTER TABLE "payload"."cms_products" ADD COLUMN "_status" "payload"."enum_cms_products_status" DEFAULT 'draft';
  ALTER TABLE "payload"."_cms_products_v" ADD COLUMN "version__status" "payload"."enum__cms_products_v_version_status" DEFAULT 'draft';
  ALTER TABLE "payload"."_cms_products_v" ADD COLUMN "latest" boolean;
  ALTER TABLE "payload"."_cms_products_v" ADD COLUMN "autosave" boolean;

  -- 3. every existing product (and its history) stays exactly as live as it is now
  UPDATE "payload"."cms_products" SET "_status" = 'published';
  UPDATE "payload"."_cms_products_v" SET "version__status" = 'published';
  UPDATE "payload"."_cms_products_v" SET "latest" = true
    WHERE "id" IN (SELECT DISTINCT ON ("parent_id") "id" FROM "payload"."_cms_products_v" ORDER BY "parent_id", "updated_at" DESC, "id" DESC);

  -- 4. a draft may be unfinished: these columns accept empty values (publishing still requires them)
  ALTER TABLE "payload"."cms_products_specs" ALTER COLUMN "label" DROP NOT NULL;
  ALTER TABLE "payload"."cms_products_specs" ALTER COLUMN "value" DROP NOT NULL;
  ALTER TABLE "payload"."cms_products_upgrades" ALTER COLUMN "group" DROP NOT NULL;
  ALTER TABLE "payload"."cms_products_upgrades" ALTER COLUMN "label" DROP NOT NULL;
  ALTER TABLE "payload"."cms_products_upgrades" ALTER COLUMN "price" DROP NOT NULL;
  ALTER TABLE "payload"."cms_products" ALTER COLUMN "title" DROP NOT NULL;
  ALTER TABLE "payload"."cms_products" ALTER COLUMN "brand_id" DROP NOT NULL;
  ALTER TABLE "payload"."cms_products" ALTER COLUMN "category_id" DROP NOT NULL;
  ALTER TABLE "payload"."cms_products" ALTER COLUMN "price" DROP NOT NULL;
  ALTER TABLE "payload"."cms_products" ALTER COLUMN "sku" DROP NOT NULL;
  ALTER TABLE "payload"."cms_products" ALTER COLUMN "status" DROP NOT NULL;
  ALTER TABLE "payload"."cms_products" ALTER COLUMN "slug" DROP NOT NULL;
  ALTER TABLE "payload"."_cms_products_v_version_specs" ALTER COLUMN "label" DROP NOT NULL;
  ALTER TABLE "payload"."_cms_products_v_version_specs" ALTER COLUMN "value" DROP NOT NULL;
  ALTER TABLE "payload"."_cms_products_v_version_upgrades" ALTER COLUMN "group" DROP NOT NULL;
  ALTER TABLE "payload"."_cms_products_v_version_upgrades" ALTER COLUMN "label" DROP NOT NULL;
  ALTER TABLE "payload"."_cms_products_v_version_upgrades" ALTER COLUMN "price" DROP NOT NULL;
  ALTER TABLE "payload"."_cms_products_v" ALTER COLUMN "version_title" DROP NOT NULL;
  ALTER TABLE "payload"."_cms_products_v" ALTER COLUMN "version_brand_id" DROP NOT NULL;
  ALTER TABLE "payload"."_cms_products_v" ALTER COLUMN "version_category_id" DROP NOT NULL;
  ALTER TABLE "payload"."_cms_products_v" ALTER COLUMN "version_price" DROP NOT NULL;
  ALTER TABLE "payload"."_cms_products_v" ALTER COLUMN "version_sku" DROP NOT NULL;
  ALTER TABLE "payload"."_cms_products_v" ALTER COLUMN "version_status" DROP NOT NULL;
  ALTER TABLE "payload"."_cms_products_v" ALTER COLUMN "version_slug" DROP NOT NULL;

  CREATE INDEX "cms_products__status_idx" ON "payload"."cms_products" USING btree ("_status");
  CREATE INDEX "_cms_products_v_version_version__status_idx" ON "payload"."_cms_products_v" USING btree ("version__status");
  CREATE INDEX "_cms_products_v_latest_idx" ON "payload"."_cms_products_v" USING btree ("latest");
  CREATE INDEX "_cms_products_v_autosave_idx" ON "payload"."_cms_products_v" USING btree ("autosave");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP INDEX IF EXISTS "payload"."cms_products__status_idx";
  DROP INDEX IF EXISTS "payload"."_cms_products_v_version_version__status_idx";
  DROP INDEX IF EXISTS "payload"."_cms_products_v_latest_idx";
  DROP INDEX IF EXISTS "payload"."_cms_products_v_autosave_idx";
  ALTER TABLE "payload"."cms_products" DROP COLUMN "_status";
  ALTER TABLE "payload"."_cms_products_v" DROP COLUMN "version__status";
  ALTER TABLE "payload"."_cms_products_v" DROP COLUMN "latest";
  ALTER TABLE "payload"."_cms_products_v" DROP COLUMN "autosave";
  DROP TYPE "payload"."enum_cms_products_status";
  DROP TYPE "payload"."enum__cms_products_v_version_status";
  ALTER TABLE "payload"."_cms_products_v" ALTER COLUMN "version_status" DROP DEFAULT;
  ALTER TABLE "payload"."_cms_products_v" ALTER COLUMN "version_status" SET DATA TYPE "payload"."enum__cms_products_v_version_visibility_old" USING "version_status"::text::"payload"."enum__cms_products_v_version_visibility_old";
  ALTER TABLE "payload"."_cms_products_v" ALTER COLUMN "version_status" SET DEFAULT 'draft';
  ALTER TYPE "payload"."enum__cms_products_v_version_visibility_old" RENAME TO "enum__cms_products_v_version_status";
  ALTER TYPE "payload"."enum_cms_products_visibility" RENAME TO "enum_cms_products_status";`)
}
