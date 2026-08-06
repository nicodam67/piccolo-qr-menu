import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const locales = pgTable(
  "locales",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 10 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    nativeName: varchar("native_name", { length: 100 }).notNull(),
    isEnabled: boolean("is_enabled").default(true).notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("locales_code_uidx").on(table.code),
    uniqueIndex("locales_single_default_uidx")
      .on(table.isDefault)
      .where(sql`${table.isDefault} = true`),
    index("locales_enabled_order_idx").on(table.isEnabled, table.sortOrder),
    check("locales_code_check", sql`${table.code} ~ '^[a-z]{2,3}(-[A-Z]{2})?$'`),
    check("locales_sort_order_check", sql`${table.sortOrder} >= 0`),
  ],
);

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: varchar("kind", { length: 20 }).notNull(),
    storageProvider: varchar("storage_provider", { length: 50 }).notNull(),
    storageKey: text("storage_key").notNull(),
    publicUrl: text("public_url"),
    originalFilename: text("original_filename").notNull(),
    mimeType: varchar("mime_type", { length: 255 }).notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    sha256: varchar("sha256", { length: 64 }).notNull(),
    width: integer("width"),
    height: integer("height"),
    durationMs: integer("duration_ms"),
    altText: text("alt_text"),
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    externalSource: varchar("external_source", { length: 50 }),
    externalId: text("external_id"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("assets_storage_provider_key_uidx").on(
      table.storageProvider,
      table.storageKey,
    ),
    uniqueIndex("assets_external_source_id_uidx")
      .on(table.externalSource, table.externalId)
      .where(
        sql`${table.externalSource} is not null and ${table.externalId} is not null`,
      ),
    index("assets_sha256_idx").on(table.sha256),
    index("assets_kind_status_idx").on(table.kind, table.status),
    check(
      "assets_kind_check",
      sql`${table.kind} in ('image', 'video', 'document', 'icon')`,
    ),
    check(
      "assets_status_check",
      sql`${table.status} in ('pending', 'available', 'failed', 'archived')`,
    ),
    check("assets_byte_size_check", sql`${table.byteSize} >= 0`),
    check(
      "assets_sha256_check",
      sql`${table.sha256} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "assets_dimensions_check",
      sql`(${table.width} is null or ${table.width} > 0) and (${table.height} is null or ${table.height} > 0)`,
    ),
    check(
      "assets_duration_check",
      sql`${table.durationMs} is null or ${table.durationMs} >= 0`,
    ),
    check(
      "assets_external_reference_check",
      sql`(${table.externalSource} is null) = (${table.externalId} is null)`,
    ),
  ],
);

export const restaurantSettings = pgTable("restaurant_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  phone: varchar("phone", { length: 40 }).notNull(),
  address: text("address").notNull(),
  timezone: varchar("timezone", { length: 64 })
    .default("Europe/Madrid")
    .notNull(),
  currencyCode: varchar("currency_code", { length: 3 }).default("EUR").notNull(),
  defaultLocale: varchar("default_locale", { length: 10 })
    .default("es")
    .notNull()
    .references(() => locales.code, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
  heroImageUrl: text("hero_image_url").notNull(),
  ...timestamps,
});

export const restaurantBranding = pgTable("restaurant_branding", {
  restaurantId: uuid("restaurant_id")
    .primaryKey()
    .references(() => restaurantSettings.id, { onDelete: "cascade" }),
  logoAssetId: uuid("logo_asset_id").references(() => assets.id, {
    onDelete: "set null",
  }),
  heroAssetId: uuid("hero_asset_id").references(() => assets.id, {
    onDelete: "set null",
  }),
  iconAssetId: uuid("icon_asset_id").references(() => assets.id, {
    onDelete: "set null",
  }),
  primaryColor: varchar("primary_color", { length: 32 }),
  secondaryColor: varchar("secondary_color", { length: 32 }),
  backgroundColor: varchar("background_color", { length: 32 }),
  textColor: varchar("text_color", { length: 32 }),
  primaryFont: varchar("primary_font", { length: 100 }),
  secondaryFont: varchar("secondary_font", { length: 100 }),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps,
});

export const restaurantLinks = pgTable(
  "restaurant_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurantSettings.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 50 }).notNull(),
    label: varchar("label", { length: 160 }),
    url: text("url").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("restaurant_links_restaurant_kind_url_uidx").on(
      table.restaurantId,
      table.kind,
      table.url,
    ),
    index("restaurant_links_restaurant_order_idx").on(
      table.restaurantId,
      table.isActive,
      table.sortOrder,
    ),
    check(
      "restaurant_links_kind_check",
      sql`${table.kind} in ('website', 'instagram', 'facebook', 'tiktok', 'youtube', 'map', 'booking', 'other')`,
    ),
    check("restaurant_links_sort_order_check", sql`${table.sortOrder} >= 0`),
  ],
);

export const restaurantTranslations = pgTable(
  "restaurant_translations",
  {
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurantSettings.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 10 })
      .notNull()
      .references(() => locales.code, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    name: varchar("name", { length: 160 }).notNull(),
    slogan: varchar("slogan", { length: 240 }).notNull(),
    description: text("description").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.restaurantId, table.locale] }),
    index("restaurant_translations_locale_idx").on(table.locale),
  ],
);

export const admins = pgTable(
  "admins",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: varchar("full_name", { length: 160 }).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    sessionVersion: integer("session_version").default(1).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("admins_email_uidx").on(table.email),
    uniqueIndex("admins_email_lower_uidx").on(sql`lower(${table.email})`),
    index("admins_active_idx").on(table.isActive),
    check("admins_email_lowercase_check", sql`${table.email} = lower(${table.email})`),
    check(
      "admins_session_version_check",
      sql`${table.sessionVersion} >= 1`,
    ),
  ],
);

export const adminLoginAttempts = pgTable(
  "admin_login_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    emailNormalized: varchar("email_normalized", { length: 320 }).notNull(),
    ipAddress: varchar("ip_address", { length: 64 }).notNull(),
    failedAttempts: integer("failed_attempts").default(0).notNull(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    blockedUntil: timestamp("blocked_until", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("admin_login_attempts_email_ip_uidx").on(
      table.emailNormalized,
      table.ipAddress,
    ),
    index("admin_login_attempts_blocked_until_idx").on(table.blockedUntil),
    check(
      "admin_login_attempts_email_lowercase_check",
      sql`${table.emailNormalized} = lower(${table.emailNormalized})`,
    ),
    check(
      "admin_login_attempts_failed_count_check",
      sql`${table.failedAttempts} >= 0`,
    ),
  ],
);

export const openingHours = pgTable(
  "opening_hours",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurantSettings.id, { onDelete: "cascade" }),
    dayOfWeek: smallint("day_of_week").notNull(),
    isClosed: boolean("is_closed").default(false).notNull(),
    firstOpensAt: time("first_opens_at"),
    firstClosesAt: time("first_closes_at"),
    secondOpensAt: time("second_opens_at"),
    secondClosesAt: time("second_closes_at"),
  },
  (table) => [
    uniqueIndex("opening_hours_restaurant_day_uidx").on(
      table.restaurantId,
      table.dayOfWeek,
    ),
    check(
      "opening_hours_day_check",
      sql`${table.dayOfWeek} between 1 and 7`,
    ),
    check(
      "opening_hours_first_period_check",
      sql`${table.isClosed} or (${table.firstOpensAt} is not null and ${table.firstClosesAt} is not null)`,
    ),
    check(
      "opening_hours_second_period_check",
      sql`(${table.secondOpensAt} is null and ${table.secondClosesAt} is null) or (${table.secondOpensAt} is not null and ${table.secondClosesAt} is not null)`,
    ),
  ],
);

export const openingHourExceptions = pgTable(
  "opening_hour_exceptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurantSettings.id, { onDelete: "cascade" }),
    exceptionType: varchar("exception_type", { length: 30 }).notNull(),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    isClosed: boolean("is_closed").default(false).notNull(),
    firstOpensAt: time("first_opens_at"),
    firstClosesAt: time("first_closes_at"),
    secondOpensAt: time("second_opens_at"),
    secondClosesAt: time("second_closes_at"),
    reason: text("reason"),
    priority: integer("priority").default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("opening_hour_exceptions_range_priority_uidx").on(
      table.restaurantId,
      table.startsOn,
      table.endsOn,
      table.priority,
    ),
    index("opening_hour_exceptions_lookup_idx").on(
      table.restaurantId,
      table.startsOn,
      table.endsOn,
      table.priority,
    ),
    check(
      "opening_hour_exceptions_type_check",
      sql`${table.exceptionType} in ('closure', 'special_opening', 'holiday')`,
    ),
    check(
      "opening_hour_exceptions_date_range_check",
      sql`${table.startsOn} <= ${table.endsOn}`,
    ),
    check(
      "opening_hour_exceptions_first_period_check",
      sql`${table.isClosed} or (${table.firstOpensAt} is not null and ${table.firstClosesAt} is not null)`,
    ),
    check(
      "opening_hour_exceptions_second_period_check",
      sql`(${table.secondOpensAt} is null and ${table.secondClosesAt} is null) or (${table.secondOpensAt} is not null and ${table.secondClosesAt} is not null)`,
    ),
    check(
      "opening_hour_exceptions_closed_periods_check",
      sql`not ${table.isClosed} or (${table.firstOpensAt} is null and ${table.firstClosesAt} is null and ${table.secondOpensAt} is null and ${table.secondClosesAt} is null)`,
    ),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    catalogSource: varchar("catalog_source", { length: 30 })
      .default("manual")
      .notNull(),
    managedBy: varchar("managed_by", { length: 30 })
      .default("qr_admin")
      .notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    syncVersion: varchar("sync_version", { length: 160 }),
    syncStatus: varchar("sync_status", { length: 30 })
      .default("not_synced")
      .notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("categories_active_order_idx").on(table.isActive, table.sortOrder),
    index("categories_catalog_sync_idx").on(
      table.catalogSource,
      table.syncStatus,
    ),
    check("categories_sort_order_check", sql`${table.sortOrder} >= 0`),
    check(
      "categories_catalog_source_check",
      sql`${table.catalogSource} in ('manual', 'hercules_convex', 'piccolo_tpv', 'legacy')`,
    ),
    check(
      "categories_managed_by_check",
      sql`${table.managedBy} in ('qr_admin', 'tpv', 'imported')`,
    ),
    check(
      "categories_sync_status_check",
      sql`${table.syncStatus} in ('not_synced', 'pending', 'synced', 'conflict', 'failed')`,
    ),
  ],
);

export const categoryTranslations = pgTable(
  "category_translations",
  {
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 10 })
      .notNull()
      .references(() => locales.code, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.categoryId, table.locale] }),
    index("category_translations_locale_idx").on(table.locale),
  ],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    fullPriceCents: integer("full_price_cents").notNull(),
    halfPriceCents: integer("half_price_cents"),
    isActive: boolean("is_active").default(true).notNull(),
    isSoldOut: boolean("is_sold_out").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    imageUrl: text("image_url").notNull(),
    primaryImageAssetId: uuid("primary_image_asset_id").references(
      () => assets.id,
      { onDelete: "set null" },
    ),
    catalogSource: varchar("catalog_source", { length: 30 })
      .default("manual")
      .notNull(),
    managedBy: varchar("managed_by", { length: 30 })
      .default("qr_admin")
      .notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    syncVersion: varchar("sync_version", { length: 160 }),
    syncStatus: varchar("sync_status", { length: 30 })
      .default("not_synced")
      .notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("products_category_active_order_idx").on(
      table.categoryId,
      table.isActive,
      table.sortOrder,
    ),
    index("products_primary_image_asset_idx").on(table.primaryImageAssetId),
    index("products_catalog_sync_idx").on(
      table.catalogSource,
      table.syncStatus,
    ),
    check("products_full_price_check", sql`${table.fullPriceCents} >= 0`),
    check(
      "products_half_price_check",
      sql`${table.halfPriceCents} is null or ${table.halfPriceCents} >= 0`,
    ),
    check("products_sort_order_check", sql`${table.sortOrder} >= 0`),
    check(
      "products_catalog_source_check",
      sql`${table.catalogSource} in ('manual', 'hercules_convex', 'piccolo_tpv', 'legacy')`,
    ),
    check(
      "products_managed_by_check",
      sql`${table.managedBy} in ('qr_admin', 'tpv', 'imported')`,
    ),
    check(
      "products_sync_status_check",
      sql`${table.syncStatus} in ('not_synced', 'pending', 'synced', 'conflict', 'failed')`,
    ),
  ],
);

export const productAssets = pgTable(
  "product_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "restrict" }),
    role: varchar("role", { length: 30 }).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("product_assets_product_asset_role_uidx").on(
      table.productId,
      table.assetId,
      table.role,
    ),
    uniqueIndex("product_assets_product_role_order_uidx").on(
      table.productId,
      table.role,
      table.sortOrder,
    ),
    index("product_assets_asset_idx").on(table.assetId),
    check(
      "product_assets_role_check",
      sql`${table.role} in ('gallery', 'video', 'document')`,
    ),
    check("product_assets_sort_order_check", sql`${table.sortOrder} >= 0`),
  ],
);

export const productTranslations = pgTable(
  "product_translations",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 10 })
      .notNull()
      .references(() => locales.code, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.locale] }),
    index("product_translations_locale_idx").on(table.locale),
  ],
);

export const allergens = pgTable("allergens", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  icon: varchar("icon", { length: 100 }).notNull(),
});

export const allergenTranslations = pgTable(
  "allergen_translations",
  {
    allergenId: uuid("allergen_id")
      .notNull()
      .references(() => allergens.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 10 })
      .notNull()
      .references(() => locales.code, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    name: varchar("name", { length: 120 }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.allergenId, table.locale] }),
    index("allergen_translations_locale_idx").on(table.locale),
  ],
);

export const productAllergens = pgTable(
  "product_allergens",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    allergenId: uuid("allergen_id")
      .notNull()
      .references(() => allergens.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.allergenId] }),
    index("product_allergens_allergen_idx").on(table.allergenId),
  ],
);

export const tags = pgTable("tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  color: varchar("color", { length: 30 }).notNull(),
});

export const tagTranslations = pgTable(
  "tag_translations",
  {
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 10 })
      .notNull()
      .references(() => locales.code, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    name: varchar("name", { length: 120 }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tagId, table.locale] }),
    index("tag_translations_locale_idx").on(table.locale),
  ],
);

export const productTags = pgTable(
  "product_tags",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.tagId] }),
    index("product_tags_tag_idx").on(table.tagId),
  ],
);

export const importRuns = pgTable(
  "import_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: varchar("source", { length: 50 }).notNull(),
    kind: varchar("kind", { length: 30 }).notNull(),
    status: varchar("status", { length: 30 }).default("pending").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    sourceChecksum: varchar("source_checksum", { length: 64 }),
    sourceFilename: text("source_filename"),
    counters: jsonb("counters").default(sql`'{}'::jsonb`).notNull(),
    warnings: jsonb("warnings").default(sql`'[]'::jsonb`).notNull(),
    errors: jsonb("errors").default(sql`'[]'::jsonb`).notNull(),
    initiatedBy: uuid("initiated_by").references(() => admins.id, {
      onDelete: "set null",
    }),
    rollbackOf: uuid("rollback_of").references(
      (): AnyPgColumn => importRuns.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("import_runs_source_status_started_idx").on(
      table.source,
      table.status,
      table.startedAt,
    ),
    index("import_runs_checksum_idx").on(table.sourceChecksum),
    check(
      "import_runs_source_check",
      sql`${table.source} in ('hercules_convex', 'legacy', 'manual')`,
    ),
    check(
      "import_runs_kind_check",
      sql`${table.kind} in ('full_import', 'incremental_import', 'validation', 'dry_run')`,
    ),
    check(
      "import_runs_status_check",
      sql`${table.status} in ('pending', 'running', 'succeeded', 'failed', 'rolled_back')`,
    ),
    check(
      "import_runs_checksum_check",
      sql`${table.sourceChecksum} is null or ${table.sourceChecksum} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "import_runs_completion_check",
      sql`${table.completedAt} is null or ${table.completedAt} >= ${table.startedAt}`,
    ),
  ],
);

