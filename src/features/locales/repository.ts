import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { getLocaleConfig, isSupportedLocale } from "@/config/locales";
import { getDatabase } from "@/db";
import {
  categories,
  products,
  productTranslations,
  restaurantLocales,
  restaurantSettings,
  restaurantTranslations,
} from "@/db/schema";

export type PublishedLocale = {
  code: string;
  nativeName: string;
  adminName: string;
  htmlLang: string;
  openGraphLocale: string;
  direction: "ltr" | "rtl";
  restaurantName: string;
  restaurantSlogan: string;
  isPrimary: boolean;
};

export async function getPublishedLocales(): Promise<PublishedLocale[]> {
  const { db } = getDatabase();
  const rows = await db
    .select({
      locale: restaurantLocales.locale,
      restaurantName: restaurantTranslations.name,
      restaurantSlogan: restaurantTranslations.slogan,
      primaryLocale: restaurantSettings.defaultLocale,
    })
    .from(restaurantLocales)
    .innerJoin(
      restaurantSettings,
      eq(restaurantLocales.restaurantId, restaurantSettings.id),
    )
    .innerJoin(
      restaurantTranslations,
      and(
        eq(
          restaurantTranslations.restaurantId,
          restaurantLocales.restaurantId,
        ),
        eq(restaurantTranslations.locale, restaurantLocales.locale),
      ),
    )
    .where(
      and(
        eq(restaurantLocales.isEnabled, true),
        eq(restaurantLocales.isPublished, true),
      ),
    )
    .orderBy(asc(restaurantLocales.sortOrder));

  return rows.flatMap((row) => {
    const config = getLocaleConfig(row.locale);

    if (!config || !isSupportedLocale(row.locale)) {
      return [];
    }

    return [
      {
        code: config.code,
        nativeName: config.nativeName,
        adminName: config.adminName,
        htmlLang: config.htmlLang,
        openGraphLocale: config.openGraphLocale,
        direction: config.direction,
        restaurantName: row.restaurantName,
        restaurantSlogan: row.restaurantSlogan,
        isPrimary: row.primaryLocale === row.locale,
      },
    ];
  });
}

export async function isLocalePublished(locale: string) {
  if (!isSupportedLocale(locale)) {
    return false;
  }

  const { db } = getDatabase();
  const [row] = await db
    .select({ locale: restaurantLocales.locale })
    .from(restaurantLocales)
    .where(
      and(
        eq(restaurantLocales.locale, locale),
        eq(restaurantLocales.isEnabled, true),
        eq(restaurantLocales.isPublished, true),
      ),
    )
    .limit(1);

  return Boolean(row);
}

export async function getPublishedProductLocales(productId: string) {
  const { db } = getDatabase();
  const rows = await db
    .select({
      locale: restaurantLocales.locale,
      name: productTranslations.name,
      primaryLocale: restaurantSettings.defaultLocale,
    })
    .from(restaurantLocales)
    .innerJoin(
      restaurantSettings,
      eq(restaurantLocales.restaurantId, restaurantSettings.id),
    )
    .innerJoin(
      productTranslations,
      and(
        eq(productTranslations.productId, productId),
        eq(productTranslations.locale, restaurantLocales.locale),
      ),
    )
    .innerJoin(
      products,
      and(eq(products.id, productId), eq(products.isActive, true)),
    )
    .innerJoin(
      categories,
      and(
        eq(categories.id, products.categoryId),
        eq(categories.isActive, true),
      ),
    )
    .where(
      and(
        eq(restaurantLocales.isEnabled, true),
        eq(restaurantLocales.isPublished, true),
      ),
    )
    .orderBy(asc(restaurantLocales.sortOrder));

  return rows.flatMap((row) => {
    const config = getLocaleConfig(row.locale);
    return config && row.name.trim()
      ? [
          {
            code: config.code,
            name: row.name,
            openGraphLocale: config.openGraphLocale,
            isPrimary: row.primaryLocale === row.locale,
          },
        ]
      : [];
  });
}
