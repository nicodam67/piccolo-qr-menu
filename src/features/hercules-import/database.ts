import { basename } from "node:path";

import postgres, { type Sql, type TransactionSql } from "postgres";

import { buildImportPlan } from "./planner";
import { buildValidationReport } from "./reports";
import { analyzeHerculesSnapshot } from "./service";
import type {
  ExistingMapping,
  ImportAnalysis,
  ImportPlanItem,
  NormalizedBranding,
  NormalizedCategory,
  NormalizedProduct,
} from "./types";
import { SUPPORTED_LOCALES } from "./types";
import { canonicalJson, deterministicUuid, sha256, sha256File } from "./utils";

const localeLabels = {
  es: ["Español", "Español"],
  ca: ["Catalán", "Català"],
  en: ["Inglés", "English"],
  ro: ["Rumano", "Română"],
  fr: ["Francés", "Français"],
  de: ["Alemán", "Deutsch"],
  nl: ["Neerlandés", "Nederlands"],
  it: ["Italiano", "Italiano"],
} as const;

export class UnsafeDatabaseTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeDatabaseTargetError";
  }
}

export type DatabaseTarget = {
  url: string;
  databaseName: string;
};

export function validateTestDatabaseUrl(databaseUrl: string): DatabaseTarget {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new UnsafeDatabaseTargetError("DATABASE_URL no es una URL válida.");
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new UnsafeDatabaseTargetError("Solo se admite PostgreSQL.");
  }
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//u, ""));
  if (
    !databaseName ||
    /(^|[_-])(prod|production|live|real)([_-]|$)/iu.test(databaseName)
  ) {
    throw new UnsafeDatabaseTargetError(
      "Se rechazó una base con nombre de producción o ambiguo.",
    );
  }
  if (!databaseName.startsWith("piccolo_test_")) {
    throw new UnsafeDatabaseTargetError(
      `La base debe llamarse piccolo_test_*; se recibió "${databaseName}".`,
    );
  }
  return { url: databaseUrl, databaseName };
}

async function loadExistingState(sql: Sql): Promise<ExistingMapping[]> {
  const mappings = await sql<ExistingMapping[]>`
    select
      entity_type as "entityType",
      external_id as "externalId",
      internal_id::text as "internalId",
      payload_hash as "payloadHash"
    from external_entity_mappings
    where source = 'hercules_convex'
  `;
  const localeRows = await sql<Array<{ code: string; id: string }>>`
    select code, id::text as id from locales
  `;
  return [
    ...mappings,
    ...localeRows.map(({ code, id }) => ({
      entityType: "locale",
      externalId: code,
      internalId: id,
      payloadHash: sha256(canonicalJson({ locale: code })),
    })),
  ];
}

function replan(
  analysis: ImportAnalysis,
  existingMappings: ExistingMapping[],
): ImportAnalysis {
  const plan = buildImportPlan(
    analysis.manifest,
    analysis.normalized,
    existingMappings,
  );
  return {
    ...analysis,
    plan,
    report: buildValidationReport(analysis.manifest, plan, analysis),
  };
}

export async function validateSnapshotAgainstDatabase(
  inputPath: string,
  databaseUrl: string,
): Promise<ImportAnalysis> {
  const target = validateTestDatabaseUrl(databaseUrl);
  const sql = postgres(target.url, { max: 1, connect_timeout: 10 });
  try {
    const [analysis, existing] = await Promise.all([
      analyzeHerculesSnapshot(inputPath),
      loadExistingState(sql),
    ]);
    return replan(analysis, existing);
  } finally {
    await sql.end();
  }
}

export async function recordDryRun(
  analysis: ImportAnalysis,
  databaseUrl: string,
): Promise<string> {
  const target = validateTestDatabaseUrl(databaseUrl);
  const sql = postgres(target.url, { max: 1, connect_timeout: 10 });
  try {
    const [run] = await sql<Array<{ id: string }>>`
      insert into import_runs (
        source, kind, status, started_at, completed_at, source_checksum,
        source_filename, counters, warnings, errors
      ) values (
        'hercules_convex', 'dry_run', 'succeeded', now(), now(),
        ${analysis.manifest.source.checksum}, ${analysis.manifest.source.filename},
        ${sql.json(analysis.plan.counters)},
        ${sql.json(analysis.report.warnings)},
        ${sql.json(analysis.report.errors)}
      )
      returning id::text as id
    `;
    return run!.id;
  } finally {
    await sql.end();
  }
}

