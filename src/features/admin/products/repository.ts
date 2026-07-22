import "server-only";

import { asc, eq, inArray, sql } from "drizzle-orm";

import { getDatabase } from "@/db";
import { buildCategoryHierarchy } from "@/features/categories/hierarchy";
import {
  allergenTranslations,
  allergens,
  categories,
  categoryTranslations,
  productAllergens,
  products,
  productTags,
  productTranslations,
  restaurantSettings,
  restaurantTranslations,
  tags,
  tagTranslations,
} from "@/db/schema";

export type AdminProductTranslation = {
  locale: string;
  name: string;
  description: string;
};

export type AdminProduct = {
  id: string;
  categoryId: string;
  fullPriceCents: number;
  halfPriceCents: number | null;
  isActive: boolean;
  isSoldOut: boolean;
  sortOrder: number;
  imageUrl: string;
  translations: AdminProductTranslation[];
  tagIds: string[];
  allergenIds: string[];
};

export type ProductCategoryOption = {
  id: string;
  parentCategoryId: string | null;
  name: string;
  path: string;
  productCount: number;
};

export type ProductTagOption = {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
};

export type ProductAllergenOption = {
  id: string;
  name: string;
  icon: string;
  isActive: boolean;
};

export type AdminProductData = {
  products: AdminProduct[];
  categories: ProductCategoryOption[];
  tags: ProductTagOption[];
  allergens: ProductAllergenOption[];
  locales: string[];
  defaultLocale: string;
  currencyCode: string;
};

export type ProductMutationInput = {
  categoryId: string;
  locale: string;
  name: string;
  description: string;
  fullPriceCents: number;
  halfPriceCents: number | null;
  isActive: boolean;
  isSoldOut: boolean;
  sortOrder: number;
  imageUrl: string;
  tagIds: string[];
  allergenIds: string[];
};

export class ProductValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductValidationError";
  }
}

type ProductTransaction = Parameters<
  Parameters<ReturnType<typeof getDatabase>["db"]["transaction"]>[0]
>[0];

async function ensureProductReferences(
  tx: ProductTransaction,
  input: ProductMutationInput,
) {
  const [[category], [locale]] = await Promise.all([
    tx
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, input.categoryId))
      .limit(1),
    tx
      .select({ locale: restaurantTranslations.locale })
      .from(restaurantTranslations)
      .where(eq(restaurantTranslations.locale, input.locale))
      .limit(1),
  ]);

  if (!category) {
    throw new ProductValidationError("Selecciona una categoría existente.");
  }

  if (!locale) {
    throw new ProductValidationError("El idioma seleccionado no está activo.");
  }

  if (input.tagIds.length > 0) {
    const existingTags = await tx
      .select({ id: tags.id })
      .from(tags)
      .where(inArray(tags.id, input.tagIds));

    if (existingTags.length !== input.tagIds.length) {
      throw new ProductValidationError(
        "Una de las etiquetas seleccionadas ya no existe.",
      );
    }
  }

  if (input.allergenIds.length > 0) {
    const existingAllergens = await tx
      .select({ id: allergens.id })
      .from(allergens)
      .where(inArray(allergens.id, input.allergenIds));

    if (existingAllergens.length !== input.allergenIds.length) {
      throw new ProductValidationError(
        "Uno de los alérgenos seleccionados ya no existe.",
      );
    }
  }
}

async function replaceProductRelations(
  tx: ProductTransaction,
  productId: string,
  tagIds: string[],
  allergenIds: string[],
) {
  await tx.delete(productTags).where(eq(productTags.productId, productId));
  await tx
    .delete(productAllergens)
    .where(eq(productAllergens.productId, productId));

  if (tagIds.length > 0) {
    await tx
      .insert(productTags)
      .values(tagIds.map((tagId) => ({ productId, tagId })));
  }

  if (allergenIds.length > 0) {
    await tx
      .insert(productAllergens)
      .values(allergenIds.map((allergenId) => ({ productId, allergenId })));
  }
}

