import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { getDatabase } from "@/db";
import { assertNoSensitiveAuditData } from "@/db/audit-safety";
import { externalEntityMappings } from "@/db/schema";

export const externalSources = [
  "hercules_convex",
  "piccolo_tpv",
  "legacy",
  "manual",
] as const;

export const mappedEntityTypes = [
  "restaurant",
  "category",
  "product",
  "tag",
  "allergen",
  "asset",
  "branding",
  "schedule",
  "user",
] as const;

export type ExternalSource = (typeof externalSources)[number];
export type MappedEntityType = (typeof mappedEntityTypes)[number];

export type ExternalEntityMappingInput = {
  source: ExternalSource;
  entityType: MappedEntityType;
  externalId: string;
  internalId: string;
  externalParentId?: string | null;
  metadata?: Record<string, unknown> | null;
  sourceCreatedAt?: Date | null;
  sourceUpdatedAt?: Date | null;
  payloadHash?: string | null;
  lastSeenImportRunId?: string | null;
  lastSeenSyncRunId?: string | null;
};

const entityLocations: Record<
  MappedEntityType,
  { tableName: string; idColumn: string }
> = {
  restaurant: { tableName: "restaurant_settings", idColumn: "id" },
  category: { tableName: "categories", idColumn: "id" },
  product: { tableName: "products", idColumn: "id" },
  tag: { tableName: "tags", idColumn: "id" },
  allergen: { tableName: "allergens", idColumn: "id" },
  asset: { tableName: "assets", idColumn: "id" },
  branding: {
    tableName: "restaurant_branding",
    idColumn: "restaurant_id",
  },
  schedule: { tableName: "opening_hour_exceptions", idColumn: "id" },
  user: { tableName: "admins", idColumn: "id" },
};

export class ExternalEntityMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExternalEntityMappingError";
  }
}

type MappingTransaction = Parameters<
  Parameters<ReturnType<typeof getDatabase>["db"]["transaction"]>[0]
>[0];

async function assertInternalEntityExists(
  tx: MappingTransaction,
  entityType: MappedEntityType,
  internalId: string,
) {
  const location = entityLocations[entityType];
  const result = await tx.execute(sql`
    select 1
    from ${sql.identifier(location.tableName)}
    where ${sql.identifier(location.idColumn)} = ${internalId}::uuid
    limit 1
  `);

  if (result.length === 0) {
    throw new ExternalEntityMappingError(
      `No existe la entidad interna ${entityType} con id ${internalId}.`,
    );
  }
}

export async function upsertExternalEntityMapping(
  input: ExternalEntityMappingInput,
) {
  assertNoSensitiveAuditData(input.metadata, "metadata");
  const { db } = getDatabase();

  return db.transaction(async (tx) => {
    await tx.execute(sql`
      select pg_advisory_xact_lock(
        hashtextextended(
          ${`${input.source}:${input.entityType}:${input.externalId}`},
          0
        )
      )
    `);
    await assertInternalEntityExists(tx, input.entityType, input.internalId);

    const [existing] = await tx
      .select({
        id: externalEntityMappings.id,
        internalId: externalEntityMappings.internalId,
      })
      .from(externalEntityMappings)
      .where(
        and(
          eq(externalEntityMappings.source, input.source),
          eq(externalEntityMappings.entityType, input.entityType),
          eq(externalEntityMappings.externalId, input.externalId),
        ),
      )
      .limit(1);

    if (existing && existing.internalId !== input.internalId) {
      throw new ExternalEntityMappingError(
        "El identificador externo ya está asociado a otra entidad interna.",
      );
    }

    const values = {
      source: input.source,
      entityType: input.entityType,
      externalId: input.externalId,
      internalId: input.internalId,
      externalParentId: input.externalParentId ?? null,
      metadata: input.metadata ?? null,
      sourceCreatedAt: input.sourceCreatedAt ?? null,
      sourceUpdatedAt: input.sourceUpdatedAt ?? null,
      payloadHash: input.payloadHash ?? null,
      lastSeenImportRunId: input.lastSeenImportRunId ?? null,
      lastSeenSyncRunId: input.lastSeenSyncRunId ?? null,
      updatedAt: new Date(),
    };

    if (existing) {
      const [updated] = await tx
        .update(externalEntityMappings)
        .set(values)
        .where(eq(externalEntityMappings.id, existing.id))
        .returning();

      return updated;
    }

    const [created] = await tx
      .insert(externalEntityMappings)
      .values(values)
      .returning();

    return created;
  });
}
