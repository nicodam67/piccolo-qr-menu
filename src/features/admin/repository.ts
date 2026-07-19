import "server-only";

import { eq, sql } from "drizzle-orm";

import { getDatabase } from "@/db";
import {
  allergens,
  categories,
  products,
  restaurantSettings,
  restaurantTranslations,
  tags,
} from "@/db/schema";

export type AdminDashboardSummary = {
  restaurantName: string;
  locale: string;
  databaseStatus: "connected";
  categoryCount: number;
  productCount: number;
  languageCount: number;
  allergenCount: number;
  tagCount: number;
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
        categoryCount: sql<number>`(select count(*)::integer from ${categories})`,
        productCount: sql<number>`(select count(*)::integer from ${products})`,
        languageCount: sql<number>`(select count(distinct ${restaurantTranslations.locale})::integer from ${restaurantTranslations})`,
        allergenCount: sql<number>`(select count(*)::integer from ${allergens})`,
        tagCount: sql<number>`(select count(*)::integer from ${tags})`,
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