type ApplyOptions = {
  inputPath: string;
  databaseUrl: string;
  confirmDatabaseName: string;
  confirmSourceChecksum: string;
  confirmBackupId: string;
};

function planItem(
  analysis: ImportAnalysis,
  entityType: ImportPlanItem["entityType"],
  externalId: string,
) {
  const item = analysis.plan.items.find(
    (candidate) =>
      candidate.entityType === entityType &&
      candidate.sourceExternalId === externalId,
  );
  if (!item) {
    throw new Error(`No existe plan para ${entityType}:${externalId}.`);
  }
  return item;
}

async function upsertMapping(
  tx: TransactionSql,
  item: ImportPlanItem,
  runId: string,
  sourceCreatedAt: string | null,
  externalParentId: string | null = null,
  metadata: Record<string, unknown> = {},
) {
  if (!item.proposedInternalId || !item.payloadHash) return;
  const [existing] = await tx<Array<{ internalId: string }>>`
    select internal_id::text as "internalId"
    from external_entity_mappings
    where source = 'hercules_convex'
      and entity_type = ${item.entityType}
      and external_id = ${item.sourceExternalId}
    for update
  `;
  if (existing && existing.internalId !== item.proposedInternalId) {
    throw new Error(
      `Mapping conflictivo para ${item.entityType}:${item.sourceExternalId}.`,
    );
  }
  await tx`
    insert into external_entity_mappings (
      source, entity_type, external_id, internal_id, external_parent_id,
      source_created_at, payload_hash, last_seen_import_run_id, metadata
    ) values (
      'hercules_convex', ${item.entityType}, ${item.sourceExternalId},
      ${item.proposedInternalId}::uuid, ${externalParentId},
      ${sourceCreatedAt ? new Date(sourceCreatedAt) : null}, ${item.payloadHash},
      ${runId}::uuid, ${tx.json({ importer: "hercules-delivery-4", ...metadata })}
    )
    on conflict (source, entity_type, external_id) do update set
      external_parent_id = excluded.external_parent_id,
      source_created_at = excluded.source_created_at,
      payload_hash = excluded.payload_hash,
      last_seen_import_run_id = excluded.last_seen_import_run_id,
      metadata = excluded.metadata,
      updated_at = now()
  `;
}

async function applyLocales(tx: TransactionSql) {
  for (const [index, locale] of SUPPORTED_LOCALES.entries()) {
    const [name, nativeName] = localeLabels[locale];
    await tx`
      insert into locales (id, code, name, native_name, is_enabled, sort_order)
      values (
        ${deterministicUuid("locale", locale)}::uuid, ${locale}, ${name},
        ${nativeName}, true, ${index}
      )
      on conflict (code) do update set
        name = excluded.name,
        native_name = excluded.native_name,
        is_enabled = true,
        sort_order = excluded.sort_order,
        updated_at = now()
    `;
  }
}

