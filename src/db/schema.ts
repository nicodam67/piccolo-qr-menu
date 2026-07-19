import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
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

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    index("categories_active_order_idx").on(table.isActive, table.sortOrder),
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