export const syncRuns = pgTable(
  "sync_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceSystem: varchar("source_system", { length: 50 }).notNull(),
    direction: varchar("direction", { length: 30 })
      .default("tpv_to_qr")
      .notNull(),
    status: varchar("status", { length: 30 }).default("pending").notNull(),
    cursor: text("cursor"),
    checkpoint: text("checkpoint"),
    recordsRead: integer("records_read").default(0).notNull(),
    recordsCreated: integer("records_created").default(0).notNull(),
    recordsUpdated: integer("records_updated").default(0).notNull(),
    recordsSkipped: integer("records_skipped").default(0).notNull(),
    recordsFailed: integer("records_failed").default(0).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errors: jsonb("errors").default(sql`'[]'::jsonb`).notNull(),
    ...timestamps,
  },
  (table) => [
    index("sync_runs_source_status_started_idx").on(
      table.sourceSystem,
      table.status,
      table.startedAt,
    ),
    check(
      "sync_runs_direction_check",
      sql`${table.direction} in ('tpv_to_qr')`,
    ),
    check(
      "sync_runs_status_check",
      sql`${table.status} in ('pending', 'running', 'succeeded', 'failed', 'partial')`,
    ),
    check(
      "sync_runs_counts_check",
      sql`${table.recordsRead} >= 0 and ${table.recordsCreated} >= 0 and ${table.recordsUpdated} >= 0 and ${table.recordsSkipped} >= 0 and ${table.recordsFailed} >= 0`,
    ),
    check(
      "sync_runs_completion_check",
      sql`${table.completedAt} is null or ${table.completedAt} >= ${table.startedAt}`,
    ),
  ],
);

