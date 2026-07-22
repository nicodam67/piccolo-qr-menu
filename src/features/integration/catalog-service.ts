import "server-only";

import { revalidatePath } from "next/cache";

import {
  ProductValidationError,
  setProductSoldOut,
} from "@/features/admin/products/repository";
import { getPublicMenu } from "@/features/public-menu/repository";

import { buildIntegrationCatalog } from "./contracts";

export async function getIntegrationCatalog(
  locale: string,
  correlationId: string,
) {
  const menu = await getPublicMenu(locale);
  return buildIntegrationCatalog(menu, correlationId);
}

export async function updateProductAvailability(
  productId: string,
  isSoldOut: boolean,
) {
  const product = await setProductSoldOut(productId, isSoldOut);
  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/es");
  return product;
}

export { ProductValidationError };
