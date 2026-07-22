import "server-only";

import { asc, count, eq, sql } from "drizzle-orm";

import { getDatabase } from "@/db";
import { assertValidCategoryParent } from "@/features/categories/hierarchy";
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
  parentCategoryId: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
  childCount: number;
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
  parentCategoryId: string | null;
};

export class CategoryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CategoryValidationError";
  }
}

type CategoryOrderRow = {
  id: string;
  parentCategoryId: string | null;
  sortOrder: number;
};

function sameParent(
  left: string | null,
  right: string | null,
) {
  return left === right;
}

async function persistSiblingOrder(
  tx: Parameters<
    Parameters<ReturnType<typeof getDatabase>["db"]["transaction"]>[0]
  >[0],
  ids: string[],
) {
  for (const [index, id] of ids.entries()) {
    await tx
      .update(categories)
      .set({ sortOrder: index + 1, updatedAt: new Date() })
      .where(eq(categories.id, id));
  }
}

function validateParent(
  rows: CategoryOrderRow[],
  categoryId: string | null,
  parentCategoryId: string | null,
) {
  try {
    assertValidCategoryParent(rows, categoryId, parentCategoryId);
  } catch (error) {
    throw new CategoryValidationError(
      error instanceof Error ? error.message : "Jerarquía no válida.",
    );
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
        parentCategoryId: categories.parentCategoryId,
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
        childCount: sql<number>`(
          select count(*)::integer
          from ${categories} child
          where child.parent_category_id = ${categories.id}
        )`,
      })
      .from(categories)
      .leftJoin(
        categoryTranslations,
        eq(categoryTranslations.categoryId, categories.id),
      )
      .orderBy(
        sql`${categories.parentCategoryId} nulls first`,
        asc(categories.sortOrder),
        asc(categoryTranslations.locale),
      ),
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
      parentCategoryId: row.parentCategoryId,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
      productCount: row.productCount,
      childCount: row.childCount,
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
      .select({
        id: categories.id,
        parentCategoryId: categories.parentCategoryId,
        sortOrder: categories.sortOrder,
      })
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.id))
      .for("update");
    validateParent(lockedCategories, null, input.parentCategoryId);
    const siblings = lockedCategories.filter(({ parentCategoryId }) =>
      sameParent(parentCategoryId, input.parentCategoryId),
    );

    if (
      input.sortOrder < 1 ||
      input.sortOrder > siblings.length + 1
    ) {
      throw new CategoryValidationError(
        `El orden debe estar entre 1 y ${siblings.length + 1}.`,
      );
    }

    const [createdCategory] = await tx
      .insert(categories)
      .values({
        parentCategoryId: input.parentCategoryId,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      })
      .returning({ id: categories.id });

    if (!createdCategory) {
      throw new Error("No se pudo crear la categoría.");
    }

    const orderedIds = siblings.map(({ id }) => id);
    orderedIds.splice(input.sortOrder - 1, 0, createdCategory.id);
    await persistSiblingOrder(tx, orderedIds);

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
      .select({
        id: categories.id,
        parentCategoryId: categories.parentCategoryId,
        sortOrder: categories.sortOrder,
      })
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.id))
      .for("update");
    const currentCategory = lockedCategories.find(
      ({ id }) => id === categoryId,
    );

    if (!currentCategory) {
      throw new CategoryValidationError("La categoría ya no existe.");
    }
    validateParent(lockedCategories, categoryId, input.parentCategoryId);
    const targetSiblings = lockedCategories.filter(
      ({ id, parentCategoryId }) =>
        id !== categoryId &&
        sameParent(parentCategoryId, input.parentCategoryId),
    );

    if (
      input.sortOrder < 1 ||
      input.sortOrder > targetSiblings.length + 1
    ) {
      throw new CategoryValidationError(
        `El orden debe estar entre 1 y ${targetSiblings.length + 1}.`,
      );
    }

    const oldSiblingIds = lockedCategories
      .filter(
        ({ id, parentCategoryId }) =>
          id !== categoryId &&
          sameParent(parentCategoryId, currentCategory.parentCategoryId),
      )
      .map(({ id }) => id);
    const targetSiblingIds = targetSiblings.map(({ id }) => id);
    targetSiblingIds.splice(input.sortOrder - 1, 0, categoryId);

    await tx
      .update(categories)
      .set({
        parentCategoryId: input.parentCategoryId,
        isActive: input.isActive,
        updatedAt: new Date(),
      })
      .where(eq(categories.id, categoryId));
    if (
      !sameParent(
        currentCategory.parentCategoryId,
        input.parentCategoryId,
      )
    ) {
      await persistSiblingOrder(tx, oldSiblingIds);
    }
    await persistSiblingOrder(tx, targetSiblingIds);

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

export async function reorderCategories(
  parentCategoryId: string | null,
  orderedCategoryIds: string[],
) {
  const { db } = getDatabase();

  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('piccolo-categories-order'))`,
    );
    const lockedCategories = await tx
      .select({
        id: categories.id,
        parentCategoryId: categories.parentCategoryId,
      })
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.id))
      .for("update");
    if (
      parentCategoryId !== null &&
      !lockedCategories.some(
        ({ id, parentCategoryId: candidateParent }) =>
          id === parentCategoryId && candidateParent === null,
      )
    ) {
      throw new CategoryValidationError(
        "La categoría principal ya no existe.",
      );
    }
    const existingIds = lockedCategories
      .filter(({ parentCategoryId: currentParent }) =>
        sameParent(currentParent, parentCategoryId),
      )
      .map(({ id }) => id);

    if (
      orderedCategoryIds.length !== existingIds.length ||
      new Set(orderedCategoryIds).size !== orderedCategoryIds.length ||
      orderedCategoryIds.some((id) => !existingIds.includes(id))
    ) {
      throw new CategoryValidationError(
        "El orden recibido no contiene todas las categorías exactamente una vez.",
      );
    }

    await persistSiblingOrder(tx, orderedCategoryIds);
  });
}

export async function deleteEmptyCategory(categoryId: string) {
  const { db } = getDatabase();

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('piccolo-categories-order'))`,
    );
    const lockedCategories = await tx
      .select({
        id: categories.id,
        parentCategoryId: categories.parentCategoryId,
      })
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.id))
      .for("update");

    const currentCategory = lockedCategories.find(({ id }) => id === categoryId);
    if (!currentCategory) {
      throw new CategoryValidationError("La categoría ya no existe.");
    }

    const [productResult] = await tx
      .select({ productCount: count() })
      .from(products)
      .where(eq(products.categoryId, categoryId));
    const productCount = productResult?.productCount ?? 0;
    const [childResult] = await tx
      .select({ childCount: count() })
      .from(categories)
      .where(eq(categories.parentCategoryId, categoryId));
    const childCount = childResult?.childCount ?? 0;

    if (productCount > 0 || childCount > 0) {
      return { deleted: false as const, productCount, childCount };
    }

    await tx.delete(categories).where(eq(categories.id, categoryId));
    const remainingIds = lockedCategories
      .filter(
        ({ id, parentCategoryId }) =>
          id !== categoryId &&
          sameParent(parentCategoryId, currentCategory.parentCategoryId),
      )
      .map(({ id }) => id);
    await persistSiblingOrder(tx, remainingIds);

    return { deleted: true as const, productCount: 0, childCount: 0 };
  });
}
