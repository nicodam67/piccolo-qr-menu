CREATE TABLE "reservation_economic_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"reservation_id" uuid NOT NULL,
	"payment_id" uuid,
	"event_type" varchar(50) NOT NULL,
	"amount_cents" integer,
	"reason" varchar(500),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservation_events_amount_check" CHECK ("reservation_economic_events"."amount_cents" is null or "reservation_economic_events"."amount_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "reservation_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"reservation_id" uuid NOT NULL,
	"method" varchar(20) NOT NULL,
	"provider" varchar(40) NOT NULL,
	"external_id" varchar(160),
	"expected_amount_cents" integer NOT NULL,
	"paid_amount_cents" integer DEFAULT 0 NOT NULL,
	"refunded_amount_cents" integer DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) NOT NULL,
	"status" varchar(30) NOT NULL,
	"expires_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"idempotency_key" varchar(64) NOT NULL,
	"note" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservation_payments_method_check" CHECK ("reservation_payments"."method" in ('card', 'bizum', 'cash')),
	CONSTRAINT "reservation_payments_status_check" CHECK ("reservation_payments"."status" in ('pending', 'processing', 'paid', 'failed', 'expired', 'refunded', 'partially_refunded', 'exempt')),
	CONSTRAINT "reservation_payments_amount_check" CHECK ("reservation_payments"."expected_amount_cents" >= 0 and "reservation_payments"."paid_amount_cents" >= 0 and "reservation_payments"."refunded_amount_cents" >= 0 and "reservation_payments"."refunded_amount_cents" <= "reservation_payments"."paid_amount_cents")
);
--> statement-breakpoint
ALTER TABLE "reservation_settings" ADD COLUMN "deposit_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reservation_settings" ADD COLUMN "deposit_per_guest_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reservation_settings" ADD COLUMN "deposit_minimum_party_size" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "reservation_settings" ADD COLUMN "grace_period_minutes" integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "reservation_settings" ADD COLUMN "payment_timeout_minutes" integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "reservation_settings" ADD COLUMN "refund_deadline_hours" integer DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE "reservation_settings" ADD COLUMN "allow_full_refund" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "reservation_settings" ADD COLUMN "allow_partial_refund" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reservation_settings" ADD COLUMN "cancellation_policy" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "reservation_settings" ADD COLUMN "no_show_policy" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "reservation_settings" ADD COLUMN "grace_policy" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "reservation_settings" ADD COLUMN "policy_version" varchar(40) DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "reservation_settings" ADD COLUMN "card_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reservation_settings" ADD COLUMN "bizum_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reservation_settings" ADD COLUMN "cash_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "reservation_settings" ADD COLUMN "manual_deposit_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reservation_settings" ADD COLUMN "confirm_only_after_payment" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "deposit_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "deposit_total_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "economic_status" varchar(30) DEFAULT 'exempt' NOT NULL;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "grace_deadline_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "arrived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "no_show_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "tpv_application_status" varchar(30) DEFAULT 'not_ready' NOT NULL;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "applied_to_tpv_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "remaining_deposit_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "accepted_policy_version" varchar(40);--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "policy_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reservation_economic_events" ADD CONSTRAINT "reservation_economic_events_restaurant_id_restaurant_settings_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurant_settings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_economic_events" ADD CONSTRAINT "reservation_economic_events_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_economic_events" ADD CONSTRAINT "reservation_economic_events_payment_id_reservation_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."reservation_payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_payments" ADD CONSTRAINT "reservation_payments_restaurant_id_restaurant_settings_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurant_settings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_payments" ADD CONSTRAINT "reservation_payments_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reservation_events_reservation_created_idx" ON "reservation_economic_events" USING btree ("reservation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reservation_payments_idempotency_uidx" ON "reservation_payments" USING btree ("restaurant_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "reservation_payments_provider_external_uidx" ON "reservation_payments" USING btree ("provider","external_id");--> statement-breakpoint
CREATE INDEX "reservation_payments_reservation_idx" ON "reservation_payments" USING btree ("reservation_id","created_at");--> statement-breakpoint
CREATE INDEX "reservation_payments_status_expiry_idx" ON "reservation_payments" USING btree ("status","expires_at");--> statement-breakpoint
ALTER TABLE "reservation_settings" ADD CONSTRAINT "reservation_settings_deposit_amount_check" CHECK ("reservation_settings"."deposit_per_guest_cents" >= 0);--> statement-breakpoint
ALTER TABLE "reservation_settings" ADD CONSTRAINT "reservation_settings_deposit_party_check" CHECK ("reservation_settings"."deposit_minimum_party_size" > 0);--> statement-breakpoint
ALTER TABLE "reservation_settings" ADD CONSTRAINT "reservation_settings_grace_check" CHECK ("reservation_settings"."grace_period_minutes" between 0 and 240);--> statement-breakpoint
ALTER TABLE "reservation_settings" ADD CONSTRAINT "reservation_settings_payment_timeout_check" CHECK ("reservation_settings"."payment_timeout_minutes" between 1 and 1440);--> statement-breakpoint
ALTER TABLE "reservation_settings" ADD CONSTRAINT "reservation_settings_refund_deadline_check" CHECK ("reservation_settings"."refund_deadline_hours" >= 0);--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_deposit_total_check" CHECK ("reservations"."deposit_total_cents" >= 0);--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_applied_check" CHECK ("reservations"."applied_to_tpv_cents" >= 0 and "reservations"."applied_to_tpv_cents" <= "reservations"."deposit_total_cents");--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_remaining_check" CHECK ("reservations"."remaining_deposit_cents" >= 0 and "reservations"."remaining_deposit_cents" <= "reservations"."deposit_total_cents");--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_economic_status_check" CHECK ("reservations"."economic_status" in ('pending', 'processing', 'paid', 'failed', 'expired', 'refunded', 'partially_refunded', 'exempt', 'retained'));--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_tpv_status_check" CHECK ("reservations"."tpv_application_status" in ('not_ready', 'available', 'partially_applied', 'applied', 'blocked'));