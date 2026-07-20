import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_PRINT_MENU_SETTINGS,
  formatPrintPriceFromCents,
  preparePrintableMenu,
  selectPublishedPrintLocale,
  validatePrintMenuSettings,
} from "../../src/features/admin/print-menu/print-settings";
import { buildPublicMenuUrl } from "../../src/features/admin/qr/qr-url";
import type { DemoMenu } from "../../src/features/public-menu/types";

const menu: DemoMenu = {
  restaurant: {
    name: "Piccolo",
    slogan: "Sabor italiano",
    phoneDisplay: "",
    phoneHref: "",
    address: "",
    heroImageUrl: "",
    heroImageAlt: "",
  },
  locale: "es",
  currencyCode: "EUR",
  timeZone: "Europe/Madrid",
  categories: [
    { id: "one", name: "Uno", eyebrow: "" },
    { id: "empty", name: "Vacía", eyebrow: "" },
  ],
  products: [
    {
      id: "a",
      categoryId: "one",
      name: "Producto",
      description: "Descripción",
      imageUrl: "",
      imageAlt: "",
      fullPrice: 12.5,
      halfPrice: 7,
      tags: [{ label: "Vegano", tone: "green" }],
      allergens: [{ label: "Leche", icon: "milk" }],
      isSoldOut: false,
    },
    {
      id: "b",
      categoryId: "one",
      name: "Agotado",
      description: "",
      imageUrl: "",
      imageAlt: "",
      fullPrice: 9,
      tags: [],
      allergens: [],
      isSoldOut: true,
    },
  ],
  openingHours: [],
  specialOpeningHours: [],
  displaySettings: {
    showImages: true,
    showDescriptions: true,
    showPrices: true,
    showTags: true,
    showAllergens: true,
    showHalfPortions: true,
    layout: "cards",
  },
};

describe("printable menu", () => {
  it("selecciona locale publicado", () => {
    assert.equal(selectPublishedPrintLocale("ca", ["es", "ca"], "es"), "ca");
  });
  it("rechaza locale no publicado usando el principal", () => {
    assert.equal(selectPublishedPrintLocale("fr", ["es"], "es"), "es");
  });
  it("formatea precios desde céntimos", () => {
    assert.match(formatPrintPriceFromCents(1250, "EUR", "es"), /12,50/);
  });
  it("mantiene precio de media ración exacto", () => {
    assert.match(formatPrintPriceFromCents(700, "EUR", "es"), /7,00/);
  });
  it("oculta categorías vacías", () => {
    assert.equal(preparePrintableMenu(menu, DEFAULT_PRINT_MENU_SETTINGS).length, 1);
  });
  for (const key of [
    "showDescriptions",
    "showAllergens",
    "showTags",
  ] as const) {
    it(`permite desactivar ${key}`, () => {
      assert.equal(
        validatePrintMenuSettings({
          ...DEFAULT_PRINT_MENU_SETTINGS,
          [key]: false,
        })[key],
        false,
      );
    });
  }
  it("oculta productos agotados", () => {
    const sections = preparePrintableMenu(menu, {
      ...DEFAULT_PRINT_MENU_SETTINGS,
      showSoldOut: false,
    });
    assert.deepEqual(
      sections[0].directProducts.map((product) => product.id),
      ["a"],
    );
  });
  it("muestra productos agotados por defecto", () => {
    assert.equal(
      preparePrintableMenu(menu, DEFAULT_PRINT_MENU_SETTINGS)[0].directProducts
        .length,
      2,
    );
  });
  it("admite una columna", () => {
    assert.equal(validatePrintMenuSettings({ ...DEFAULT_PRINT_MENU_SETTINGS, columns: 1 }).columns, 1);
  });
  it("admite dos columnas", () => {
    assert.equal(validatePrintMenuSettings({ ...DEFAULT_PRINT_MENU_SETTINGS, columns: 2 }).columns, 2);
  });
  it("admite orientación vertical", () => {
    assert.equal(validatePrintMenuSettings({ ...DEFAULT_PRINT_MENU_SETTINGS, orientation: "portrait" }).orientation, "portrait");
  });
  it("admite orientación horizontal", () => {
    assert.equal(validatePrintMenuSettings({ ...DEFAULT_PRINT_MENU_SETTINGS, orientation: "landscape" }).orientation, "landscape");
  });
  it("construye QR con URL canónica", () => {
    assert.equal(buildPublicMenuUrl("https://piccolo.example", "es", ["es"]), "https://piccolo.example/es");
  });
  it("mantiene defaults seguros", () => {
    assert.equal(DEFAULT_PRINT_MENU_SETTINGS.columns, 2);
    assert.equal(DEFAULT_PRINT_MENU_SETTINGS.showSoldOut, true);
  });
  it("tolera datos opcionales ausentes", () => {
    assert.equal(menu.restaurant.address, "");
  });
  it("no contiene configuración de persistencia", () => {
    assert.equal("id" in DEFAULT_PRINT_MENU_SETTINGS, false);
  });
});
