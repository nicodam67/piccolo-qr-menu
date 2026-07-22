"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/features/auth/server-session";
import {
  assignCustomerTag,
  createCustomerTag,
  setCustomerTagActive,
  unassignCustomerTag,
  updateCustomerTag,
} from "./repository";

function parse(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "");
  const sortOrder = Number(formData.get("sortOrder"));
  if (name.length < 2 || name.length > 120 || /[<>]/.test(name))
    throw new Error("El nombre no es válido.");
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error("El color no es válido.");
  if (!Number.isInteger(sortOrder) || sortOrder < 1)
    throw new Error("El orden no es válido.");
  return { name, color, sortOrder };
}
const errorResult = (error: unknown) => ({
  success: false,
  error: error instanceof Error ? error.message : "No se pudo completar.",
});

export async function createCustomerTagAction(formData: FormData) {
  await requireAdminSession();
  try {
    await createCustomerTag(parse(formData));
    revalidatePath("/admin/customer-tags");
    return { success: true, error: null };
  } catch (error) {
    return errorResult(error);
  }
}

export async function updateCustomerTagAction(id: string, formData: FormData) {
  await requireAdminSession();
  try {
    await updateCustomerTag(id, {
      ...parse(formData),
      isActive: formData.get("isActive") === "true",
    });
    revalidatePath("/admin/customer-tags");
    revalidatePath("/admin/customers");
    return { success: true, error: null };
  } catch (error) {
    return errorResult(error);
  }
}

export async function toggleCustomerTagAction(id: string, isActive: boolean) {
  await requireAdminSession();
  try {
    await setCustomerTagActive(id, isActive);
    revalidatePath("/admin/customer-tags");
    return { success: true, error: null };
  } catch (error) {
    return errorResult(error);
  }
}

export async function setCustomerTagAssignmentAction(
  customerId: string,
  tagId: string,
  assigned: boolean,
) {
  await requireAdminSession();
  if (assigned) await assignCustomerTag(customerId, tagId);
  else await unassignCustomerTag(customerId, tagId);
  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath("/admin/customers");
  return { success: true, error: null };
}
