"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/features/auth/server-session";
import {
  getLoyaltySettings,
  saveLoyaltySettings,
} from "./repository";

export async function saveLoyaltySettingsAction(formData: FormData) {
  await requireAdminSession();
  try {
    const programName = String(formData.get("programName") ?? "").trim();
    const pointsPerEuro = Number(formData.get("pointsPerEuro"));
    const pointsExpire = formData.get("pointsExpire") === "true";
    const expiryMonths = pointsExpire
      ? Number(formData.get("expiryMonths"))
      : null;
    if (
      programName.length < 2 ||
      programName.length > 120 ||
      /[<>]/.test(programName)
    ) {
      throw new Error("El nombre del programa no es válido.");
    }
    if (!Number.isInteger(pointsPerEuro) || pointsPerEuro < 1) {
      throw new Error("La equivalencia de puntos no es válida.");
    }
    if (
      pointsExpire &&
      (!Number.isInteger(expiryMonths) ||
        (expiryMonths ?? 0) < 1 ||
        (expiryMonths ?? 0) > 120)
    ) {
      throw new Error("Los meses de validez no son válidos.");
    }
    const { restaurantId } = await getLoyaltySettings();
    await saveLoyaltySettings(restaurantId, {
      isEnabled: formData.get("isEnabled") === "true",
      programName,
      pointsPerEuro,
      pointsExpire,
      expiryMonths,
      manualAdjustmentsEnabled:
        formData.get("manualAdjustmentsEnabled") === "true",
    });
    revalidatePath("/admin/loyalty-settings");
    revalidatePath("/admin/customers");
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "No se pudo guardar.",
    };
  }
}
