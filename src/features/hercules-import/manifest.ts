import type {
  AssetManifestEntry,
  NormalizedSnapshot,
  SnapshotData,
  SnapshotManifest,
  TableClassification,
  ValidationIssue,
} from "./types";
import { asString, deterministicUuid } from "./utils";
import { snapshotDisplayName } from "./zip-reader";

const supportedTables = new Set([
  "users",
  "categories",
  "branding",
  "menuItems",
  "_storage",
]);
const storageFields = new Set([
  "_id",
  "_creationTime",
  "contentType",
  "mimeType",
  "sha256",
  "size",
  "byteSize",
  "storageId",
  "originalFilename",
  "name",
]);

function classification(name: string): TableClassification {
  if (supportedTables.has(name)) return "supported";
  if (name.startsWith("_")) return "auxiliary";
  return "unknown";
}

function documentId(document: Record<string, unknown>): string | null {
  return asString(document._id);
}

function assetReferences(normalized: NormalizedSnapshot) {
  const references = new Map<string, Set<string>>();
  const add = (storageId: string | null, source: string) => {
    if (!storageId) return;
    const current = references.get(storageId) ?? new Set<string>();
    current.add(source);
    references.set(storageId, current);
  };
  normalized.products.forEach((product) => {
    const source = `product:${product.externalId}`;
    add(product.primaryAssetExternalId, source);
    product.galleryAssetExternalIds.forEach((id) => add(id, source));
    product.videoAssetExternalIds.forEach((id) => add(id, source));
  });
  normalized.branding.forEach((branding) => {
    const source = `branding:${branding.externalId}`;
    add(branding.assetExternalIds.logo, source);
    add(branding.assetExternalIds.hero, source);
    add(branding.assetExternalIds.icon, source);
  });
  return references;
}