async function applyBranding(
  tx: TransactionSql,
  analysis: ImportAnalysis,
  branding: NormalizedBranding,
  runId: string,
) {
  const restaurantItem = planItem(
    analysis,
    "restaurant",
    branding.externalId,
  );
  const brandingItem = planItem(analysis, "branding", branding.externalId);
  if (restaurantItem.action === "reject" || brandingItem.action === "reject") {
    return;
  }
  const mappingMetadata = {
    ...branding.sourceMetadata,
    openingHours: branding.openingHours,
  };
  if (restaurantItem.action === "skip" && brandingItem.action === "skip") {
    await upsertMapping(
      tx,
      restaurantItem,
      runId,
      branding.sourceCreatedAt,
      null,
      mappingMetadata,
    );
    await upsertMapping(
      tx,
      brandingItem,
      runId,
      branding.sourceCreatedAt,
      null,
      mappingMetadata,
    );
    return;
  }
  const restaurantId = restaurantItem.proposedInternalId!;
  await tx`
    insert into restaurant_settings (
      id, phone, address, timezone, currency_code, default_locale, hero_image_url
    ) values (
      ${restaurantId}::uuid, ${branding.phone}, ${branding.address},
      ${branding.timezone}, ${branding.currencyCode}, ${branding.defaultLocale},
      ${branding.heroImageUrl}
    )
    on conflict (id) do update set
      phone = excluded.phone,
      address = excluded.address,
      timezone = excluded.timezone,
      currency_code = excluded.currency_code,
      default_locale = excluded.default_locale,
      hero_image_url = excluded.hero_image_url,
      updated_at = now()
  `;
  for (const translation of branding.translations) {
    await tx`
      insert into restaurant_translations (
        restaurant_id, locale, name, slogan, description
      ) values (
        ${restaurantId}::uuid, ${translation.locale}, ${translation.name},
        ${translation.slogan ?? ""},
        ${translation.description}
      )
      on conflict (restaurant_id, locale) do update set
        name = excluded.name,
        slogan = excluded.slogan,
        description = excluded.description
    `;
  }
  const logoAssetId = canonicalAssetId(
    analysis,
    branding.assetExternalIds.logo,
  );
  const heroAssetId = canonicalAssetId(
    analysis,
    branding.assetExternalIds.hero,
  );
  const iconAssetId = canonicalAssetId(
    analysis,
    branding.assetExternalIds.icon,
  );
  await tx`
    insert into restaurant_branding (
      restaurant_id, logo_asset_id, hero_asset_id, icon_asset_id,
      primary_color, secondary_color, background_color, text_color,
      primary_font, secondary_font, is_active
    ) values (
      ${restaurantId}::uuid, ${logoAssetId}::uuid, ${heroAssetId}::uuid,
      ${iconAssetId}::uuid, ${branding.colors.primaryColor},
      ${branding.colors.secondaryColor}, ${branding.colors.backgroundColor},
      ${branding.colors.textColor}, ${branding.fonts.primaryFont},
      ${branding.fonts.secondaryFont}, true
    )
    on conflict (restaurant_id) do update set
      logo_asset_id = excluded.logo_asset_id,
      hero_asset_id = excluded.hero_asset_id,
      icon_asset_id = excluded.icon_asset_id,
      primary_color = excluded.primary_color,
      secondary_color = excluded.secondary_color,
      background_color = excluded.background_color,
      text_color = excluded.text_color,
      primary_font = excluded.primary_font,
      secondary_font = excluded.secondary_font,
      updated_at = now()
  `;
  await tx`delete from restaurant_links where restaurant_id = ${restaurantId}::uuid`;
  for (const link of branding.links) {
    await tx`
      insert into restaurant_links (
        restaurant_id, kind, label, url, sort_order, is_active
      ) values (
        ${restaurantId}::uuid, ${link.kind}, ${link.label}, ${link.url},
        ${link.sortOrder}, true
      )
    `;
  }
  if (branding.openingHours.length > 0) {
    await tx`delete from opening_hours where restaurant_id = ${restaurantId}::uuid`;
    for (const hours of branding.openingHours) {
      await tx`
        insert into opening_hours (
          id, restaurant_id, day_of_week, is_closed,
          first_opens_at, first_closes_at, second_opens_at, second_closes_at
        ) values (
          ${deterministicUuid("opening_hour", `${branding.externalId}:${hours.dayOfWeek}`)}::uuid,
          ${restaurantId}::uuid, ${hours.dayOfWeek}, ${hours.isClosed},
          ${hours.firstOpensAt}, ${hours.firstClosesAt}, ${hours.secondOpensAt},
          ${hours.secondClosesAt}
        )
        on conflict (restaurant_id, day_of_week) do update set
          is_closed = excluded.is_closed,
          first_opens_at = excluded.first_opens_at,
          first_closes_at = excluded.first_closes_at,
          second_opens_at = excluded.second_opens_at,
          second_closes_at = excluded.second_closes_at
      `;
    }
  }
  await upsertMapping(
    tx,
    restaurantItem,
    runId,
    branding.sourceCreatedAt,
    null,
    mappingMetadata,
  );
  await upsertMapping(
    tx,
    brandingItem,
    runId,
    branding.sourceCreatedAt,
    null,
    mappingMetadata,
  );
}

