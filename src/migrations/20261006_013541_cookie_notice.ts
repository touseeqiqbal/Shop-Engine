import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "payload"."cms_cookie_notice" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"message" varchar DEFAULT 'We use cookies to keep your cart and sign-in working. With your OK we also measure visits (Google Analytics) and ads (Meta) to improve the shop.',
  	"accept_label" varchar DEFAULT 'Accept',
  	"reject_label" varchar DEFAULT 'Only necessary',
  	"policy_link" varchar DEFAULT '/privacy-policy',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "payload"."cms_cookie_notice" CASCADE;`)
}