async function persistProductOrder(
  tx: ProductTransaction,
  orderedProductIds: string[],
) {
  for (const [index, productId] of orderedProductIds.entries()) {
    await tx
      .update(products)
      .set({ sortOrder: index + 1, updatedAt: new Date() })
      .where(eq(products.id, productId));
  }
}

export async function getAdminProductData(): Promise<AdminProductData> {
  const { db } = getDatabase();
  const [restaurant] = await db
    .select({
      defaultLocale: restaurantSettings.defaultLocale,
      currencyCode: restaurantSettings.currencyCode,
    })
    .from(restaurantSettings)
    .limit(1);

  if (!restaurant) {
    throw new ProductValidationError("No existe un restaurante configurado.");
  }

  const defaultLocale = restaurant.defaultLocale;
  const [
    productRows,
    categoryRows,
    tagRows,
    allergenRows,
    localeRows,
    productTagRows,
    productAllergenRows,
  ] = await Promise.all([
    db
      .select({
        id: products.id,
        categoryId: products.categoryId,
        fullPriceCents: products.fullPriceCents,
        halfPriceCents: products.halfPriceCents,
        isActive: products.isActive,
        isSoldOut: products.isSoldOut,
        sortOrder: products.sortOrder,
        imageUrl: products.imageUrl,
        locale: productTranslations.locale,
        name: productTranslations.name,
        description: productTranslations.description,
      })
      .from(products)
      .leftJoin(
        productTranslations,
        eq(productTranslations.productId, products.id),
      )
      .orderBy(
        asc(products.categoryId),
        asc(products.sortOrder),
        asc(productTranslations.locale),
      ),
    db
      .select({
        id: categories.id,
        parentCategoryId: categories.parentCategoryId,
        sortOrder: categories.sortOrder,
        name: categoryTranslations.name,
        productCount: sql<number>`(
          select count(*)::integer
          from ${products}
          where ${products.categoryId} = ${categories.id}
        )`,
      })
      .from(categories)
      .innerJoin(
        categoryTranslations,
        eq(categoryTranslations.categoryId, categories.id),
      )
      .where(eq(categoryTranslations.locale, defaultLocale))
      .orderBy(
        sql`${categories.parentCategoryId} nulls first`,
        asc(categories.sortOrder),
      ),
    db
      .select({
        id: tags.id,
        color: tags.color,
        isActive: tags.isActive,
        name: tagTranslations.name,
      })
      .from(tags)
      .innerJoin(tagTranslations, eq(tagTranslations.tagId, tags.id))
      .where(eq(tagTranslations.locale, defaultLocale))
      .orderBy(asc(tags.sortOrder), asc(tagTranslations.name)),
    db
      .select({
        id: allergens.id,
        icon: allergens.icon,
        isActive: allergens.isActive,
        name: allergenTranslations.name,
      })
      .from(allergens)
      .innerJoin(
        allergenTranslations,
        eq(allergenTranslations.allergenId, allergens.id),
      )
      .where(eq(allergenTranslations.locale, defaultLocale))
      .orderBy(asc(allergens.sortOrder), asc(allergenTranslations.name)),
    db
      .selectDistinct({ locale: restaurantTranslations.locale })
      .from(restaurantTranslations)
      .orderBy(asc(restaurantTranslations.locale)),
    db.select().from(productTags),
    db.select().from(productAllergens),
  ]);

  const productsById = new Map<string, AdminProduct>();

  for (const row of productRows) {
    const product = productsById.get(row.id) ?? {
      id: row.id,
      categoryId: row.categoryId,
      fullPriceCents: row.fullPriceCents,
      halfPriceCents: row.halfPriceCents,
      isActive: row.isActive,
      isSoldOut: row.isSoldOut,
      sortOrder: row.sortOrder,
      imageUrl: row.imageUrl,
      translations: [],
      tagIds: [],
      allergenIds: [],
    };

    if (row.locale && row.name !== null && row.description !== null) {
      product.translations.push({
        locale: row.locale,
        name: row.name,
        description: row.description,
      });
    }

    productsById.set(row.id, product);
  }

  for (const relation of productTagRows) {
    productsById.get(relation.productId)?.tagIds.push(relation.tagId);
  }

  for (const relation of productAllergenRows) {
    productsById
      .get(relation.productId)
      ?.allergenIds.push(relation.allergenId);
  }

  const categoryOptions = buildCategoryHierarchy(categoryRows).flatMap(
    (category) => [
      { ...category, path: category.name },
      ...category.children.map((child) => ({
        ...child,
        path: `${category.name} > ${child.name}`,
      })),
    ],
  );
  const categoryOrder = new Map(
    categoryOptions.map((category, index) => [category.id, index]),
  );
  const orderedProducts = [...productsById.values()].sort(
    (left, right) =>
      (categoryOrder.get(left.categoryId) ?? Number.MAX_SAFE_INTEGER) -
        (categoryOrder.get(right.categoryId) ?? Number.MAX_SAFE_INTEGER) ||
      left.sortOrder - right.sortOrder,
  );

  return {
    products: orderedProducts,
    categories: categoryOptions,
    tags: tagRows,
    allergens: allergenRows,
    locales: localeRows.map(({ locale }) => locale),
    defaultLocale,
    currencyCode: restaurant.currencyCode,
  };
}

