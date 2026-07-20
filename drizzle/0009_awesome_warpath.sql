CREATE TABLE "reservation_settings" (
	"restaurant_id" uuid PRIMARY KEY NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"duration_minutes" integer DEFAULT 90 NOT NULL,
	"slot_interval_minutes" integer DEFAULT 30 NOT NULL,
	"minimum_advance_minutes" integer DEFAULT 120 NOT NULL,
	"maximum_advance_days" integer DEFAULT 30 NOT NULL,
	"maximum_party_size" integer DEFAULT 8 NOT NULL,
	"slot_capacity" integer DEFAULT 20 NOT NULL,
	"large_group_phone" varchar(40),
	"customer_message" text DEFAULT '' NOT NULL,
	"policy_text" text DEFAULT '' NOT NULL,
	"initial_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservation_settings_duration_check" CHECK ("reservation_settings"."duration_minutes" between 15 and 480),
	CONSTRAINT "reservation_settings_interval_check" CHECK ("reservation_settings"."slot_interval_minutes" in (15, 30, 60)),
	CONSTRAINT "reservation_settings_minimum_advance_check" CHECK ("reservation_settings"."minimum_advance_minutes" between 0 and 43200),
	CONSTRAINT "reservation_settings_maximum_advance_check" CHECK ("reservation_settings"."maximum_advance_days" between 1 and 365),
	CONSTRAINT "reservation_settings_party_size_check" CHECK ("reservation_settings"."maximum_party_size" between 1 and 100),
	CONSTRAINT "reservation_settings_capacity_check" CHECK ("reservation_settings"."slot_capacity" between 1 and 1000),
	CONSTRAINT "reservation_settings_initial_status_check" CHECK ("reservation_settings"."initial_status" in ('pending', 'confirmed'))
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"locator" varchar(12) NOT NULL,
	"reservation_date" date NOT NULL,
	"reservation_time" time NOT NULL,
	"party_size" smallint NOT NULL,
	"guest_name" varchar(160) NOT NULL,
	"guest_phone" varchar(40) NOT NULL,
	"guest_email" varchar(254),
	"customer_notes" varchar(1000),
	"internal_notes" varchar(1000),
	"status" varchar(20) NOT NULL,
	"origin" varchar(20) NOT NULL,
	"locale" varchar(10) NOT NULL,
	"idempotency_key" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservations_party_size_check" CHECK ("reservations"."party_size" > 0),
	CONSTRAINT "reservations_status_check" CHECK ("reservations"."status" in ('pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show')),
	CONSTRAINT "reservations_origin_check" CHECK ("reservations"."origin" in ('online', 'manual')),
	CONSTRAINT "reservations_locale_lowercase_check" CHECK ("reservations"."locale" = lower("reservations"."locale"))
);
--> statement-breakpoint
ALTER TABLE "reservation_settings" ADD CONSTRAINT "reservation_settings_restaurant_id_restaurant_settings_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurant_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_restaurant_id_restaurant_settings_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurant_settings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reservations_locator_uidx" ON "reservations" USING btree ("locator");--> statement-breakpoint
CREATE UNIQUE INDEX "reservations_idempotency_uidx" ON "reservations" USING btree ("restaurant_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "reservations_restaurant_date_idx" ON "reservations" USING btree ("restaurant_id","reservation_date");--> statement-breakpoint
CREATE INDEX "reservations_restaurant_date_time_idx" ON "reservations" USING btree ("restaurant_id","reservation_date","reservation_time");--> statement-breakpoint
CREATE INDEX "reservations_restaurant_status_date_idx" ON "reservations" USING btree ("restaurant_id","status","reservation_date");--> statement-breakpoint
CREATE INDEX "reservations_restaurant_guest_name_idx" ON "reservations" USING btree ("restaurant_id","guest_name");--> statement-breakpoint
CREATE INDEX "reservations_restaurant_phone_idx" ON "reservations" USING btree ("restaurant_id","guest_phone");