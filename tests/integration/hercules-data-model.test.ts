import assert from "node:assert/strict";
import test from "node:test";

import { asc, eq } from "drizzle-orm";

import { getDatabase } from "../../src/db";
import {
  assets,
  auditLog,
  externalEntityMappings,
  importRuns,
  locales,
  openingHourExceptions,
  productAssets,
  products,
  restaurantBranding,
  restaurantLinks,
  restaurantSettings,
  restaurantTranslations,
  syncRuns,
} from "../../src/db/schema";
import { appendAuditLog } from "../../src/db/repositories/audit-log";
import {
  ExternalEntityMappingError,
  upsertExternalEntityMapping,
} from "../../src/db/repositories/external-entity-mappings";
import {
  createCategory,
  deleteEmptyCategory,
  getAdminCategoryData,
  updateCategory,
} from "../../src/features/admin/categories/repository";
import {
  createProduct,
  deleteProduct,
  getAdminProductData,
  updateProduct,
} from "../../src/features/admin/products/repository";

const restaurantId = "70000000-0000-4000-8000-000000000001";
const secondCategoryId = "70000000-0000-4000-8000-000000000002";
const missingEntityId = "70000000-0000-4000-8000-000000000099";

function assertIsTestDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL es obligatoria para la integración.");
  }

  const databaseName = new URL(databaseUrl).pathname.slice(1);

  if (!databaseName.startsWith("piccolo_test_")) {
    throw new Error(
      `La integración solo puede usar una base aislada piccolo_test_*; se recibió "${databaseName}".`,
    );
  }
}

async function truncateDomainTables() {
  const { sql } = getDatabase();
  await sql.unsafe(`
    truncate table
      audit_log,
      external_entity_mappings,
      product_assets,
      restaurant_links,
      restaurant_branding,
      opening_hour_exceptions,
      sync_runs,
      import_runs,
      product_allergens,
      product_tags,
      product_translations,
      products,
      category_translations,
      categories,
      allergen_translations,
      allergens,
      tag_translations,
      tags,
      opening_hours,
      restaurant_translations,
      restaurant_settings,
      locales,
      admins,
      admin_login_attempts
    restart identity cascade
  `);
}