export function buildManifest(
  snapshot: SnapshotData,
  normalized: NormalizedSnapshot,
): SnapshotManifest {
  const issues: ValidationIssue[] = [...snapshot.issues, ...normalized.issues];
  const tables = [...snapshot.documentsByTable.entries()]
    .map(([name, documents]) => {
      const seen = new Set<string>();
      const duplicates = new Set<string>();
      documents.forEach((document) => {
        const id = documentId(document);
        if (!id) {
          issues.push({
            code: "MISSING_EXTERNAL_ID",
            severity: "error",
            table: name,
            message: `Documento sin _id en ${name}.`,
          });
        } else if (seen.has(id)) {
          duplicates.add(id);
          issues.push({
            code: "DUPLICATE_EXTERNAL_ID",
            severity: "error",
            table: name,
            externalId: id,
            message: `_id duplicado "${id}" en ${name}.`,
          });
        }
        if (id) seen.add(id);
      });
      const tableClassification = classification(name);
      if (tableClassification === "unknown") {
        issues.push({
          code: "UNKNOWN_TABLE",
          severity: "warning",
          table: name,
          message: `Tabla desconocida "${name}" inventariada; no se importará.`,
        });
      } else if (tableClassification === "auxiliary") {
        issues.push({
          code: "AUXILIARY_TABLE",
          severity: "warning",
          table: name,
          message: `Tabla auxiliar "${name}" inventariada; no se importará.`,
        });
      }
      return {
        name,
        classification: tableClassification,
        documentCount: documents.length,
        fields: [...(snapshot.tableFields.get(name) ?? new Set())].sort(),
        invalidLineCount: snapshot.tableInvalidLines.get(name) ?? 0,
        duplicateIds: [...duplicates].sort(),
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  const references = assetReferences(normalized);
  const metadataById = new Map(
    snapshot.storageMetadata.map((metadata) => [metadata._id, metadata]),
  );
  snapshot.storageMetadata.forEach((metadata) => {
    Object.keys(metadata)
      .filter((field) => !storageFields.has(field))
      .sort()
      .forEach((field) =>
        issues.push({
          code: "UNKNOWN_DOCUMENT_FIELD",
          severity: "warning",
          table: "_storage",
          externalId: metadata._id,
          path: field,
          message: `Campo desconocido "${field}" en _storage.`,
        }),
      );
  });
  const storageIds = new Set([
    ...metadataById.keys(),
    ...snapshot.storageFiles.keys(),
    ...references.keys(),
  ]);
  const assets: AssetManifestEntry[] = [...storageIds]
    .sort()
    .map((storageId) => {
      const metadata = metadataById.get(storageId);
      const binary = snapshot.storageFiles.get(storageId);
      const referencedBy = [...(references.get(storageId) ?? [])].sort();
      const declaredMime = asString(metadata?.contentType ?? metadata?.mimeType);
      const declaredSize = metadata?.size ?? metadata?.byteSize;
      const declaredHash = asString(metadata?.sha256);
      if (!binary) {
        issues.push({
          code: "STORAGE_BINARY_MISSING",
          severity: referencedBy.length > 0 ? "error" : "warning",
          table: "_storage",
          externalId: storageId,
          message: `No existe binario para storage "${storageId}".`,
        });
      }
      if (binary && !metadata) {
        issues.push({
          code: "STORAGE_METADATA_MISSING",
          severity: "warning",
          table: "_storage",
          externalId: storageId,
          message: `Binario "${storageId}" sin documento _storage.`,
        });
      }
      if (binary && declaredMime && declaredMime !== binary.mimeType) {
        issues.push({
          code: "STORAGE_MIME_MISMATCH",
          severity: "error",
          table: "_storage",
          externalId: storageId,
          message: `MIME declarado "${declaredMime}" no coincide con "${binary.mimeType}".`,
        });
      }
      if (
        binary &&
        typeof declaredSize === "number" &&
        declaredSize !== binary.byteSize
      ) {
        issues.push({
          code: "STORAGE_SIZE_MISMATCH",
          severity: "error",
          table: "_storage",
          externalId: storageId,
          message: `Tamaño declarado ${declaredSize} no coincide con ${binary.byteSize}.`,
        });
      }
      if (
        binary &&
        declaredHash &&
        /^[0-9a-f]{64}$/u.test(declaredHash) &&
        declaredHash !== binary.sha256
      ) {
        issues.push({
          code: "STORAGE_CHECKSUM_MISMATCH",
          severity: "error",
          table: "_storage",
          externalId: storageId,
          message: `SHA-256 declarado no coincide para "${storageId}".`,
        });
      }
      if (binary?.mimeType === "application/octet-stream") {
        issues.push({
          code: "STORAGE_UNSUPPORTED_MIME",
          severity: "error",
          table: "_storage",
          externalId: storageId,
          message: `Tipo binario no permitido para "${storageId}".`,
        });
      }
      return {
        storageId,
        originalFilename:
          asString(metadata?.originalFilename ?? metadata?.name) ?? null,
        mimeType: binary?.mimeType ?? declaredMime ?? "application/octet-stream",
        byteSize:
          binary?.byteSize ??
          (typeof declaredSize === "number" ? declaredSize : 0),
        sha256: binary?.sha256 ?? declaredHash ?? "",
        width: binary?.width ?? null,
        height: binary?.height ?? null,
        durationMs: binary?.durationMs ?? null,
        referencedBy,
        orphan: referencedBy.length === 0,
        duplicateOf: null,
        proposedStorageKey: binary
          ? `hercules/${binary.sha256.slice(0, 2)}/${binary.sha256}`
          : "",
        proposedAssetId: deterministicUuid("asset", storageId),
        status: !binary
          ? "missing_binary"
          : !metadata
            ? "metadata_missing"
            : binary.mimeType === "application/octet-stream"
              ? "unsupported"
              : "ready",
      };
    });

  const assetsByHash = new Map<string, AssetManifestEntry[]>();
  assets.forEach((asset) => {
    if (!asset.sha256) return;
    const group = assetsByHash.get(asset.sha256) ?? [];
    group.push(asset);
    assetsByHash.set(asset.sha256, group);
  });
  assetsByHash.forEach((group) => {
    if (group.length < 2) return;
    const canonical = [...group].sort(
      (left, right) =>
        Number(left.orphan) - Number(right.orphan) ||
        Number(left.status !== "ready") - Number(right.status !== "ready") ||
        left.storageId.localeCompare(right.storageId),
    )[0]!;
    group.forEach((asset) => {
      if (asset === canonical) return;
      asset.duplicateOf = canonical.storageId;
      issues.push({
        code: "ASSET_DUPLICATE_SHA256",
        severity: "warning",
        table: "_storage",
        externalId: asset.storageId,
        message: `Asset duplicado por contenido; se propone reutilizar "${canonical.storageId}".`,
      });
    });
  });

  return {
    schemaVersion: 1,
    source: {
      filename: snapshotDisplayName(snapshot),
      checksum: snapshot.checksum,
      byteSize: snapshot.byteSize,
    },
    tables,
    assets,
    totals: {
      tables: tables.length,
      documents: tables.reduce(
        (total, table) => total + table.documentCount,
        0,
      ),
      storageFiles: snapshot.storageFiles.size,
      storageBytes: [...snapshot.storageFiles.values()].reduce(
        (total, file) => total + file.byteSize,
        0,
      ),
    },
    issues: issues.sort((left, right) =>
      [
        left.severity,
        left.table ?? "",
        left.externalId ?? "",
        left.code,
        left.path ?? "",
      ]
        .join(":")
        .localeCompare(
          [
            right.severity,
            right.table ?? "",
            right.externalId ?? "",
            right.code,
            right.path ?? "",
          ].join(":"),
        ),
    ),
  };
}
