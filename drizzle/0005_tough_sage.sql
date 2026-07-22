CREATE TABLE "restaurant_locales" (
	"restaurant_id" uuid NOT NULL,
	"locale" varchar(10) NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "restaurant_locales_restaurant_id_locale_pk" PRIMARY KEY("restaurant_id","locale"),
	CONSTRAINT "restaurant_locales_published_requires_enabled" CHECK (not "restaurant_locales"."is_published" or "restaurant_locales"."is_enabled"),
	CONSTRAINT "restaurant_locales_positive_order" CHECK ("restaurant_locales"."sort_order" >= 1),
	CONSTRAINT "restaurant_locales_lowercase" CHECK ("restaurant_locales"."locale" = lower("restaurant_locales"."locale"))
);
--> statement-breakpoint
ALTER TABLE "restaurant_locales" ADD CONSTRAINT "restaurant_locales_restaurant_id_restaurant_settings_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurant_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "restaurant_locales_order_uidx" ON "restaurant_locales" USING btree ("restaurant_id","sort_order");--> statement-breakpoint
CREATE INDEX "restaurant_locales_public_idx" ON "restaurant_locales" USING btree ("restaurant_id","is_published","sort_order");--> statement-breakpoint
INSERT INTO "restaurant_locales" (
	"restaurant_id",
	"locale",
	"is_enabled",
	"is_published",
	"sort_order"
)
SELECT
	"id",
	lower("default_locale"),
	true,
	true,
	1
FROM "restaurant_settings"
ON CONFLICT ("restaurant_id", "locale") DO NOTHING;--> statement-breakpoint
WITH "additional_locales" AS (
	SELECT
		"rt"."restaurant_id",
		lower("rt"."locale") AS "locale",
		(row_number() OVER (
			PARTITION BY "rt"."restaurant_id"
			ORDER BY lower("rt"."locale")
		) + 1)::integer AS "sort_order"
	FROM "restaurant_translations" AS "rt"
	INNER JOIN "restaurant_settings" AS "rs"
		ON "rs"."id" = "rt"."restaurant_id"
	WHERE lower("rt"."locale") <> lower("rs"."default_locale")
)
INSERT INTO "restaurant_locales" (
	"restaurant_id",
	"locale",
	"is_enabled",
	"is_published",
	"sort_order"
)
SELECT
	"restaurant_id",
	"locale",
	true,
	false,
	"sort_order"
FROM "additional_locales"
ON CONFLICT ("restaurant_id", "locale") DO NOTHING;