import "server-only";

import { eq } from "drizzle-orm";

import { getDatabase } from "@/db";
import { loyaltySettings, restaurantSettings } from "@/db/schema";

export const DEFAULT_LOYALTY_SETTINGS = {
  isEnabled: false,
  programName: "Fidelización Piccolo",
  pointsPerEuro: 1,
  pointsExpire: false,
  expiryMonths: null as number | null,
  manualAdjustmentsEnabled: true,
};

export async function getLoyaltySettings() {
  const { db } = getDatabase();
  const [restaurant] = await db
    .select({ id: restaurantSettings.id })
    .from(restaurantSettings)
    .limit(1);
  if (!restaurant) throw new Error("No existe un restaurante configurado.");
  const [row] = await db
    .select()
    .from(loyaltySettings)
    .where(eq(loyaltySettings.restaurantId, restaurant.id))
    .limit(1);
  return { restaurantId: restaurant.id, settings: row ?? DEFAULT_LOYALTY_SETTINGS };
}

export async function saveLoyaltySettings(
  restaurantId: string,
  values: typeof DEFAULT_LOYALTY_SETTINGS,
) {
  const { db } = getDatabase();
  await db
    .insert(loyaltySettings)
    .values({ restaurantId, ...values })
    .onConflictDoUpdate({
      target: loyaltySettings.restaurantId,
      set: { ...values, updatedAt: new Date() },
    });
}
