"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, sql } from "drizzle-orm";

import { isSupportedLocale } from "@/config/locales";
import { getDatabase } from "@/db";
import {
  allergenTranslations,
  categoryTranslations,
  productTranslations,
  restaurantLocales,
  restaurantSettings,
  restaurantTranslations,
  tagTranslations,
} from "@/db/schema";
import { requireAdminSession } from "@/features/auth/server-session";

import { getLanguageManagementData } from "./repository";

export type LanguageActionResult = {
  success: boolean;
  error: string | null;
};

function revalidateLanguageViews() {
  revalidatePath("/admin");
  revalidatePath("/admin/languages");
  revalidatePath("/admin/qr");
  revalidatePath("/", "layout");
}

function validateLocale(locale: string) {
  if (!isSupportedLocale(locale)) {
    throw new Error("El idioma no está soportado por la aplicación.");
  }
}

function validateTranslation(value: unknown, maxLength?: number) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();

  if (/[<>]/.test(trimmed)) {
    throw new Error("Las traducciones no pueden contener HTML.");
  }

  if (maxLength && trimmed.length > maxLength) {
    throw new Error(`El texto supera ${maxLength} caracteres.`);
  }

  return trimmed;
}

export async function setLanguageEnabledAction(
  locale: string,
  enabled: boolean,
  confirmed: boolean,
): Promise<LanguageActionResult> {
  await requireAdminSession();

  try {
    validateLocale(locale);
    const data = await getLanguageManagementData();
    const language = data.languages.find(
      (candidate) => candidate.config.code === locale,
    );

    if (!language) {
      throw new Error("El idioma no está disponible.");
    }

    if (!enabled && language.isPrimary) {
      throw new Error("El idioma principal no puede desactivarse.");
    }

    if (!enabled && language.hasTranslations && !confirmed) {
      throw new Error(
        "Confirma la desactivación del idioma con traducciones existentes.",
      );
    }

    const { db } = getDatabase();

    await db.transaction(async (tx) => {
      const [restaurant] = await tx
        .select({ id: restaurantSettings.id })
        .from(restaurantSettings)
        .limit(1)
        .for("update");

      if (!restaurant) {
        throw new Error("No existe un restaurante configurado.");
      }

      const existing = await tx
        .select()
        .from(restaurantLocales)
        .where(
          and(
            eq(restaurantLocales.restaurantId, restaurant.id),
            eq(restaurantLocales.locale, locale),
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        const [{ maxOrder }] = await tx
          .select({
            maxOrder: sql<number>`coalesce(max(${restaurantLocales.sortOrder}), 0)::integer`,
          })
          .from(restaurantLocales)
          .where(eq(restaurantLocales.restaurantId, restaurant.id));
        await tx.insert(restaurantLocales).values({
          restaurantId: restaurant.id,
          locale,
          isEnabled: enabled,
          isPublished: false,
          sortOrder: (maxOrder ?? 0) + 1,
        });
      } else {
        await tx
          .update(restaurantLocales)
          .set({
            isEnabled: enabled,
            isPublished: enabled ? existing[0].isPublished : false,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(restaurantLocales.restaurantId, restaurant.id),
              eq(restaurantLocales.locale, locale),
            ),
          );
      }
    });

    revalidateLanguageViews();
    return { success: true, error: null };
  } catch (error: unknown) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "No se pudo cambiar el estado.",
    };
  }
}

export async function setLanguagePublishedAction(
  locale: string,
  published: boolean,
  confirmed: boolean,
): Promise<LanguageActionResult> {
  await requireAdminSession();

  try {
    validateLocale(locale);
    const data = await getLanguageManagementData();
    const language = data.languages.find(
      (candidate) => candidate.config.code === locale,
    );

    if (!language?.configured || !language.isEnabled) {
      throw new Error("Activa el idioma antes de publicarlo.");
    }

    if (published && !language.coverage.complete) {
      throw new Error(
        `El idioma tiene ${language.coverage.pending} elementos pendientes.`,
      );
    }

    if (!published && language.isPrimary) {
      throw new Error("El idioma principal no puede despublicarse.");
    }

    if (!published && language.isPublished && !confirmed) {
      throw new Error("Confirma que quieres despublicar este idioma.");
    }

    const { db } = getDatabase();
    await db
      .update(restaurantLocales)
      .set({ isPublished: published, updatedAt: new Date() })
      .where(
        and(
          eq(restaurantLocales.restaurantId, data.restaurantId),
          eq(restaurantLocales.locale, locale),
        ),
      );
    revalidateLanguageViews();
    return { success: true, error: null };
  } catch (error: unknown) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "No se pudo publicar el idioma.",
    };
  }
}

export async function setPrimaryLanguageAction(
  locale: string,
  confirmed: boolean,
): Promise<LanguageActionResult> {
  await requireAdminSession();

  try {
    validateLocale(locale);

    if (!confirmed) {
      throw new Error("Confirma el cambio de idioma principal.");
    }

    const data = await getLanguageManagementData();
    const language = data.languages.find(
      (candidate) => candidate.config.code === locale,
    );

    if (
      !language?.isEnabled ||
      !language.isPublished ||
      !language.coverage.complete
    ) {
      throw new Error(
        "El idioma principal debe estar activado, publicado y completo.",
      );
    }

    const { db } = getDatabase();
    await db
      .update(restaurantSettings)
      .set({ defaultLocale: locale, updatedAt: new Date() });
    revalidateLanguageViews();
    return { success: true, error: null };
  } catch (error: unknown) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo cambiar el idioma principal.",
    };
  }
}

