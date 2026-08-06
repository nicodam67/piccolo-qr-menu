import assert from "node:assert/strict";
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
