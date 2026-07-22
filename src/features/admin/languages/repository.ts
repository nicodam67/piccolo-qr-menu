import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { SUPPORTED_LOCALES, type SupportedLocaleCode } from "@/config/locales";
import { getDatabase } from "@/db";
import {
  allergenTranslations,
  allergens,
  categories,
  categoryTranslations,
  productAllergens,
  products,
  productTags,
  productTranslations,
  restaurantLocales,
  restaurantSettings,
  restaurantTranslations,
  tags,
  tagTranslations,
} from "@/db/schema";
import { normalizeMenuDisplaySettings } from "@/features/menu-settings/config";

export type CoverageSection = {
  translated: number;
  total: number;
};

export type LanguageCoverage = {
  restaurant: CoverageSection;
  categories: CoverageSection;
  products: CoverageSection;
  descriptions: CoverageSection;
  tags: CoverageSection;
  allergens: CoverageSection;
  translated: number;
  total: number;
  pending: number;
  percentage: number;
  complete: boolean;
};

export type LanguageManagementItem = {
  config: (typeof SUPPORTED_LOCALES)[number];
  configured: boolean;
  isEnabled: boolean;
  isPublished: boolean;
  isPrimary: boolean;
  sortOrder: number | null;
  hasTranslations: boolean;
  coverage: LanguageCoverage;
};

export type TranslationEditorItem = {
  id: string;
  technicalCode?: string;
  referenceName: string;
  referenceDescription?: string;
  translatedName: string;
  translatedDescription?: string;
  descriptionRequired?: boolean;
};

export type LanguageEditorData = {
  locale: SupportedLocaleCode;
  primaryLocale: string;
  restaurant: {
    referenceName: string;
    referenceSlogan: string;
    referenceDescription: string;
    name: string;
    slogan: string;
    description: string;
  };
  categories: TranslationEditorItem[];
  products: Array<
    TranslationEditorItem & { categoryId: string; categoryName: string }
  >;
  tags: TranslationEditorItem[];
  allergens: TranslationEditorItem[];
};

export type LanguageManagementData = {
  restaurantId: string;
  primaryLocale: string;
  languages: LanguageManagementItem[];
  editor: LanguageEditorData | null;
};

type TranslationRow = {
  locale: string | null;
  name: string | null;
  description?: string | null;
};

function getTranslation<T extends TranslationRow>(
  rows: T[],
  locale: string,
) {
  return rows.find((row) => row.locale === locale);
}

function section(translated: number, total: number): CoverageSection {
  return { translated, total };
}