async function applyCategory(
  tx: TransactionSql,
  analysis: ImportAnalysis,
  category: NormalizedCategory,
  runId: string,
) {
  const item = planItem(analysis, "category", category.externalId);
  if (item.action === "reject") return;
  if (item.action === "skip") {
    await upsertMapping(
      tx,
      item,
      runId,
      category.sourceCreatedAt,
      null,
      category.sourceMetadata,
    );
    return;
  }
  await tx`
    insert into categories (
      id, sort_order, is_active, catalog_source, managed_by, sync_status
    ) values (
      ${item.proposedInternalId}::uuid, ${category.sortOrder},
      ${category.isActive}, 'hercules_convex', 'imported', 'not_synced'
    )
    on conflict (id) do update set
      sort_order = excluded.sort_order,
      is_active = excluded.is_active,
      updated_at = now()
  `;
  for (const translation of category.translations) {
    await tx`
      insert into category_translations (
        category_id, locale, name, description
      ) values (
        ${item.proposedInternalId}::uuid, ${translation.locale},
        ${translation.name}, ${translation.description}
      )
      on conflict (category_id, locale) do update set
        name = excluded.name,
        description = excluded.description
    `;
  }
  await upsertMapping(
    tx,
    item,
    runId,
    category.sourceCreatedAt,
    null,
    category.sourceMetadata,
  );
}

async function applyTerms(
  tx: TransactionSql,
  analysis: ImportAnalysis,
  runId: string,
  entityType: "tag" | "allergen",
  values: string[],
) {
  for (const value of values) {
    const item = planItem(analysis, entityType, value);
    if (item.action === "reject") continue;
    if (item.action === "skip") {
      await upsertMapping(tx, item, runId, null);
      continue;
    }
    if (entityType === "tag") {
      await tx`
        insert into tags (id, color)
        values (${item.proposedInternalId}::uuid, '#6b7280')
        on conflict (id) do nothing
      `;
      await tx`
        insert into tag_translations (tag_id, locale, name)
        values (${item.proposedInternalId}::uuid, 'es', ${value})
        on conflict (tag_id, locale) do update set name = excluded.name
      `;
    } else {
      await tx`
        insert into allergens (id, code, icon)
        values (
          ${item.proposedInternalId}::uuid,
          ${`hercules-${sha256(value).slice(0, 16)}`},
          'circle-alert'
        )
        on conflict (id) do nothing
      `;
      await tx`
        insert into allergen_translations (allergen_id, locale, name)
        values (${item.proposedInternalId}::uuid, 'es', ${value})
        on conflict (allergen_id, locale) do update set name = excluded.name
      `;
    }
    await upsertMapping(tx, item, runId, null);
  }
}

async function applyAssets(
  tx: TransactionSql,
  analysis: ImportAnalysis,
  runId: string,
) {
  for (const asset of analysis.manifest.assets) {
    const item = planItem(analysis, "asset", asset.storageId);
    if (!["create", "update"].includes(item.action)) continue;
    const kind = asset.mimeType.startsWith("image/")
      ? "image"
      : asset.mimeType.startsWith("video/")
        ? "video"
        : "document";
    await tx`
      insert into assets (
        id, kind, storage_provider, storage_key, original_filename, mime_type,
        byte_size, sha256, width, height, duration_ms, status,
        external_source, external_id
      ) values (
        ${item.proposedInternalId}::uuid, ${kind}, 'hercules_pending',
        ${asset.proposedStorageKey}, ${asset.originalFilename ?? asset.storageId},
        ${asset.mimeType}, ${asset.byteSize}, ${asset.sha256}, ${asset.width},
        ${asset.height}, ${asset.durationMs}, 'pending', 'hercules_convex',
        ${asset.storageId}
      )
      on conflict (id) do update set
        storage_key = excluded.storage_key,
        original_filename = excluded.original_filename,
        mime_type = excluded.mime_type,
        byte_size = excluded.byte_size,
        sha256 = excluded.sha256,
        width = excluded.width,
        height = excluded.height,
        duration_ms = excluded.duration_ms,
        updated_at = now()
    `;
    await upsertMapping(tx, item, runId, null, null, {
      sourceInternalId: asset.sourceInternalId,
      physicalFilename: asset.physicalFilename,
      references: asset.references,
    });
  }
}

