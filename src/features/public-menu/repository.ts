import "server-only";

import { and, asc, eq, gte, inArray, lte, ne } from "drizzle-orm";

import { getDatabase } from "@/db";
import {
  allergenTranslations,
  allergens,
  categories,
  categoryTranslations,
  openingHours,
  productAllergens,
  productTags,
  productTranslations,
  products,
  restaurantLocales,
  restaurantSettings,
  restaurantTranslations,
  specialOpeningHours,
  tagTranslations,
  tags,
} from "@/db/schema";
import { normalizeMenuDisplaySettings } from "@/features/menu-settings/config";

import type {
  DayKey,
  DemoMenu,
  DemoProduct,
  OpeningDay,
  PublicProductDetail,
  ProductTag,
  SpecialOpeningDay,
} from "./types";

export class PublicMenuRepositoryError extends Error {
  constructor(options?: ErrorOptions) {
    super("No se pudo cargar la carta pública desde PostgreSQL.", options);
    this.name = "PublicMenuRepositoryError";
  }
}

const dayMetadata: Array<{ day: DayKey; label: string }> = [
  { day: "monday", label: "Lunes" },
  { day: "tuesday", label: "Martes" },
  { day: "wednesday", label: "Miércoles" },
  { day: "thursday", label: "Jueves" },
  { day: "friday", label: "Viernes" },
  { day: "saturday", label: "Sábado" },
  { day: "sunday", label: "Domingo" },
];

function normalizeTime(value: string) {
  return value.slice(0, 5);
}

function getPhoneHref(phone: string) {
  const normalizedPhone = phone.replace(/[^\d+]/g, "");
  return `tel:${normalizedPhone}`;
}

function buildOpeningDays(
  rows: Array<{
    dayOfWeek: number;
    isClosed: boolean;
    firstOpensAt: string | null;
    firstClosesAt: string | null;
    secondOpensAt: string | null;
    secondClosesAt: string | null;
  }>,
): OpeningDay[] {
  const hoursByDay = new Map(rows.map((row) => [row.dayOfWeek, row]));
  return dayMetadata.map(({ day, label }, index) => {
    const row = hoursByDay.get(index + 1);
    if (!row || row.isClosed) return { day, label, periods: [] };
    const periods = [];
    if (row.firstOpensAt && row.firstClosesAt) {
      periods.push({
        opensAt: normalizeTime(row.firstOpensAt),
        closesAt: normalizeTime(row.firstClosesAt),
      });
    }
    if (row.secondOpensAt && row.secondClosesAt) {
      periods.push({
        opensAt: normalizeTime(row.secondOpensAt),
        closesAt: normalizeTime(row.secondClosesAt),
      });
    }
    return { day, label, periods };
  });
}

function shiftIsoDate(value: string, offset: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function getSpecialDateRange(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const today = `${values.year}-${values.month}-${values.day}`;
  return { from: shiftIsoDate(today, -1), to: shiftIsoDate(today, 7) };
}

function buildSpecialOpeningDays(
  rows: Array<{
    exceptionDate: string;
    exceptionType: string;
    isClosed: boolean;
    reason: string | null;
    firstOpensAt: string | null;
    firstClosesAt: string | null;
    secondOpensAt: string | null;
    secondClosesAt: string | null;
  }>,
): SpecialOpeningDay[] {
  return rows.map((row) => ({
    date: row.exceptionDate,
    exceptionType:
      row.exceptionType === "open" || row.exceptionType === "closed"
        ? row.exceptionType
        : "special",
    isClosed: row.isClosed,
    ...(row.reason?.trim() ? { reason: row.reason.trim() } : {}),
    periods: row.isClosed
      ? []
      : [
          row.firstOpensAt && row.firstClosesAt
            ? {
                opensAt: normalizeTime(row.firstOpensAt),
                closesAt: normalizeTime(row.firstClosesAt),
              }
            : null,
          row.secondOpensAt && row.secondClosesAt
            ? {
                opensAt: normalizeTime(row.secondOpensAt),
                closesAt: normalizeTime(row.secondClosesAt),
              }
            : null,
        ].filter((period): period is { opensAt: string; closesAt: string } =>
          Boolean(period),
        ),
  }));
}

function getTagTone(color: string): ProductTag["tone"] {
  if (color === "green" || color === "red" || color === "gold") {
    return color;
  }

  return "gold";
}

type PublicProductRow = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  fullPriceCents: number;
  halfPriceCents: number | null;
  isSoldOut: boolean;
  imageUrl: string;
};

type PublicTagRow = {
  productId: string;
  name: string;
  color: string;
};

