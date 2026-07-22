import { createHash } from "node:crypto";

import type { DemoMenu } from "@/features/public-menu/types";

export const INTEGRATION_SCHEMA_VERSION = "1.0.0";

export type IntegrationCatalog = {
  version: string;
  publicationScope: "public-menu";
  restaurant: {
    id: string;
    name: string;
    locale: string;
    currencyCode: string;
    timeZone: string;
  };
  categories: Array<{
    id: string;
    name: string;
    description: string;
  }>;
  products: Array<{
    id: string;
    categoryId: string;
    name: string;
    description: string;
    fullPriceCents: number;
    halfPriceCents: number | null;
    isSoldOut: boolean;
    imageUrl: string;
    tags: Array<{
      label: string;
      tone: "green" | "red" | "gold";
    }>;
    allergens: string[];
  }>;
};

export type IntegrationCatalogDocument = {
  data: IntegrationCatalog;
  meta: {
    schemaVersion: typeof INTEGRATION_SCHEMA_VERSION;
    generatedAt: string;
    correlationId: string;
  };
};

export class IntegrationContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntegrationContractError";
  }
}

function sortByLabel<T extends { label: string }>(values: T[]) {
  return [...values].sort((left, right) =>
    left.label.localeCompare(right.label, "es"),
  );
}

export function buildIntegrationCatalog(
  menu: DemoMenu,
  correlationId: string,
  generatedAt = new Date(),
): IntegrationCatalogDocument {
  const catalogWithoutVersion = {
    publicationScope: "public-menu" as const,
    restaurant: {
      id: menu.restaurant.id,
      name: menu.restaurant.name,
      locale: menu.locale,
      currencyCode: menu.restaurant.currencyCode,
      timeZone: menu.timeZone,
    },
    categories: menu.categories.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.eyebrow,
    })),
    products: menu.products.map((product) => ({
      id: product.id,
      categoryId: product.categoryId,
      name: product.name,
      description: product.description,
      fullPriceCents: product.fullPriceCents,
      halfPriceCents: product.halfPriceCents ?? null,
      isSoldOut: product.isSoldOut ?? false,
      imageUrl: product.imageUrl,
      tags: sortByLabel(product.tags),
      allergens: [...product.allergens].sort((left, right) =>
        left.localeCompare(right, "es"),
      ),
    })),
  };
  const version = createHash("sha256")
    .update(JSON.stringify(catalogWithoutVersion))
    .digest("hex");

  return {
    data: {
      version,
      ...catalogWithoutVersion,
    },
    meta: {
      schemaVersion: INTEGRATION_SCHEMA_VERSION,
      generatedAt: generatedAt.toISOString(),
      correlationId,
    },
  };
}

export function parseAvailabilityCommand(value: unknown) {
  if (
    typeof value !== "object" ||
    value === null ||
    Object.keys(value).length !== 1 ||
    !("isSoldOut" in value) ||
    typeof value.isSoldOut !== "boolean"
  ) {
    throw new IntegrationContractError(
      "El cuerpo debe contener únicamente isSoldOut con un valor booleano.",
    );
  }

  return { isSoldOut: value.isSoldOut };
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function isCatalogVersion(value: string) {
  return /^[a-f0-9]{64}$/.test(value);
}
