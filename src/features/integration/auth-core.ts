import { timingSafeEqual } from "node:crypto";

export const INTEGRATION_SCOPES = [
  "catalog:read",
  "catalog:write",
  "customers:read",
  "customers:write",
  "reservations:read",
  "reservations:write",
  "loyalty:read",
  "loyalty:write",
] as const;

export type IntegrationScope = (typeof INTEGRATION_SCOPES)[number];
export type IntegrationCredentialDecision =
  | "authorized"
  | "invalid_token"
  | "insufficient_scope";

const integrationScopeSet = new Set<string>(INTEGRATION_SCOPES);

export function parseBearerCredential(
  authorization: string | null,
): string | null {
  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer ([^\s]+)$/i);
  return match?.[1] ?? null;
}

export function parseIntegrationScopes(value: string | undefined) {
  if (!value) {
    return new Set<IntegrationScope>();
  }

  return new Set(
    value
      .split(",")
      .map((scope) => scope.trim())
      .filter(
        (scope): scope is IntegrationScope =>
          integrationScopeSet.has(scope),
      ),
  );
}

export function isIntegrationTokenValid(
  providedToken: string | null,
  configuredToken: string,
) {
  if (!providedToken) {
    return false;
  }

  const provided = Buffer.from(providedToken);
  const configured = Buffer.from(configuredToken);

  return (
    provided.length === configured.length &&
    timingSafeEqual(provided, configured)
  );
}

export function evaluateIntegrationCredential(
  providedToken: string | null,
  configuredToken: string,
  scopes: ReadonlySet<IntegrationScope>,
  requiredScope: IntegrationScope,
): IntegrationCredentialDecision {
  if (!isIntegrationTokenValid(providedToken, configuredToken)) {
    return "invalid_token";
  }

  return scopes.has(requiredScope) ? "authorized" : "insufficient_scope";
}