export async function createProduct(input: ProductMutationInput) {
  const { db } = getDatabase();

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('piccolo-products-order'))`,
    );
    await ensureProductReferences(tx, input);
    const targetProducts = await tx
      .select({ id: products.id })
      .from(products)
      .where(eq(products.categoryId, input.categoryId))
      .orderBy(asc(products.sortOrder), asc(products.id))
      .for("update");

    if (input.sortOrder < 1 || input.sortOrder > targetProducts.length + 1) {
      throw new ProductValidationError(
        `El orden debe estar entre 1 y ${targetProducts.length + 1}.`,
      );
    }

    const [createdProduct] = await tx
      .insert(products)
      .values({
        categoryId: input.categoryId,
        fullPriceCents: input.fullPriceCents,
        halfPriceCents: input.halfPriceCents,
        isActive: input.isActive,
        isSoldOut: input.isSoldOut,
        sortOrder: input.sortOrder,
        imageUrl: input.imageUrl,
      })
      .returning({ id: products.id });

    if (!createdProduct) {
      throw new Error("No se pudo crear el producto.");
    }

    const orderedIds = targetProducts.map(({ id }) => id);
    orderedIds.splice(input.sortOrder - 1, 0, createdProduct.id);
    await persistProductOrder(tx, orderedIds);
    await tx.insert(productTranslations).values({
      productId: createdProduct.id,
      locale: input.locale,
      name: input.name,
      description: input.description,
    });
    await replaceProductRelations(
      tx,
      createdProduct.id,
      input.tagIds,
      input.allergenIds,
    );

    return createdProduct.id;
  });
}

export async function updateProduct(
  productId: string,
  input: ProductMutationInput,
) {
  const { db } = getDatabase();

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('piccolo-products-order'))`,
    );
    await ensureProductReferences(tx, input);
    const lockedProducts = await tx
      .select({
        id: products.id,
        categoryId: products.categoryId,
        imageUrl: products.imageUrl,
      })
      .from(products)
      .orderBy(asc(products.categoryId), asc(products.sortOrder), asc(products.id))
      .for("update");
    const currentProduct = lockedProducts.find(({ id }) => id === productId);

    if (!currentProduct) {
      throw new ProductValidationError("El producto ya no existe.");
    }

    const targetIds = lockedProducts
      .filter(
        (product) =>
          product.categoryId === input.categoryId && product.id !== productId,
      )
      .map(({ id }) => id);

    if (input.sortOrder < 1 || input.sortOrder > targetIds.length + 1) {
      throw new ProductValidationError(
        `El orden debe estar entre 1 y ${targetIds.length + 1}.`,
      );
    }

    targetIds.splice(input.sortOrder - 1, 0, productId);
    const previousCategoryIds =
      currentProduct.categoryId === input.categoryId
        ? []
        : lockedProducts
            .filter(
              (product) =>
                product.categoryId === currentProduct.categoryId &&
                product.id !== productId,
            )
            .map(({ id }) => id);

    await tx
      .update(products)
      .set({
        categoryId: input.categoryId,
        fullPriceCents: input.fullPriceCents,
        halfPriceCents: input.halfPriceCents,
        isActive: input.isActive,
        isSoldOut: input.isSoldOut,
        imageUrl: input.imageUrl,
        updatedAt: new Date(),
      })
      .where(eq(products.id, productId));
    await persistProductOrder(tx, targetIds);

    if (previousCategoryIds.length > 0) {
      await persistProductOrder(tx, previousCategoryIds);
    }

    await tx
      .insert(productTranslations)
      .values({
        productId,
        locale: input.locale,
        name: input.name,
        description: input.description,
      })
      .onConflictDoUpdate({
        target: [
          productTranslations.productId,
          productTranslations.locale,
        ],
        set: {
          name: input.name,
          description: input.description,
        },
      });
    await replaceProductRelations(
      tx,
      productId,
      input.tagIds,
      input.allergenIds,
    );

    return currentProduct.imageUrl;
  });
}

