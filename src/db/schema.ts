import { sql } from "drizzle-orm";
import {
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
    .notNull(),
  heroImageUrl: text("hero_image_url").notNull(),
  menuDisplaySettings: jsonb("menu_display_settings"),
  ...timestamps,
});

export const restaurantTranslations = pgTable(
  "restaurant_translations",
  {
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurantSettings.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 10 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    slogan: varchar("slogan", { length: 240 }).notNull(),
    description: text("description").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.restaurantId, table.locale] }),
    index("restaurant_translations_locale_idx").on(table.locale),
  ],
);

export const restaurantLocales = pgTable(
  "restaurant_locales",
  {
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurantSettings.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 10 }).notNull(),
    isEnabled: boolean("is_enabled").default(false).notNull(),
    isPublished: boolean("is_published").default(false).notNull(),
    sortOrder: integer("sort_order").notNull(),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.restaurantId, table.locale] }),
    uniqueIndex("restaurant_locales_order_uidx").on(
      table.restaurantId,
      table.sortOrder,
    ),
    index("restaurant_locales_public_idx").on(
      table.restaurantId,
      table.isPublished,
      table.sortOrder,
    ),
    check(
      "restaurant_locales_published_requires_enabled",
      sql`not ${table.isPublished} or ${table.isEnabled}`,
    ),
    check("restaurant_locales_positive_order", sql`${table.sortOrder} >= 1`),
    check(
      "restaurant_locales_lowercase",
      sql`${table.locale} = lower(${table.locale})`,
    ),
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

export const specialOpeningHours = pgTable(
  "special_opening_hours",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurantSettings.id, { onDelete: "cascade" }),
    exceptionDate: date("date").notNull(),
    exceptionType: varchar("exception_type", { length: 20 })
      .default("special")
      .notNull(),
    isClosed: boolean("is_closed").default(false).notNull(),
    reason: varchar("reason", { length: 240 }),
    firstOpensAt: time("first_open_time"),
    firstClosesAt: time("first_close_time"),
    secondOpensAt: time("second_open_time"),
    secondClosesAt: time("second_close_time"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("special_opening_hours_restaurant_date_uidx").on(
      table.restaurantId,
      table.exceptionDate,
    ),
    index("special_opening_hours_date_idx").on(
      table.restaurantId,
      table.exceptionDate,
    ),
    check(
      "special_opening_hours_type_check",
      sql`${table.exceptionType} in ('open', 'closed', 'special')`,
    ),
    check(
      "special_opening_hours_type_closed_consistency",
      sql`(${table.exceptionType} = 'closed' and ${table.isClosed}) or (${table.exceptionType} in ('open', 'special') and not ${table.isClosed})`,
    ),
    check(
      "special_opening_hours_first_period_check",
      sql`${table.isClosed} or (${table.firstOpensAt} is not null and ${table.firstClosesAt} is not null)`,
    ),
    check(
      "special_opening_hours_second_period_check",
      sql`(${table.secondOpensAt} is null and ${table.secondClosesAt} is null) or (${table.secondOpensAt} is not null and ${table.secondClosesAt} is not null)`,
    ),
    check(
      "special_opening_hours_closed_has_no_periods",
      sql`not ${table.isClosed} or (${table.firstOpensAt} is null and ${table.firstClosesAt} is null and ${table.secondOpensAt} is null and ${table.secondClosesAt} is null)`,
    ),
  ],
);

export const reservationSettings = pgTable(
  "reservation_settings",
  {
    restaurantId: uuid("restaurant_id")
      .primaryKey()
      .references(() => restaurantSettings.id, { onDelete: "cascade" }),
    isEnabled: boolean("is_enabled").default(false).notNull(),
    durationMinutes: integer("duration_minutes").default(90).notNull(),
    slotIntervalMinutes: integer("slot_interval_minutes").default(30).notNull(),
    minimumAdvanceMinutes: integer("minimum_advance_minutes")
      .default(120)
      .notNull(),
    maximumAdvanceDays: integer("maximum_advance_days").default(30).notNull(),
    maximumPartySize: integer("maximum_party_size").default(8).notNull(),
    slotCapacity: integer("slot_capacity").default(20).notNull(),
    largeGroupPhone: varchar("large_group_phone", { length: 40 }),
    customerMessage: text("customer_message").default("").notNull(),
    policyText: text("policy_text").default("").notNull(),
    initialStatus: varchar("initial_status", { length: 20 })
      .default("pending")
      .notNull(),
    ...timestamps,
  },
  (table) => [
    check(
      "reservation_settings_duration_check",
      sql`${table.durationMinutes} between 15 and 480`,
    ),
    check(
      "reservation_settings_interval_check",
      sql`${table.slotIntervalMinutes} in (15, 30, 60)`,
    ),
    check(
      "reservation_settings_minimum_advance_check",
      sql`${table.minimumAdvanceMinutes} between 0 and 43200`,
    ),
    check(
      "reservation_settings_maximum_advance_check",
      sql`${table.maximumAdvanceDays} between 1 and 365`,
    ),
    check(
      "reservation_settings_party_size_check",
      sql`${table.maximumPartySize} between 1 and 100`,
    ),
    check(
      "reservation_settings_capacity_check",
      sql`${table.slotCapacity} between 1 and 1000`,
    ),
    check(
      "reservation_settings_initial_status_check",
      sql`${table.initialStatus} in ('pending', 'confirmed')`,
    ),
  ],
);

