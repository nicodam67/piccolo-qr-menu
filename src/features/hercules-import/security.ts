import {
  assertNoSensitiveAuditData,
  SensitiveAuditDataError,
} from "@/db/audit-safety";

const sensitiveKeys = new Set([
  "authorization",
  "cookie",
  "credential",
  "credentials",
  "password",
  "passwordhash",
  "secret",
  "token",
  "apikey",
  "refreshtoken",
  "accesstoken",
  "session",
  "sessionid",
  "privatekey",
]);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function findSensitivePaths(
  value: unknown,
  path = "payload",
): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      findSensitivePaths(item, `${path}[${index}]`),
    );
  }
  if (!value || typeof value !== "object") {
    return [];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, nested]) => {
      const nestedPath = `${path}.${key}`;
      return sensitiveKeys.has(normalizeKey(key))
        ? [nestedPath]
        : findSensitivePaths(nested, nestedPath);
    },
  );
}

export function assertSafeForReport(value: unknown, path = "payload"): void {
  const sensitive = findSensitivePaths(value, path);
  if (sensitive.length > 0) {
    throw new SensitiveAuditDataError(sensitive[0]!);
  }
  assertNoSensitiveAuditData(value, path);
}

export function redactSensitiveValues(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSensitiveValues);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
      key,
      sensitiveKeys.has(normalizeKey(key))
        ? "[REDACTED]"
        : redactSensitiveValues(nested),
    ]),
  );
}

export function omitSensitiveValues(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(omitSensitiveValues);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !sensitiveKeys.has(normalizeKey(key)))
      .map(([key, nested]) => [key, omitSensitiveValues(nested)]),
  );
}
