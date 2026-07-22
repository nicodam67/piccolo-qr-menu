import type {
  DemoProduct,
  OpeningPeriod,
} from "./types";

export function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .trim();
}

export function filterProducts(products: DemoProduct[], query: string) {
  const normalizedQuery = normalizeSearchValue(query);

  if (!normalizedQuery) {
    return products;
  }

  return products.filter((product) => {
    const searchableText = [
      product.name,
      product.description,
      ...product.tags.map((tag) => tag.label),
      ...product.allergens.map((allergen) => allergen.label),
    ].join(" ");

    return normalizeSearchValue(searchableText).includes(normalizedQuery);
  });
}

export function formatDemoPrice(price: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(price);
}

export function formatOpeningPeriods(periods: OpeningPeriod[]) {
  if (periods.length === 0) {
    return "Cerrado";
  }

  return periods
    .map((period) => `${period.opensAt}–${period.closesAt}`)
    .join(" · ");
}
