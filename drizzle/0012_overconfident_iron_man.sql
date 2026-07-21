CREATE TABLE "customer_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"label" varchar(80) DEFAULT '' NOT NULL,
	"line1" varchar(200) NOT NULL,
	"line2" varchar(200),
	"city" varchar(120) DEFAULT '' NOT NULL,
	"postal_code" varchar(20) DEFAULT '' NOT NULL,
	"province" varchar(120) DEFAULT '' NOT NULL,
	"country_code" varchar(2) DEFAULT 'ES' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_addresses_country_check" CHECK ("customer_addresses"."country_code" = upper("customer_addresses"."country_code"))
);
--> statement-breakpoint
CREATE TABLE "customer_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"admin_id" uuid,
	"body" varchar(2000) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(160) DEFAULT '' NOT NULL,
	"phone" varchar(40) NOT NULL,
	"email" varchar(254),
	"birth_date" date,
	"preferred_locale" varchar(10) NOT NULL,
	"observations" varchar(2000),
	"important_allergies" varchar(1000),
	"is_active" boolean DEFAULT true NOT NULL,
	"last_visit_at" timestamp with time zone,
	"total_spend_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_spend_check" CHECK ("customers"."total_spend_cents" >= 0),
	CONSTRAINT "customers_locale_lowercase_check" CHECK ("customers"."preferred_locale" = lower("customers"."preferred_locale"))
);
--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_restaurant_id_restaurant_settings_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurant_settings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
INSERT INTO "customers" (
	"restaurant_id", "first_name", "last_name", "phone", "email",
	"preferred_locale", "is_active", "created_at", "updated_at"
)
SELECT DISTINCT ON ("restaurant_id", "guest_phone")
	"restaurant_id",
	left("guest_name", 100),
	'',
	"guest_phone",
	NULL,
	"locale",
	true,
	"created_at",
	"updated_at"
FROM "reservations"
ORDER BY "restaurant_id", "guest_phone", "created_at" DESC;--> statement-breakpoint
UPDATE "reservations"
SET "customer_id" = "customers"."id"
FROM "customers"
WHERE "reservations"."restaurant_id" = "customers"."restaurant_id"
	AND "reservations"."guest_phone" = "customers"."phone";--> statement-breakpoint
CREATE INDEX "customer_addresses_customer_idx" ON "customer_addresses" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customer_notes_customer_created_idx" ON "customer_notes" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_restaurant_phone_uidx" ON "customers" USING btree ("restaurant_id","phone");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_restaurant_email_uidx" ON "customers" USING btree ("restaurant_id",lower("email")) WHERE "customers"."email" is not null;--> statement-breakpoint
CREATE INDEX "customers_restaurant_name_idx" ON "customers" USING btree ("restaurant_id","first_name","last_name");--> statement-breakpoint
CREATE INDEX "customers_restaurant_updated_idx" ON "customers" USING btree ("restaurant_id","updated_at");--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reservations_customer_date_idx" ON "reservations" USING btree ("customer_id","reservation_date");