export async function getLanguageManagementData(
  editorLocale?: string,
): Promise<LanguageManagementData> {
  const { db } = getDatabase();
  const [restaurant] = await db
    .select({
      id: restaurantSettings.id,
      primaryLocale: restaurantSettings.defaultLocale,
      menuDisplaySettings: restaurantSettings.menuDisplaySettings,
    })
    .from(restaurantSettings)
    .limit(1);

  if (!restaurant) {
    throw new Error("No existe un restaurante configurado.");
  }

  const [
    localeRows,
    restaurantTranslationRows,
    categoryRows,
    productRows,
    tagRows,
    allergenRows,
  ] = await Promise.all([
    db
      .select()
      .from(restaurantLocales)
      .where(eq(restaurantLocales.restaurantId, restaurant.id))
      .orderBy(asc(restaurantLocales.sortOrder)),
    db
      .select()
      .from(restaurantTranslations)
      .where(eq(restaurantTranslations.restaurantId, restaurant.id)),
    db
      .select({
        id: categories.id,
        sortOrder: categories.sortOrder,
        locale: categoryTranslations.locale,
        name: categoryTranslations.name,
        description: categoryTranslations.description,
      })
      .from(categories)
      .leftJoin(
        categoryTranslations,
        eq(categoryTranslations.categoryId, categories.id),
      )
      .where(eq(categories.isActive, true))
      .orderBy(asc(categories.sortOrder)),
    db
      .select({
        id: products.id,
        categoryId: products.categoryId,
        sortOrder: products.sortOrder,
        locale: productTranslations.locale,
        name: productTranslations.name,
        description: productTranslations.description,
      })
      .from(products)
      .innerJoin(
        categories,
        and(
          eq(products.categoryId, categories.id),
          eq(categories.isActive, true),
        ),
      )
      .leftJoin(
        productTranslations,
        eq(productTranslations.productId, products.id),
      )
      .where(eq(products.isActive, true))
      .orderBy(asc(products.categoryId), asc(products.sortOrder)),
    db
      .select({
        id: tags.id,
        color: tags.color,
        locale: tagTranslations.locale,
        name: tagTranslations.name,
      })
      .from(tags)
      .innerJoin(productTags, eq(productTags.tagId, tags.id))
      .innerJoin(products, eq(productTags.productId, products.id))
      .innerJoin(
        categories,
        and(
          eq(products.categoryId, categories.id),
          eq(categories.isActive, true),
        ),
      )
      .leftJoin(tagTranslations, eq(tagTranslations.tagId, tags.id))
      .where(and(eq(tags.isActive, true), eq(products.isActive, true)))
      .orderBy(asc(tags.sortOrder)),
    db
      .select({
        id: allergens.id,
        code: allergens.code,
        locale: allergenTranslations.locale,
        name: allergenTranslations.name,
      })
      .from(allergens)
      .innerJoin(
        productAllergens,
        eq(productAllergens.allergenId, allergens.id),
      )
      .innerJoin(products, eq(productAllergens.productId, products.id))
      .innerJoin(
        categories,
        and(
          eq(products.categoryId, categories.id),
          eq(categories.isActive, true),
        ),
      )
      .leftJoin(
        allergenTranslations,
        eq(allergenTranslations.allergenId, allergens.id),
      )
      .where(and(eq(allergens.isActive, true), eq(products.isActive, true)))
      .orderBy(asc(allergens.sortOrder)),
  ]);

  const displaySettings = normalizeMenuDisplaySettings(
    restaurant.menuDisplaySettings,
  );
  const uniqueCategories = [...new Set(categoryRows.map(({ id }) => id))];
  const uniqueProducts = [...new Set(productRows.map(({ id }) => id))];
  const uniqueTags = [...new Set(tagRows.map(({ id }) => id))];
  const uniqueAllergens = [...new Set(allergenRows.map(({ id }) => id))];
  const localeState = new Map(localeRows.map((row) => [row.locale, row]));

  const coverageFor = (locale: string): LanguageCoverage => {
    const restaurantTranslation = restaurantTranslationRows.find(
      (row) => row.locale === locale,
    );
    const primaryProductRows = productRows.filter(
      (row) => row.locale === restaurant.primaryLocale,
    );
    const requiredDescriptionIds = displaySettings.showDescriptions
      ? new Set(
          primaryProductRows
            .filter((row) => row.description?.trim())
            .map(({ id }) => id),
        )
      : new Set<string>();
    const translatedRestaurant = restaurantTranslation?.name.trim() ? 1 : 0;
    const translatedCategories = uniqueCategories.filter((id) =>
      categoryRows.some(
        (row) => row.id === id && row.locale === locale && row.name?.trim(),
      ),
    ).length;
    const translatedProducts = uniqueProducts.filter((id) =>
      productRows.some(
        (row) => row.id === id && row.locale === locale && row.name?.trim(),
      ),
    ).length;
    const translatedDescriptions = [...requiredDescriptionIds].filter((id) =>
      productRows.some(
        (row) =>
          row.id === id &&
          row.locale === locale &&
          row.description?.trim(),
      ),
    ).length;
    const translatedTags = uniqueTags.filter((id) =>
      tagRows.some(
        (row) => row.id === id && row.locale === locale && row.name?.trim(),
      ),
    ).length;
    const translatedAllergens = uniqueAllergens.filter((id) =>
      allergenRows.some(
        (row) => row.id === id && row.locale === locale && row.name?.trim(),
      ),
    ).length;
    const sections = {
      restaurant: section(translatedRestaurant, 1),
      categories: section(translatedCategories, uniqueCategories.length),
      products: section(translatedProducts, uniqueProducts.length),
      descriptions: section(
        translatedDescriptions,
        requiredDescriptionIds.size,
      ),
      tags: section(translatedTags, uniqueTags.length),
      allergens: section(translatedAllergens, uniqueAllergens.length),
    };
    const translated = Object.values(sections).reduce(
      (total, value) => total + value.translated,
      0,
    );
    const total = Object.values(sections).reduce(
      (sum, value) => sum + value.total,
      0,
    );
    const complete = translated === total;

    return {
      ...sections,
      translated,
      total,
      pending: total - translated,
      percentage: complete ? 100 : Math.floor((translated / total) * 100),
      complete,
    };
  };

  const languages = SUPPORTED_LOCALES.map((config) => {
    const state = localeState.get(config.code);
    const hasTranslations =
      restaurantTranslationRows.some((row) => row.locale === config.code) ||
      categoryRows.some((row) => row.locale === config.code) ||
      productRows.some((row) => row.locale === config.code) ||
      tagRows.some((row) => row.locale === config.code) ||
      allergenRows.some((row) => row.locale === config.code);

    return {
      config,
      configured: Boolean(state),
      isEnabled: state?.isEnabled ?? false,
      isPublished: state?.isPublished ?? false,
      isPrimary: restaurant.primaryLocale === config.code,
      sortOrder: state?.sortOrder ?? null,
      hasTranslations,
      coverage: coverageFor(config.code),
    };
  });

  const selectedConfig = editorLocale
    ? SUPPORTED_LOCALES.find(({ code }) => code === editorLocale)
    : null;
  const selectedState = editorLocale ? localeState.get(editorLocale) : null;
  let editor: LanguageEditorData | null = null;

  if (selectedConfig && selectedState?.isEnabled) {
    const primaryRestaurant = restaurantTranslationRows.find(
      (row) => row.locale === restaurant.primaryLocale,
    );
    const selectedRestaurant = restaurantTranslationRows.find(
      (row) => row.locale === selectedConfig.code,
    );
    const groupRows = <T extends { id: string }>(rows: T[], id: string) =>
      rows.filter((row) => row.id === id);
    const categoryReference = new Map(
      uniqueCategories.map((id) => [
        id,
        getTranslation(groupRows(categoryRows, id), restaurant.primaryLocale),
      ]),
    );

    editor = {
      locale: selectedConfig.code,
      primaryLocale: restaurant.primaryLocale,
      restaurant: {
        referenceName: primaryRestaurant?.name ?? "",
        referenceSlogan: primaryRestaurant?.slogan ?? "",
        referenceDescription: primaryRestaurant?.description ?? "",
        name: selectedRestaurant?.name ?? "",
        slogan: selectedRestaurant?.slogan ?? "",
        description: selectedRestaurant?.description ?? "",
      },
      categories: uniqueCategories.map((id) => {
        const rows = groupRows(categoryRows, id);
        const reference = getTranslation(rows, restaurant.primaryLocale);
        const translated = getTranslation(rows, selectedConfig.code);
        return {
          id,
          referenceName: reference?.name ?? "",
          translatedName: translated?.name ?? "",
        };
      }),
      products: uniqueProducts.map((id) => {
        const rows = groupRows(productRows, id);
        const reference = getTranslation(rows, restaurant.primaryLocale);
        const translated = getTranslation(rows, selectedConfig.code);
        const row = rows[0];
        return {
          id,
          categoryId: row?.categoryId ?? "",
          categoryName:
            categoryReference.get(row?.categoryId ?? "")?.name ?? "",
          referenceName: reference?.name ?? "",
          referenceDescription: reference?.description ?? "",
          translatedName: translated?.name ?? "",
          translatedDescription: translated?.description ?? "",
          descriptionRequired:
            displaySettings.showDescriptions &&
            Boolean(reference?.description?.trim()),
        };
      }),
      tags: uniqueTags.map((id) => {
        const rows = groupRows(tagRows, id);
        return {
          id,
          referenceName:
            getTranslation(rows, restaurant.primaryLocale)?.name ?? "",
          translatedName:
            getTranslation(rows, selectedConfig.code)?.name ?? "",
        };
      }),
      allergens: uniqueAllergens.map((id) => {
        const rows = groupRows(allergenRows, id);
        return {
          id,
          technicalCode: rows[0]?.code,
          referenceName:
            getTranslation(rows, restaurant.primaryLocale)?.name ?? "",
          translatedName:
            getTranslation(rows, selectedConfig.code)?.name ?? "",
        };
      }),
    };
  }

  return {
    restaurantId: restaurant.id,
    primaryLocale: restaurant.primaryLocale,
    languages,
    editor,
  };
}
