-- Manual rollback for delivery 1. Run only after taking a backup and confirming
-- that no production data has been written to the new tables/columns.

ALTER TABLE "tag_translations"
  DROP CONSTRAINT IF EXISTS "tag_translations_locale_locales_code_fk";
ALTER TABLE "restaurant_translations"
  DROP CONSTRAINT IF EXISTS "restaurant_translations_locale_locales_code_fk";
ALTER TABLE "restaurant_settings"
  DROP CONSTRAINT IF EXISTS "restaurant_settings_default_locale_locales_code_fk";
ALTER TABLE "product_translations"
  DROP CONSTRAINT IF EXISTS "product_translations_locale_locales_code_fk";
ALTER TABLE "category_translations"
  DROP CONSTRAINT IF EXISTS "category_translations_locale_locales_code_fk";
ALTER TABLE "allergen_translations"
  DROP CONSTRAINT IF EXISTS "allergen_translations_locale_locales_code_fk";

ALTER TABLE "products"
  DROP CONSTRAINT IF EXISTS "products_primary_image_asset_id_assets_id_fk";
ALTER TABLE "products"
  DROP CONSTRAINT IF EXISTS "products_catalog_source_check";
ALTER TABLE "products"
  DROP CONSTRAINT IF EXISTS "products_managed_by_check";
ALTER TABLE "products"
  DROP CONSTRAINT IF EXISTS "products_sync_status_check";
DROP INDEX IF EXISTS "products_catalog_sync_idx";
DROP INDEX IF EXISTS "products_primary_image_asset_idx";
ALTER TABLE "products"
  DROP COLUMN IF EXISTS "archived_at",
  DROP COLUMN IF EXISTS "sync_status",
  DROP COLUMN IF EXISTS "sync_version",
  DROP COLUMN IF EXISTS "last_synced_at",
  DROP COLUMN IF EXISTS "managed_by",
  DROP COLUMN IF EXISTS "catalog_source",
  DROP COLUMN IF EXISTS "primary_image_asset_id";

ALTER TABLE "categories"
  DROP CONSTRAINT IF EXISTS "categories_catalog_source_check";
ALTER TABLE "categories"
  DROP CONSTRAINT IF EXISTS "categories_managed_by_check";
ALTER TABLE "categories"
  DROP CONSTRAINT IF EXISTS "categories_sync_status_check";
DROP INDEX IF EXISTS "categories_catalog_sync_idx";
ALTER TABLE "categories"
  DROP COLUMN IF EXISTS "archived_at",
  DROP COLUMN IF EXISTS "sync_status",
  DROP COLUMN IF EXISTS "sync_version",
  DROP COLUMN IF EXISTS "last_synced_at",
  DROP COLUMN IF EXISTS "managed_by",
  DROP COLUMN IF EXISTS "catalog_source";

DROP TABLE IF EXISTS "audit_log";
DROP TABLE IF EXISTS "external_entity_mappings";
DROP TABLE IF EXISTS "product_assets";
DROP TABLE IF EXISTS "restaurant_links";
DROP TABLE IF EXISTS "restaurant_branding";
DROP TABLE IF EXISTS "opening_hour_exceptions";
DROP TABLE IF EXISTS "sync_runs";
DROP TABLE IF EXISTS "import_runs";
DROP TABLE IF EXISTS "assets";
DROP TABLE IF EXISTS "locales";
