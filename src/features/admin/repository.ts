import "server-only";

import { eq, sql } from "drizzle-orm";

import { getDatabase } from "@/db";
import {
  allergens,
  categories,
  customers,
  products,
  reservations,
  restaurantLocales,
  restaurantSettings,
  restaurantTranslations,
  tags,
} from "@/db/schema";

export type AdminDashboardSummary = {
  restaurantName: string;
  locale: string;
  databaseStatus: "connected";
  categoryCount: number;
  subcategoryCount: number;
  productCount: number;
  languageCount: number;
  allergenCount: number;
  tagCount: number;
  todayReservationCount: number;
  todayGuestCount: number;
  todayPendingCount: number;
  customerCount: number;
};

export class AdminDashboardRepositoryError extends Error {
  constructor(options?: ErrorOptions) {
    super("No se pudieron cargar los datos del panel.", options);
    this.name = "AdminDashboardRepositoryError";
  }
}

export async function getAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  try {
    const { db } = getDatabase();
    const [summary] = await db
      .select({
        restaurantName: restaurantTranslations.name,
        locale: restaurantSettings.defaultLocale,
        categoryCount: sql<number>`(select count(*)::integer from ${categories} where ${categories.isActive} = true and ${categories.parentCategoryId} is null)`,
        subcategoryCount: sql<number>`(select count(*)::integer from ${categories} where ${categories.isActive} = true and ${categories.parentCategoryId} is not null)`,
        productCount: sql<number>`(select count(*)::integer from ${products} where ${products.isActive} = true)`,
        languageCount: sql<number>`(select count(*)::integer from ${restaurantLocales} where ${restaurantLocales.isEnabled} = true)`,
        allergenCount: sql<number>`(select count(*)::integer from ${allergens})`,
        tagCount: sql<number>`(select count(*)::integer from ${tags})`,
        todayReservationCount: sql<number>`(
          select count(*)::integer from ${reservations}
          where ${reservations.restaurantId} = ${restaurantSettings.id}
            and ${reservations.reservationDate} = (current_timestamp at time zone ${restaurantSettings.timezone})::date
            and ${reservations.status} <> 'cancelled'
        )`,
        todayGuestCount: sql<number>`(
          select coalesce(sum(${reservations.partySize}), 0)::integer from ${reservations}
          where ${reservations.restaurantId} = ${restaurantSettings.id}
            and ${reservations.reservationDate} = (current_timestamp at time zone ${restaurantSettings.timezone})::date
            and ${reservations.status} not in ('cancelled', 'no_show')
        )`,
        todayPendingCount: sql<number>`(
          select count(*)::integer from ${reservations}
          where ${reservations.restaurantId} = ${restaurantSettings.id}
            and ${reservations.reservationDate} = (current_timestamp at time zone ${restaurantSettings.timezone})::date
            and ${reservations.status} = 'pending'
        )`,
        customerCount: sql<number>`(select count(*)::integer from ${customers} where ${customers.restaurantId} = ${restaurantSettings.id} and ${customers.isActive} = true)`,
      })
      .from(restaurantSettings)
      .innerJoin(
        restaurantTranslations,
        eq(restaurantTranslations.restaurantId, restaurantSettings.id),
      )
      .where(
        eq(
          restaurantTranslations.locale,
          restaurantSettings.defaultLocale,
        ),
      )
      .limit(1);

    if (!summary) {
      throw new Error("No existe un restaurante configurado.");
    }

    return {
      ...summary,
      databaseStatus: "connected",
    };
  } catch (error: unknown) {
    throw new AdminDashboardRepositoryError({ cause: error });
  }
}
