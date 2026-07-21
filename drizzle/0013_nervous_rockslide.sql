CREATE TABLE "customer_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"consent_type" varchar(40) NOT NULL,
	"status" varchar(20) NOT NULL,
	"origin" varchar(40) NOT NULL,
	"legal_version" varchar(80) NOT NULL,
	"ip_address" varchar(45),
	"user_agent" varchar(500),
	"admin_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_consents_type_check" CHECK ("customer_consents"."consent_type" in ('marketing_email', 'marketing_phone', 'loyalty_program', 'personalization')),
	CONSTRAINT "customer_consents_status_check" CHECK ("customer_consents"."status" in ('granted', 'rejected', 'withdrawn'))
);
--> statement-breakpoint
CREATE TABLE "customer_loyalty_accounts" (
	"customer_id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"total_earned" integer DEFAULT 0 NOT NULL,
	"total_redeemed" integer DEFAULT 0 NOT NULL,
	"total_expired" integer DEFAULT 0 NOT NULL,
	"last_movement_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_accounts_balance_check" CHECK ("customer_loyalty_accounts"."balance" >= 0),
	CONSTRAINT "loyalty_accounts_totals_check" CHECK ("customer_loyalty_accounts"."total_earned" >= 0 and "customer_loyalty_accounts"."total_redeemed" >= 0 and "customer_loyalty_accounts"."total_expired" >= 0)
);
--> statement-breakpoint
CREATE TABLE "customer_loyalty_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"movement_type" varchar(30) NOT NULL,
	"reason" varchar(500) NOT NULL,
	"admin_id" uuid,
	"external_reference" varchar(160),
	"idempotency_key" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_movements_amount_check" CHECK ("customer_loyalty_movements"."amount" <> 0),
	CONSTRAINT "loyalty_movements_type_check" CHECK ("customer_loyalty_movements"."movement_type" in ('manual_credit', 'manual_debit', 'correction', 'redemption', 'expiry', 'tpv_accrual', 'tpv_redemption'))
);
--> statement-breakpoint
CREATE TABLE "customer_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" varchar(1000),
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_tag_assignments" (
	"customer_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_tag_assignments_customer_id_tag_id_pk" PRIMARY KEY("customer_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "customer_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"color" varchar(7) DEFAULT '#64748b' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_tags_order_check" CHECK ("customer_tags"."sort_order" > 0),
	CONSTRAINT "customer_tags_color_check" CHECK ("customer_tags"."color" ~ '^#[0-9A-Fa-f]{6}$')
);
--> statement-breakpoint
CREATE TABLE "loyalty_settings" (
	"restaurant_id" uuid PRIMARY KEY NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"program_name" varchar(120) DEFAULT 'Fidelización' NOT NULL,
	"points_per_euro" integer DEFAULT 1 NOT NULL,
	"points_expire" boolean DEFAULT false NOT NULL,
	"expiry_months" integer,
	"manual_adjustments_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_settings_points_check" CHECK ("loyalty_settings"."points_per_euro" > 0),
	CONSTRAINT "loyalty_settings_expiry_check" CHECK ((not "loyalty_settings"."points_expire" and "loyalty_settings"."expiry_months" is null) or ("loyalty_settings"."points_expire" and "loyalty_settings"."expiry_months" between 1 and 120))
);
--> statement-breakpoint
ALTER TABLE "customer_consents" ADD CONSTRAINT "customer_consents_restaurant_id_restaurant_settings_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurant_settings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_consents" ADD CONSTRAINT "customer_consents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_consents" ADD CONSTRAINT "customer_consents_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_loyalty_accounts" ADD CONSTRAINT "customer_loyalty_accounts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_loyalty_accounts" ADD CONSTRAINT "customer_loyalty_accounts_restaurant_id_restaurant_settings_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurant_settings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_loyalty_movements" ADD CONSTRAINT "customer_loyalty_movements_restaurant_id_restaurant_settings_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurant_settings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_loyalty_movements" ADD CONSTRAINT "customer_loyalty_movements_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_loyalty_movements" ADD CONSTRAINT "customer_loyalty_movements_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_segments" ADD CONSTRAINT "customer_segments_restaurant_id_restaurant_settings_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurant_settings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_tag_assignments" ADD CONSTRAINT "customer_tag_assignments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_tag_assignments" ADD CONSTRAINT "customer_tag_assignments_tag_id_customer_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."customer_tags"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_tags" ADD CONSTRAINT "customer_tags_restaurant_id_restaurant_settings_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurant_settings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_settings" ADD CONSTRAINT "loyalty_settings_restaurant_id_restaurant_settings_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurant_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "customer_loyalty_accounts" ("customer_id", "restaurant_id")
SELECT "id", "restaurant_id" FROM "customers";--> statement-breakpoint
CREATE INDEX "customer_consents_current_idx" ON "customer_consents" USING btree ("customer_id","consent_type","created_at");--> statement-breakpoint
CREATE INDEX "loyalty_accounts_restaurant_balance_idx" ON "customer_loyalty_accounts" USING btree ("restaurant_id","balance");--> statement-breakpoint
CREATE INDEX "loyalty_movements_customer_created_idx" ON "customer_loyalty_movements" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_movements_idempotency_uidx" ON "customer_loyalty_movements" USING btree ("restaurant_id","idempotency_key") WHERE "customer_loyalty_movements"."idempotency_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_movements_external_uidx" ON "customer_loyalty_movements" USING btree ("restaurant_id","external_reference") WHERE "customer_loyalty_movements"."external_reference" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_segments_restaurant_name_uidx" ON "customer_segments" USING btree ("restaurant_id",lower("name"));--> statement-breakpoint
CREATE INDEX "customer_segments_restaurant_active_idx" ON "customer_segments" USING btree ("restaurant_id","is_active","updated_at");--> statement-breakpoint
CREATE INDEX "customer_tag_assignments_tag_idx" ON "customer_tag_assignments" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_tags_restaurant_name_uidx" ON "customer_tags" USING btree ("restaurant_id",lower("name"));--> statement-breakpoint
CREATE INDEX "customer_tags_restaurant_order_idx" ON "customer_tags" USING btree ("restaurant_id","is_active","sort_order");