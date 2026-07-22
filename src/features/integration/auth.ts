import "server-only";

import {
  isIntegrationTokenValid,
  parseBearerCredential,
  parseIntegrationScopes,
  type IntegrationScope,
} from "./auth-core";

const MINIMUM_TOKEN_BYTES = 32;

export type IntegrationAuthorization =
  | { authorized: true }
  | {
      authorized: false;
      code: "integration_not_configured" | "invalid_token" | "insufficient_scope";
      message: string;
      status: 401 | 403 | 503;
    };

export function authorizeIntegrationRequest(
  request: Request,
  requiredScope: IntegrationScope,
): IntegrationAuthorization {
  const configuredToken = process.env.INTEGRATION_SERVICE_TOKEN;

  if (
    !configuredToken ||
    Buffer.byteLength(configuredToken) < MINIMUM_TOKEN_BYTES
  ) {
    return {
      authorized: false,
      code: "integration_not_configured",
      message: "La integración entre servicios no está configurada.",
      status: 503,
    };
  }

  const providedToken = parseBearerCredential(
    request.headers.get("authorization"),
  );

  if (!isIntegrationTokenValid(providedToken, configuredToken)) {
    return {
      authorized: false,
      code: "invalid_token",
      message: "Las credenciales de integración no son válidas.",
      status: 401,
    };
  }

  const scopes = parseIntegrationScopes(
    process.env.INTEGRATION_SERVICE_SCOPES,
  );

  if (!scopes.has(requiredScope)) {
    return {
      authorized: false,
      code: "insufficient_scope",
      message: `La credencial no dispone del scope ${requiredScope}.`,
      status: 403,
    };
  }

  return { authorized: true };
}