export async function setProductVisibility(
  productId: string,
  isActive: boolean,
) {
  const { db } = getDatabase();
  const [updatedProduct] = await db
    .update(products)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(products.id, productId))
    .returning({ id: products.id });

  if (!updatedProduct) {
    throw new ProductValidationError("El producto ya no existe.");
  }
}

export async function setProductSoldOut(
  productId: string,
  isSoldOut: boolean,
) {
  const { db } = getDatabase();
  const updatedAt = new Date();
  const [updatedProduct] = await db
    .update(products)
    .set({ isSoldOut, updatedAt })
    .where(eq(products.id, productId))
    .returning({
      id: products.id,
      isSoldOut: products.isSoldOut,
      updatedAt: products.updatedAt,
    });

  if (!updatedProduct) {
    throw new ProductValidationError("El producto ya no existe.");
  }

  return updatedProduct;
}

export async function reorderProducts(
  categoryId: string,
  orderedProductIds: string[],
) {
  const { db } = getDatabase();

  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('piccolo-products-order'))`,
    );
    const categoryProducts = await tx
      .select({ id: products.id })
      .from(products)
      .where(eq(products.categoryId, categoryId))
      .orderBy(asc(products.sortOrder), asc(products.id))
      .for("update");
    const existingIds = categoryProducts.map(({ id }) => id);

    if (
      orderedProductIds.length !== existingIds.length ||
      new Set(orderedProductIds).size !== orderedProductIds.length ||
      orderedProductIds.some((id) => !existingIds.includes(id))
    ) {
      throw new ProductValidationError(
        "El orden recibido no contiene todos los productos de la categoría exactamente una vez.",
      );
    }

    await persistProductOrder(tx, orderedProductIds);
  });
}

export async function deleteProduct(productId: string) {
  const { db } = getDatabase();

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('piccolo-products-order'))`,
    );
    const [product] = await tx
      .select({
        id: products.id,
        categoryId: products.categoryId,
        imageUrl: products.imageUrl,
      })
      .from(products)
      .where(eq(products.id, productId))
      .for("update");

    if (!product) {
      throw new ProductValidationError("El producto ya no existe.");
    }

    await tx.delete(products).where(eq(products.id, productId));
    const remainingProducts = await tx
      .select({ id: products.id })
      .from(products)
      .where(eq(products.categoryId, product.categoryId))
      .orderBy(asc(products.sortOrder), asc(products.id))
      .for("update");
    await persistProductOrder(
      tx,
      remainingProducts.map(({ id }) => id),
    );

    return product.imageUrl;
  });
}