export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurantSettings.id, { onDelete: "restrict" }),
    locator: varchar("locator", { length: 12 }).notNull(),
    reservationDate: date("reservation_date").notNull(),
    reservationTime: time("reservation_time").notNull(),
    partySize: smallint("party_size").notNull(),
    guestName: varchar("guest_name", { length: 160 }).notNull(),
    guestPhone: varchar("guest_phone", { length: 40 }).notNull(),
    guestEmail: varchar("guest_email", { length: 254 }),
    customerNotes: varchar("customer_notes", { length: 1000 }),
    internalNotes: varchar("internal_notes", { length: 1000 }),
    status: varchar("status", { length: 20 }).notNull(),
    origin: varchar("origin", { length: 20 }).notNull(),
    locale: varchar("locale", { length: 10 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 64 }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("reservations_locator_uidx").on(table.locator),
    uniqueIndex("reservations_idempotency_uidx").on(
      table.restaurantId,
      table.idempotencyKey,
    ),
    index("reservations_restaurant_date_idx").on(
      table.restaurantId,
      table.reservationDate,
    ),
    index("reservations_restaurant_date_time_idx").on(
      table.restaurantId,
      table.reservationDate,
      table.reservationTime,
    ),
    index("reservations_restaurant_status_date_idx").on(
      table.restaurantId,
      table.status,
      table.reservationDate,
    ),
    index("reservations_restaurant_guest_name_idx").on(
      table.restaurantId,
      table.guestName,
    ),
    index("reservations_restaurant_phone_idx").on(
      table.restaurantId,
      table.guestPhone,
    ),
    check("reservations_party_size_check", sql`${table.partySize} > 0`),
    check(
      "reservations_status_check",
      sql`${table.status} in ('pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show')`,
    ),
    check(
      "reservations_origin_check",
      sql`${table.origin} in ('online', 'manual')`,
    ),
    check("reservations_locale_lowercase_check", sql`${table.locale} = lower(${table.locale})`),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    parentCategoryId: uuid("parent_category_id"),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    index("categories_active_order_idx").on(table.isActive, table.sortOrder),
    index("categories_parent_order_idx").on(
      table.parentCategoryId,
      table.sortOrder,
    ),
    foreignKey({
      columns: [table.parentCategoryId],
      foreignColumns: [table.id],
      name: "categories_parent_category_id_categories_id_fk",
    }).onDelete("restrict"),
    check(
      "categories_parent_not_self_check",
      sql`${table.parentCategoryId} is null or ${table.parentCategoryId} <> ${table.id}`,
    ),
    check("categories_sort_order_check", sql`${table.sortOrder} >= 0`),
  ],
);

export const categoryTranslations = pgTable(
  "category_translations",
  {
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 10 }).notNull(),
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
    ...timestamps,
  },
  (table) => [
    index("products_category_active_order_idx").on(
      table.categoryId,
      table.isActive,
      table.sortOrder,
    ),
    check("products_full_price_check", sql`${table.fullPriceCents} >= 0`),
    check(
      "products_half_price_check",
      sql`${table.halfPriceCents} is null or ${table.halfPriceCents} >= 0`,
    ),
    check("products_sort_order_check", sql`${table.sortOrder} >= 0`),
  ],
);

export const productTranslations = pgTable(
  "product_translations",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 10 }).notNull(),
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
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export const allergenTranslations = pgTable(
  "allergen_translations",
  {
    allergenId: uuid("allergen_id")
      .notNull()
      .references(() => allergens.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 10 }).notNull(),
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
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export const tagTranslations = pgTable(
  "tag_translations",
  {
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 10 }).notNull(),
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
