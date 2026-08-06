const sensitiveKeyPattern =
  /^(authorization|cookie|credentials?|password|password[_-]?hash|secret|token|api[_-]?key|refresh[_-]?token|access[_-]?token|session(?:[_-]?id)?|private[_-]?key)$/i;

export class SensitiveAuditDataError extends Error {
  constructor(path: string) {
    super(`El campo sensible "${path}" no puede guardarse en auditoría.`);
    this.name = "SensitiveAuditDataError";
  }
}

export function assertNoSensitiveAuditData(
  value: unknown,
  path = "payload",
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertNoSensitiveAuditData(item, `${path}[${index}]`),
    );
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const nestedPath = `${path}.${key}`;

    if (sensitiveKeyPattern.test(key)) {
      throw new SensitiveAuditDataError(nestedPath);
    }

    assertNoSensitiveAuditData(nestedValue, nestedPath);
  }
}