type PublicAllergenRow = {
  productId: string;
  name: string;
  icon: string;
};

function buildPublicProduct(
  product: PublicProductRow,
  tagRows: PublicTagRow[],
  allergenRows: PublicAllergenRow[],
): DemoProduct {
  return {
    id: product.id,
    categoryId: product.categoryId,
    name: product.name,
    description: product.description,
    imageUrl: product.imageUrl,
    imageAlt: `Imagen de ${product.name}`,
    fullPrice: product.fullPriceCents / 100,
    halfPrice:
      product.halfPriceCents === null
        ? undefined
        : product.halfPriceCents / 100,
    tags: tagRows
      .filter((tag) => tag.productId === product.id)
      .map((tag) => ({
        label: tag.name,
        tone: getTagTone(tag.color),
      })),
    allergens: allergenRows
      .filter((allergen) => allergen.productId === product.id)
      .map((allergen) => ({
        label: allergen.name,
        icon: allergen.icon,
      })),
    isSoldOut: product.isSoldOut,
  };
}

async function getPublicTaxonomyRows(
  db: ReturnType<typeof getDatabase>["db"],
  productIds: string[],
  locale: string,
) {
  if (productIds.length === 0) {
    return {
      tagRows: [] as PublicTagRow[],
      allergenRows: [] as PublicAllergenRow[],
    };
  }

  const [tagRows, allergenRows] = await Promise.all([
    db
      .select({
        productId: productTags.productId,
        name: tagTranslations.name,
        color: tags.color,
      })
      .from(productTags)
      .innerJoin(tags, eq(productTags.tagId, tags.id))
      .innerJoin(
        tagTranslations,
        and(
          eq(tagTranslations.tagId, tags.id),
          eq(tagTranslations.locale, locale),
        ),
      )
      .where(
        and(
          inArray(productTags.productId, productIds),
          eq(tags.isActive, true),
        ),
      )
      .orderBy(asc(tags.sortOrder)),
    db
      .select({
        productId: productAllergens.productId,
        name: allergenTranslations.name,
        icon: allergens.icon,
      })
      .from(productAllergens)
      .innerJoin(
        allergens,
        eq(productAllergens.allergenId, allergens.id),
      )
      .innerJoin(
        allergenTranslations,
        and(
          eq(allergenTranslations.allergenId, allergens.id),
          eq(allergenTranslations.locale, locale),
        ),
      )
      .where(
        and(
          inArray(productAllergens.productId, productIds),
          eq(allergens.isActive, true),
        ),
      )
      .orderBy(asc(allergens.sortOrder), asc(allergenTranslations.name)),
  ]);

  return { tagRows, allergenRows };
}

