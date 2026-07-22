import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { getDatabase } from "@/db";
import {
  openingHours,
  restaurantSettings,
  restaurantTranslations,
} from "@/db/schema";

export type BrandingTranslation = {
  locale: string;
  name: string;
  slogan: string;
  description: string;
};

export type BrandingOpeningDay = {
  dayOfWeek: number;
  label: string;
  isClosed: boolean;
  firstOpensAt: string;
  firstClosesAt: string;
  secondOpensAt: string;
  secondClosesAt: string;
};

export type RestaurantBrandingData = {
  id: string;
  phone: string;
  address: string;
  timezone: string;
  currencyCode: string;
  defaultLocale: string;
  heroImageUrl: string;
  translations: BrandingTranslation[];
  openingHours: BrandingOpeningDay[];
};

export type RestaurantBrandingInput = Omit<
  RestaurantBrandingData,
  "id" | "translations"
> & {
  locale: string;
  name: string;
  slogan: string;
  description: string;
};

export class BrandingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrandingValidationError";
  }
}

const dayLabels = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

function normalizeTime(value: string | null) {
  return value?.slice(0, 5) ?? "";
}

export async function getRestaurantBranding(): Promise<RestaurantBrandingData> {
  const { db } = getDatabase();
  const [restaurant] = await db
    .select()
    .from(restaurantSettings)
    .limit(1);

  if (!restaurant) {
    throw new BrandingValidationError("No existe un restaurante configurado.");
  }

  const [translationRows, openingRows] = await Promise.all([
    db
      .select({
        locale: restaurantTranslations.locale,
        name: restaurantTranslations.name,
        slogan: restaurantTranslations.slogan,
        description: restaurantTranslations.description,
      })
      .from(restaurantTranslations)
      .where(eq(restaurantTranslations.restaurantId, restaurant.id))
      .orderBy(asc(restaurantTranslations.locale)),
    db
      .select()
      .from(openingHours)
      .where(eq(openingHours.restaurantId, restaurant.id))
      .orderBy(asc(openingHours.dayOfWeek)),
  ]);

  const openingByDay = new Map(
    openingRows.map((openingDay) => [openingDay.dayOfWeek, openingDay]),
  );

  return {
    id: restaurant.id,
    phone: restaurant.phone,
    address: restaurant.address,
    timezone: restaurant.timezone,
    currencyCode: restaurant.currencyCode,
    defaultLocale: restaurant.defaultLocale,
    heroImageUrl: restaurant.heroImageUrl,
    translations: translationRows,
    openingHours: dayLabels.map((label, index) => {
      const dayOfWeek = index + 1;
      const openingDay = openingByDay.get(dayOfWeek);

      return {
        dayOfWeek,
        label,
        isClosed: openingDay?.isClosed ?? true,
        firstOpensAt: normalizeTime(openingDay?.firstOpensAt ?? null),
        firstClosesAt: normalizeTime(openingDay?.firstClosesAt ?? null),
        secondOpensAt: normalizeTime(openingDay?.secondOpensAt ?? null),
        secondClosesAt: normalizeTime(openingDay?.secondClosesAt ?? null),
      };
    }),
  };
}

export async function updateRestaurantBranding(
  input: RestaurantBrandingInput,
) {
  const { db } = getDatabase();

  await db.transaction(async (tx) => {
    const [restaurant] = await tx
      .select({ id: restaurantSettings.id })
      .from(restaurantSettings)
      .limit(1)
      .for("update");

    if (!restaurant) {
      throw new BrandingValidationError(
        "No existe un restaurante configurado.",
      );
    }

    const existingTranslations = await tx
      .select({ locale: restaurantTranslations.locale })
      .from(restaurantTranslations)
      .where(eq(restaurantTranslations.restaurantId, restaurant.id));
    const existingLocales = new Set(
      existingTranslations.map(({ locale }) => locale),
    );

    if (!existingLocales.has(input.locale)) {
      throw new BrandingValidationError(
        "Solo se pueden editar traducciones existentes.",
      );
    }

    if (!existingLocales.has(input.defaultLocale)) {
      throw new BrandingValidationError(
        "El idioma predeterminado debe tener una traducción existente.",
      );
    }

    await tx
      .update(restaurantSettings)
      .set({
        phone: input.phone,
        address: input.address,
        timezone: input.timezone,
        currencyCode: input.currencyCode,
        defaultLocale: input.defaultLocale,
        heroImageUrl: input.heroImageUrl,
        updatedAt: new Date(),
      })
      .where(eq(restaurantSettings.id, restaurant.id));

    await tx
      .update(restaurantTranslations)
      .set({
        name: input.name,
        slogan: input.slogan,
        description: input.description,
      })
      .where(
        and(
          eq(restaurantTranslations.restaurantId, restaurant.id),
          eq(restaurantTranslations.locale, input.locale),
        ),
      );

    for (const openingDay of input.openingHours) {
      await tx
        .insert(openingHours)
        .values({
          restaurantId: restaurant.id,
          dayOfWeek: openingDay.dayOfWeek,
          isClosed: openingDay.isClosed,
          firstOpensAt: openingDay.isClosed
            ? null
            : openingDay.firstOpensAt,
          firstClosesAt: openingDay.isClosed
            ? null
            : openingDay.firstClosesAt,
          secondOpensAt:
            openingDay.isClosed || !openingDay.secondOpensAt
              ? null
              : openingDay.secondOpensAt,
          secondClosesAt:
            openingDay.isClosed || !openingDay.secondClosesAt
              ? null
              : openingDay.secondClosesAt,
        })
        .onConflictDoUpdate({
          target: [openingHours.restaurantId, openingHours.dayOfWeek],
          set: {
            isClosed: openingDay.isClosed,
            firstOpensAt: openingDay.isClosed
              ? null
              : openingDay.firstOpensAt,
            firstClosesAt: openingDay.isClosed
              ? null
              : openingDay.firstClosesAt,
            secondOpensAt:
              openingDay.isClosed || !openingDay.secondOpensAt
                ? null
                : openingDay.secondOpensAt,
            secondClosesAt:
              openingDay.isClosed || !openingDay.secondClosesAt
                ? null
                : openingDay.secondClosesAt,
          },
        });
    }
  });
}