test("persiste el modelo Hercules sin romper el CRUD actual", async (t) => {
  assertIsTestDatabase();
  const { db, sql } = getDatabase();
  await truncateDomainTables();

  try {
    await t.test("locales y locale predeterminado único", async () => {
      await db.insert(locales).values([
        {
          code: "es",
          name: "Español",
          nativeName: "Español",
          isDefault: true,
          sortOrder: 1,
        },
        {
          code: "en",
          name: "Inglés",
          nativeName: "English",
          isDefault: false,
          sortOrder: 2,
        },
      ]);

      await assert.rejects(() =>
        db.insert(locales).values({
          code: "es",
          name: "Duplicado",
          nativeName: "Duplicado",
          sortOrder: 3,
        }),
      );
      await assert.rejects(() =>
        db
          .update(locales)
          .set({ isDefault: true })
          .where(eq(locales.code, "en")),
      );
    });

    await db.insert(restaurantSettings).values({
      id: restaurantId,
      phone: "+34 900 000 000",
      address: "Dirección de prueba aislada",
      defaultLocale: "es",
      heroImageUrl: "https://example.test/legacy-hero.jpg",
    });
    await db.insert(restaurantTranslations).values({
      restaurantId,
      locale: "es",
      name: "Restaurante de prueba",
      slogan: "Persistencia aislada",
      description: "Contenido sintético de integración.",
    });

    let categoryId = "";
    let productId = "";

    await t.test("CRUD actual de categorías y productos", async () => {
      categoryId = await createCategory({
        name: "Categoría persistencia",
        description: "Creada por el repositorio existente.",
        locale: "es",
        isActive: true,
        sortOrder: 1,
      });
      productId = await createProduct({
        categoryId,
        locale: "es",
        name: "Producto persistencia",
        description: "Creado por el repositorio existente.",
        fullPriceCents: 1234,
        halfPriceCents: 700,
        isActive: true,
        isSoldOut: false,
        sortOrder: 1,
        imageUrl: "https://example.test/legacy-product.jpg",
        tagIds: [],
        allergenIds: [],
      });

      await updateCategory(categoryId, {
        name: "Categoría persistencia actualizada",
        description: "Actualizada sin tocar campos de sincronización.",
        locale: "es",
        isActive: true,
        sortOrder: 1,
      });
      await updateProduct(productId, {
        categoryId,
        locale: "es",
        name: "Producto persistencia actualizado",
        description: "Actualizado sin tocar campos de sincronización.",
        fullPriceCents: 1300,
        halfPriceCents: null,
        isActive: true,
        isSoldOut: true,
        sortOrder: 1,
        imageUrl: "https://example.test/legacy-product-updated.jpg",
        tagIds: [],
        allergenIds: [],
      });

      const [categoryData, productData] = await Promise.all([
        getAdminCategoryData(),
        getAdminProductData(),
      ]);
      assert.equal(categoryData.categories[0]?.id, categoryId);
      assert.equal(
        categoryData.categories[0]?.translations[0]?.name,
        "Categoría persistencia actualizada",
      );
      assert.equal(productData.products[0]?.id, productId);
      assert.equal(productData.products[0]?.fullPriceCents, 1300);
      assert.equal(productData.products[0]?.isSoldOut, true);

      const [catalogDefaults] = await db
        .select({
          catalogSource: products.catalogSource,
          managedBy: products.managedBy,
          syncStatus: products.syncStatus,
        })
        .from(products)
        .where(eq(products.id, productId));
      assert.deepEqual(catalogDefaults, {
        catalogSource: "manual",
        managedBy: "qr_admin",
        syncStatus: "not_synced",
      });
    });

    let importRunId = "";
    let syncRunId = "";

    await t.test("runs de importación y sincronización", async () => {
      [importRunId] = (
        await db
          .insert(importRuns)
          .values({
            source: "hercules_convex",
            kind: "dry_run",
            status: "succeeded",
            sourceChecksum: "a".repeat(64),
            sourceFilename: "fixture-anonimizado.zip",
            counters: { read: 2, skipped: 2 },
            warnings: [{ code: "SYNTHETIC_WARNING" }],
            errors: [],
            completedAt: new Date(),
          })
          .returning({ id: importRuns.id })
      ).map(({ id }) => id);

      [syncRunId] = (
        await db
          .insert(syncRuns)
          .values({
            sourceSystem: "piccolo_tpv",
            direction: "tpv_to_qr",
            status: "succeeded",
            checkpoint: "synthetic-checkpoint",
            recordsRead: 3,
            recordsCreated: 1,
            recordsUpdated: 1,
            recordsSkipped: 1,
            recordsFailed: 0,
            completedAt: new Date(),
          })
          .returning({ id: syncRuns.id })
      ).map(({ id }) => id);

      assert.ok(importRunId);
      assert.ok(syncRunId);
    });

    await t.test("mappings externos idempotentes y validados", async () => {
      const first = await upsertExternalEntityMapping({
        source: "hercules_convex",
        entityType: "product",
        externalId: "convex-product-synthetic",
        internalId: productId,
        metadata: { collection: "products" },
        payloadHash: "b".repeat(64),
        lastSeenImportRunId: importRunId,
      });
      const repeated = await upsertExternalEntityMapping({
        source: "hercules_convex",
        entityType: "product",
        externalId: "convex-product-synthetic",
        internalId: productId,
        metadata: { collection: "products", repeated: true },
        payloadHash: "b".repeat(64),
        lastSeenImportRunId: importRunId,
      });

      assert.equal(repeated?.id, first?.id);
      assert.equal(
        (
          await db
            .select()
            .from(externalEntityMappings)
            .where(
              eq(
                externalEntityMappings.externalId,
                "convex-product-synthetic",
              ),
            )
        ).length,
        1,
      );

      await db.insert(products).values({
        id: secondCategoryId,
        categoryId,
        fullPriceCents: 100,
        imageUrl: "https://example.test/other.jpg",
      });
      await assert.rejects(
        () =>
          upsertExternalEntityMapping({
            source: "hercules_convex",
            entityType: "product",
            externalId: "convex-product-synthetic",
            internalId: secondCategoryId,
          }),
        ExternalEntityMappingError,
      );
      await assert.rejects(
        () =>
          upsertExternalEntityMapping({
            source: "hercules_convex",
            entityType: "product",
            externalId: "missing-product",
            internalId: missingEntityId,
          }),
        ExternalEntityMappingError,
      );
      await assert.rejects(() =>
        upsertExternalEntityMapping({
          source: "hercules_convex",
          entityType: "product",
          externalId: "unsafe-product",
          internalId: productId,
          metadata: { token: "must-not-be-stored" },
        }),
      );
      await db.delete(products).where(eq(products.id, secondCategoryId));
    });

    await t.test("assets, imagen principal, galería y vídeo ordenados", async () => {
      const assetRows = await db
        .insert(assets)
        .values([
          {
            kind: "image",
            storageProvider: "test",
            storageKey: "images/primary.webp",
            publicUrl: "https://assets.example.test/images/primary.webp",
            originalFilename: "primary.webp",
            mimeType: "image/webp",
            byteSize: 1000,
            sha256: "1".repeat(64),
            width: 1200,
            height: 800,
            status: "available",
          },
          {
            kind: "image",
            storageProvider: "test",
            storageKey: "images/gallery.webp",
            originalFilename: "gallery.webp",
            mimeType: "image/webp",
            byteSize: 900,
            sha256: "2".repeat(64),
            width: 1200,
            height: 800,
            status: "available",
          },
          {
            kind: "video",
            storageProvider: "test",
            storageKey: "videos/product.mp4",
            originalFilename: "product.mp4",
            mimeType: "video/mp4",
            byteSize: 5000,
            sha256: "3".repeat(64),
            durationMs: 2500,
            status: "available",
          },
        ])
        .returning({ id: assets.id, kind: assets.kind });
      const [primary, gallery] = assetRows.filter(({ kind }) => kind === "image");
      const video = assetRows.find(({ kind }) => kind === "video");

      assert.ok(primary && gallery && video);
      await db
        .update(products)
        .set({ primaryImageAssetId: primary.id })
        .where(eq(products.id, productId));
      await db.insert(productAssets).values([
        {
          productId,
          assetId: primary.id,
          role: "gallery",
          sortOrder: 1,
        },
        {
          productId,
          assetId: gallery.id,
          role: "gallery",
          sortOrder: 2,
        },
        {
          productId,
          assetId: video.id,
          role: "video",
          sortOrder: 1,
        },
      ]);

      const orderedGallery = await db
        .select({ assetId: productAssets.assetId })
        .from(productAssets)
        .where(eq(productAssets.role, "gallery"))
        .orderBy(asc(productAssets.sortOrder));
      assert.deepEqual(
        orderedGallery.map(({ assetId }) => assetId),
        [primary.id, gallery.id],
      );
      await assert.rejects(() =>
        db.insert(productAssets).values({
          productId,
          assetId: video.id,
          role: "gallery",
          sortOrder: 2,
        }),
      );

      await db.insert(restaurantBranding).values({
        restaurantId,
        logoAssetId: primary.id,
        heroAssetId: gallery.id,
        iconAssetId: primary.id,
        primaryColor: "#112233",
        secondaryColor: "#445566",
        backgroundColor: "#ffffff",
        textColor: "#111111",
        primaryFont: "System Sans",
        secondaryFont: "System Serif",
      });
      await db.insert(restaurantLinks).values({
        restaurantId,
        kind: "website",
        label: "Sitio de prueba",
        url: "https://example.test",
        sortOrder: 1,
      });
    });

    await t.test("excepciones horarias con cierres y cruce de medianoche", async () => {
      await db.insert(openingHourExceptions).values([
        {
          restaurantId,
          exceptionType: "holiday",
          startsOn: "2027-01-01",
          endsOn: "2027-01-01",
          isClosed: true,
          reason: "Festivo sintético",
          priority: 100,
        },
        {
          restaurantId,
          exceptionType: "special_opening",
          startsOn: "2027-01-02",
          endsOn: "2027-01-03",
          isClosed: false,
          firstOpensAt: "20:00",
          firstClosesAt: "01:30",
          reason: "Servicio sintético nocturno",
          priority: 50,
        },
      ]);

      assert.equal(
        (
          await db
            .select()
            .from(openingHourExceptions)
            .where(eq(openingHourExceptions.restaurantId, restaurantId))
        ).length,
        2,
      );
    });

    await t.test("auditoría sanitizada e indexable", async () => {
      const event = await appendAuditLog({
        actorType: "import",
        actorId: importRunId,
        action: "mapping.upsert",
        entityType: "product",
        entityId: productId,
        source: "hercules_convex",
        before: null,
        after: { payloadHash: "b".repeat(64) },
        metadata: { importRunId },
      });
      assert.ok(event?.id);
      assert.equal((await db.select().from(auditLog)).length, 1);
      await assert.rejects(() =>
        appendAuditLog({
          actorType: "system",
          action: "unsafe",
          entityType: "product",
          source: "system",
          metadata: { password: "must-not-be-stored" },
        }),
      );
    });

    await t.test("borrado mediante repositorios actuales", async () => {
      await deleteProduct(productId);
      const result = await deleteEmptyCategory(categoryId);
      assert.deepEqual(result, { deleted: true, productCount: 0 });
    });
  } finally {
    await truncateDomainTables();
    await sql.end();
  }
});