function canonicalAssetId(analysis: ImportAnalysis, storageId: string | null) {
  if (!storageId) return null;
  const asset = analysis.manifest.assets.find(
    (candidate) => candidate.storageId === storageId,
  );
  if (!asset || asset.status !== "ready" || asset.orphan) return null;
  const canonicalId = asset.duplicateOf ?? storageId;
  return planItem(analysis, "asset", canonicalId).proposedInternalId;
}

async function applyProduct(
  tx: TransactionSql,
  analysis: ImportAnalysis,
  product: NormalizedProduct,
  runId: string,
) {
  const item = planItem(analysis, "product", product.externalId);
  const category = planItem(
    analysis,
    "category",
    product.categoryExternalId,
  );
  if (item.action === "reject" || category.action === "reject") return;
  if (item.action === "skip") {
    await upsertMapping(
      tx,
      item,
      runId,
      product.sourceCreatedAt,
      product.categoryExternalId,
      product.sourceMetadata,
    );
    return;
  }
  const primaryAssetId = canonicalAssetId(
    analysis,
    product.primaryAssetExternalId,
  );
  const imageUrl = product.primaryAssetExternalId
    ? `hercules-pending://storage/${product.primaryAssetExternalId}`
    : "hercules-pending://no-image";
  await tx`
    insert into products (
      id, category_id, full_price_cents, half_price_cents, is_active,
      is_sold_out, sort_order, image_url, primary_image_asset_id,
      catalog_source, managed_by, sync_status
    ) values (
      ${item.proposedInternalId}::uuid, ${category.proposedInternalId}::uuid,
      ${product.fullPriceCents}, ${product.halfPriceCents}, ${product.isActive},
      ${product.isSoldOut}, ${product.sortOrder}, ${imageUrl},
      ${primaryAssetId}::uuid, 'hercules_convex', 'imported', 'not_synced'
    )
    on conflict (id) do update set
      category_id = excluded.category_id,
      full_price_cents = excluded.full_price_cents,
      half_price_cents = excluded.half_price_cents,
      is_active = excluded.is_active,
      is_sold_out = excluded.is_sold_out,
      sort_order = excluded.sort_order,
      image_url = excluded.image_url,
      primary_image_asset_id = excluded.primary_image_asset_id,
      updated_at = now()
  `;
  for (const translation of product.translations) {
    await tx`
      insert into product_translations (
        product_id, locale, name, description
      ) values (
        ${item.proposedInternalId}::uuid, ${translation.locale},
        ${translation.name}, ${translation.description}
      )
      on conflict (product_id, locale) do update set
        name = excluded.name,
        description = excluded.description
    `;
  }
  await tx`delete from product_tags where product_id = ${item.proposedInternalId}::uuid`;
  for (const tag of product.tags) {
    const tagItem = planItem(analysis, "tag", tag);
    await tx`
      insert into product_tags (product_id, tag_id)
      values (${item.proposedInternalId}::uuid, ${tagItem.proposedInternalId}::uuid)
      on conflict do nothing
    `;
  }
  await tx`delete from product_allergens where product_id = ${item.proposedInternalId}::uuid`;
  for (const allergen of product.allergens) {
    const allergenItem = planItem(analysis, "allergen", allergen);
    await tx`
      insert into product_allergens (product_id, allergen_id)
      values (
        ${item.proposedInternalId}::uuid,
        ${allergenItem.proposedInternalId}::uuid
      )
      on conflict do nothing
    `;
  }
  await tx`delete from product_assets where product_id = ${item.proposedInternalId}::uuid`;
  for (const [role, ids] of [
    ["gallery", product.galleryAssetExternalIds],
    ["video", product.videoAssetExternalIds],
  ] as const) {
    for (const [sortOrder, storageId] of ids.entries()) {
      const assetId = canonicalAssetId(analysis, storageId);
      if (!assetId) continue;
      await tx`
        insert into product_assets (product_id, asset_id, role, sort_order)
        values (
          ${item.proposedInternalId}::uuid, ${assetId}::uuid, ${role},
          ${sortOrder}
        )
        on conflict do nothing
      `;
    }
  }
  await upsertMapping(
    tx,
    item,
    runId,
    product.sourceCreatedAt,
    product.categoryExternalId,
    product.sourceMetadata,
  );
}

