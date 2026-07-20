import "server-only";

import { asc, count, eq, sql } from "drizzle-orm";

import { getDatabase } from "@/db";
import {
  categories,
  categoryTranslations,
  products,
  restaurantSettings,
  restaurantTranslations,
} from "@/db/schema";

export type AdminCategoryTranslation = {
  locale: string;
  name: string;
  description: string;
};

export type AdminCategory = {
  id: string;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
  translations: AdminCategoryTranslation[];
};

export type AdminCategoryData = {
  categories: AdminCategory[];
  locales: string[];
  defaultLocale: string;
};

export type CategoryMutationInput = {
  name: string;
  description: string;
  locale: string;
  isActive: boolean;
  sortOrder: number;
};

export class CategoryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CategoryValidationError";
  }
}

async function ensureLocaleExists(
  tx: Parameters<
    Parameters<ReturnType<typeof getDatabase>["db"]["transaction"]>[0]
  >[0],
  locale: string,
) {
  const [configuredLocale] = await tx
    .select({ locale: restaurantTranslations.locale })
    .from(restaurantTranslations)
    .where(eq(restaurantTranslations.locale, locale))
    .limit(1);

  if (!configuredLocale) {
    throw new CategoryValidationError("El idioma seleccionado no está activo.");
  }
}

export async function getAdminCategoryData(): Promise<AdminCategoryData> {
  const { db } = getDatabase();
  const [categoryRows, localeRows, [restaurant]] = await Promise.all([
    db
      .select({
        id: categories.id,
        sortOrder: categories.sortOrder,
        isActive: categories.isActive,
        locale: categoryTranslations.locale,
        name: categoryTranslations.name,
        description: categoryTranslations.description,
        productCount: sql<number>`(
          select count(*)::integer
          from ${products}
          where ${products.categoryId} = ${categories.id}
        )`,
      })
      .from(categories)
      .leftJoin(
        categoryTranslations,
        eq(categoryTranslations.categoryId, categories.id),
      )
      .orderBy(asc(categories.sortOrder), asc(categoryTranslations.locale)),
    db
      .selectDistinct({ locale: restaurantTranslations.locale })
      .from(restaurantTranslations)
      .orderBy(asc(restaurantTranslations.locale)),
    db
      .select({ defaultLocale: restaurantSettings.defaultLocale })
      .from(restaurantSettings)
      .limit(1),
  ]);

  if (!restaurant) {
    throw new CategoryValidationError("No existe un restaurante configurado.");
  }

  const categoriesById = new Map<string, AdminCategory>();

  for (const row of categoryRows) {
    const category = categoriesById.get(row.id) ?? {
      id: row.id,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
      productCount: row.productCount,
      translations: [],
    };

    if (row.locale && row.name !== null && row.description !== null) {
      category.translations.push({
        locale: row.locale,
        name: row.name,
        description: row.description,
      });
    }

    categoriesById.set(row.id, category);
  }

  return {
    categories: [...categoriesById.values()],
    locales: localeRows.map(({ locale }) => locale),
    defaultLocale: restaurant.defaultLocale,
  };
}

