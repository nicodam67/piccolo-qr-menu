import "server-only";

import { asc, eq } from "drizzle-orm";

import { getDatabase } from "@/db";
import {
  restaurantSettings,
  restaurantTranslations,
} from "@/db/schema";

export type QrAdminData = {
  defaultLocale: string;
  locales: string[];
  restaurantNames: Record<string, string>;
};

export async function getQrAdminData(): Promise<QrAdminData> {
  const { db } = getDatabase();
  const [restaurant] = await db
    .select({
      id: restaurantSettings.id,
      defaultLocale: restaurantSettings.defaultLocale,
    })
    .from(restaurantSettings)
    .limit(1);

  if (!restaurant) {
    throw new Error("No existe un restaurante configurado.");
  }

  const translations = await db
    .select({
      locale: restaurantTranslations.locale,
      name: restaurantTranslations.name,
    })
    .from(restaurantTranslations)
    .where(eq(restaurantTranslations.restaurantId, restaurant.id))
    .orderBy(asc(restaurantTranslations.locale));

  if (translations.length === 0) {
    throw new Error("El restaurante no tiene traducciones configuradas.");
  }

  return {
    defaultLocale: restaurant.defaultLocale,
    locales: translations.map(({ locale }) => locale),
    restaurantNames: Object.fromEntries(
      translations.map(({ locale, name }) => [locale, name]),
    ),
  };
}
