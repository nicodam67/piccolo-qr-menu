import { z } from "zod";

export const DEFAULT_MENU_DISPLAY_SETTINGS = {
  showImages: true,
  showDescriptions: true,
  showPrices: true,
  showTags: true,
  showAllergens: true,
  showHalfPortions: true,
  layout: "cards",
} as const;

export type MenuDisplaySettings = {
  showImages: boolean;
  showDescriptions: boolean;
  showPrices: boolean;
  showTags: boolean;
  showAllergens: boolean;
  showHalfPortions: boolean;
  layout: "list" | "cards";
};

export const menuDisplaySettingsInputSchema = z
  .object({
    showImages: z.boolean(),
    showDescriptions: z.boolean(),
    showPrices: z.boolean(),
    showTags: z.boolean(),
    showAllergens: z.boolean(),
    showHalfPortions: z.boolean(),
    layout: z.enum(["list", "cards"]),
  })
  .strict();

const storedMenuDisplaySettingsSchema = z
  .object({
    showImages: z.boolean().catch(DEFAULT_MENU_DISPLAY_SETTINGS.showImages),
    showDescriptions: z
      .boolean()
      .catch(DEFAULT_MENU_DISPLAY_SETTINGS.showDescriptions),
    showPrices: z.boolean().catch(DEFAULT_MENU_DISPLAY_SETTINGS.showPrices),
    showTags: z.boolean().catch(DEFAULT_MENU_DISPLAY_SETTINGS.showTags),
    showAllergens: z
      .boolean()
      .catch(DEFAULT_MENU_DISPLAY_SETTINGS.showAllergens),
    showHalfPortions: z
      .boolean()
      .catch(DEFAULT_MENU_DISPLAY_SETTINGS.showHalfPortions),
    layout: z
      .enum(["list", "cards"])
      .catch(DEFAULT_MENU_DISPLAY_SETTINGS.layout),
  })
  .strip();

export function normalizeMenuDisplaySettings(
  value: unknown,
): MenuDisplaySettings {
  const candidate =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};

  return storedMenuDisplaySettingsSchema.parse(candidate);
}