export const externalEntityMappings = pgTable(
  "external_entity_mappings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: varchar("source", { length: 50 }).notNull(),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    externalId: text("external_id").notNull(),
    internalId: uuid("internal_id").notNull(),
    externalParentId: text("external_parent_id"),
    metadata: jsonb("metadata"),
    sourceCreatedAt: timestamp("source_created_at", { withTimezone: true }),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    payloadHash: varchar("payload_hash", { length: 64 }),
    lastSeenImportRunId: uuid("last_seen_import_run_id"),
    lastSeenSyncRunId: uuid("last_seen_sync_run_id"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("external_entity_mappings_external_uidx").on(
      table.source,
      table.entityType,
      table.externalId,
    ),
    uniqueIndex("external_entity_mappings_internal_uidx").on(
      table.source,
      table.entityType,
      table.internalId,
    ),
    index("external_entity_mappings_internal_idx").on(table.internalId),
    index("external_entity_mappings_import_run_idx").on(
      table.lastSeenImportRunId,
    ),
    index("external_entity_mappings_sync_run_idx").on(table.lastSeenSyncRunId),
    foreignKey({
      name: "external_mappings_import_run_fk",
      columns: [table.lastSeenImportRunId],
      foreignColumns: [importRuns.id],
    }).onDelete("set null"),
    foreignKey({
      name: "external_mappings_sync_run_fk",
      columns: [table.lastSeenSyncRunId],
      foreignColumns: [syncRuns.id],
    }).onDelete("set null"),
    check(
      "external_entity_mappings_source_check",
      sql`${table.source} in ('hercules_convex', 'piccolo_tpv', 'legacy', 'manual')`,
    ),
    check(
      "external_entity_mappings_entity_type_check",
      sql`${table.entityType} ~ '^[a-z][a-z0-9_]*$'`,
    ),
    check(
      "external_entity_mappings_payload_hash_check",
      sql`${table.payloadHash} is null or ${table.payloadHash} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorType: varchar("actor_type", { length: 30 }).notNull(),
    actorId: uuid("actor_id"),
    action: varchar("action", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: uuid("entity_id"),
    source: varchar("source", { length: 50 }).notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_log_entity_idx").on(table.entityType, table.entityId),
    index("audit_log_created_at_idx").on(table.createdAt),
    index("audit_log_actor_idx").on(table.actorType, table.actorId),
    index("audit_log_source_idx").on(table.source),
    check(
      "audit_log_actor_type_check",
      sql`${table.actorType} in ('admin', 'system', 'import', 'tpv')`,
    ),
    check(
      "audit_log_source_check",
      sql`${table.source} in ('qr_admin', 'system', 'hercules_convex', 'piccolo_tpv', 'legacy', 'manual')`,
    ),
    check(
      "audit_log_entity_type_check",
      sql`${table.entityType} ~ '^[a-z][a-z0-9_]*$'`,
    ),
  ],
);
