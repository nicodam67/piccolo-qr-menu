"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/features/auth/server-session";

import {
  createTaxonomyItem,
  deleteUnusedTaxonomyItem,
  reorderTaxonomyItems,
  setTaxonomyVisibility,
  TaxonomyValidationError,
  updateTaxonomyItem,
  type TaxonomyKind,
  type TaxonomyMutationInput,
} from "./repository";

export type TaxonomyActionResult = {
  success: boolean;
  error: string | null;
  itemId?: string;
};

function parseTaxonomyForm(
  kind: TaxonomyKind,
  formData: FormData,
): TaxonomyMutationInput {
  const nameValue = formData.get("name");
  const localeValue = formData.get("locale");
  const orderValue = formData.get("sortOrder");
  const name = typeof nameValue === "string" ? nameValue : "";
  const locale = typeof localeValue === "string" ? localeValue : "";
  const sortOrder =
    typeof orderValue === "string" && /^\d+$/.test(orderValue)
      ? Number(orderValue)
      : Number.NaN;

  if (!name) {
    throw new TaxonomyValidationError("El nombre es obligatorio.");
  }

  if (name !== name.trim()) {
    throw new TaxonomyValidationError(
      "El nombre no puede empezar ni terminar con espacios.",
    );
  }

  if (name.length > 120) {
    throw new TaxonomyValidationError(
      "El nombre no puede superar 120 caracteres.",
    );
  }

  if (!locale) {
    throw new TaxonomyValidationError("Selecciona un idioma.");
  }

  if (!Number.isInteger(sortOrder) || sortOrder < 1) {
    throw new TaxonomyValidationError("El orden debe ser un entero positivo.");
  }

  if (kind === "allergen") {
    const codeValue = formData.get("code");
    const iconValue = formData.get("icon");
    const code =
      typeof codeValue === "string" ? codeValue.trim().toLowerCase() : "";
    const icon = typeof iconValue === "string" ? iconValue.trim() : "";

    if (!code || !/^[a-z0-9_-]+$/.test(code) || code.length > 50) {
      throw new TaxonomyValidationError(
        "El código debe usar hasta 50 letras minúsculas, números, guiones o guiones bajos.",
      );
    }

    if (!icon || icon.length > 100) {
      throw new TaxonomyValidationError(
        "El icono es obligatorio y admite hasta 100 caracteres.",
      );
    }

    return {
      locale,
      name,
      code,
      icon,
      color: null,
      isActive: formData.get("isActive") === "true",
      sortOrder,
    };
  }

  const colorValue = formData.get("color");
  const color = typeof colorValue === "string" ? colorValue.trim() : "";

  if (!color || color.length > 30) {
    throw new TaxonomyValidationError(
      "El color es obligatorio y admite hasta 30 caracteres.",
    );
  }

  return {
    locale,
    name,
    code: null,
    icon: null,
    color,
    isActive: formData.get("isActive") === "true",
    sortOrder,
  };
}

function getActionError(error: unknown) {
  if (error instanceof TaxonomyValidationError) {
    return error.message;
  }

  return "No se ha podido completar la operación. Inténtalo de nuevo.";
}

function revalidateTaxonomyViews() {
  revalidatePath("/admin");
  revalidatePath("/admin/allergens");
  revalidatePath("/admin/tags");
  revalidatePath("/admin/products");
  revalidatePath("/es");
}

export async function createTaxonomyAction(
  kind: TaxonomyKind,
  formData: FormData,
): Promise<TaxonomyActionResult> {
  await requireAdminSession();

  try {
    const itemId = await createTaxonomyItem(
      kind,
      parseTaxonomyForm(kind, formData),
    );
    revalidateTaxonomyViews();
    return { success: true, error: null, itemId };
  } catch (error: unknown) {
    return { success: false, error: getActionError(error) };
  }
}

export async function updateTaxonomyAction(
  kind: TaxonomyKind,
  itemId: string,
  formData: FormData,
): Promise<TaxonomyActionResult> {
  await requireAdminSession();

  try {
    await updateTaxonomyItem(
      kind,
      itemId,
      parseTaxonomyForm(kind, formData),
    );
    revalidateTaxonomyViews();
    return { success: true, error: null, itemId };
  } catch (error: unknown) {
    return { success: false, error: getActionError(error) };
  }
}

export async function toggleTaxonomyAction(
  kind: TaxonomyKind,
  itemId: string,
  isActive: boolean,
): Promise<TaxonomyActionResult> {
  await requireAdminSession();

  try {
    await setTaxonomyVisibility(kind, itemId, isActive);
    revalidateTaxonomyViews();
    return { success: true, error: null, itemId };
  } catch (error: unknown) {
    return { success: false, error: getActionError(error) };
  }
}

export async function reorderTaxonomyAction(
  kind: TaxonomyKind,
  orderedIds: string[],
): Promise<TaxonomyActionResult> {
  await requireAdminSession();

  try {
    await reorderTaxonomyItems(kind, orderedIds);
    revalidateTaxonomyViews();
    return { success: true, error: null };
  } catch (error: unknown) {
    return { success: false, error: getActionError(error) };
  }
}

export async function deleteTaxonomyAction(
  kind: TaxonomyKind,
  itemId: string,
): Promise<TaxonomyActionResult> {
  await requireAdminSession();

  try {
    const result = await deleteUnusedTaxonomyItem(kind, itemId);

    if (!result.deleted) {
      return {
        success: false,
        error: `No se puede eliminar: está asociado a ${result.productCount} ${
          result.productCount === 1 ? "producto" : "productos"
        }.`,
      };
    }

    revalidateTaxonomyViews();
    return { success: true, error: null };
  } catch (error: unknown) {
    return { success: false, error: getActionError(error) };
  }
}
