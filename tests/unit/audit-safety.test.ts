import assert from "node:assert/strict";
import test from "node:test";

import {
  assertNoSensitiveAuditData,
  SensitiveAuditDataError,
} from "../../src/db/audit-safety";

test("permite metadatos de auditoría no sensibles", () => {
  assert.doesNotThrow(() =>
    assertNoSensitiveAuditData({
      changedFields: ["name", "status"],
      counts: { created: 2, skipped: 1 },
      references: [{ entityType: "product", externalId: "product-1" }],
    }),
  );
});

test("rechaza secretos incluso cuando están anidados", () => {
  assert.throws(
    () =>
      assertNoSensitiveAuditData({
        request: {
          headers: {
            authorization: "sensitive-value",
          },
        },
      }),
    (error: unknown) =>
      error instanceof SensitiveAuditDataError &&
      error.message.includes("payload.request.headers.authorization"),
  );
});

test("rechaza credenciales dentro de arrays", () => {
  assert.throws(
    () =>
      assertNoSensitiveAuditData([
        { action: "safe" },
        { passwordHash: "should-never-be-persisted" },
      ]),
    SensitiveAuditDataError,
  );
});
