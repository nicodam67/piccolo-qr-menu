import "dotenv/config";

import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  allergenTranslations,
  allergens,
  categories,
  categoryTranslations,
  openingHours,
  productAllergens,
  productTags,
  productTranslations,
  products,
  restaurantSettings,
  restaurantTranslations,
  tagTranslations,
  tags,
} from "./schema";

/**
 * SEED EXCLUSIVAMENTE DEMOSTRATIVO.
 *
 * Ningún teléfono, dirección, horario, producto, precio, alérgeno, etiqueta o
 * imagen incluido aquí debe interpretarse como información oficial de
 * Piccolo La Ràpita.
 */

const isProduction = process.env.NODE_ENV === "production";
const hasExplicitProductionAuthorization =
  process.env.ALLOW_DEMO_SEED === "true";

if (isProduction && !hasExplicitProductionAuthorization) {
  console.error(
    "Seed demo bloqueado: NODE_ENV=production. Para autorizarlo de forma excepcional, establece explícitamente ALLOW_DEMO_SEED=true. No se ha abierto ninguna conexión ni se ha modificado la base de datos.",
  );
  process.exit(1);
}

const ids = {
  restaurant: "10000000-0000-4000-8000-000000000001",
  categories: {
    antipasti: "20000000-0000-4000-8000-000000000001",
    pizze: "20000000-0000-4000-8000-000000000002",
    pasta: "20000000-0000-4000-8000-000000000003",
    dolci: "20000000-0000-4000-8000-000000000004",
  },
  products: {
    burrata: "30000000-0000-4000-8000-000000000001",
    focaccia: "30000000-0000-4000-8000-000000000002",
    margherita: "30000000-0000-4000-8000-000000000003",
    piccante: "30000000-0000-4000-8000-000000000004",
    tagliatelle: "30000000-0000-4000-8000-000000000005",
    tiramisu: "30000000-0000-4000-8000-000000000006",
  },
  allergens: {
    gluten: "40000000-0000-4000-8000-000000000001",
    egg: "40000000-0000-4000-8000-000000000002",
    milk: "40000000-0000-4000-8000-000000000003",
  },
  tags: {
    vegetarian: "50000000-0000-4000-8000-000000000001",
    vegan: "50000000-0000-4000-8000-000000000002",
    spicy: "50000000-0000-4000-8000-000000000003",
    recipeDemo: "50000000-0000-4000-8000-000000000004",
    demo: "50000000-0000-4000-8000-000000000005",
  },
};

