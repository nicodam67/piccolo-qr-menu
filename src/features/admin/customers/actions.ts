"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/features/auth/server-session";
import {
  normalizeCustomerInput,
  normalizeCustomerNote,
} from "@/features/customers/domain";
import {
  addCustomerNote,
  createCustomer,
  deleteCustomerAddress,
  saveCustomerAddress,
  setCustomerActive,
  updateCustomer,
} from "./repository";

function parseCustomer(formData: FormData) {
  return normalizeCustomerInput({
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    birthDate: String(formData.get("birthDate") ?? ""),
    preferredLocale: String(formData.get("preferredLocale") ?? ""),
    observations: String(formData.get("observations") ?? ""),
    importantAllergies: String(formData.get("importantAllergies") ?? ""),
    isActive: formData.get("isActive") === "true",
  });
}

const resultError = (error: unknown) => ({
  success: false as const,
  error: error instanceof Error ? error.message : "No se pudo completar.",
});

export async function createCustomerAction(formData: FormData) {
  await requireAdminSession();
  try {
    const id = await createCustomer(parseCustomer(formData));
    revalidatePath("/admin/customers");
    revalidatePath("/admin");
    return { success: true as const, error: null, id };
  } catch (error) {
    return resultError(error);
  }
}

export async function updateCustomerAction(id: string, formData: FormData) {
  await requireAdminSession();
  try {
    await updateCustomer(id, parseCustomer(formData));
    revalidatePath("/admin/customers");
    revalidatePath(`/admin/customers/${id}`);
    return { success: true as const, error: null };
  } catch (error) {
    return resultError(error);
  }
}

export async function toggleCustomerAction(id: string, isActive: boolean) {
  await requireAdminSession();
  try {
    await setCustomerActive(id, isActive);
    revalidatePath("/admin/customers");
    revalidatePath(`/admin/customers/${id}`);
    return { success: true as const, error: null };
  } catch (error) {
    return resultError(error);
  }
}

export async function addCustomerNoteAction(
  customerId: string,
  formData: FormData,
) {
  const session = await requireAdminSession();
  try {
    await addCustomerNote(
      customerId,
      session.adminId,
      normalizeCustomerNote(String(formData.get("body") ?? "")),
    );
    revalidatePath(`/admin/customers/${customerId}`);
    return { success: true as const, error: null };
  } catch (error) {
    return resultError(error);
  }
}

export async function saveCustomerAddressAction(
  customerId: string,
  formData: FormData,
) {
  await requireAdminSession();
  try {
    const line1 = String(formData.get("line1") ?? "").trim();
    if (!line1 || line1.length > 200 || /[<>]/.test(line1)) {
      throw new Error("La dirección no es válida.");
    }
    await saveCustomerAddress(customerId, {
      label: String(formData.get("label") ?? "").trim().slice(0, 80),
      line1,
      line2: String(formData.get("line2") ?? "").trim().slice(0, 200) || null,
      city: String(formData.get("city") ?? "").trim().slice(0, 120),
      postalCode: String(formData.get("postalCode") ?? "").trim().slice(0, 20),
      province: String(formData.get("province") ?? "").trim().slice(0, 120),
      countryCode: String(formData.get("countryCode") ?? "ES")
        .trim()
        .toUpperCase()
        .slice(0, 2),
      isDefault: formData.get("isDefault") === "true",
    });
    revalidatePath(`/admin/customers/${customerId}`);
    return { success: true as const, error: null };
  } catch (error) {
    return resultError(error);
  }
}

export async function deleteCustomerAddressAction(
  customerId: string,
  id: string,
) {
  await requireAdminSession();
  await deleteCustomerAddress(customerId, id);
  revalidatePath(`/admin/customers/${customerId}`);
}
