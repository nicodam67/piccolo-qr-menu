CREATE TABLE "allergen_translations" (
	"allergen_id" uuid NOT NULL,
	"locale" varchar(10) NOT NULL,
	"name" varchar(120) NOT NULL,
	CONSTRAINT "allergen_translations_allergen_id_locale_pk" PRIMARY KEY("allergen_id","locale")
);
--> statement-breakpoint
CREATE TABLE "allergens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"icon" varchar(100) NOT NULL,
	CONSTRAINT "allergens_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_sort_order_check" CHECK ("categories"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "category_translations" (
	"category_id" uuid NOT NULL,
	"locale" varchar(10) NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text NOT NULL,
	CONSTRAINT "category_translations_category_id_locale_pk" PRIMARY KEY("category_id","locale")
);
--> statement-breakpoint
CREATE TABLE "opening_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"day_of_week" smallint NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"first_opens_at" time,
	"first_closes_at" time,
	"second_opens_at" time,
	"second_closes_at" time,
	CONSTRAINT "opening_hours_day_check" CHECK ("opening_hours"."day_of_week" between 1 and 7),
	CONSTRAINT "opening_hours_first_period_check" CHECK ("opening_hours"."is_closed" or ("opening_hours"."first_opens_at" is not null and "opening_hours"."first_closes_at" is not null)),
	CONSTRAINT "opening_hours_second_period_check" CHECK (("opening_hours"."second_opens_at" is null and "opening_hours"."second_closes_at" is null) or ("opening_hours"."second_opens_at" is not null and "opening_hours"."second_closes_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "product_allergens" (
	"product_id" uuid NOT NULL,
	"allergen_id" uuid NOT NULL,
	CONSTRAINT "product_allergens_product_id_allergen_id_pk" PRIMARY KEY("product_id","allergen_id")
);
--> statement-breakpoint
CREATE TABLE "product_tags" (
	"product_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "product_tags_product_id_tag_id_pk" PRIMARY KEY("product_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "product_translations" (
	"product_id" uuid NOT NULL,
	"locale" varchar(10) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text NOT NULL,
	CONSTRAINT "product_translations_product_id_locale_pk" PRIMARY KEY("product_id","locale")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"full_price_cents" integer NOT NULL,
	"half_price_cents" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_sold_out" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"image_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_full_price_check" CHECK ("products"."full_price_cents" >= 0),
	CONSTRAINT "products_half_price_check" CHECK ("products"."half_price_cents" is null or "products"."half_price_cents" >= 0),
	CONSTRAINT "products_sort_order_check" CHECK ("products"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "restaurant_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(40) NOT NULL,
	"address" text NOT NULL,
	"timezone" varchar(64) DEFAULT 'Europe/Madrid' NOT NULL,
	"currency_code" varchar(3) DEFAULT 'EUR' NOT NULL,
	"default_locale" varchar(10) DEFAULT 'es' NOT NULL,
	"hero_image_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurant_translations" (
	"restaurant_id" uuid NOT NULL,
	"locale" varchar(10) NOT NULL,
	"name" varchar(160) NOT NULL,
	"slogan" varchar(240) NOT NULL,
	"description" text NOT NULL,
	CONSTRAINT "restaurant_translations_restaurant_id_locale_pk" PRIMARY KEY("restaurant_id","locale")
);
--> statement-breakpoint
CREATE TABLE "tag_translations" (
	"tag_id" uuid NOT NULL,
	"locale" varchar(10) NOT NULL,
	"name" varchar(120) NOT NULL,
	CONSTRAINT "tag_translations_tag_id_locale_pk" PRIMARY KEY("tag_id","locale")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"color" varchar(30) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "allergen_translations" ADD CONSTRAINT "allergen_translations_allergen_id_allergens_id_fk" FOREIGN KEY ("allergen_id") REFERENCES "public"."allergens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_translations" ADD CONSTRAINT "category_translations_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opening_hours" ADD CONSTRAINT "opening_hours_restaurant_id_restaurant_settings_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurant_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_allergens" ADD CONSTRAINT "product_allergens_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_allergens" ADD CONSTRAINT "product_allergens_allergen_id_allergens_id_fk" FOREIGN KEY ("allergen_id") REFERENCES "public"."allergens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_tags" ADD CONSTRAINT "product_tags_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_tags" ADD CONSTRAINT "product_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_translations" ADD CONSTRAINT "product_translations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_translations" ADD CONSTRAINT "restaurant_translations_restaurant_id_restaurant_settings_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurant_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_translations" ADD CONSTRAINT "tag_translations_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "allergen_translations_locale_idx" ON "allergen_translations" USING btree ("locale");--> statement-breakpoint
CREATE INDEX "categories_active_order_idx" ON "categories" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE INDEX "category_translations_locale_idx" ON "category_translations" USING btree ("locale");--> statement-breakpoint
CREATE UNIQUE INDEX "opening_hours_restaurant_day_uidx" ON "opening_hours" USING btree ("restaurant_id","day_of_week");--> statement-breakpoint
CREATE INDEX "product_allergens_allergen_idx" ON "product_allergens" USING btree ("allergen_id");--> statement-breakpoint
CREATE INDEX "product_tags_tag_idx" ON "product_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "product_translations_locale_idx" ON "product_translations" USING btree ("locale");--> statement-breakpoint
CREATE INDEX "products_category_active_order_idx" ON "products" USING btree ("category_id","is_active","sort_order");--> statement-breakpoint
CREATE INDEX "restaurant_translations_locale_idx" ON "restaurant_translations" USING btree ("locale");--> statement-breakpoint
CREATE INDEX "tag_translations_locale_idx" ON "tag_translations" USING btree ("locale");