const openingHourIds = Array.from(
  { length: 7 },
  (_, index) => `60000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
);

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL es obligatoria para ejecutar el seed demo.");
}

const client = postgres(databaseUrl, { max: 1 });
const db = drizzle(client);
const now = new Date();

async function seedDemo() {
  await db.transaction(async (tx) => {
    await tx
      .insert(restaurantSettings)
      .values({
        id: ids.restaurant,
        phone: "+34 900 000 000",
        address: "Dirección de demostración · La Ràpita",
        timezone: "Europe/Madrid",
        currencyCode: "EUR",
        defaultLocale: "es",
        heroImageUrl:
          "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1800&q=85",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: restaurantSettings.id,
        set: {
          phone: "+34 900 000 000",
          address: "Dirección de demostración · La Ràpita",
          timezone: "Europe/Madrid",
          currencyCode: "EUR",
          defaultLocale: "es",
          heroImageUrl:
            "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1800&q=85",
          updatedAt: now,
        },
      });

    await tx
      .insert(restaurantTranslations)
      .values({
        restaurantId: ids.restaurant,
        locale: "es",
        name: "Piccolo La Ràpita",
        slogan: "Cocina con sabor italiano",
        description:
          "Descripción exclusivamente demostrativa para el prototipo visual.",
      })
      .onConflictDoUpdate({
        target: [
          restaurantTranslations.restaurantId,
          restaurantTranslations.locale,
        ],
        set: {
          name: "Piccolo La Ràpita",
          slogan: "Cocina con sabor italiano",
          description:
            "Descripción exclusivamente demostrativa para el prototipo visual.",
        },
      });

    const hours = [
      {
        dayOfWeek: 1,
        isClosed: true,
        firstOpensAt: null,
        firstClosesAt: null,
        secondOpensAt: null,
        secondClosesAt: null,
      },
      ...[2, 3, 4].map((dayOfWeek) => ({
        dayOfWeek,
        isClosed: false,
        firstOpensAt: "13:00",
        firstClosesAt: "16:00",
        secondOpensAt: "19:30",
        secondClosesAt: "23:00",
      })),
      ...[5, 6].map((dayOfWeek) => ({
        dayOfWeek,
        isClosed: false,
        firstOpensAt: "13:00",
        firstClosesAt: "16:00",
        secondOpensAt: "19:30",
        secondClosesAt: "00:30",
      })),
      {
        dayOfWeek: 7,
        isClosed: false,
        firstOpensAt: "13:00",
        firstClosesAt: "16:00",
        secondOpensAt: "19:30",
        secondClosesAt: "23:00",
      },
    ];

    for (const [index, hoursForDay] of hours.entries()) {
      await tx
        .insert(openingHours)
        .values({
          id: openingHourIds[index],
          restaurantId: ids.restaurant,
          ...hoursForDay,
        })
        .onConflictDoUpdate({
          target: [openingHours.restaurantId, openingHours.dayOfWeek],
          set: {
            isClosed: hoursForDay.isClosed,
            firstOpensAt: hoursForDay.firstOpensAt,
            firstClosesAt: hoursForDay.firstClosesAt,
            secondOpensAt: hoursForDay.secondOpensAt,
            secondClosesAt: hoursForDay.secondClosesAt,
          },
        });
    }

    const categoryRows = [
      { id: ids.categories.antipasti, sortOrder: 1 },
      { id: ids.categories.pizze, sortOrder: 2 },
      { id: ids.categories.pasta, sortOrder: 3 },
      { id: ids.categories.dolci, sortOrder: 4 },
    ];

    for (const category of categoryRows) {
      await tx
        .insert(categories)
        .values({ ...category, isActive: true, createdAt: now, updatedAt: now })
        .onConflictDoUpdate({
          target: categories.id,
          set: {
            sortOrder: category.sortOrder,
            isActive: true,
            updatedAt: now,
          },
        });
    }

    const categoryTranslationRows = [
      {
        categoryId: ids.categories.antipasti,
        name: "Antipasti",
        description: "Para comenzar · demo",
      },
      {
        categoryId: ids.categories.pizze,
        name: "Pizze",
        description: "Masa artesana · demo",
      },
      {
        categoryId: ids.categories.pasta,
        name: "Pasta",
        description: "Recetas de muestra · demo",
      },
      {
        categoryId: ids.categories.dolci,
        name: "Dolci",
        description: "Un final dulce · demo",
      },
    ];

    for (const translation of categoryTranslationRows) {
      await tx
        .insert(categoryTranslations)
        .values({ ...translation, locale: "es" })
        .onConflictDoUpdate({
          target: [
            categoryTranslations.categoryId,
            categoryTranslations.locale,
          ],
          set: {
            name: translation.name,
            description: translation.description,
          },
        });
    }

    const productRows = [
      {
        id: ids.products.burrata,
        categoryId: ids.categories.antipasti,
        fullPriceCents: 1250,
        halfPriceCents: null,
        isSoldOut: false,
        sortOrder: 1,
        imageUrl:
          "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=85",
      },
      {
        id: ids.products.focaccia,
        categoryId: ids.categories.antipasti,
        fullPriceCents: 790,
        halfPriceCents: null,
        isSoldOut: true,
        sortOrder: 2,
        imageUrl:
          "https://images.unsplash.com/photo-1573140401552-3fab0b24306f?auto=format&fit=crop&w=1200&q=85",
      },
      {
        id: ids.products.margherita,
        categoryId: ids.categories.pizze,
        fullPriceCents: 1180,
        halfPriceCents: 720,
        isSoldOut: false,
        sortOrder: 1,
        imageUrl:
          "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=1200&q=85",
      },
      {
        id: ids.products.piccante,
        categoryId: ids.categories.pizze,
        fullPriceCents: 1420,
        halfPriceCents: null,
        isSoldOut: false,
        sortOrder: 2,
        imageUrl:
          "https://images.unsplash.com/photo-1594007654729-407eedc4be65?auto=format&fit=crop&w=1200&q=85",
      },
      {
        id: ids.products.tagliatelle,
        categoryId: ids.categories.pasta,
        fullPriceCents: 1540,
        halfPriceCents: 950,
        isSoldOut: false,
        sortOrder: 1,
        imageUrl:
          "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1200&q=85",
      },
      {
        id: ids.products.tiramisu,
        categoryId: ids.categories.dolci,
        fullPriceCents: 680,
        halfPriceCents: null,
        isSoldOut: false,
        sortOrder: 1,
        imageUrl:
          "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=1200&q=85",
      },
    ];

    for (const product of productRows) {
      await tx
        .insert(products)
        .values({
          ...product,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: products.id,
          set: {
            categoryId: product.categoryId,
            fullPriceCents: product.fullPriceCents,
            halfPriceCents: product.halfPriceCents,
            isActive: true,
            isSoldOut: product.isSoldOut,
            sortOrder: product.sortOrder,
            imageUrl: product.imageUrl,
            updatedAt: now,
          },
        });
    }

    const productTranslationRows = [
      {
        productId: ids.products.burrata,
        name: "Burrata de muestra",
        description:
          "Composición visual de tomate, burrata y albahaca. Descripción no oficial.",
      },
      {
        productId: ids.products.focaccia,
        name: "Focaccia de muestra",
        description:
          "Pan aromático presentado como contenido provisional para revisar la tarjeta.",
      },
      {
        productId: ids.products.margherita,
        name: "Pizza de muestra",
        description:
          "Tomate, mozzarella y albahaca usados solo para representar el diseño.",
      },
      {
        productId: ids.products.piccante,
        name: "Pizza piccante de muestra",
        description:
          "Una combinación ficticia para mostrar etiquetas y alérgenos en el prototipo.",
      },
      {
        productId: ids.products.tagliatelle,
        name: "Tagliatelle de muestra",
        description:
          "Pasta y salsa ilustrativas; el plato y su precio no pertenecen a la carta real.",
      },
      {
        productId: ids.products.tiramisu,
        name: "Postre de muestra",
        description:
          "Presentación ficticia para validar el aspecto de la sección de postres.",
      },
    ];

    for (const translation of productTranslationRows) {
      await tx
        .insert(productTranslations)
        .values({ ...translation, locale: "es" })
        .onConflictDoUpdate({
          target: [
            productTranslations.productId,
            productTranslations.locale,
          ],
          set: {
            name: translation.name,
            description: translation.description,
          },
        });
    }

    const allergenRows = [
      { id: ids.allergens.gluten, code: "gluten", icon: "wheat" },
      { id: ids.allergens.egg, code: "egg", icon: "egg" },
      { id: ids.allergens.milk, code: "milk", icon: "milk" },
    ];

    await tx.insert(allergens).values(allergenRows).onConflictDoNothing();
    await tx
      .insert(allergenTranslations)
      .values([
        { allergenId: ids.allergens.gluten, locale: "es", name: "Gluten" },
        { allergenId: ids.allergens.egg, locale: "es", name: "Huevo" },
        { allergenId: ids.allergens.milk, locale: "es", name: "Leche" },
      ])
      .onConflictDoNothing();

    const tagRows = [
      { id: ids.tags.vegetarian, color: "green", name: "Vegetariano" },
      { id: ids.tags.vegan, color: "green", name: "Vegano" },
      { id: ids.tags.spicy, color: "red", name: "Picante" },
      { id: ids.tags.recipeDemo, color: "gold", name: "Receta demo" },
      { id: ids.tags.demo, color: "gold", name: "Demo" },
    ];

    await tx
      .insert(tags)
      .values(tagRows.map(({ id, color }) => ({ id, color })))
      .onConflictDoNothing();
    await tx
      .insert(tagTranslations)
      .values(
        tagRows.map(({ id, name }) => ({
          tagId: id,
          locale: "es",
          name,
        })),
      )
      .onConflictDoNothing();

    const productIds = Object.values(ids.products);
    await tx
      .delete(productAllergens)
      .where(inArray(productAllergens.productId, productIds));
    await tx.delete(productTags).where(inArray(productTags.productId, productIds));

    await tx.insert(productAllergens).values([
      { productId: ids.products.burrata, allergenId: ids.allergens.milk },
      { productId: ids.products.focaccia, allergenId: ids.allergens.gluten },
      { productId: ids.products.margherita, allergenId: ids.allergens.gluten },
      { productId: ids.products.margherita, allergenId: ids.allergens.milk },
      { productId: ids.products.piccante, allergenId: ids.allergens.gluten },
      { productId: ids.products.piccante, allergenId: ids.allergens.milk },
      { productId: ids.products.tagliatelle, allergenId: ids.allergens.gluten },
      { productId: ids.products.tagliatelle, allergenId: ids.allergens.egg },
      { productId: ids.products.tagliatelle, allergenId: ids.allergens.milk },
      { productId: ids.products.tiramisu, allergenId: ids.allergens.gluten },
      { productId: ids.products.tiramisu, allergenId: ids.allergens.egg },
      { productId: ids.products.tiramisu, allergenId: ids.allergens.milk },
    ]);

    await tx.insert(productTags).values([
      { productId: ids.products.burrata, tagId: ids.tags.vegetarian },
      { productId: ids.products.focaccia, tagId: ids.tags.vegan },
      { productId: ids.products.margherita, tagId: ids.tags.vegetarian },
      { productId: ids.products.piccante, tagId: ids.tags.spicy },
      { productId: ids.products.tagliatelle, tagId: ids.tags.recipeDemo },
      { productId: ids.products.tiramisu, tagId: ids.tags.demo },
    ]);
  });
}

seedDemo()
  .then(() => {
    console.info("Seed demo de Piccolo QR Menu completado.");
  })
  .catch((error: unknown) => {
    console.error("No se pudo ejecutar el seed demo.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
