import assert from "node:assert/strict";
import test from "node:test";

import {
  isIntegrationTokenValid,
  parseBearerCredential,
  parseIntegrationScopes,
} from "../../src/features/integration/auth-core";
import {
  IntegrationContractError,
  buildIntegrationCatalog,
  isCatalogVersion,
  isUuid,
  parseAvailabilityCommand,
} from "../../src/features/integration/contracts";
import type { DemoMenu } from "../../src/features/public-menu/types";

const menu: DemoMenu = {
  restaurant: {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Piccolo",
    slogan: "Cocina italiana",
    phoneDisplay: "+34 900 000 000",
    phoneHref: "tel:+34900000000",
    address: "Carrer Major, 1",
    currencyCode: "EUR",
    heroImageUrl: "https://example.com/hero.jpg",
    heroImageAlt: "Restaurante",
  },
  locale: "es",
  timeZone: "Europe/Madrid",
  categories: [
    {
      id: "20000000-0000-4000-8000-000000000001",
      name: "Pizze",
      eyebrow: "Pizza al horno",
    },
  ],
  products: [
    {
      id: "30000000-0000-4000-8000-000000000001",
      categoryId: "20000000-0000-4000-8000-000000000001",
      name: "Margherita",
      description: "Tomate y mozzarella",
      imageUrl: "https://example.com/product.jpg",
      imageAlt: "Margherita",
      fullPriceCents: 1_250,
      halfPriceCents: 700,
      fullPrice: 12.5,
      halfPrice: 7,
      tags: [
        { label: "Vegetariano", tone: "green" },
        { label: "Clásico", tone: "gold" },
      ],
      allergens: [
        { label: "Leche", icon: "milk" },
        { label: "Gluten", icon: "wheat" },
      ],
      isSoldOut: false,
    },
  ],
  openingHours: [],
};

test("parses strict Bearer credentials and configured scopes", () => {
  assert.equal(parseBearerCredential("Bearer secret-token"), "secret-token");
  assert.equal(parseBearerCredential("bearer secret-token"), "secret-token");
  assert.equal(parseBearerCredential("Basic secret-token"), null);
  assert.equal(parseBearerCredential("Bearer token with spaces"), null);

  assert.deepEqual(
    [...parseIntegrationScopes("catalog:read, unknown, catalog:write")],
    ["catalog:read", "catalog:write"],
  );
});

test("compares integration tokens without accepting prefixes", () => {
  assert.equal(isIntegrationTokenValid("exact-token", "exact-token"), true);
  assert.equal(isIntegrationTokenValid("exact", "exact-token"), false);
  assert.equal(isIntegrationTokenValid(null, "exact-token"), false);
});

test("builds a stable, cent-based catalog contract", () => {
  const first = buildIntegrationCatalog(
    menu,
    "correlation-one",
    new Date("2026-07-22T12:00:00.000Z"),
  );
  const second = buildIntegrationCatalog(
    menu,
    "correlation-two",
    new Date("2026-07-22T13:00:00.000Z"),
  );

  assert.equal(first.data.version, second.data.version);
  assert.equal(first.data.products[0]?.fullPriceCents, 1_250);
  assert.equal(first.data.products[0]?.halfPriceCents, 700);
  assert.deepEqual(first.data.products[0]?.allergens, ["Gluten", "Leche"]);
  assert.deepEqual(
    first.data.products[0]?.tags.map(({ label }) => label),
    ["Clásico", "Vegetariano"],
  );
  assert.equal(first.meta.correlationId, "correlation-one");
  assert.notEqual(first.meta.generatedAt, second.meta.generatedAt);
});

test("validates absolute availability commands and product UUIDs", () => {
  assert.deepEqual(parseAvailabilityCommand({ isSoldOut: true }), {
    isSoldOut: true,
  });
  assert.throws(
    () => parseAvailabilityCommand({ isSoldOut: true, delta: 1 }),
    IntegrationContractError,
  );
  assert.throws(
    () => parseAvailabilityCommand({ isSoldOut: "yes" }),
    IntegrationContractError,
  );
  assert.equal(
    isUuid("30000000-0000-4000-8000-000000000001"),
    true,
  );
  assert.equal(isUuid("not-a-uuid"), false);
  assert.equal(
    isCatalogVersion(
      "baa24069444a392eb101d2b1ea904abbe364f357cf135f147d26d11811fc7a04",
    ),
    true,
  );
  assert.equal(isCatalogVersion("latest"), false);
});
