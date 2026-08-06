import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import postgres from "postgres";

import {
  applySnapshotToTestDatabase,
  validateSnapshotAgainstDatabase,
} from "../../src/features/hercules-import/database";
import { sha256File } from "../../src/features/hercules-import/utils";
import { writeSyntheticSnapshot } from "../fixtures/hercules/synthetic-snapshot";

function testDatabaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL es obligatoria.");
  const name = new URL(value).pathname.slice(1);
  if (name !== "piccolo_test_import") {
    throw new Error(
      `Este test apply exige piccolo_test_import; se recibió "${name}".`,
    );
  }
  return value;
}

async function truncateImporterTables(databaseUrl: string) {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
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
        assets,
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
  } finally {
    await sql.end();
  }
}

test("apply sintético es transaccional e idempotente en dos ejecuciones", async (t) => {
  const databaseUrl = testDatabaseUrl();
  const directory = await mkdtemp(join(tmpdir(), "hercules-apply-"));
  const inputPath = join(directory, "synthetic-snapshot.zip");
  t.after(async () => {
    await truncateImporterTables(databaseUrl);
    await rm(directory, { recursive: true, force: true });
  });
  await writeSyntheticSnapshot(inputPath);
  await truncateImporterTables(databaseUrl);
  const checksum = await sha256File(inputPath);

  const beforeValidation = postgres(databaseUrl, { max: 1 });
  const beforeRuns =
    await beforeValidation<Array<{ count: number }>>`select count(*)::int as count from import_runs`;
  await beforeValidation.end();
  const validation = await validateSnapshotAgainstDatabase(
    inputPath,
    databaseUrl,
  );
  assert.equal(validation.plan.counters.reject, 0);
  const afterValidation = postgres(databaseUrl, { max: 1 });
  const afterRuns =
    await afterValidation<Array<{ count: number }>>`select count(*)::int as count from import_runs`;
  await afterValidation.end();
  assert.equal(afterRuns[0]?.count, beforeRuns[0]?.count);

  const first = await applySnapshotToTestDatabase({
    inputPath,
    databaseUrl,
    confirmDatabaseName: "piccolo_test_import",
    confirmSourceChecksum: checksum,
    confirmBackupId: "synthetic-pre-apply-backup",
  });
  const second = await applySnapshotToTestDatabase({
    inputPath,
    databaseUrl,
    confirmDatabaseName: "piccolo_test_import",
    confirmSourceChecksum: checksum,
    confirmBackupId: "synthetic-pre-apply-backup",
  });

  assert.notEqual(first.runId, second.runId);
  assert.equal(second.analysis.plan.counters.create, 0);
  assert.equal(second.analysis.plan.counters.update, 0);
  assert.ok(second.analysis.plan.counters.skip > 0);

  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const [counts] = await sql<
      Array<{
        categories: number;
        products: number;
        assets: number;
        mappings: number;
        distinctMappings: number;
        users: number;
        runs: number;
      }>
    >`
      select
        (select count(*)::int from categories) as categories,
        (select count(*)::int from products) as products,
        (select count(*)::int from assets) as assets,
        (select count(*)::int from external_entity_mappings) as mappings,
        (
          select count(distinct (source, entity_type, external_id))::int
          from external_entity_mappings
        ) as "distinctMappings",
        (select count(*)::int from admins) as users,
        (select count(*)::int from import_runs) as runs
    `;
    assert.deepEqual(counts, {
      categories: 1,
      products: 1,
      assets: 1,
      mappings: 7,
      distinctMappings: 7,
      users: 0,
      runs: 2,
    });
    const duplicateMappings = await sql<Array<{ count: number }>>`
      select count(*)::int as count
      from (
        select source, entity_type, external_id
        from external_entity_mappings
        group by source, entity_type, external_id
        having count(*) > 1
      ) duplicated
    `;
    assert.equal(duplicateMappings[0]?.count, 0);
  } finally {
    await sql.end();
  }
});

test("un fallo durante apply revierte todos los datos de dominio", async (t) => {
  const databaseUrl = testDatabaseUrl();
  const directory = await mkdtemp(join(tmpdir(), "hercules-rollback-"));
  const inputPath = join(directory, "synthetic-snapshot.zip");
  const admin = postgres(databaseUrl, { max: 1 });
  t.after(async () => {
    await admin`drop trigger if exists hercules_test_fail_category on categories`;
    await admin`drop function if exists hercules_test_fail_category()`;
    await admin.end();
    await truncateImporterTables(databaseUrl);
    await rm(directory, { recursive: true, force: true });
  });
  await writeSyntheticSnapshot(inputPath);
  await truncateImporterTables(databaseUrl);
  await admin`
    create function hercules_test_fail_category()
    returns trigger
    language plpgsql
    as $$
    begin
      raise exception 'synthetic apply failure';
    end
    $$
  `;
  await admin`
    create trigger hercules_test_fail_category
    before insert on categories
    for each row execute function hercules_test_fail_category()
  `;
  const checksum = await sha256File(inputPath);

  await assert.rejects(() =>
    applySnapshotToTestDatabase({
      inputPath,
      databaseUrl,
      confirmDatabaseName: "piccolo_test_import",
      confirmSourceChecksum: checksum,
      confirmBackupId: "synthetic-pre-rollback-backup",
    }),
  );

  const [counts] = await admin<
    Array<{
      locales: number;
      restaurants: number;
      assets: number;
      categories: number;
      mappings: number;
      failedRuns: number;
    }>
  >`
    select
      (select count(*)::int from locales) as locales,
      (select count(*)::int from restaurant_settings) as restaurants,
      (select count(*)::int from assets) as assets,
      (select count(*)::int from categories) as categories,
      (select count(*)::int from external_entity_mappings) as mappings,
      (
        select count(*)::int from import_runs where status = 'failed'
      ) as "failedRuns"
  `;
  assert.deepEqual(counts, {
    locales: 0,
    restaurants: 0,
    assets: 0,
    categories: 0,
    mappings: 0,
    failedRuns: 1,
  });
});
