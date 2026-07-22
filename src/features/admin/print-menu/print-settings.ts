import type { DemoMenu } from "@/features/public-menu/types";
import { buildMenuHierarchy } from "@/features/categories/hierarchy";

export type PrintMenuSettings = {
  orientation: "portrait" | "landscape";
  columns: 1 | 2;
  fontSize: "small" | "normal" | "large";
  density: "compact" | "comfortable";
  showDescriptions: boolean;
  showAllergens: boolean;
  showTags: boolean;
  showHalfPortions: boolean;
  showSoldOut: boolean;
  showAddress: boolean;
  showPhone: boolean;
  showSlogan: boolean;
  showQr: boolean;
};

export const DEFAULT_PRINT_MENU_SETTINGS: PrintMenuSettings = {
  orientation: "portrait",
  columns: 2,
  fontSize: "normal",
  density: "comfortable",
  showDescriptions: true,
  showAllergens: true,
  showTags: true,
  showHalfPortions: true,
  showSoldOut: true,
  showAddress: true,
  showPhone: true,
  showSlogan: true,
  showQr: true,
};

export function validatePrintMenuSettings(value: PrintMenuSettings) {
  if (!["portrait", "landscape"].includes(value.orientation)) {
    throw new Error("Orientación no válida.");
  }
  if (value.columns !== 1 && value.columns !== 2) {
    throw new Error("Número de columnas no válido.");
  }
  if (!["small", "normal", "large"].includes(value.fontSize)) {
    throw new Error("Tamaño de texto no válido.");
  }
  if (!["compact", "comfortable"].includes(value.density)) {
    throw new Error("Densidad no válida.");
  }
  return value;
}

export function selectPublishedPrintLocale(
  requested: string,
  publishedLocales: string[],
  defaultLocale: string,
) {
  if (publishedLocales.includes(requested)) return requested;
  if (publishedLocales.includes(defaultLocale)) return defaultLocale;
  throw new Error("No hay un idioma publicado disponible.");
}

export function preparePrintableMenu(
  menu: DemoMenu,
  settings: PrintMenuSettings,
) {
  validatePrintMenuSettings(settings);
  return buildMenuHierarchy(
    menu.categories,
    menu.products.filter(
      (product) => settings.showSoldOut || !product.isSoldOut,
    ),
  );
}

export function formatPrintPriceFromCents(
  cents: number,
  currency: string,
  locale: string,
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(cents / 100);
}
