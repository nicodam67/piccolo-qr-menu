"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/features/auth/server-session";
import { normalizeCustomerFilters } from "@/features/customer-segments/config";
import { saveCustomerSegment } from "./repository";

const optionalBoolean = (value: FormDataEntryValue | null) =>
  value === "true" ? true : value === "false" ? false : undefined;

export async function saveCustomerSegmentAction(formData: FormData) {
  await requireAdminSession();
  try {
    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    if (name.length < 2 || name.length > 160 || /[<>]/.test(name)) {
      throw new Error("El nombre del segmento no es válido.");
    }
    const noVisitsValue = String(formData.get("noVisitsSinceDays") ?? "");
    const filters = normalizeCustomerFilters({
      ...(String(formData.get("query") ?? "").trim()
        ? { query: String(formData.get("query")).trim() }
        : {}),
      ...(optionalBoolean(formData.get("customerIsActive")) !== undefined
        ? { isActive: optionalBoolean(formData.get("customerIsActive")) }
        : {}),
      ...(optionalBoolean(formData.get("loyaltyParticipating")) !== undefined
        ? {
            loyaltyParticipating: optionalBoolean(
              formData.get("loyaltyParticipating"),
            ),
          }
        : {}),
      ...(optionalBoolean(formData.get("hasPoints")) !== undefined
        ? { hasPoints: optionalBoolean(formData.get("hasPoints")) }
        : {}),
      ...(String(formData.get("emailConsent") ?? "")
        ? { emailConsent: String(formData.get("emailConsent")) }
        : {}),
      ...(String(formData.get("phoneConsent") ?? "")
        ? { phoneConsent: String(formData.get("phoneConsent")) }
        : {}),
      ...(optionalBoolean(formData.get("hasNoShows")) !== undefined
        ? { hasNoShows: optionalBoolean(formData.get("hasNoShows")) }
        : {}),
      ...(noVisitsValue
        ? { noVisitsSinceDays: Number(noVisitsValue) }
        : {}),
      ...(formData.getAll("tagIds").length
        ? { tagIds: formData.getAll("tagIds").map(String) }
        : {}),
    });
    await saveCustomerSegment({
      id: String(formData.get("id") ?? "") || undefined,
      name,
      description: description.slice(0, 1000),
      filters,
      isActive: formData.get("isActive") === "true",
    });
    revalidatePath("/admin/customer-segments");
    revalidatePath("/admin/customers");
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "No se pudo guardar.",
    };
  }
}
