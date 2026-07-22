import "server-only";

import { eq } from "drizzle-orm";

import { getDatabase } from "@/db";
import { restaurantSettings } from "@/db/schema";
import {
  menuDisplaySettingsInputSchema,
  normalizeMenuDisplaySettings,
  type MenuDisplaySettings,
} from "@/features/menu-settings/config";

export class MenuSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MenuSettingsError";
  }
}

export async function getMenuDisplaySettings() {
  const { db } = getDatabase();
  const [restaurant] = await db
    .select({
      id: restaurantSettings.id,
      settings: restaurantSettings.menuDisplaySettings,
    })
    .from(restaurantSettings)
    .limit(1);

  if (!restaurant) {
    throw new MenuSettingsError("No existe un restaurante configurado.");
  }

  return {
    restaurantId: restaurant.id,
    settings: normalizeMenuDisplaySettings(restaurant.settings),
  };
}

export async function updateMenuDisplaySettings(
  settings: MenuDisplaySettings,
) {
  const validatedSettings = menuDisplaySettingsInputSchema.parse(settings);
  const { db } = getDatabase();
  const [restaurant] = await db
    .select({ id: restaurantSettings.id })
    .from(restaurantSettings)
    .limit(1);

  if (!restaurant) {
    throw new MenuSettingsError("No existe un restaurante configurado.");
  }

  await db
    .update(restaurantSettings)
    .set({
      menuDisplaySettings: validatedSettings,
      updatedAt: new Date(),
    })
    .where(eq(restaurantSettings.id, restaurant.id));
}
