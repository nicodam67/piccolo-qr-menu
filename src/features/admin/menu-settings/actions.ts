"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/features/auth/server-session";
import {
  menuDisplaySettingsInputSchema,
  type MenuDisplaySettings,
} from "@/features/menu-settings/config";

import {
  MenuSettingsError,
  updateMenuDisplaySettings,
} from "./repository";

export type MenuSettingsActionResult = {
  success: boolean;
  error: string | null;
};

function parseSettingsForm(formData: FormData): MenuDisplaySettings {
  const layout = formData.get("layout");
  const parsed = menuDisplaySettingsInputSchema.safeParse({
    showImages: formData.get("showImages") === "true",
    showDescriptions: formData.get("showDescriptions") === "true",
    showPrices: formData.get("showPrices") === "true",
    showTags: formData.get("showTags") === "true",
    showAllergens: formData.get("showAllergens") === "true",
    showHalfPortions: formData.get("showHalfPortions") === "true",
    layout,
  });

  if (!parsed.success) {
    throw new MenuSettingsError("La configuración recibida no es válida.");
  }

  return parsed.data;
}

export async function updateMenuSettingsAction(
  formData: FormData,
): Promise<MenuSettingsActionResult> {
  await requireAdminSession();

  try {
    await updateMenuDisplaySettings(parseSettingsForm(formData));
    revalidatePath("/admin");
    revalidatePath("/admin/menu-settings");
    revalidatePath("/es");
    return { success: true, error: null };
  } catch (error: unknown) {
    return {
      success: false,
      error:
        error instanceof MenuSettingsError
          ? error.message
          : "No se ha podido guardar la configuración.",
    };
  }
}
