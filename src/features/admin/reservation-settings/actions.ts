"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/features/auth/server-session";
import {
  normalizeOptionalText,
  normalizePhone,
  type ReservationSettingsData,
} from "@/features/reservations/domain";
import { saveReservationSettings } from "./repository";

export async function saveReservationSettingsAction(formData: FormData) {
  await requireAdminSession();
  try {
    const interval = Number(formData.get("slotIntervalMinutes"));
    const initialStatus = String(formData.get("initialStatus"));
    if (![15, 30, 60].includes(interval)) {
      throw new Error("El intervalo seleccionado no es válido.");
    }
    if (initialStatus !== "pending" && initialStatus !== "confirmed") {
      throw new Error("El estado inicial no es válido.");
    }
    const input: ReservationSettingsData = {
      isEnabled: formData.get("isEnabled") === "true",
      durationMinutes: readInteger(formData, "durationMinutes", 15, 480),
      slotIntervalMinutes: interval as 15 | 30 | 60,
      minimumAdvanceMinutes: readInteger(
        formData,
        "minimumAdvanceMinutes",
        0,
        43_200,
      ),
      maximumAdvanceDays: readInteger(
        formData,
        "maximumAdvanceDays",
        1,
        365,
      ),
      maximumPartySize: readInteger(formData, "maximumPartySize", 1, 100),
      slotCapacity: readInteger(formData, "slotCapacity", 1, 1_000),
      largeGroupPhone: String(formData.get("largeGroupPhone") ?? "").trim()
        ? normalizePhone(String(formData.get("largeGroupPhone")))
        : "",
      customerMessage:
        normalizeOptionalText(
          String(formData.get("customerMessage") ?? ""),
          1000,
        ) ?? "",
      policyText:
        normalizeOptionalText(
          String(formData.get("policyText") ?? ""),
          4000,
        ) ?? "",
      initialStatus,
    };
    if (input.isEnabled && !input.policyText) {
      throw new Error(
        "Define la política de reserva antes de activar el módulo.",
      );
    }
    await saveReservationSettings(input);
    revalidatePath("/admin/reservation-settings");
    revalidatePath("/", "layout");
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo guardar la configuración.",
    };
  }
}

function readInteger(
  formData: FormData,
  name: string,
  minimum: number,
  maximum: number,
) {
  const value = Number(formData.get(name));
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`El campo ${name} no es válido.`);
  }
  return value;
}
