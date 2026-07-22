import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertValidCategoryParent,
  buildCategoryHierarchy,
  buildMenuHierarchy,
  getCategoryBreadcrumb,
  getCategoryDeletionBlockers,
  normalizeSiblingOrder,
} from "../../src/features/categories/hierarchy";
import { filterProducts } from "../../src/features/public-menu/utils";

const categories = [
  { id: "wines", parentCategoryId: null, sortOrder: 2, name: "Vinos" },
  { id: "pasta", parentCategoryId: null, sortOrder: 1, name: "Pasta fresca" },
  {
    id: "red",
    parentCategoryId: "wines",
    sortOrder: 2,
    name: "Vinos tintos",
  },
  {
    id: "white",
    parentCategoryId: "wines",
    sortOrder: 1,
    name: "Vinos blancos",
  },
];
const products = [
  {
    id: "direct",
    categoryId: "wines",
    name: "Sangría",
    description: "Fruta",
    imageUrl: "",
    imageAlt: "",
    fullPriceCents: 1000,
    fullPrice: 10,
    tags: [],
    allergens: [],
  },
  {
    id: "chianti",
    categoryId: "red",
    name: "Chianti",
    description: "Vino italiano",
    imageUrl: "",
    imageAlt: "",
    fullPriceCents: 1800,
    fullPrice: 18,
    tags: [],
    allergens: [],
  },
];

describe("category hierarchy", () => {
  it("construye categorías principales", () => {
    assert.deepEqual(
      buildCategoryHierarchy(categories).map(({ id }) => id),
      ["pasta", "wines"],
    );
  });
  it("construye subcategorías", () => {
    assert.deepEqual(
      buildCategoryHierarchy(categories)[1].children.map(({ id }) => id),
      ["white", "red"],
    );
  });
  it("rechaza tercer nivel", () => {
    assert.throws(
      () => assertValidCategoryParent(categories, "new", "red"),
      /tercer nivel/,
    );
  });
  it("rechaza padre inexistente", () => {
    assert.throws(
      () => assertValidCategoryParent(categories, "new", "missing"),
      /no existe/,
    );
  });
  it("rechaza autorreferencia", () => {
    assert.throws(
      () => assertValidCategoryParent(categories, "wines", "wines"),
      /propio padre/,
    );
  });
  it("rechaza ciclos al convertir un padre con hijos", () => {
    assert.throws(
      () => assertValidCategoryParent(categories, "wines", "pasta"),
      /con subcategorías/,
    );
  });
  it("ordena principales consecutivamente", () => {
    const normalized = normalizeSiblingOrder(categories);
    assert.deepEqual(
      normalized
        .filter(({ parentCategoryId }) => parentCategoryId === null)
        .map(({ sortOrder }) => sortOrder),
      [1, 2],
    );
  });
  it("ordena subcategorías consecutivamente", () => {
    const normalized = normalizeSiblingOrder(categories);
    assert.deepEqual(
      normalized
        .filter(({ parentCategoryId }) => parentCategoryId === "wines")
        .map(({ sortOrder }) => sortOrder),
      [1, 2],
    );
  });
  it("mantiene productos directos antes de subcategorías", () => {
    const branch = buildMenuHierarchy(categories, products)[0];
    assert.equal(branch.category.id, "wines");
    assert.equal(branch.directProducts[0].id, "direct");
  });
  it("agrupa productos de subcategoría", () => {
    const branch = buildMenuHierarchy(categories, products)[0];
    assert.equal(branch.subcategories[0].products[0].id, "chianti");
  });
  it("oculta una rama principal inactiva al excluir su padre", () => {
    assert.equal(
      buildMenuHierarchy(
        categories.filter(({ id }) => id !== "wines"),
        products,
      ).length,
      0,
    );
  });
  it("oculta una subcategoría inactiva", () => {
    const branch = buildMenuHierarchy(
      categories.filter(({ id }) => id !== "red"),
      products,
    )[0];
    assert.equal(branch.subcategories.length, 0);
  });
  it("oculta ramas vacías", () => {
    assert.equal(buildMenuHierarchy(categories, []).length, 0);
  });
  it("crea breadcrumb principal y subcategoría", () => {
    assert.deepEqual(
      getCategoryBreadcrumb(categories, "red").map(({ id }) => id),
      ["wines", "red"],
    );
  });
  it("busca ignorando acentos y mayúsculas", () => {
    assert.equal(filterProducts(products, "VINO ITALIANO")[0].id, "chianti");
  });
  it("acepta datos planos existentes", () => {
    assert.equal(
      buildCategoryHierarchy([{ id: "legacy", name: "Legacy" }])[0].id,
      "legacy",
    );
  });
  it("bloquea eliminación con productos o subcategorías", () => {
    assert.equal(getCategoryDeletionBlockers(1, 0).canDelete, false);
    assert.equal(getCategoryDeletionBlockers(0, 2).canDelete, false);
  });
  it("permite convertir una subcategoría en principal", () => {
    assert.doesNotThrow(() =>
      assertValidCategoryParent(categories, "red", null),
    );
  });
  it("comparte la jerarquía con la carta imprimible", () => {
    const printable = buildMenuHierarchy(categories, products);
    assert.equal(printable[0].subcategories[0].category.name, "Vinos tintos");
  });
});
