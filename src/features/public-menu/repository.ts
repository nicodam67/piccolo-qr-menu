import "server-only";

import { and, asc, eq, inArray, ne } from "drizzle-orm";

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

    const [hoursRows, categoryRows, productRows] = await Promise.all([
      db
        .select()
        .from(openingHours)
        .where(eq(openingHours.restaurantId, restaurant.id))
        .orderBy(asc(openingHours.dayOfWeek)),
      db
        .select({
          id: categories.id,
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
        .orderBy(asc(categories.sortOrder)),
      db
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

    const hoursByDay = new Map(
      hoursRows.map((openingDay) => [openingDay.dayOfWeek, openingDay]),
    );
    const normalizedHours: OpeningDay[] = dayMetadata.map(
      ({ day, label }, index) => {
        const openingDay = hoursByDay.get(index + 1);

        if (!openingDay || openingDay.isClosed) {
          return { day, label, periods: [] };
        }

        const periods = [];

        if (openingDay.firstOpensAt && openingDay.firstClosesAt) {
          periods.push({
            opensAt: normalizeTime(openingDay.firstOpensAt),
            closesAt: normalizeTime(openingDay.firstClosesAt),
          });
        }

        if (openingDay.secondOpensAt && openingDay.secondClosesAt) {
          periods.push({
            opensAt: normalizeTime(openingDay.secondOpensAt),
            closesAt: normalizeTime(openingDay.secondClosesAt),
          });
        }

        return { day, label, periods };
      },
    );

    return {
      restaurant: {
        name: restaurant.name,
        slogan: restaurant.slogan,
        phoneDisplay: `${restaurant.phone} · DEMO`,
        phoneHref: getPhoneHref(restaurant.phone),
        address: restaurant.address,
        heroImageUrl: restaurant.heroImageUrl,
        heroImageAlt:
          "Interior de restaurante usado únicamente como imagen de demostración",
      },
      locale,
      timeZone: restaurant.timezone,
      categories: categoryRows.map((category) => ({
        id: category.id,
        name: category.name,
        eyebrow: category.description,
      })),
      products: productRows.map((product) =>
        buildPublicProduct(product, tagRows, allergenRows),
      ),
      openingHours: normalizedHours,
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
          name: restaurantTranslations.name,
          slogan: restaurantTranslations.slogan,
          phone: restaurantSettings.phone,
          address: restaurantSettings.address,
          heroImageUrl: restaurantSettings.heroImageUrl,
          currencyCode: restaurantSettings.currencyCode,
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
        name: product.categoryName,
        eyebrow: product.categoryDescription,
      },
      product: publicProduct,
      relatedProducts: relatedRows.map((related) =>
        buildPublicProduct(related, tagRows, allergenRows),
      ),
      displaySettings: normalizeMenuDisplaySettings(
        restaurant.menuDisplaySettings,
      ),
    };
  } catch (error: unknown) {
    throw new PublicMenuRepositoryError({ cause: error });
  }
}
