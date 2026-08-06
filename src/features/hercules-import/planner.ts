import type {
  ExistingMapping,
  ImportAction,
  ImportPlan,
  ImportPlanItem,
  NormalizedSnapshot,
  SnapshotManifest,
  ValidationIssue,
} from "./types";
import { SUPPORTED_LOCALES } from "./types";
import { canonicalJson, deterministicUuid, sha256 } from "./utils";

function mappingKey(entityType: string, externalId: string): string {
  return `${entityType}:${externalId}`;
}

function decideAction(
  entityType: string,
  externalId: string,
  payloadHash: string | null,
  existing: Map<string, ExistingMapping>,
): { action: ImportAction; reason: string; internalId: string } {
  const mapped = existing.get(mappingKey(entityType, externalId));
  if (!mapped) {
    return {
      action: "create",
      reason: "No existe mapping previo.",
      internalId: deterministicUuid(entityType, externalId),
    };
  }
  if (payloadHash && mapped.payloadHash === payloadHash) {
    return {
      action: "skip",
      reason: "Mapping y payload hash sin cambios.",
      internalId: mapped.internalId,
    };
  }
  return {
    action: "update",
    reason: "Mapping existente con payload modificado.",
    internalId: mapped.internalId,
  };
}

function issuesFor(
  issues: ValidationIssue[],
  table: string,
  externalId: string,
) {
  return issues.filter(
    (issue) =>
      issue.table === table &&
      (issue.externalId === externalId || !issue.externalId),
  );
}