export async function createCategory(input: CategoryMutationInput) {
  const { db } = getDatabase();

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('piccolo-categories-order'))`,
    );
    await ensureLocaleExists(tx, input.locale);
    const lockedCategories = await tx
      .select({ id: categories.id })
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.id))
      .for("update");

    if (
      input.sortOrder < 1 ||
      input.sortOrder > lockedCategories.length + 1
    ) {
      throw new CategoryValidationError(
        `El orden debe estar entre 1 y ${lockedCategories.length + 1}.`,
      );
    }

    const [createdCategory] = await tx
      .insert(categories)
      .values({
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      })
      .returning({ id: categories.id });

    if (!createdCategory) {
      throw new Error("No se pudo crear la categoría.");
    }

    const orderedIds = lockedCategories.map(({ id }) => id);
    orderedIds.splice(input.sortOrder - 1, 0, createdCategory.id);

    for (const [index, categoryId] of orderedIds.entries()) {
      await tx
        .update(categories)
        .set({ sortOrder: index + 1, updatedAt: new Date() })
        .where(eq(categories.id, categoryId));
    }

    await tx.insert(categoryTranslations).values({
      categoryId: createdCategory.id,
      locale: input.locale,
      name: input.name,
      description: input.description,
    });

    return createdCategory.id;
  });
}

export async function updateCategory(
  categoryId: string,
  input: CategoryMutationInput,
) {
  const { db } = getDatabase();

  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('piccolo-categories-order'))`,
    );
    await ensureLocaleExists(tx, input.locale);
    const lockedCategories = await tx
      .select({ id: categories.id })
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.id))
      .for("update");
    const currentIndex = lockedCategories.findIndex(
      ({ id }) => id === categoryId,
    );

    if (currentIndex < 0) {
      throw new CategoryValidationError("La categoría ya no existe.");
    }

    if (
      input.sortOrder < 1 ||
      input.sortOrder > lockedCategories.length
    ) {
      throw new CategoryValidationError(
        `El orden debe estar entre 1 y ${lockedCategories.length}.`,
      );
    }

    const orderedIds = lockedCategories.map(({ id }) => id);
    orderedIds.splice(currentIndex, 1);
    orderedIds.splice(input.sortOrder - 1, 0, categoryId);

    await tx
      .update(categories)
      .set({ isActive: input.isActive, updatedAt: new Date() })
      .where(eq(categories.id, categoryId));

    for (const [index, orderedCategoryId] of orderedIds.entries()) {
      await tx
        .update(categories)
        .set({ sortOrder: index + 1, updatedAt: new Date() })
        .where(eq(categories.id, orderedCategoryId));
    }

    await tx
      .insert(categoryTranslations)
      .values({
        categoryId,
        locale: input.locale,
        name: input.name,
        description: input.description,
      })
      .onConflictDoUpdate({
        target: [
          categoryTranslations.categoryId,
          categoryTranslations.locale,
        ],
        set: {
          name: input.name,
          description: input.description,
        },
      });
  });
}

export async function setCategoryVisibility(
  categoryId: string,
  isActive: boolean,
) {
  const { db } = getDatabase();
  const [updatedCategory] = await db
    .update(categories)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(categories.id, categoryId))
    .returning({ id: categories.id });

  if (!updatedCategory) {
    throw new CategoryValidationError("La categoría ya no existe.");
  }
}

export async function reorderCategories(orderedCategoryIds: string[]) {
  const { db } = getDatabase();

  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('piccolo-categories-order'))`,
    );
    const lockedCategories = await tx
      .select({ id: categories.id })
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.id))
      .for("update");
    const existingIds = lockedCategories.map(({ id }) => id);

    if (
      orderedCategoryIds.length !== existingIds.length ||
      new Set(orderedCategoryIds).size !== orderedCategoryIds.length ||
      orderedCategoryIds.some((id) => !existingIds.includes(id))
    ) {
      throw new CategoryValidationError(
        "El orden recibido no contiene todas las categorías exactamente una vez.",
      );
    }

    for (const [index, categoryId] of orderedCategoryIds.entries()) {
      await tx
        .update(categories)
        .set({ sortOrder: index + 1, updatedAt: new Date() })
        .where(eq(categories.id, categoryId));
    }
  });
}

export async function deleteEmptyCategory(categoryId: string) {
  const { db } = getDatabase();

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('piccolo-categories-order'))`,
    );
    const lockedCategories = await tx
      .select({ id: categories.id })
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.id))
      .for("update");

    if (!lockedCategories.some(({ id }) => id === categoryId)) {
      throw new CategoryValidationError("La categoría ya no existe.");
    }

    const [productResult] = await tx
      .select({ productCount: count() })
      .from(products)
      .where(eq(products.categoryId, categoryId));
    const productCount = productResult?.productCount ?? 0;

    if (productCount > 0) {
      return { deleted: false as const, productCount };
    }

    await tx.delete(categories).where(eq(categories.id, categoryId));
    const remainingIds = lockedCategories
      .map(({ id }) => id)
      .filter((id) => id !== categoryId);

    for (const [index, remainingId] of remainingIds.entries()) {
      await tx
        .update(categories)
        .set({ sortOrder: index + 1, updatedAt: new Date() })
        .where(eq(categories.id, remainingId));
    }

    return { deleted: true as const, productCount: 0 };
  });
}
