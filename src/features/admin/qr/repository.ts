import "server-only";

import { getDatabase } from "@/db";
import { restaurantSettings } from "@/db/schema";
import { getPublishedLocales } from "@/features/locales/repository";
import type { PublishedLocale } from "@/features/locales/repository";
import {
  getConfiguredPublicSiteUrl,
  getPublicSiteUrl,
} from "@/features/public-menu/site-url";

export type QrAdminData = {
  defaultLocale: string;
  locales: PublishedLocale[];
  restaurantNames: Record<string, string>;
  restaurantSlogans: Record<string, string>;
  publicBaseUrl: string;
  configuredDomain: boolean;
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

  const translations = await getPublishedLocales();
  const configuredSiteUrl = getConfiguredPublicSiteUrl();
  const siteUrl = configuredSiteUrl ?? (await getPublicSiteUrl());

  if (translations.length === 0) {
    throw new Error("El restaurante no tiene traducciones configuradas.");
  }

  return {
    defaultLocale: restaurant.defaultLocale,
    locales: translations,
    restaurantNames: Object.fromEntries(
      translations.map(({ code, restaurantName }) => [
        code,
        restaurantName,
      ]),
    ),
    restaurantSlogans: Object.fromEntries(
      translations.map(({ code, restaurantSlogan }) => [
        code,
        restaurantSlogan,
      ]),
    ),
    publicBaseUrl: siteUrl.toString(),
    configuredDomain: Boolean(configuredSiteUrl),
  };
}
