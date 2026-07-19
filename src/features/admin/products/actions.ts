"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/features/auth/server-session";

import {
  createProduct,
  deleteProduct,
  ProductValidationError,
  reorderProducts,
  setProductVisibility,
  updateProduct,
  type ProductMutationInput,
} from "./repository";

export type ProductActionResult = {
  success: boolean;
  error: string | null;
  productId?: string;
};

function parsePrice(
  value: FormDataEntryValue | null,
  label: string,
  required: boolean,
) {
  if (typeof value !== "string" || !value.trim()) {
    if (required) {
      throw new ProductValidationError(`${label} es obligatorio.`);
    }

    return null;
  }

  const normalized = value.trim().replace(",", ".");

  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new ProductValidationError(
      `${label} debe tener como máximo dos decimales.`,
    );
  }

  const cents = Math.round(Number(normalized) * 100);

  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new ProductValidationError(`${label} no es válido.`);
  }

  return cents;
}

function parseProductForm(formData: FormData): ProductMutationInput {
  const nameValue = formData.get("name");
  const descriptionValue = formData.get("description");
  const localeValue = formData.get("locale");
  const categoryValue = formData.get("categoryId");
  const orderValue = formData.get("sortOrder");
  const imageUrlValue = formData.get("imageUrl");
  const name = typeof nameValue === "string" ? nameValue : "";
  const description =
    typeof descriptionValue === "string" ? descriptionValue.trim() : "";
  const locale = typeof localeValue === "string" ? localeValue : "";
  const categoryId =
    typeof categoryValue === "string" ? categoryValue : "";
  const imageUrl =
    typeof imageUrlValue === "string" ? imageUrlValue.trim() : "";
  const sortOrder =
    typeof orderValue === "string" && /^\d+$/.test(orderValue)
      ? Number(orderValue)
      : Number.NaN;

  if (!name) {
    throw new ProductValidationError("El nombre es obligatorio.");
  }

  if (name !== name.trim()) {
    throw new ProductValidationError(
      "El nombre no puede empezar ni terminar con espacios.",
    );
  }

  if (name.length > 200) {
    throw new ProductValidationError(
      "El nombre no puede superar 200 caracteres.",
    );
  }

  if (!locale) {
    throw new ProductValidationError("Selecciona un idioma.");
  }

  if (!categoryId) {
    throw new ProductValidationError("Selecciona una categoría.");
  }

  if (!Number.isInteger(sortOrder) || sortOrder < 1) {
    throw new ProductValidationError("El orden debe ser un entero positivo.");
  }

  try {
    const parsedImageUrl = new URL(imageUrl);

    if (
      parsedImageUrl.protocol !== "https:" &&
      parsedImageUrl.protocol !== "http:"
    ) {
      throw new Error("Unsupported protocol");
    }
  } catch {
    throw new ProductValidationError(
      "La URL de imagen existente debe ser HTTP o HTTPS.",
    );
  }

  return {
    name,
    description,
    locale,
    categoryId,
    sortOrder,
    imageUrl,
    fullPriceCents:
      parsePrice(formData.get("fullPrice"), "El precio completo", true) ?? 0,
    halfPriceCents: parsePrice(
      formData.get("halfPrice"),
      "El precio de media ración",
      false,
    ),
    isActive: formData.get("isActive") === "true",
    isSoldOut: formData.get("isSoldOut") === "true",
    tagIds: [...new Set(formData.getAll("tagIds"))].filter(
      (value): value is string => typeof value === "string" && Boolean(value),
    ),
    allergenIds: [...new Set(formData.getAll("allergenIds"))].filter(
      (value): value is string => typeof value === "string" && Boolean(value),
    ),
  };
}

function getActionError(error: unknown) {
  if (error instanceof ProductValidationError) {
    return error.message;
  }

  return "No se ha podido completar la operación. Inténtalo de nuevo.";
}

function revalidateProductViews() {
  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/es");
}

export async function createProductAction(
  formData: FormData,
): Promise<ProductActionResult> {
  await requireAdminSession();

  try {
    const productId = await createProduct(parseProductForm(formData));
    revalidateProductViews();
    return { success: true, error: null, productId };
  } catch (error: unknown) {
    return { success: false, error: getActionError(error) };
  }
}

export async function updateProductAction(
  productId: string,
  formData: FormData,
): Promise<ProductActionResult> {
  await requireAdminSession();

  try {
    await updateProduct(productId, parseProductForm(formData));
    revalidateProductViews();
    return { success: true, error: null, productId };
  } catch (error: unknown) {
    return { success: false, error: getActionError(error) };
  }
}

export async function toggleProductAction(
  productId: string,
  isActive: boolean,
): Promise<ProductActionResult> {
  await requireAdminSession();

  try {
    await setProductVisibility(productId, isActive);
    revalidateProductViews();
    return { success: true, error: null, productId };
  } catch (error: unknown) {
    return { success: false, error: getActionError(error) };
  }
}

export async function reorderProductsAction(
  categoryId: string,
  orderedProductIds: string[],
): Promise<ProductActionResult> {
  await requireAdminSession();

  try {
    await reorderProducts(categoryId, orderedProductIds);
    revalidateProductViews();
    return { success: true, error: null };
  } catch (error: unknown) {
    return { success: false, error: getActionError(error) };
  }
}

export async function deleteProductAction(
  productId: string,
): Promise<ProductActionResult> {
  await requireAdminSession();

  try {
    await deleteProduct(productId);
    revalidateProductViews();
    return { success: true, error: null };
  } catch (error: unknown) {
    return { success: false, error: getActionError(error) };
  }
}
