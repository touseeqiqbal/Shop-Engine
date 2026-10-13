import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_cms_shipping_zones_cities" AS ENUM('Abbottabad', 'Ahmadpur East', 'Alipur', 'Arifwala', 'Attock', 'Awaran', 'Badin', 'Bagh', 'Bahawalnagar', 'Bahawalpur', 'Bannu', 'Barkhan', 'Batagram', 'Battagram', 'Bhakkar', 'Bhalwal', 'Bhimber', 'Burewala', 'Chakwal', 'Chaman', 'Charsadda', 'Chichawatni', 'Chiniot', 'Chishtian', 'Chitral', 'Dadu', 'Daska', 'Dera Ghazi Khan', 'Dera Ismail Khan', 'Dera Murad Jamali', 'Dina', 'Dipalpur', 'Faisalabad', 'Fateh Jang', 'Gadoon', 'Gawadar', 'Ghotki', 'Gilgit', 'Gojra', 'Gujar Khan', 'Gujranwala', 'Gujrat', 'Hafizabad', 'Hala', 'Hangu', 'Haripur', 'Haroonabad', 'Hasilpur', 'Hassan Abdal', 'Hub', 'Hunza', 'Hyderabad', 'Islamabad', 'Jacobabad', 'Jalalpur Jattan', 'Jampur', 'Jamshoro', 'Jaranwala', 'Jhang', 'Jhelum', 'Kabirwala', 'Kahror Pakka', 'Kamalia', 'Kamoke', 'Kandhkot', 'Karachi', 'Kasur', 'Khairpur', 'Khanewal', 'Khanpur', 'Kharian', 'Khushab', 'Khuzdar', 'Kohat', 'Kot Addu', 'Kotli', 'Kotri', 'Lahore', 'Lakki Marwat', 'Lalamusa', 'Larkana', 'Layyah', 'Lodhran', 'Loralai', 'Malakand', 'Mandi Bahauddin', 'Mansehra', 'Mardan', 'Matiari', 'Mian Channu', 'Mianwali', 'Mingora', 'Mirpur (AJK)', 'Mirpur Khas', 'Mirpur Mathelo', 'Moro', 'Multan', 'Muridke', 'Murree', 'Muzaffarabad', 'Muzaffargarh', 'Narowal', 'Naushahro Feroze', 'Nawabshah', 'Nowshera', 'Okara', 'Other (mention in address)', 'Pakpattan', 'Pasrur', 'Pattoki', 'Peshawar', 'Pind Dadan Khan', 'Pindi Bhattian', 'Pishin', 'Quetta', 'Rahim Yar Khan', 'Rajanpur', 'Rawalakot', 'Rawalpindi', 'Renala Khurd', 'Sadiqabad', 'Sahiwal', 'Samundri', 'Sanghar', 'Sangla Hill', 'Sargodha', 'Shahdadkot', 'Shahdadpur', 'Sheikhupura', 'Shikarpur', 'Shujabad', 'Sialkot', 'Sibi', 'Skardu', 'Sukkur', 'Swabi', 'Swat', 'Talagang', 'Tando Adam', 'Tando Allahyar', 'Tando Muhammad Khan', 'Taxila', 'Thatta', 'Timergara', 'Toba Tek Singh', 'Turbat', 'Umerkot', 'Vehari', 'Wah Cantt', 'Wazirabad', 'Zhob', 'Ziarat');
  CREATE TABLE "payload"."cms_shipping_zones_cities" (
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"value" "payload"."enum_cms_shipping_zones_cities",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "payload"."cms_shipping_zones" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"rest" boolean,
  	"charge" numeric NOT NULL,
  	"free_above" numeric,
  	"estimate" varchar
  );
  
  CREATE TABLE "payload"."cms_shipping" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"free_delivery_threshold" numeric DEFAULT 15000,
  	"default_charge" numeric DEFAULT 350,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload"."cms_payments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"cod_enabled" boolean DEFAULT true,
  	"cod_note" varchar,
  	"cod_fee" numeric DEFAULT 0,
  	"cod_max_order" numeric,
  	"cod_advance_threshold" numeric DEFAULT 100000,
  	"cod_advance_amount" numeric DEFAULT 5000,
  	"jazzcash_enabled" boolean DEFAULT true,
  	"jazzcash_note" varchar,
  	"jazzcash_title" varchar DEFAULT 'Urko Tech Store',
  	"jazzcash_number" varchar DEFAULT '0342-6693115',
  	"easypaisa_enabled" boolean DEFAULT true,
  	"easypaisa_note" varchar,
  	"easypaisa_title" varchar DEFAULT 'Urko Tech Store',
  	"easypaisa_number" varchar DEFAULT '0343-5867409',
  	"bank_enabled" boolean DEFAULT true,
  	"bank_note" varchar,
  	"bank_bank_name" varchar DEFAULT 'Meezan Bank',
  	"bank_account_title" varchar DEFAULT 'Urko Tech Store',
  	"bank_account_number" varchar,
  	"bank_iban" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "payload"."cms_shipping_zones_cities" ADD CONSTRAINT "cms_shipping_zones_cities_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_shipping_zones"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_shipping_zones" ADD CONSTRAINT "cms_shipping_zones_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_shipping"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "cms_shipping_zones_cities_order_idx" ON "payload"."cms_shipping_zones_cities" USING btree ("order");
  CREATE INDEX "cms_shipping_zones_cities_parent_idx" ON "payload"."cms_shipping_zones_cities" USING btree ("parent_id");
  CREATE INDEX "cms_shipping_zones_order_idx" ON "payload"."cms_shipping_zones" USING btree ("_order");
  CREATE INDEX "cms_shipping_zones_parent_id_idx" ON "payload"."cms_shipping_zones" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "payload"."cms_shipping_zones_cities" CASCADE;
  DROP TABLE "payload"."cms_shipping_zones" CASCADE;
  DROP TABLE "payload"."cms_shipping" CASCADE;
  DROP TABLE "payload"."cms_payments" CASCADE;
  DROP TYPE "payload"."enum_cms_shipping_zones_cities";`)
}
