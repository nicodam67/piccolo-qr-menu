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
import {
  realShapeFixture,
  writeSyntheticSnapshot,
} from "../fixtures/hercules/synthetic-snapshot";

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
    const [brandingMapping] = await sql<
      Array<{ brandingId: string; restaurantId: string }>
    >`
      select
        max(internal_id::text) filter (
          where entity_type = 'branding'
        ) as "brandingId",
        max(internal_id::text) filter (
          where entity_type = 'restaurant'
        ) as "restaurantId"
      from external_entity_mappings
      where external_id = 'branding-1'
    `;
    assert.equal(
      brandingMapping?.brandingId,
      brandingMapping?.restaurantId,
    );
    const [unresolved] = await sql<Array<{ count: number }>>`
      select count(*)::int as count
      from external_entity_mappings mapping
      where mapping.source = 'hercules_convex'
        and (
          (
            mapping.entity_type = 'restaurant'
            and not exists (
              select 1 from restaurant_settings
              where id = mapping.internal_id
            )
          )
          or (
            mapping.entity_type = 'branding'
            and not exists (
              select 1 from restaurant_branding
              where restaurant_id = mapping.internal_id
            )
          )
          or (
            mapping.entity_type = 'category'
            and not exists (
              select 1 from categories where id = mapping.internal_id
            )
          )
          or (
            mapping.entity_type = 'product'
            and not exists (
              select 1 from products where id = mapping.internal_id
            )
          )
          or (
            mapping.entity_type = 'tag'
            and not exists (
              select 1 from tags where id = mapping.internal_id
            )
          )
          or (
            mapping.entity_type = 'allergen'
            and not exists (
              select 1 from allergens where id = mapping.internal_id
            )
          )
          or (
            mapping.entity_type = 'asset'
            and not exists (
              select 1 from assets where id = mapping.internal_id
            )
          )
        )
    `;
    assert.equal(unresolved?.count, 0);
  } finally {
    await sql.end();
  }
});

test("apply sintético preserva la forma real compatible", async (t) => {
  const databaseUrl = testDatabaseUrl();
  const directory = await mkdtemp(join(tmpdir(), "hercules-real-shape-apply-"));
  const inputPath = join(directory, "synthetic-real-shape.zip");
  t.after(async () => {
    await truncateImporterTables(databaseUrl);
    await rm(directory, { recursive: true, force: true });
  });
  const source = realShapeFixture();
  await writeSyntheticSnapshot(inputPath, source);
  await truncateImporterTables(databaseUrl);
  const checksum = await sha256File(inputPath);

  const result = await applySnapshotToTestDatabase({
    inputPath,
    databaseUrl,
    confirmDatabaseName: "piccolo_test_import",
    confirmSourceChecksum: checksum,
    confirmBackupId: "synthetic-real-shape-backup",
  });
  assert.equal(result.analysis.plan.counters.reject, 0);

  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const [counts] = await sql<
      Array<{
        assets: number;
        hours: number;
        videos: number;
        closedDays: number;
      }>
    >`
      select
        (select count(*)::int from assets) as assets,
        (select count(*)::int from opening_hours) as hours,
        (
          select count(*)::int from product_assets where role = 'video'
        ) as videos,
        (
          select count(*)::int from opening_hours where is_closed
        ) as "closedDays"
    `;
    assert.deepEqual(counts, {
      assets: 5,
      hours: 7,
      videos: 1,
      closedDays: 2,
    });
    const [product] = await sql<
      Array<{
        fullPriceCents: number;
        halfPriceCents: number | null;
        isActive: boolean;
        quantity: string | null;
      }>
    >`
      select
        product.full_price_cents as "fullPriceCents",
        product.half_price_cents as "halfPriceCents",
        product.is_active as "isActive",
        mapping.metadata->>'quantity' as quantity
      from products product
      join external_entity_mappings mapping
        on mapping.source = 'hercules_convex'
       and mapping.entity_type = 'product'
       and mapping.internal_id = product.id
    `;
    assert.deepEqual(product, {
      fullPriceCents: 1250,
      halfPriceCents: 725,
      isActive: false,
      quantity: "250 g",
    });
    const [branding] = await sql<
      Array<{
        primaryColor: string | null;
        primaryFont: string | null;
        heroLinked: boolean;
      }>
    >`
      select
        primary_color as "primaryColor",
        primary_font as "primaryFont",
        hero_asset_id is not null as "heroLinked"
      from restaurant_branding
    `;
    assert.deepEqual(branding, {
      primaryColor: "#112233",
      primaryFont: "Synthetic Sans",
      heroLinked: true,
    });
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