export async function getPublicMenu(locale: string): Promise<DemoMenu> {
  try {
    const { db } = getDatabase();
    const [restaurant] = await db
      .select({
        id: restaurantSettings.id,
        phone: restaurantSettings.phone,
        address: restaurantSettings.address,
        timezone: restaurantSettings.timezone,
        currencyCode: restaurantSettings.currencyCode,
        heroImageUrl: restaurantSettings.heroImageUrl,
        menuDisplaySettings: restaurantSettings.menuDisplaySettings,
        name: restaurantTranslations.name,
        slogan: restaurantTranslations.slogan,
      })
      .from(restaurantSettings)
      .innerJoin(
        restaurantLocales,
        and(
          eq(restaurantLocales.restaurantId, restaurantSettings.id),
          eq(restaurantLocales.locale, locale),
          eq(restaurantLocales.isEnabled, true),
          eq(restaurantLocales.isPublished, true),
        ),
      )
      .innerJoin(
        restaurantTranslations,
        and(
          eq(restaurantTranslations.restaurantId, restaurantSettings.id),
          eq(restaurantTranslations.locale, locale),
        ),
      )
      .limit(1);

    if (!restaurant) {
      throw new Error(`No existe contenido público para el locale "${locale}".`);
    }

    const specialRange = getSpecialDateRange(restaurant.timezone);
    const [hoursRows, specialRows, categoryRows, productRows] = await Promise.all([
      db
        .select()
        .from(openingHours)
        .where(eq(openingHours.restaurantId, restaurant.id))
        .orderBy(asc(openingHours.dayOfWeek)),
      db
        .select()
        .from(specialOpeningHours)
        .where(
          and(
            eq(specialOpeningHours.restaurantId, restaurant.id),
            gte(specialOpeningHours.exceptionDate, specialRange.from),
            lte(specialOpeningHours.exceptionDate, specialRange.to),
          ),
        )
        .orderBy(asc(specialOpeningHours.exceptionDate)),
      db
        .select({
          id: categories.id,
          parentCategoryId: categories.parentCategoryId,
          sortOrder: categories.sortOrder,
          name: categoryTranslations.name,
          description: categoryTranslations.description,
        })
        .from(categories)
        .innerJoin(
          categoryTranslations,
          and(
            eq(categoryTranslations.categoryId, categories.id),
            eq(categoryTranslations.locale, locale),
          ),
        )
        .where(eq(categories.isActive, true))
        .orderBy(
          asc(categories.parentCategoryId),
          asc(categories.sortOrder),
        ),
      db
        .select({
          id: products.id,
          categoryId: products.categoryId,
          parentCategoryId: categories.parentCategoryId,
          name: productTranslations.name,
          description: productTranslations.description,
          fullPriceCents: products.fullPriceCents,
          halfPriceCents: products.halfPriceCents,
          isSoldOut: products.isSoldOut,
          imageUrl: products.imageUrl,
        })
        .from(products)
        .innerJoin(categories, eq(products.categoryId, categories.id))
        .innerJoin(
          productTranslations,
          and(
            eq(productTranslations.productId, products.id),
            eq(productTranslations.locale, locale),
          ),
        )
        .where(and(eq(products.isActive, true), eq(categories.isActive, true)))
        .orderBy(asc(categories.sortOrder), asc(products.sortOrder)),
    ]);

    const productIds = productRows.map((product) => product.id);
    const { tagRows, allergenRows } = await getPublicTaxonomyRows(
      db,
      productIds,
      locale,
    );

    const normalizedHours = buildOpeningDays(hoursRows);

    return {
      restaurant: {
        name: restaurant.name,
        slogan: restaurant.slogan,
        phoneDisplay: restaurant.phone,
        phoneHref: getPhoneHref(restaurant.phone),
        address: restaurant.address,
        heroImageUrl: restaurant.heroImageUrl,
        heroImageAlt:
          "Interior de restaurante usado únicamente como imagen de demostración",
      },
      locale,
      currencyCode: restaurant.currencyCode,
      timeZone: restaurant.timezone,
      categories: categoryRows.map((category) => ({
        id: category.id,
        parentCategoryId: category.parentCategoryId,
        sortOrder: category.sortOrder,
        name: category.name,
        eyebrow: category.description,
      })),
      products: productRows.map((product) =>
        buildPublicProduct(product, tagRows, allergenRows),
      ),
      openingHours: normalizedHours,
      specialOpeningHours: buildSpecialOpeningDays(specialRows),
      displaySettings: normalizeMenuDisplaySettings(
        restaurant.menuDisplaySettings,
      ),
    };
  } catch (error: unknown) {
    throw new PublicMenuRepositoryError({ cause: error });
  }
}

