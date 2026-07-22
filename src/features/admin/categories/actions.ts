"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/features/auth/server-session";

import {
  CategoryValidationError,
  createCategory,
  deleteEmptyCategory,
  reorderCategories,
  setCategoryVisibility,
  updateCategory,
  type CategoryMutationInput,
} from "./repository";

export type CategoryActionResult = {
  success: boolean;
  error: string | null;
  categoryId?: string;
};

function revalidateCategoryViews() {
  revalidatePath("/admin");
  revalidatePath("/admin/categories");
  revalidatePath("/es");
}

function parseCategoryForm(formData: FormData): CategoryMutationInput {
  const nameValue = formData.get("name");
  const descriptionValue = formData.get("description");
  const localeValue = formData.get("locale");
  const orderValue = formData.get("sortOrder");
  const parentValue = formData.get("parentCategoryId");
  const name = typeof nameValue === "string" ? nameValue : "";
  const description =
    typeof descriptionValue === "string" ? descriptionValue.trim() : "";
  const locale = typeof localeValue === "string" ? localeValue : "";
  const sortOrder =
    typeof orderValue === "string" && /^\d+$/.test(orderValue)
      ? Number(orderValue)
      : Number.NaN;

  if (!name) {
    throw new CategoryValidationError("El nombre es obligatorio.");
  }

  if (name !== name.trim()) {
    throw new CategoryValidationError(
      "El nombre no puede empezar ni terminar con espacios.",
    );
  }

  if (name.length > 160) {
    throw new CategoryValidationError(
      "El nombre no puede superar 160 caracteres.",
    );
  }

  if (!locale) {
    throw new CategoryValidationError("Selecciona un idioma.");
  }

  if (!Number.isInteger(sortOrder) || sortOrder < 1) {
    throw new CategoryValidationError("El orden debe ser un entero positivo.");
  }

  return {
    name,
    description,
    locale,
    sortOrder,
    isActive: formData.get("isActive") === "true",
    parentCategoryId:
      typeof parentValue === "string" && parentValue ? parentValue : null,
  };
}

function getActionError(error: unknown) {
  if (error instanceof CategoryValidationError) {
    return error.message;
  }

  return "No se ha podido completar la operación. Inténtalo de nuevo.";
}

export async function createCategoryAction(
  formData: FormData,
): Promise<CategoryActionResult> {
  await requireAdminSession();

  try {
    const categoryId = await createCategory(parseCategoryForm(formData));
    revalidateCategoryViews();
    return { success: true, error: null, categoryId };
  } catch (error: unknown) {
    return { success: false, error: getActionError(error) };
  }
}

export async function updateCategoryAction(
  categoryId: string,
  formData: FormData,
): Promise<CategoryActionResult> {
  await requireAdminSession();

  try {
    await updateCategory(categoryId, parseCategoryForm(formData));
    revalidateCategoryViews();
    return { success: true, error: null, categoryId };
  } catch (error: unknown) {
    return { success: false, error: getActionError(error) };
  }
}

export async function toggleCategoryAction(
  categoryId: string,
  isActive: boolean,
): Promise<CategoryActionResult> {
  await requireAdminSession();

  try {
    await setCategoryVisibility(categoryId, isActive);
    revalidateCategoryViews();
    return { success: true, error: null, categoryId };
  } catch (error: unknown) {
    return { success: false, error: getActionError(error) };
  }
}

export async function reorderCategoriesAction(
  parentCategoryId: string | null,
  orderedCategoryIds: string[],
): Promise<CategoryActionResult> {
  await requireAdminSession();

  try {
    await reorderCategories(parentCategoryId, orderedCategoryIds);
    revalidateCategoryViews();
    return { success: true, error: null };
  } catch (error: unknown) {
    return { success: false, error: getActionError(error) };
  }
}

export async function deleteCategoryAction(
  categoryId: string,
): Promise<CategoryActionResult> {
  await requireAdminSession();

  try {
    const result = await deleteEmptyCategory(categoryId);

    if (!result.deleted) {
      return {
        success: false,
        error: `No se puede eliminar: tiene ${result.productCount} ${
          result.productCount === 1 ? "producto asociado" : "productos asociados"
        } y ${result.childCount} ${
          result.childCount === 1 ? "subcategoría" : "subcategorías"
        }.`,
      };
    }

    revalidateCategoryViews();
    return { success: true, error: null };
  } catch (error: unknown) {
    return { success: false, error: getActionError(error) };
  }
}
