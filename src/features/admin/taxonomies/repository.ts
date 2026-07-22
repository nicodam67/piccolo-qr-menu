import "server-only";

import { and, asc, count, eq, ne, sql } from "drizzle-orm";

import { getDatabase } from "@/db";
import {
  allergenTranslations,
  allergens,
  productAllergens,
  productTags,
  restaurantSettings,
  restaurantTranslations,
  tagTranslations,
  tags,
} from "@/db/schema";

export type TaxonomyKind = "allergen" | "tag";

export type TaxonomyTranslation = {
  locale: string;
  name: string;
};

export type AdminTaxonomyItem = {
  id: string;
  code: string | null;
  icon: string | null;
  color: string | null;
  isActive: boolean;
  sortOrder: number;
  productCount: number;
  translations: TaxonomyTranslation[];
};

export type AdminTaxonomyData = {
  items: AdminTaxonomyItem[];
  locales: string[];
  defaultLocale: string;
};

export type TaxonomyMutationInput = {
  locale: string;
  name: string;
  code: string | null;
  icon: string | null;
  color: string | null;
  isActive: boolean;
  sortOrder: number;
};

export class TaxonomyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaxonomyValidationError";
  }
}

type TaxonomyTransaction = Parameters<
  Parameters<ReturnType<typeof getDatabase>["db"]["transaction"]>[0]
>[0];

