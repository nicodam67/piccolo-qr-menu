CREATE TABLE "special_opening_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"date" date NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"reason" varchar(240),
	"first_open_time" time,
	"first_close_time" time,
	"second_open_time" time,
	"second_close_time" time,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "special_opening_hours_first_period_check" CHECK ("special_opening_hours"."is_closed" or ("special_opening_hours"."first_open_time" is not null and "special_opening_hours"."first_close_time" is not null)),
	CONSTRAINT "special_opening_hours_second_period_check" CHECK (("special_opening_hours"."second_open_time" is null and "special_opening_hours"."second_close_time" is null) or ("special_opening_hours"."second_open_time" is not null and "special_opening_hours"."second_close_time" is not null)),
	CONSTRAINT "special_opening_hours_closed_has_no_periods" CHECK (not "special_opening_hours"."is_closed" or ("special_opening_hours"."first_open_time" is null and "special_opening_hours"."first_close_time" is null and "special_opening_hours"."second_open_time" is null and "special_opening_hours"."second_close_time" is null))
);
--> statement-breakpoint
ALTER TABLE "special_opening_hours" ADD CONSTRAINT "special_opening_hours_restaurant_id_restaurant_settings_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurant_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "special_opening_hours_restaurant_date_uidx" ON "special_opening_hours" USING btree ("restaurant_id","date");--> statement-breakpoint
CREATE INDEX "special_opening_hours_date_idx" ON "special_opening_hours" USING btree ("restaurant_id","date");