export async function applySnapshotToTestDatabase(options: ApplyOptions) {
  const target = validateTestDatabaseUrl(options.databaseUrl);
  if (
    !options.confirmDatabaseName ||
    options.confirmDatabaseName !== target.databaseName
  ) {
    throw new UnsafeDatabaseTargetError(
      "La confirmación del nombre de base no coincide.",
    );
  }
  if (!options.confirmBackupId.trim()) {
    throw new UnsafeDatabaseTargetError(
      "Debe identificarse el backup previo con --confirm-backup-id.",
    );
  }
  const sql = postgres(target.url, { max: 1, connect_timeout: 10 });
  let runId: string | null = null;
  try {
    const initial = await analyzeHerculesSnapshot(options.inputPath);
    if (initial.manifest.source.checksum !== options.confirmSourceChecksum) {
      throw new UnsafeDatabaseTargetError(
        "El checksum confirmado no coincide con el ZIP.",
      );
    }
    const existing = await loadExistingState(sql);
    const analysis = replan(initial, existing);
    if (!analysis.report.valid || analysis.plan.counters.reject > 0) {
      throw new UnsafeDatabaseTargetError(
        "El plan contiene errores o rechazos; apply bloqueado.",
      );
    }
    if ((await sha256File(options.inputPath)) !== options.confirmSourceChecksum) {
      throw new UnsafeDatabaseTargetError(
        "El ZIP cambió después del análisis; apply bloqueado.",
      );
    }
    const [run] = await sql<Array<{ id: string }>>`
      insert into import_runs (
        source, kind, status, source_checksum, source_filename, counters,
        warnings, errors
      ) values (
        'hercules_convex', 'full_import', 'running',
        ${analysis.manifest.source.checksum}, ${basename(options.inputPath)},
        ${sql.json({ ...analysis.plan.counters, backupId: options.confirmBackupId })},
        ${sql.json(analysis.report.warnings)}, '[]'::jsonb
      )
      returning id::text as id
    `;
    runId = run!.id;
    await sql.begin(async (tx) => {
      await applyLocales(tx);
      await applyAssets(tx, analysis, runId!);
      for (const branding of analysis.normalized.branding) {
        await applyBranding(tx, analysis, branding, runId!);
      }
      for (const category of analysis.normalized.categories) {
        await applyCategory(tx, analysis, category, runId!);
      }
      await applyTerms(
        tx,
        analysis,
        runId!,
        "tag",
        [...new Set(analysis.normalized.products.flatMap(({ tags }) => tags))].sort(),
      );
      await applyTerms(
        tx,
        analysis,
        runId!,
        "allergen",
        [
          ...new Set(
            analysis.normalized.products.flatMap(({ allergens }) => allergens),
          ),
        ].sort(),
      );
      for (const product of analysis.normalized.products) {
        await applyProduct(tx, analysis, product, runId!);
      }
    });
    analysis.plan.dryRun = false;
    await sql`
      update import_runs
      set status = 'succeeded', completed_at = now(), updated_at = now()
      where id = ${runId}::uuid
    `;
    return { runId, databaseName: target.databaseName, analysis };
  } catch (error) {
    if (runId) {
      await sql`
        update import_runs
        set status = 'failed', completed_at = now(),
            errors = ${sql.json([{ code: "APPLY_FAILED", message: "Apply transaccional fallido." }])},
            updated_at = now()
        where id = ${runId}::uuid
      `;
    }
    throw error;
  } finally {
    await sql.end();
  }
}