async function lockTaxonomyOrder(
  tx: TaxonomyTransaction,
  kind: TaxonomyKind,
) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`piccolo-${kind}-order`}))`,
  );
}

async function ensureLocaleExists(
  tx: TaxonomyTransaction,
  locale: string,
) {
  const [configuredLocale] = await tx
    .select({ locale: restaurantTranslations.locale })
    .from(restaurantTranslations)
    .where(eq(restaurantTranslations.locale, locale))
    .limit(1);

  if (!configuredLocale) {
    throw new TaxonomyValidationError("El idioma seleccionado no está activo.");
  }
}

async function persistTaxonomyOrder(
  tx: TaxonomyTransaction,
  kind: TaxonomyKind,
  orderedIds: string[],
) {
  for (const [index, id] of orderedIds.entries()) {
    if (kind === "allergen") {
      await tx
        .update(allergens)
        .set({ sortOrder: index + 1 })
        .where(eq(allergens.id, id));
    } else {
      await tx
        .update(tags)
        .set({ sortOrder: index + 1 })
        .where(eq(tags.id, id));
    }
  }
}

export async function getAdminTaxonomyData(
  kind: TaxonomyKind,
): Promise<AdminTaxonomyData> {
  const { db } = getDatabase();
  const [[restaurant], localeRows] = await Promise.all([
    db
      .select({ defaultLocale: restaurantSettings.defaultLocale })
      .from(restaurantSettings)
      .limit(1),
    db
      .selectDistinct({ locale: restaurantTranslations.locale })
      .from(restaurantTranslations)
      .orderBy(asc(restaurantTranslations.locale)),
  ]);

  if (!restaurant) {
    throw new TaxonomyValidationError("No existe un restaurante configurado.");
  }

  if (kind === "allergen") {
    const rows = await db
      .select({
        id: allergens.id,
        code: allergens.code,
        icon: allergens.icon,
        isActive: allergens.isActive,
        sortOrder: allergens.sortOrder,
        locale: allergenTranslations.locale,
        name: allergenTranslations.name,
        productCount: sql<number>`(
          select count(*)::integer
          from ${productAllergens}
          where ${productAllergens.allergenId} = ${allergens.id}
        )`,
      })
      .from(allergens)
      .leftJoin(
        allergenTranslations,
        eq(allergenTranslations.allergenId, allergens.id),
      )
      .orderBy(asc(allergens.sortOrder), asc(allergenTranslations.locale));
    const itemsById = new Map<string, AdminTaxonomyItem>();

    for (const row of rows) {
      const item = itemsById.get(row.id) ?? {
        id: row.id,
        code: row.code,
        icon: row.icon,
        color: null,
        isActive: row.isActive,
        sortOrder: row.sortOrder,
        productCount: row.productCount,
        translations: [],
      };

      if (row.locale && row.name !== null) {
        item.translations.push({ locale: row.locale, name: row.name });
      }

      itemsById.set(row.id, item);
    }

    return {
      items: [...itemsById.values()],
      locales: localeRows.map(({ locale }) => locale),
      defaultLocale: restaurant.defaultLocale,
    };
  }

  const rows = await db
    .select({
      id: tags.id,
      color: tags.color,
      isActive: tags.isActive,
      sortOrder: tags.sortOrder,
      locale: tagTranslations.locale,
      name: tagTranslations.name,
      productCount: sql<number>`(
        select count(*)::integer
        from ${productTags}
        where ${productTags.tagId} = ${tags.id}
      )`,
    })
    .from(tags)
    .leftJoin(tagTranslations, eq(tagTranslations.tagId, tags.id))
    .orderBy(asc(tags.sortOrder), asc(tagTranslations.locale));
  const itemsById = new Map<string, AdminTaxonomyItem>();

  for (const row of rows) {
    const item = itemsById.get(row.id) ?? {
      id: row.id,
      code: null,
      icon: null,
      color: row.color,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      productCount: row.productCount,
      translations: [],
    };

    if (row.locale && row.name !== null) {
      item.translations.push({ locale: row.locale, name: row.name });
    }

    itemsById.set(row.id, item);
  }

  return {
    items: [...itemsById.values()],
    locales: localeRows.map(({ locale }) => locale),
    defaultLocale: restaurant.defaultLocale,
  };
}

export async function createTaxonomyItem(
  kind: TaxonomyKind,
  input: TaxonomyMutationInput,
) {
  const { db } = getDatabase();

  return db.transaction(async (tx) => {
    await lockTaxonomyOrder(tx, kind);
    await ensureLocaleExists(tx, input.locale);
    const existingItems =
      kind === "allergen"
        ? await tx
            .select({ id: allergens.id })
            .from(allergens)
            .orderBy(asc(allergens.sortOrder), asc(allergens.id))
            .for("update")
        : await tx
            .select({ id: tags.id })
            .from(tags)
            .orderBy(asc(tags.sortOrder), asc(tags.id))
            .for("update");

    if (input.sortOrder < 1 || input.sortOrder > existingItems.length + 1) {
      throw new TaxonomyValidationError(
        `El orden debe estar entre 1 y ${existingItems.length + 1}.`,
      );
    }

    let itemId: string;

    if (kind === "allergen") {
      const [existingCode] = await tx
        .select({ id: allergens.id })
        .from(allergens)
        .where(eq(allergens.code, input.code ?? ""))
        .limit(1);

      if (existingCode) {
        throw new TaxonomyValidationError(
          "Ya existe un alérgeno con ese código.",
        );
      }

      const [created] = await tx
        .insert(allergens)
        .values({
          code: input.code ?? "",
          icon: input.icon ?? "",
          isActive: input.isActive,
          sortOrder: input.sortOrder,
        })
        .returning({ id: allergens.id });

      if (!created) {
        throw new Error("No se pudo crear el alérgeno.");
      }

      itemId = created.id;
      await tx.insert(allergenTranslations).values({
        allergenId: itemId,
        locale: input.locale,
        name: input.name,
      });
    } else {
      const [created] = await tx
        .insert(tags)
        .values({
          color: input.color ?? "",
          isActive: input.isActive,
          sortOrder: input.sortOrder,
        })
        .returning({ id: tags.id });

      if (!created) {
        throw new Error("No se pudo crear la etiqueta.");
      }

      itemId = created.id;
      await tx.insert(tagTranslations).values({
        tagId: itemId,
        locale: input.locale,
        name: input.name,
      });
    }

    const orderedIds = existingItems.map(({ id }) => id);
    orderedIds.splice(input.sortOrder - 1, 0, itemId);
    await persistTaxonomyOrder(tx, kind, orderedIds);
    return itemId;
  });
}

export async function updateTaxonomyItem(
  kind: TaxonomyKind,
  itemId: string,
  input: TaxonomyMutationInput,
) {
  const { db } = getDatabase();

  await db.transaction(async (tx) => {
    await lockTaxonomyOrder(tx, kind);
    await ensureLocaleExists(tx, input.locale);
    const existingItems =
      kind === "allergen"
        ? await tx
            .select({ id: allergens.id })
            .from(allergens)
            .orderBy(asc(allergens.sortOrder), asc(allergens.id))
            .for("update")
        : await tx
            .select({ id: tags.id })
            .from(tags)
            .orderBy(asc(tags.sortOrder), asc(tags.id))
            .for("update");
    const currentIndex = existingItems.findIndex(({ id }) => id === itemId);

    if (currentIndex < 0) {
      throw new TaxonomyValidationError("El elemento ya no existe.");
    }

    if (input.sortOrder < 1 || input.sortOrder > existingItems.length) {
      throw new TaxonomyValidationError(
        `El orden debe estar entre 1 y ${existingItems.length}.`,
      );
    }

    if (kind === "allergen") {
      const [duplicateCode] = await tx
        .select({ id: allergens.id })
        .from(allergens)
        .where(
          and(
            eq(allergens.code, input.code ?? ""),
            ne(allergens.id, itemId),
          ),
        )
        .limit(1);

      if (duplicateCode) {
        throw new TaxonomyValidationError(
          "Ya existe un alérgeno con ese código.",
        );
      }

      await tx
        .update(allergens)
        .set({
          code: input.code ?? "",
          icon: input.icon ?? "",
          isActive: input.isActive,
        })
        .where(eq(allergens.id, itemId));
      await tx
        .insert(allergenTranslations)
        .values({
          allergenId: itemId,
          locale: input.locale,
          name: input.name,
        })
        .onConflictDoUpdate({
          target: [
            allergenTranslations.allergenId,
            allergenTranslations.locale,
          ],
          set: { name: input.name },
        });
    } else {
      await tx
        .update(tags)
        .set({
          color: input.color ?? "",
          isActive: input.isActive,
        })
        .where(eq(tags.id, itemId));
      await tx
        .insert(tagTranslations)
        .values({
          tagId: itemId,
          locale: input.locale,
          name: input.name,
        })
        .onConflictDoUpdate({
          target: [tagTranslations.tagId, tagTranslations.locale],
          set: { name: input.name },
        });
    }

    const orderedIds = existingItems.map(({ id }) => id);
    orderedIds.splice(currentIndex, 1);
    orderedIds.splice(input.sortOrder - 1, 0, itemId);
    await persistTaxonomyOrder(tx, kind, orderedIds);
  });
}

export async function setTaxonomyVisibility(
  kind: TaxonomyKind,
  itemId: string,
  isActive: boolean,
) {
  const { db } = getDatabase();
  const [updated] =
    kind === "allergen"
      ? await db
          .update(allergens)
          .set({ isActive })
          .where(eq(allergens.id, itemId))
          .returning({ id: allergens.id })
      : await db
          .update(tags)
          .set({ isActive })
          .where(eq(tags.id, itemId))
          .returning({ id: tags.id });

  if (!updated) {
    throw new TaxonomyValidationError("El elemento ya no existe.");
  }
}

export async function reorderTaxonomyItems(
  kind: TaxonomyKind,
  orderedIds: string[],
) {
  const { db } = getDatabase();

  await db.transaction(async (tx) => {
    await lockTaxonomyOrder(tx, kind);
    const existingItems =
      kind === "allergen"
        ? await tx
            .select({ id: allergens.id })
            .from(allergens)
            .orderBy(asc(allergens.sortOrder), asc(allergens.id))
            .for("update")
        : await tx
            .select({ id: tags.id })
            .from(tags)
            .orderBy(asc(tags.sortOrder), asc(tags.id))
            .for("update");
    const existingIds = existingItems.map(({ id }) => id);

    if (
      orderedIds.length !== existingIds.length ||
      new Set(orderedIds).size !== orderedIds.length ||
      orderedIds.some((id) => !existingIds.includes(id))
    ) {
      throw new TaxonomyValidationError(
        "El orden recibido no contiene todos los elementos exactamente una vez.",
      );
    }

    await persistTaxonomyOrder(tx, kind, orderedIds);
  });
}

export async function deleteUnusedTaxonomyItem(
  kind: TaxonomyKind,
  itemId: string,
) {
  const { db } = getDatabase();

  return db.transaction(async (tx) => {
    await lockTaxonomyOrder(tx, kind);
    const existingItems =
      kind === "allergen"
        ? await tx
            .select({ id: allergens.id })
            .from(allergens)
            .orderBy(asc(allergens.sortOrder), asc(allergens.id))
            .for("update")
        : await tx
            .select({ id: tags.id })
            .from(tags)
            .orderBy(asc(tags.sortOrder), asc(tags.id))
            .for("update");

    if (!existingItems.some(({ id }) => id === itemId)) {
      throw new TaxonomyValidationError("El elemento ya no existe.");
    }

    const [relationCount] =
      kind === "allergen"
        ? await tx
            .select({ value: count() })
            .from(productAllergens)
            .where(eq(productAllergens.allergenId, itemId))
        : await tx
            .select({ value: count() })
            .from(productTags)
            .where(eq(productTags.tagId, itemId));
    const productCount = relationCount?.value ?? 0;

    if (productCount > 0) {
      return { deleted: false as const, productCount };
    }

    if (kind === "allergen") {
      await tx.delete(allergens).where(eq(allergens.id, itemId));
    } else {
      await tx.delete(tags).where(eq(tags.id, itemId));
    }

    await persistTaxonomyOrder(
      tx,
      kind,
      existingItems.map(({ id }) => id).filter((id) => id !== itemId),
    );
    return { deleted: true as const, productCount: 0 };
  });
}