export function buildImportPlan(
  manifest: SnapshotManifest,
  normalized: NormalizedSnapshot,
  existingMappings: ExistingMapping[] = [],
): ImportPlan {
  const existing = new Map(
    existingMappings.map((mapping) => [
      mappingKey(mapping.entityType, mapping.externalId),
      mapping,
    ]),
  );
  const items: ImportPlanItem[] = [];
  const allIssues = manifest.issues;
  const addMapped = (
    entityType: ImportPlanItem["entityType"],
    externalId: string,
    payloadHash: string | null,
    table: string,
    dependencies: string[],
    importOrder: number,
    forcedInternalId?: string,
  ) => {
    const relevant = issuesFor(allIssues, table, externalId);
    const errors = relevant.filter(({ severity }) => severity === "error");
    const warnings = relevant
      .filter(({ severity }) => severity === "warning")
      .map(({ code }) => code);
    const mapped = existing.get(mappingKey(entityType, externalId));
    const forcedConflict = Boolean(
      forcedInternalId && mapped && mapped.internalId !== forcedInternalId,
    );
    const decision =
      forcedInternalId && !mapped
        ? {
            action: "create" as const,
            reason: "No existe mapping previo.",
            internalId: forcedInternalId,
          }
        : decideAction(entityType, externalId, payloadHash, existing);
    const item: ImportPlanItem = {
      entityType,
      sourceExternalId: externalId,
      proposedInternalId: decision.internalId,
      action: errors.length > 0 || forcedConflict ? "reject" : decision.action,
      reason:
        errors.length > 0
          ? `Errores bloqueantes: ${errors.map(({ code }) => code).join(", ")}.`
          : forcedConflict
            ? "El mapping branding no coincide con el UUID del restaurante."
          : decision.reason,
      warnings,
      dependencies,
      importOrder,
      payloadHash,
    };
    items.push(item);
    return item;
  };

  for (const locale of SUPPORTED_LOCALES) {
    const hash = sha256(canonicalJson({ locale }));
    const decision = decideAction("locale", locale, hash, existing);
    items.push({
      entityType: "locale",
      sourceExternalId: locale,
      proposedInternalId: decision.internalId,
      action: decision.action,
      reason: decision.reason,
      warnings: [],
      dependencies: [],
      importOrder: 10,
      payloadHash: hash,
    });
  }
  normalized.branding.forEach((branding) => {
    const restaurantItem = addMapped(
      "restaurant",
      branding.externalId,
      branding.payloadHash,
      "branding",
      [`locale:${branding.defaultLocale}`],
      20,
    );
    addMapped(
      "branding",
      branding.externalId,
      branding.payloadHash,
      "branding",
      [`restaurant:${branding.externalId}`],
      30,
      restaurantItem.proposedInternalId ?? undefined,
    );
  });
  normalized.categories.forEach((category) =>
    addMapped(
      "category",
      category.externalId,
      category.payloadHash,
      "categories",
      category.translations.map(({ locale }) => `locale:${locale}`),
      40,
    ),
  );

  const tags = [
    ...new Set(normalized.products.flatMap((product) => product.tags)),
  ].sort();
  tags.forEach((tag) =>
    addMapped("tag", tag, sha256(canonicalJson({ tag })), "menuItems", [], 50),
  );
  const allergens = [
    ...new Set(normalized.products.flatMap((product) => product.allergens)),
  ].sort();
  allergens.forEach((allergen) =>
    addMapped(
      "allergen",
      allergen,
      sha256(canonicalJson({ allergen })),
      "menuItems",
      [],
      50,
    ),
  );
  normalized.products.forEach((product) =>
    addMapped(
      "product",
      product.externalId,
      product.payloadHash,
      "menuItems",
      [
        `category:${product.categoryExternalId}`,
        ...product.tags.map((tag) => `tag:${tag}`),
        ...product.allergens.map((allergen) => `allergen:${allergen}`),
      ],
      60,
    ),
  );
  manifest.assets.forEach((asset) => {
    const relevant = issuesFor(allIssues, "_storage", asset.storageId);
    const errors = relevant.filter(({ severity }) => severity === "error");
    const decision = decideAction(
      "asset",
      asset.storageId,
      asset.sha256 || null,
      existing,
    );
    const skipReason = asset.duplicateOf
      ? `Deduplicación propuesta por SHA-256 con "${asset.duplicateOf}".`
      : asset.orphan
        ? "Asset huérfano inventariado; no se importará."
        : null;
    items.push({
      entityType: "asset",
      sourceExternalId: asset.storageId,
      proposedInternalId: decision.internalId,
      action: errors.length > 0 ? "reject" : skipReason ? "skip" : decision.action,
      reason:
        errors.length > 0
          ? `Errores bloqueantes: ${errors.map(({ code }) => code).join(", ")}.`
          : skipReason ?? decision.reason,
      warnings: relevant
        .filter(({ severity }) => severity === "warning")
        .map(({ code }) => code),
      dependencies: asset.referencedBy,
      importOrder: 70,
      payloadHash: asset.sha256 || null,
    });
  });
  normalized.users.forEach((user) =>
    items.push({
      entityType: "user",
      sourceExternalId: user.externalId,
      proposedInternalId: null,
      action: "skip",
      reason: "Usuarios requieren intervención humana; no se importan.",
      warnings: ["USER_REQUIRES_HUMAN_REVIEW"],
      dependencies: [],
      importOrder: 90,
      payloadHash: null,
    }),
  );
  manifest.tables
    .filter(({ classification }) => classification !== "supported")
    .forEach((table) =>
      items.push({
        entityType: "unknown_table",
        sourceExternalId: table.name,
        proposedInternalId: null,
        action: "skip",
        reason: `Tabla ${table.classification} sin adaptador explícito.`,
        warnings: [
          table.classification === "unknown"
            ? "UNKNOWN_TABLE"
            : "AUXILIARY_TABLE",
        ],
        dependencies: [],
        importOrder: 100,
        payloadHash: null,
      }),
    );
  items.sort(
    (left, right) =>
      left.importOrder - right.importOrder ||
      left.entityType.localeCompare(right.entityType) ||
      left.sourceExternalId.localeCompare(right.sourceExternalId),
  );
  const counters: Record<ImportAction, number> = {
    create: 0,
    update: 0,
    skip: 0,
    reject: 0,
  };
  items.forEach(({ action }) => {
    counters[action] += 1;
  });
  return {
    schemaVersion: 1,
    sourceChecksum: manifest.source.checksum,
    dryRun: true,
    items,
    counters,
    issues: allIssues,
  };
}
