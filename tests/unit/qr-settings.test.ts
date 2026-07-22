import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_QR_CUSTOMIZATION,
  validateQrCustomization,
  verifyQrDestination,
} from "../../src/features/admin/qr/qr-settings";
import { buildPublicMenuUrl } from "../../src/features/admin/qr/qr-url";

describe("QR URL and customization", () => {
  it("construye URL española", () => {
    assert.equal(
      buildPublicMenuUrl("https://piccolo.example", "es", ["es", "ca"]),
      "https://piccolo.example/es",
    );
  });
  it("construye URL catalana", () => {
    assert.equal(
      buildPublicMenuUrl("https://piccolo.example/es", "ca", ["es", "ca"]),
      "https://piccolo.example/ca",
    );
  });
  it("permite seleccionar el idioma predeterminado", () => {
    const defaultLocale = "es";
    assert.equal(
      buildPublicMenuUrl("https://piccolo.example", defaultLocale, ["es"]),
      "https://piccolo.example/es",
    );
  });
  it("rechaza idioma no soportado", () => {
    assert.throws(() =>
      buildPublicMenuUrl("https://piccolo.example", "ro", ["es", "ca"]),
    );
  });
  it("no usa localhost con URL de producción", () => {
    assert.doesNotMatch(
      buildPublicMenuUrl("https://menu.piccolo.example", "es", ["es"]),
      /localhost/,
    );
  });
  it("valida tamaños", () => {
    assert.throws(() =>
      validateQrCustomization({ ...DEFAULT_QR_CUSTOMIZATION, size: 300 as 512 }),
    );
  });
  it("valida márgenes", () => {
    assert.throws(() =>
      validateQrCustomization({ ...DEFAULT_QR_CUSTOMIZATION, margin: 1 }),
    );
  });
  it("valida colores y contraste", () => {
    assert.throws(() =>
      validateQrCustomization({
        ...DEFAULT_QR_CUSTOMIZATION,
        darkColor: "#ffffff",
      }),
    );
  });
  it("acepta niveles de corrección permitidos", () => {
    for (const level of ["M", "Q", "H"] as const) {
      assert.equal(
        validateQrCustomization({
          ...DEFAULT_QR_CUSTOMIZATION,
          errorCorrectionLevel: level,
        }).errorCorrectionLevel,
        level,
      );
    }
  });
  it("comprueba que contenido y URL visible coinciden", () => {
    assert.equal(
      verifyQrDestination({
        destinationUrl: "https://piccolo.example/es",
        visibleUrl: "https://piccolo.example/es",
        publicBaseUrl: "https://piccolo.example",
        locale: "es",
        publishedLocales: ["es"],
      }),
      true,
    );
  });
  it("admite nombre y eslogan opcionales", () => {
    assert.doesNotThrow(() =>
      validateQrCustomization({
        ...DEFAULT_QR_CUSTOMIZATION,
        showRestaurantName: false,
        showSlogan: false,
      }),
    );
  });
  it("admite fondo transparente con código oscuro", () => {
    assert.equal(
      validateQrCustomization({
        ...DEFAULT_QR_CUSTOMIZATION,
        background: "transparent",
      }).background,
      "transparent",
    );
  });
  it("mantiene defaults seguros", () => {
    assert.deepEqual(DEFAULT_QR_CUSTOMIZATION, {
      size: 1024,
      margin: 4,
      errorCorrectionLevel: "H",
      darkColor: "#111111",
      lightColor: "#ffffff",
      background: "white",
      layout: "vertical",
      showRestaurantName: true,
      showSlogan: true,
      showCallToAction: true,
    });
  });
});
