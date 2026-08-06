import "server-only";

import { getDatabase } from "@/db";
import { assertNoSensitiveAuditData } from "@/db/audit-safety";
import { auditLog } from "@/db/schema";

export type AuditLogEntry = Omit<
  typeof auditLog.$inferInsert,
  "id" | "createdAt"
>;

export async function appendAuditLog(entry: AuditLogEntry) {
  assertNoSensitiveAuditData(entry.before, "before");
  assertNoSensitiveAuditData(entry.after, "after");
  assertNoSensitiveAuditData(entry.metadata, "metadata");

  const { db } = getDatabase();
  const [created] = await db.insert(auditLog).values(entry).returning();

  return created;
}