export async function getPublicProductDetail(
  productId: string,
  locale: string,
): Promise<PublicProductDetail | null> {
  try {
    const { db } = getDatabase();
    const [[product], [restaurant]] = await Promise.all([
      db
        .select({
          id: products.id,
          categoryId: products.categoryId,
          parentCategoryId: categories.parentCategoryId,
          name: productTranslations.name,
          description: productTranslations.description,
          fullPriceCents: products.fullPriceCents,
          halfPriceCents: products.halfPriceCents,
          isSoldOut: products.isSoldOut,
          imageUrl: products.imageUrl,
          categoryName: categoryTranslations.name,
          categoryDescription: categoryTranslations.description,
        })
        .from(products)
        .innerJoin(
          categories,
          and(
            eq(products.categoryId, categories.id),
            eq(categories.isActive, true),
          ),
        )
        .innerJoin(
          productTranslations,
          and(
            eq(productTranslations.productId, products.id),
            eq(productTranslations.locale, locale),
          ),
        )
        .innerJoin(
          categoryTranslations,
          and(
            eq(categoryTranslations.categoryId, categories.id),
            eq(categoryTranslations.locale, locale),
          ),
        )
        .where(and(eq(products.id, productId), eq(products.isActive, true)))
        .limit(1),
      db
        .select({
          id: restaurantSettings.id,
          name: restaurantTranslations.name,
          slogan: restaurantTranslations.slogan,
          phone: restaurantSettings.phone,
          address: restaurantSettings.address,
          heroImageUrl: restaurantSettings.heroImageUrl,
          currencyCode: restaurantSettings.currencyCode,
          timezone: restaurantSettings.timezone,
          menuDisplaySettings: restaurantSettings.menuDisplaySettings,
        })
        .from(restaurantSettings)
        .innerJoin(
          restaurantLocales,
          and(
            eq(restaurantLocales.restaurantId, restaurantSettings.id),
            eq(restaurantLocales.locale, locale),
            eq(restaurantLocales.isEnabled, true),
            eq(restaurantLocales.isPublished, true),
          ),
        )
        .innerJoin(
          restaurantTranslations,
          and(
            eq(
              restaurantTranslations.restaurantId,
              restaurantSettings.id,
            ),
            eq(restaurantTranslations.locale, locale),
          ),
        )
        .limit(1),
    ]);

    if (!product || !restaurant) {
      return null;
    }
    const [parentCategory] = product.parentCategoryId
      ? await db
          .select({
            id: categories.id,
            parentCategoryId: categories.parentCategoryId,
            sortOrder: categories.sortOrder,
            name: categoryTranslations.name,
            description: categoryTranslations.description,
          })
          .from(categories)
          .innerJoin(
            categoryTranslations,
            and(
              eq(categoryTranslations.categoryId, categories.id),
              eq(categoryTranslations.locale, locale),
            ),
          )
          .where(
            and(
              eq(categories.id, product.parentCategoryId),
              eq(categories.isActive, true),
            ),
          )
          .limit(1)
      : [undefined];

    if (product.parentCategoryId && !parentCategory) {
      return null;
    }

    const relatedRows = await db
      .select({
        id: products.id,
        categoryId: products.categoryId,
        name: productTranslations.name,
        description: productTranslations.description,
        fullPriceCents: products.fullPriceCents,
        halfPriceCents: products.halfPriceCents,
        isSoldOut: products.isSoldOut,
        imageUrl: products.imageUrl,
      })
      .from(products)
      .innerJoin(
        categories,
        and(
          eq(products.categoryId, categories.id),
          eq(categories.isActive, true),
        ),
      )
      .innerJoin(
        productTranslations,
        and(
          eq(productTranslations.productId, products.id),
          eq(productTranslations.locale, locale),
        ),
      )
      .where(
        and(
          eq(products.categoryId, product.categoryId),
          eq(products.isActive, true),
          ne(products.id, product.id),
        ),
      )
      .orderBy(asc(products.sortOrder))
      .limit(4);
    const detailHours = await db
      .select()
      .from(openingHours)
      .where(eq(openingHours.restaurantId, restaurant.id))
      .orderBy(asc(openingHours.dayOfWeek));
    const specialRange = getSpecialDateRange(restaurant.timezone);
    const detailSpecialHours = await db
      .select()
      .from(specialOpeningHours)
      .where(
        and(
          eq(specialOpeningHours.restaurantId, restaurant.id),
          gte(specialOpeningHours.exceptionDate, specialRange.from),
          lte(specialOpeningHours.exceptionDate, specialRange.to),
        ),
      )
      .orderBy(asc(specialOpeningHours.exceptionDate));
    const allProductIds = [
      product.id,
      ...relatedRows.map((related) => related.id),
    ];
    const { tagRows, allergenRows } = await getPublicTaxonomyRows(
      db,
      allProductIds,
      locale,
    );
    const publicProduct = buildPublicProduct(
      product,
      tagRows,
      allergenRows,
    );

    return {
      locale,
      currencyCode: restaurant.currencyCode,
      restaurant: {
        name: restaurant.name,
        slogan: restaurant.slogan,
        phoneDisplay: restaurant.phone,
        phoneHref: getPhoneHref(restaurant.phone),
        address: restaurant.address,
        heroImageUrl: restaurant.heroImageUrl,
        heroImageAlt: `Imagen principal de ${restaurant.name}`,
      },
      category: {
        id: product.categoryId,
        parentCategoryId: product.parentCategoryId,
        name: product.categoryName,
        eyebrow: product.categoryDescription,
      },
      parentCategory: parentCategory
        ? {
            id: parentCategory.id,
            parentCategoryId: null,
            sortOrder: parentCategory.sortOrder,
            name: parentCategory.name,
            eyebrow: parentCategory.description,
          }
        : null,
      product: publicProduct,
      relatedProducts: relatedRows.map((related) =>
        buildPublicProduct(related, tagRows, allergenRows),
      ),
      displaySettings: normalizeMenuDisplaySettings(
        restaurant.menuDisplaySettings,
      ),
      openingHours: buildOpeningDays(detailHours),
      specialOpeningHours: buildSpecialOpeningDays(detailSpecialHours),
      timeZone: restaurant.timezone,
    };
  } catch (error: unknown) {
    throw new PublicMenuRepositoryError({ cause: error });
  }
}
