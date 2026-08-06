CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" varchar(20) NOT NULL,
	"storage_provider" varchar(50) NOT NULL,
	"storage_key" text NOT NULL,
	"public_url" text,
	"original_filename" text NOT NULL,
	"mime_type" varchar(255) NOT NULL,
	"byte_size" bigint NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"width" integer,
	"height" integer,
	"duration_ms" integer,
	"alt_text" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"external_source" varchar(50),
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_kind_check" CHECK ("assets"."kind" in ('image', 'video', 'document', 'icon')),
	CONSTRAINT "assets_status_check" CHECK ("assets"."status" in ('pending', 'available', 'failed', 'archived')),
	CONSTRAINT "assets_byte_size_check" CHECK ("assets"."byte_size" >= 0),
	CONSTRAINT "assets_sha256_check" CHECK ("assets"."sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "assets_dimensions_check" CHECK (("assets"."width" is null or "assets"."width" > 0) and ("assets"."height" is null or "assets"."height" > 0)),
	CONSTRAINT "assets_duration_check" CHECK ("assets"."duration_ms" is null or "assets"."duration_ms" >= 0),
	CONSTRAINT "assets_external_reference_check" CHECK (("assets"."external_source" is null) = ("assets"."external_id" is null))
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_type" varchar(30) NOT NULL,
	"actor_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid,
	"source" varchar(50) NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_log_actor_type_check" CHECK ("audit_log"."actor_type" in ('admin', 'system', 'import', 'tpv')),
	CONSTRAINT "audit_log_source_check" CHECK ("audit_log"."source" in ('qr_admin', 'system', 'hercules_convex', 'piccolo_tpv', 'legacy', 'manual')),
	CONSTRAINT "audit_log_entity_type_check" CHECK ("audit_log"."entity_type" ~ '^[a-z][a-z0-9_]*$')
);
--> statement-breakpoint
CREATE TABLE "external_entity_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(50) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"external_id" text NOT NULL,
	"internal_id" uuid NOT NULL,
	"external_parent_id" text,
	"metadata" jsonb,
	"source_created_at" timestamp with time zone,
	"source_updated_at" timestamp with time zone,
	"payload_hash" varchar(64),
	"last_seen_import_run_id" uuid,
	"last_seen_sync_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_entity_mappings_source_check" CHECK ("external_entity_mappings"."source" in ('hercules_convex', 'piccolo_tpv', 'legacy', 'manual')),
	CONSTRAINT "external_entity_mappings_entity_type_check" CHECK ("external_entity_mappings"."entity_type" ~ '^[a-z][a-z0-9_]*$'),
	CONSTRAINT "external_entity_mappings_payload_hash_check" CHECK ("external_entity_mappings"."payload_hash" is null or "external_entity_mappings"."payload_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "import_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(50) NOT NULL,
	"kind" varchar(30) NOT NULL,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"source_checksum" varchar(64),
	"source_filename" text,
	"counters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"initiated_by" uuid,
	"rollback_of" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_runs_source_check" CHECK ("import_runs"."source" in ('hercules_convex', 'legacy', 'manual')),
	CONSTRAINT "import_runs_kind_check" CHECK ("import_runs"."kind" in ('full_import', 'incremental_import', 'validation', 'dry_run')),
	CONSTRAINT "import_runs_status_check" CHECK ("import_runs"."status" in ('pending', 'running', 'succeeded', 'failed', 'rolled_back')),
	CONSTRAINT "import_runs_checksum_check" CHECK ("import_runs"."source_checksum" is null or "import_runs"."source_checksum" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "import_runs_completion_check" CHECK ("import_runs"."completed_at" is null or "import_runs"."completed_at" >= "import_runs"."started_at")
);
--> statement-breakpoint
CREATE TABLE "locales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(10) NOT NULL,
	"name" varchar(100) NOT NULL,
	"native_name" varchar(100) NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "locales_code_check" CHECK ("locales"."code" ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
	CONSTRAINT "locales_sort_order_check" CHECK ("locales"."sort_order" >= 0)
);
--> statement-breakpoint
WITH "observed_locales" AS (
	SELECT "default_locale" AS "code" FROM "restaurant_settings"
	UNION
	SELECT "locale" FROM "restaurant_translations"
	UNION
	SELECT "locale" FROM "category_translations"
	UNION
	SELECT "locale" FROM "product_translations"
	UNION
	SELECT "locale" FROM "allergen_translations"
	UNION
	SELECT "locale" FROM "tag_translations"
),
"ranked_locales" AS (
	SELECT "code", row_number() OVER (ORDER BY "code")::integer AS "sort_order"
	FROM "observed_locales"
	WHERE "code" IS NOT NULL
)
INSERT INTO "locales" (
	"code",
	"name",
	"native_name",
	"is_enabled",
	"is_default",
	"sort_order"
)
SELECT
	"code",
	CASE "code"
		WHEN 'es' THEN 'Español'
		WHEN 'ca' THEN 'Catalán'
		WHEN 'en' THEN 'Inglés'
		WHEN 'ro' THEN 'Rumano'
		WHEN 'fr' THEN 'Francés'
		WHEN 'de' THEN 'Alemán'
		WHEN 'nl' THEN 'Neerlandés'
		WHEN 'it' THEN 'Italiano'
		ELSE upper("code")
	END,
	CASE "code"
		WHEN 'es' THEN 'Español'
		WHEN 'ca' THEN 'Català'
		WHEN 'en' THEN 'English'
		WHEN 'ro' THEN 'Română'
		WHEN 'fr' THEN 'Français'
		WHEN 'de' THEN 'Deutsch'
		WHEN 'nl' THEN 'Nederlands'
		WHEN 'it' THEN 'Italiano'
		ELSE upper("code")
	END,
	true,
	false,
	"sort_order"
FROM "ranked_locales"
ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
UPDATE "locales"
SET "is_default" = true, "updated_at" = now()
WHERE "code" = (
	SELECT "default_locale"
	FROM "restaurant_settings"
	ORDER BY "created_at", "id"
	LIMIT 1
);--> statement-breakpoint
CREATE TABLE "opening_hour_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"exception_type" varchar(30) NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"first_opens_at" time,
	"first_closes_at" time,
	"second_opens_at" time,
	"second_closes_at" time,
	"reason" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "opening_hour_exceptions_type_check" CHECK ("opening_hour_exceptions"."exception_type" in ('closure', 'special_opening', 'holiday')),
	CONSTRAINT "opening_hour_exceptions_date_range_check" CHECK ("opening_hour_exceptions"."starts_on" <= "opening_hour_exceptions"."ends_on"),
	CONSTRAINT "opening_hour_exceptions_first_period_check" CHECK ("opening_hour_exceptions"."is_closed" or ("opening_hour_exceptions"."first_opens_at" is not null and "opening_hour_exceptions"."first_closes_at" is not null)),
	CONSTRAINT "opening_hour_exceptions_second_period_check" CHECK (("opening_hour_exceptions"."second_opens_at" is null and "opening_hour_exceptions"."second_closes_at" is null) or ("opening_hour_exceptions"."second_opens_at" is not null and "opening_hour_exceptions"."second_closes_at" is not null)),
	CONSTRAINT "opening_hour_exceptions_closed_periods_check" CHECK (not "opening_hour_exceptions"."is_closed" or ("opening_hour_exceptions"."first_opens_at" is null and "opening_hour_exceptions"."first_closes_at" is null and "opening_hour_exceptions"."second_opens_at" is null and "opening_hour_exceptions"."second_closes_at" is null))
);
--> statement-breakpoint
CREATE TABLE "product_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"role" varchar(30) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_assets_role_check" CHECK ("product_assets"."role" in ('gallery', 'video', 'document')),
	CONSTRAINT "product_assets_sort_order_check" CHECK ("product_assets"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "restaurant_branding" (
	"restaurant_id" uuid PRIMARY KEY NOT NULL,
	"logo_asset_id" uuid,
	"hero_asset_id" uuid,
	"icon_asset_id" uuid,
	"primary_color" varchar(32),
	"secondary_color" varchar(32),
	"background_color" varchar(32),
	"text_color" varchar(32),
	"primary_font" varchar(100),
	"secondary_font" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurant_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"kind" varchar(50) NOT NULL,
	"label" varchar(160),
	"url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "restaurant_links_kind_check" CHECK ("restaurant_links"."kind" in ('website', 'instagram', 'facebook', 'tiktok', 'youtube', 'map', 'booking', 'other')),
	CONSTRAINT "restaurant_links_sort_order_check" CHECK ("restaurant_links"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_system" varchar(50) NOT NULL,
	"direction" varchar(30) DEFAULT 'tpv_to_qr' NOT NULL,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"cursor" text,
	"checkpoint" text,
	"records_read" integer DEFAULT 0 NOT NULL,
	"records_created" integer DEFAULT 0 NOT NULL,
	"records_updated" integer DEFAULT 0 NOT NULL,
	"records_skipped" integer DEFAULT 0 NOT NULL,
	"records_failed" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_runs_direction_check" CHECK ("sync_runs"."direction" in ('tpv_to_qr')),
	CONSTRAINT "sync_runs_status_check" CHECK ("sync_runs"."status" in ('pending', 'running', 'succeeded', 'failed', 'partial')),
	CONSTRAINT "sync_runs_counts_check" CHECK ("sync_runs"."records_read" >= 0 and "sync_runs"."records_created" >= 0 and "sync_runs"."records_updated" >= 0 and "sync_runs"."records_skipped" >= 0 and "sync_runs"."records_failed" >= 0),
	CONSTRAINT "sync_runs_completion_check" CHECK ("sync_runs"."completed_at" is null or "sync_runs"."completed_at" >= "sync_runs"."started_at")
);
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "catalog_source" varchar(30) DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "managed_by" varchar(30) DEFAULT 'qr_admin' NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "sync_version" varchar(160);--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "sync_status" varchar(30) DEFAULT 'not_synced' NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "primary_image_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "catalog_source" varchar(30) DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "managed_by" varchar(30) DEFAULT 'qr_admin' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sync_version" varchar(160);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sync_status" varchar(30) DEFAULT 'not_synced' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "external_entity_mappings" ADD CONSTRAINT "external_entity_mappings_last_seen_import_run_id_import_runs_id_fk" FOREIGN KEY ("last_seen_import_run_id") REFERENCES "public"."import_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_entity_mappings" ADD CONSTRAINT "external_entity_mappings_last_seen_sync_run_id_sync_runs_id_fk" FOREIGN KEY ("last_seen_sync_run_id") REFERENCES "public"."sync_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_initiated_by_admins_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_rollback_of_import_runs_id_fk" FOREIGN KEY ("rollback_of") REFERENCES "public"."import_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opening_hour_exceptions" ADD CONSTRAINT "opening_hour_exceptions_restaurant_id_restaurant_settings_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurant_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_assets" ADD CONSTRAINT "product_assets_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_assets" ADD CONSTRAINT "product_assets_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_branding" ADD CONSTRAINT "restaurant_branding_restaurant_id_restaurant_settings_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurant_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_branding" ADD CONSTRAINT "restaurant_branding_logo_asset_id_assets_id_fk" FOREIGN KEY ("logo_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_branding" ADD CONSTRAINT "restaurant_branding_hero_asset_id_assets_id_fk" FOREIGN KEY ("hero_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_branding" ADD CONSTRAINT "restaurant_branding_icon_asset_id_assets_id_fk" FOREIGN KEY ("icon_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_links" ADD CONSTRAINT "restaurant_links_restaurant_id_restaurant_settings_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurant_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assets_storage_provider_key_uidx" ON "assets" USING btree ("storage_provider","storage_key");--> statement-breakpoint
CREATE UNIQUE INDEX "assets_external_source_id_uidx" ON "assets" USING btree ("external_source","external_id") WHERE "assets"."external_source" is not null and "assets"."external_id" is not null;--> statement-breakpoint
CREATE INDEX "assets_sha256_idx" ON "assets" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX "assets_kind_status_idx" ON "assets" USING btree ("kind","status");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_type","actor_id");--> statement-breakpoint
CREATE INDEX "audit_log_source_idx" ON "audit_log" USING btree ("source");--> statement-breakpoint
CREATE UNIQUE INDEX "external_entity_mappings_external_uidx" ON "external_entity_mappings" USING btree ("source","entity_type","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_entity_mappings_internal_uidx" ON "external_entity_mappings" USING btree ("source","entity_type","internal_id");--> statement-breakpoint
CREATE INDEX "external_entity_mappings_internal_idx" ON "external_entity_mappings" USING btree ("internal_id");--> statement-breakpoint
CREATE INDEX "external_entity_mappings_import_run_idx" ON "external_entity_mappings" USING btree ("last_seen_import_run_id");--> statement-breakpoint
CREATE INDEX "external_entity_mappings_sync_run_idx" ON "external_entity_mappings" USING btree ("last_seen_sync_run_id");--> statement-breakpoint
CREATE INDEX "import_runs_source_status_started_idx" ON "import_runs" USING btree ("source","status","started_at");--> statement-breakpoint
CREATE INDEX "import_runs_checksum_idx" ON "import_runs" USING btree ("source_checksum");--> statement-breakpoint
CREATE UNIQUE INDEX "locales_code_uidx" ON "locales" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "locales_single_default_uidx" ON "locales" USING btree ("is_default") WHERE "locales"."is_default" = true;--> statement-breakpoint
CREATE INDEX "locales_enabled_order_idx" ON "locales" USING btree ("is_enabled","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "opening_hour_exceptions_range_priority_uidx" ON "opening_hour_exceptions" USING btree ("restaurant_id","starts_on","ends_on","priority");--> statement-breakpoint
CREATE INDEX "opening_hour_exceptions_lookup_idx" ON "opening_hour_exceptions" USING btree ("restaurant_id","starts_on","ends_on","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "product_assets_product_asset_role_uidx" ON "product_assets" USING btree ("product_id","asset_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "product_assets_product_role_order_uidx" ON "product_assets" USING btree ("product_id","role","sort_order");--> statement-breakpoint
CREATE INDEX "product_assets_asset_idx" ON "product_assets" USING btree ("asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "restaurant_links_restaurant_kind_url_uidx" ON "restaurant_links" USING btree ("restaurant_id","kind","url");--> statement-breakpoint
CREATE INDEX "restaurant_links_restaurant_order_idx" ON "restaurant_links" USING btree ("restaurant_id","is_active","sort_order");--> statement-breakpoint
CREATE INDEX "sync_runs_source_status_started_idx" ON "sync_runs" USING btree ("source_system","status","started_at");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_primary_image_asset_id_assets_id_fk" FOREIGN KEY ("primary_image_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categories_catalog_sync_idx" ON "categories" USING btree ("catalog_source","sync_status");--> statement-breakpoint
CREATE INDEX "products_primary_image_asset_idx" ON "products" USING btree ("primary_image_asset_id");--> statement-breakpoint
CREATE INDEX "products_catalog_sync_idx" ON "products" USING btree ("catalog_source","sync_status");--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_catalog_source_check" CHECK ("categories"."catalog_source" in ('manual', 'hercules_convex', 'piccolo_tpv', 'legacy'));--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_managed_by_check" CHECK ("categories"."managed_by" in ('qr_admin', 'tpv', 'imported'));--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_sync_status_check" CHECK ("categories"."sync_status" in ('not_synced', 'pending', 'synced', 'conflict', 'failed'));--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_catalog_source_check" CHECK ("products"."catalog_source" in ('manual', 'hercules_convex', 'piccolo_tpv', 'legacy'));--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_managed_by_check" CHECK ("products"."managed_by" in ('qr_admin', 'tpv', 'imported'));--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_sync_status_check" CHECK ("products"."sync_status" in ('not_synced', 'pending', 'synced', 'conflict', 'failed'));