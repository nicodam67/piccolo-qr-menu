"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/features/auth/server-session";
import {
  isReservationStatus,
  normalizeEmail,
  normalizeGuestName,
  normalizeOptionalText,
  normalizePhone,
} from "@/features/reservations/domain";
import { createManualReservation } from "@/features/reservations/repository";
import {
  transitionReservationStatus,
  updateReservationDetails,
} from "./repository";

const revalidate = () => {
  revalidatePath("/admin/reservations");
  revalidatePath("/admin");
};

export async function createManualReservationAction(formData: FormData) {
  await requireAdminSession();
  try {
    const date = String(formData.get("date") ?? "");
    const time = String(formData.get("time") ?? "");
    const partySize = Number(formData.get("partySize"));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Fecha no válida.");
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Hora no válida.");
    if (!Number.isInteger(partySize) || partySize < 1 || partySize > 100) {
      throw new Error("Número de personas no válido.");
    }
    const created = await createManualReservation({
      locale: String(formData.get("locale") ?? "es"),
      date,
      time,
      partySize,
      guestName: normalizeGuestName(String(formData.get("guestName") ?? "")),
      guestPhone: normalizePhone(String(formData.get("guestPhone") ?? "")),
      guestEmail: normalizeEmail(String(formData.get("guestEmail") ?? "")),
      customerNotes: normalizeOptionalText(
        String(formData.get("customerNotes") ?? ""),
        1000,
      ),
      internalNotes: normalizeOptionalText(
        String(formData.get("internalNotes") ?? ""),
        1000,
      ),
      overrideWarning: formData.get("overrideWarning") === "true",
    });
    revalidate();
    return { success: true, error: null, locator: created.locator };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "No se pudo crear.",
    };
  }
}

export async function transitionReservationAction(
  id: string,
  nextStatus: string,
) {
  await requireAdminSession();
  try {
    if (!isReservationStatus(nextStatus)) throw new Error("Estado no válido.");
    await transitionReservationStatus(id, nextStatus);
    revalidate();
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "No se pudo actualizar.",
    };
  }
}

export async function updateReservationAction(
  id: string,
  formData: FormData,
) {
  await requireAdminSession();
  try {
    await updateReservationDetails(id, {
      guestName: normalizeGuestName(String(formData.get("guestName") ?? "")),
      guestPhone: normalizePhone(String(formData.get("guestPhone") ?? "")),
      guestEmail: normalizeEmail(String(formData.get("guestEmail") ?? "")),
      customerNotes: normalizeOptionalText(
        String(formData.get("customerNotes") ?? ""),
        1000,
      ),
      internalNotes: normalizeOptionalText(
        String(formData.get("internalNotes") ?? ""),
        1000,
      ),
    });
    revalidate();
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "No se pudo guardar.",
    };
  }
}