type TranslationPayload = {
  restaurant: { name?: unknown; slogan?: unknown; description?: unknown };
  categories: Array<{ id?: unknown; name?: unknown }>;
  products: Array<{ id?: unknown; name?: unknown; description?: unknown }>;
  tags: Array<{ id?: unknown; name?: unknown }>;
  allergens: Array<{ id?: unknown; name?: unknown }>;
};

export async function saveLanguageTranslationsAction(
  locale: string,
  payload: TranslationPayload,
): Promise<LanguageActionResult> {
  await requireAdminSession();

  try {
    validateLocale(locale);
    const data = await getLanguageManagementData(locale);

    if (!data.editor) {
      throw new Error("Activa el idioma antes de editar sus traducciones.");
    }

    const editor = data.editor;
    const allowed = {
      categories: new Set(editor.categories.map(({ id }) => id)),
      products: new Set(editor.products.map(({ id }) => id)),
      tags: new Set(editor.tags.map(({ id }) => id)),
      allergens: new Set(editor.allergens.map(({ id }) => id)),
    };
    const { db } = getDatabase();

    await db.transaction(async (tx) => {
      const [restaurant] = await tx
        .select({ id: restaurantSettings.id })
        .from(restaurantSettings)
        .limit(1)
        .for("update");

      if (!restaurant) {
        throw new Error("No existe un restaurante configurado.");
      }

      const restaurantName = validateTranslation(
        payload.restaurant.name,
        160,
      );
      const restaurantSlogan = validateTranslation(
        payload.restaurant.slogan,
        240,
      );
      const restaurantDescription = validateTranslation(
        payload.restaurant.description,
      );

      if (
        restaurantName ||
        restaurantSlogan ||
        restaurantDescription ||
        locale === data.primaryLocale
      ) {
        await tx
          .insert(restaurantTranslations)
          .values({
            restaurantId: restaurant.id,
            locale,
            name: restaurantName,
            slogan: restaurantSlogan,
            description: restaurantDescription,
          })
          .onConflictDoUpdate({
            target: [
              restaurantTranslations.restaurantId,
              restaurantTranslations.locale,
            ],
            set: {
              name: restaurantName,
              slogan: restaurantSlogan,
              description: restaurantDescription,
            },
          });
      } else {
        await tx
          .delete(restaurantTranslations)
          .where(
            and(
              eq(restaurantTranslations.restaurantId, restaurant.id),
              eq(restaurantTranslations.locale, locale),
            ),
          );
      }

      for (const item of payload.categories) {
        if (typeof item.id !== "string" || !allowed.categories.has(item.id)) {
          throw new Error("Categoría no válida.");
        }
        const name = validateTranslation(item.name, 160);
        if (name) {
          await tx
            .insert(categoryTranslations)
            .values({ categoryId: item.id, locale, name, description: "" })
            .onConflictDoUpdate({
              target: [
                categoryTranslations.categoryId,
                categoryTranslations.locale,
              ],
              set: { name },
            });
        } else {
          await tx
            .delete(categoryTranslations)
            .where(
              and(
                eq(categoryTranslations.categoryId, item.id),
                eq(categoryTranslations.locale, locale),
              ),
            );
        }
      }

      for (const item of payload.products) {
        if (typeof item.id !== "string" || !allowed.products.has(item.id)) {
          throw new Error("Producto no válido.");
        }
        const name = validateTranslation(item.name, 200);
        const description = validateTranslation(item.description);
        if (name || description) {
          await tx
            .insert(productTranslations)
            .values({ productId: item.id, locale, name, description })
            .onConflictDoUpdate({
              target: [
                productTranslations.productId,
                productTranslations.locale,
              ],
              set: { name, description },
            });
        } else {
          await tx
            .delete(productTranslations)
            .where(
              and(
                eq(productTranslations.productId, item.id),
                eq(productTranslations.locale, locale),
              ),
            );
        }
      }

      for (const item of payload.tags) {
        if (typeof item.id !== "string" || !allowed.tags.has(item.id)) {
          throw new Error("Etiqueta no válida.");
        }
        const name = validateTranslation(item.name, 120);
        if (name) {
          await tx
            .insert(tagTranslations)
            .values({ tagId: item.id, locale, name })
            .onConflictDoUpdate({
              target: [tagTranslations.tagId, tagTranslations.locale],
              set: { name },
            });
        } else {
          await tx
            .delete(tagTranslations)
            .where(
              and(
                eq(tagTranslations.tagId, item.id),
                eq(tagTranslations.locale, locale),
              ),
            );
        }
      }

      for (const item of payload.allergens) {
        if (typeof item.id !== "string" || !allowed.allergens.has(item.id)) {
          throw new Error("Alérgeno no válido.");
        }
        const name = validateTranslation(item.name, 120);
        if (name) {
          await tx
            .insert(allergenTranslations)
            .values({ allergenId: item.id, locale, name })
            .onConflictDoUpdate({
              target: [
                allergenTranslations.allergenId,
                allergenTranslations.locale,
              ],
              set: { name },
            });
        } else {
          await tx
            .delete(allergenTranslations)
            .where(
              and(
                eq(allergenTranslations.allergenId, item.id),
                eq(allergenTranslations.locale, locale),
              ),
            );
        }
      }
    });

    revalidateLanguageViews();
    return { success: true, error: null };
  } catch (error: unknown) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudieron guardar las traducciones.",
    };
  }
}
