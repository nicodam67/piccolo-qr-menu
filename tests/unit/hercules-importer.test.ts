import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  applySnapshotToTestDatabase,
  UnsafeDatabaseTargetError,
  validateTestDatabaseUrl,
} from "../../src/features/hercules-import/database";
import { writeReports } from "../../src/features/hercules-import/reports";
import { analyzeHerculesSnapshot } from "../../src/features/hercules-import/service";
import { deterministicUuid, sha256File } from "../../src/features/hercules-import/utils";
import {
  baseTables,
  realShapeFixture,
  tinyMp4,
  tinyPng,
  writeSyntheticSnapshot,
} from "../fixtures/hercules/synthetic-snapshot";

async function fixture(
  t: test.TestContext,
  mutate?: (
    tables: ReturnType<typeof baseTables>,
  ) => { storageFiles?: Record<string, Buffer> } | void,
) {
  const directory = await mkdtemp(join(tmpdir(), "hercules-importer-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "synthetic-snapshot.zip");
  const tables = structuredClone(baseTables());
  const result = mutate?.(tables);
  await writeSyntheticSnapshot(path, {
    tables,
    storageFiles: result?.storageFiles,
  });
  return { directory, path, tables };
}

async function realFixture(t: test.TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "hercules-real-shape-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "synthetic-real-shape.zip");
  const source = realShapeFixture();
  await writeSyntheticSnapshot(path, source);
  return { directory, path, ...source };
}

function issueCodes(analysis: Awaited<ReturnType<typeof analyzeHerculesSnapshot>>) {
  return analysis.manifest.issues.map(({ code }) => code);
}

test("inspecciona un ZIP Convex mínimo y genera plan sin escribir", async (t) => {
  const { path } = await fixture(t);
  const analysis = await analyzeHerculesSnapshot(path);
  assert.equal(analysis.report.valid, true);
  assert.equal(analysis.manifest.tables.length, 5);
  assert.equal(analysis.manifest.assets[0]?.mimeType, "image/png");
  assert.equal(analysis.manifest.assets[0]?.byteSize, tinyPng.length);
  assert.match(analysis.manifest.assets[0]?.sha256 ?? "", /^[0-9a-f]{64}$/u);
  assert.equal(analysis.plan.items.some(({ action }) => action === "create"), true);
});

test("fusiona metadata y archivos con extensión en un único asset lógico", async (t) => {
  const { path } = await realFixture(t);
  const analysis = await analyzeHerculesSnapshot(path);
  assert.equal(analysis.manifest.totals.storageFiles, 5);
  assert.equal(analysis.manifest.assets.length, 5);
  assert.ok(analysis.manifest.assets.every(({ status }) => status === "ready"));
  assert.ok(
    analysis.manifest.assets.every(
      ({ physicalFilename, sourceInternalId }) =>
        Boolean(physicalFilename?.includes(".")) && Boolean(sourceInternalId),
    ),
  );
  assert.equal(issueCodes(analysis).includes("STORAGE_BINARY_MISSING"), false);
  assert.equal(issueCodes(analysis).includes("STORAGE_METADATA_MISSING"), false);
});

test("262 archivos físicos con extensión no generan 524 assets", async (t) => {
  const digest = createHash("sha256").update(tinyPng).digest("base64");
  const { path } = await fixture(t, (tables) => {
    tables.menuItems[0]!.imageStorageId = "storage-0";
    tables.branding[0]!.heroId = "storage-0";
    tables._storage = Array.from({ length: 262 }, (_, index) => ({
      _id: `storage-${index}`,
      internalId: `internal-${index}`,
      contentType: "image/png",
      size: tinyPng.length,
      sha256: digest,
    }));
    return {
      storageFiles: Object.fromEntries(
        Array.from({ length: 262 }, (_, index) => [
          `storage-${index}.png`,
          tinyPng,
        ]),
      ),
    };
  });
  const analysis = await analyzeHerculesSnapshot(path);
  assert.equal(analysis.manifest.totals.storageFiles, 262);
  assert.equal(analysis.manifest.assets.length, 262);
  assert.ok(analysis.manifest.assets.every(({ status }) => status === "ready"));
});

test("varias referencias al mismo storage ID no duplican el asset", async (t) => {
  const { path } = await fixture(t, (tables) => {
    tables.menuItems[0]!.gallery = ["storage-image-1"];
    tables.branding[0]!.heroId = "storage-image-1";
    return { storageFiles: { "storage-image-1.png": tinyPng } };
  });
  const analysis = await analyzeHerculesSnapshot(path);
  assert.equal(analysis.manifest.assets.length, 1);
  assert.equal(analysis.manifest.assets[0]?.references.length, 3);
  assert.deepEqual(analysis.manifest.assets[0]?.referencedBy, [
    "branding:branding-1",
    "product:product-1",
  ]);
});

test("normaliza la forma real sin pérdida silenciosa", async (t) => {
  const { path } = await realFixture(t);
  const analysis = await analyzeHerculesSnapshot(path);
  const branding = analysis.normalized.branding[0]!;
  const product = analysis.normalized.products[0]!;
  const category = analysis.normalized.categories[0]!;

  assert.equal(analysis.report.valid, true);
  assert.equal(analysis.plan.counters.reject, 0);
  assert.ok(issueCodes(analysis).includes("HOURS_SCHEDULE_REVIEW"));
  assert.equal(branding.translations[0]?.name, "Restaurante sanitizado");
  assert.equal(branding.translations[0]?.slogan, "Eslogan sintético");
  assert.deepEqual(branding.colors, {
    primaryColor: "#112233",
    secondaryColor: "#445566",
    backgroundColor: "#ffffff",
    textColor: "#222222",
  });
  assert.deepEqual(branding.fonts, {
    primaryFont: "Synthetic Sans",
    secondaryFont: "Synthetic Serif",
  });
  assert.equal(branding.openingHours.length, 7);
  assert.equal(branding.openingHours.filter(({ isClosed }) => isClosed).length, 2);
  assert.equal(branding.openingHours[0]?.crossesMidnight, true);
  assert.equal(product.fullPriceCents, 1250);
  assert.equal(product.halfPriceCents, 725);
  assert.equal(product.halfPortionAvailable, null);
  assert.equal(product.quantity, "250 g");
  assert.equal(product.isActive, false);
  assert.deepEqual(product.videoAssetExternalIds, ["real-product-video"]);
  assert.equal(category.isActive, true);
  assert.equal(tinyMp4.length > 12, true);

  const unsupportedRealFields = analysis.manifest.issues.filter(
    ({ code, path }) =>
      code === "UNKNOWN_DOCUMENT_FIELD" &&
      [
        "internalId",
        "cardSettings",
        "city",
        "establishedYear",
        "heroImageStorageId",
        "hours",
        "postalCode",
        "province",
        "restaurantName",
        "schedule",
        "tagline",
        "themeColors",
        "themeFonts",
        "available",
        "halfPortionPrice",
        "quantity",
        "videoStorageId",
      ].includes(path ?? ""),
  );
  assert.deepEqual(unsupportedRealFields, []);
  assert.equal(branding.sourceMetadata.cardSettings != null, true);
  assert.equal(product.sourceMetadata.quantity, "250 g");
});

test("preserva exactamente 31 precios reales de media ración", async (t) => {
  const { path } = await fixture(t, (tables) => {
    const template = tables.menuItems[0]!;
    tables.menuItems = Array.from({ length: 31 }, (_, index) => ({
      ...structuredClone(template),
      _id: `half-product-${index}`,
      halfPrice: undefined,
      hasHalfPortion: undefined,
      halfPortionPrice: Number((1 + index / 100).toFixed(2)),
      imageStorageId: "storage-image-1",
    }));
  });
  const analysis = await analyzeHerculesSnapshot(path);
  assert.equal(
    analysis.normalized.products.filter(
      ({ halfPriceCents }) => halfPriceCents !== null,
    ).length,
    31,
  );
  assert.deepEqual(
    analysis.normalized.products.map(({ halfPriceCents }) => halfPriceCents),
    Array.from({ length: 31 }, (_, index) => 100 + index),
  );
  assert.equal(
    analysis.manifest.issues.some(
      ({ code, path: issuePath }) =>
        code === "UNKNOWN_DOCUMENT_FIELD" &&
        issuePath === "halfPortionPrice",
    ),
    false,
  );
});

test("distingue traducciones ausentes, vacías, base e iguales", async (t) => {
  const { path } = await realFixture(t);
  const analysis = await analyzeHerculesSnapshot(path);
  assert.ok(issueCodes(analysis).includes("EMPTY_TRANSLATION"));
  assert.ok(issueCodes(analysis).includes("MISSING_TRANSLATION"));
  assert.equal(
    analysis.report.translationSummary.find(
      ({ table, locale }) => table === "branding" && locale === "es",
    )?.baseFallback,
    1,
  );
  assert.equal(
    analysis.report.translationSummary.find(
      ({ table, locale }) => table === "menuItems" && locale === "en",
    )?.empty,
    1,
  );
});

test("detecta JSONL inválido sin exponer su contenido", async (t) => {
  const { path } = await fixture(t, (tables) => {
    tables.categories.push("{not-json" as unknown as Record<string, unknown>);
  });
  const analysis = await analyzeHerculesSnapshot(path);
  assert.equal(analysis.report.valid, false);
  assert.ok(issueCodes(analysis).includes("JSONL_INVALID_DOCUMENT"));
});

test("inventa pero no importa una tabla desconocida", async (t) => {
  const { path } = await fixture(t, (tables) => {
    tables.extraTable = [{ _id: "extra-1", value: "synthetic" }];
  });
  const analysis = await analyzeHerculesSnapshot(path);
  assert.ok(issueCodes(analysis).includes("UNKNOWN_TABLE"));
  assert.equal(
    analysis.plan.items.find(
      ({ entityType, sourceExternalId }) =>
        entityType === "unknown_table" && sourceExternalId === "extraTable",
    )?.action,
    "skip",
  );
});

test("detecta IDs Convex duplicados", async (t) => {
  const { path } = await fixture(t, (tables) => {
    tables.categories.push(structuredClone(tables.categories[0]!));
  });
  const analysis = await analyzeHerculesSnapshot(path);
  assert.ok(issueCodes(analysis).includes("DUPLICATE_EXTERNAL_ID"));
  assert.equal(analysis.report.valid, false);
});

test("rechaza categoría con padre huérfano", async (t) => {
  const { path } = await fixture(t, (tables) => {
    tables.categories[0]!.parentCategoryId = "missing-category";
  });
  const analysis = await analyzeHerculesSnapshot(path);
  assert.ok(issueCodes(analysis).includes("ORPHAN_CATEGORY"));
  assert.equal(
    analysis.plan.items.find(
      ({ entityType }) => entityType === "category",
    )?.action,
    "reject",
  );
});

test("rechaza producto con categoría inexistente", async (t) => {
  const { path } = await fixture(t, (tables) => {
    tables.menuItems[0]!.categoryId = "missing-category";
  });
  const analysis = await analyzeHerculesSnapshot(path);
  assert.ok(issueCodes(analysis).includes("PRODUCT_CATEGORY_NOT_FOUND"));
});

test("rechaza precio con precisión no representable en céntimos", async (t) => {
  const { path } = await fixture(t, (tables) => {
    tables.menuItems[0]!.price = "1.001";
  });
  const analysis = await analyzeHerculesSnapshot(path);
  assert.ok(issueCodes(analysis).includes("INVALID_PRICE"));
});

test("rechaza media ración incoherente", async (t) => {
  const { path } = await fixture(t, (tables) => {
    tables.menuItems[0]!.hasHalfPortion = false;
  });
  const analysis = await analyzeHerculesSnapshot(path);
  assert.ok(issueCodes(analysis).includes("INVALID_HALF_PORTION"));
});

test("rechaza locale desconocido", async (t) => {
  const { path } = await fixture(t, (tables) => {
    tables.categories[0]!.translations = {
      xx: { name: "Unknown", description: "Synthetic" },
    };
  });
  const analysis = await analyzeHerculesSnapshot(path);
  assert.ok(issueCodes(analysis).includes("UNKNOWN_LOCALE"));
  assert.equal(analysis.report.valid, false);
});

test("advierte traducciones faltantes sin inventarlas", async (t) => {
  const { path } = await fixture(t);
  const analysis = await analyzeHerculesSnapshot(path);
  assert.ok(issueCodes(analysis).includes("MISSING_TRANSLATION"));
  assert.deepEqual(
    analysis.normalized.categories[0]?.translations.map(({ locale }) => locale),
    ["es"],
  );
});

test("detecta referencia a storage sin binario", async (t) => {
  const { path } = await fixture(t, () => ({ storageFiles: {} }));
  const analysis = await analyzeHerculesSnapshot(path);
  assert.ok(issueCodes(analysis).includes("STORAGE_BINARY_MISSING"));
  assert.equal(analysis.report.valid, false);
});

test("detecta asset huérfano", async (t) => {
  const { path } = await fixture(t, (tables) => {
    tables._storage.push({
      _id: "orphan-file",
      contentType: "image/png",
      size: tinyPng.length,
    });
    return {
      storageFiles: {
        "storage-image-1": tinyPng,
        "orphan-file": Buffer.from(tinyPng),
      },
    };
  });
  const analysis = await analyzeHerculesSnapshot(path);
  assert.equal(
    analysis.manifest.assets.find(({ storageId }) => storageId === "orphan-file")
      ?.orphan,
    true,
  );
});

test("propone deduplicación de assets por SHA-256", async (t) => {
  const { path } = await fixture(t, (tables) => {
    tables._storage.push({
      _id: "storage-image-2",
      contentType: "image/png",
      size: tinyPng.length,
    });
    tables.menuItems[0]!.gallery = ["storage-image-2"];
    return {
      storageFiles: {
        "storage-image-1": tinyPng,
        "storage-image-2": Buffer.from(tinyPng),
      },
    };
  });
  const analysis = await analyzeHerculesSnapshot(path);
  assert.ok(issueCodes(analysis).includes("ASSET_DUPLICATE_SHA256"));
  assert.equal(
    analysis.manifest.assets.find(
      ({ storageId }) => storageId === "storage-image-2",
    )?.duplicateOf,
    "storage-image-1",
  );
});

test("rechaza campos sensibles anidados en entidades importables", async (t) => {
  const { path } = await fixture(t, (tables) => {
    tables.menuItems[0]!.metadata = {
      auth: { refreshToken: "never-report-this" },
    };
  });
  const analysis = await analyzeHerculesSnapshot(path);
  assert.ok(issueCodes(analysis).includes("SENSITIVE_FIELD"));
  assert.equal(
    JSON.stringify(analysis.report).includes("never-report-this"),
    false,
  );
});

test("redacta campos sensibles de usuarios y no crea administradores", async (t) => {
  const { path } = await fixture(t, (tables) => {
    tables.users[0]!.metadata = {
      safe: "kept",
      passwordHash: "never-report-this",
    };
  });
  const analysis = await analyzeHerculesSnapshot(path);
  assert.deepEqual(analysis.report.userInventory[0]?.metadata, { safe: "kept" });
  assert.equal(
    analysis.plan.items.find(({ entityType }) => entityType === "user")?.action,
    "skip",
  );
});

test("rechaza checksum incorrecto antes de conectar o escribir", async (t) => {
  const { path } = await fixture(t);
  await assert.rejects(
    () =>
      applySnapshotToTestDatabase({
        inputPath: path,
        databaseUrl:
          "postgresql://unused:unused@127.0.0.1:1/piccolo_test_import",
        confirmDatabaseName: "piccolo_test_import",
        confirmSourceChecksum: "0".repeat(64),
        confirmBackupId: "synthetic-backup",
      }),
    UnsafeDatabaseTargetError,
  );
});

test("rechaza bases productivas y nombres que no sean de test", () => {
  assert.throws(
    () =>
      validateTestDatabaseUrl(
        "postgresql://example.test/piccolo_production",
      ),
    UnsafeDatabaseTargetError,
  );
  assert.throws(
    () => validateTestDatabaseUrl("postgresql://example.test/piccolo"),
    UnsafeDatabaseTargetError,
  );
  assert.equal(
    validateTestDatabaseUrl(
      "postgresql://example.test/piccolo_test_import",
    ).databaseName,
    "piccolo_test_import",
  );
});

test("los UUID propuestos y el plan son idempotentes", async (t) => {
  const { path } = await fixture(t);
  const first = await analyzeHerculesSnapshot(path);
  const second = await analyzeHerculesSnapshot(path);
  assert.deepEqual(first.plan, second.plan);
  assert.equal(
    deterministicUuid("product", "product-1"),
    deterministicUuid("product", "product-1"),
  );
});

test("mappings propuestos son únicos por tipo e ID externo", async (t) => {
  const { path } = await fixture(t);
  const analysis = await analyzeHerculesSnapshot(path);
  const mapped = analysis.plan.items.filter(
    ({ proposedInternalId }) => proposedInternalId,
  );
  const keys = mapped.map(
    ({ entityType, sourceExternalId }) => `${entityType}:${sourceExternalId}`,
  );
  assert.equal(new Set(keys).size, keys.length);
  const restaurant = mapped.find(
    ({ entityType }) => entityType === "restaurant",
  );
  const branding = mapped.find(({ entityType }) => entityType === "branding");
  assert.equal(branding?.proposedInternalId, restaurant?.proposedInternalId);
});

test("un mapping existente sin cambios produce skip", async (t) => {
  const { path } = await fixture(t);
  const initial = await analyzeHerculesSnapshot(path);
  const product = initial.plan.items.find(
    ({ entityType }) => entityType === "product",
  )!;
  const repeated = await analyzeHerculesSnapshot(path, [
    {
      entityType: "product",
      externalId: product.sourceExternalId,
      internalId: product.proposedInternalId!,
      payloadHash: product.payloadHash,
    },
  ]);
  assert.equal(
    repeated.plan.items.find(({ entityType }) => entityType === "product")
      ?.action,
    "skip",
  );
});

test("los cuatro informes son deterministas", async (t) => {
  const { directory, path } = await fixture(t);
  const analysis = await analyzeHerculesSnapshot(path);
  const first = join(directory, "first");
  const second = join(directory, "second");
  await writeReports(analysis, first);
  await writeReports(analysis, second);
  for (const filename of [
    "manifest.json",
    "import-plan.json",
    "validation-report.json",
    "REPORT.md",
  ]) {
    const firstContents = await readFile(join(first, filename), "utf8");
    assert.equal(
      firstContents,
      await readFile(join(second, filename), "utf8"),
    );
    if (filename.endsWith(".json")) {
      assert.doesNotThrow(() => JSON.parse(firstContents));
    }
  }
  assert.equal(await sha256File(path), analysis.manifest.source.checksum);
});
