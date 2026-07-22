import { randomUUID } from "node:crypto";

import type { IntegrationAuthorization } from "./auth";

const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export function getCorrelationId(request: Request) {
  const provided = request.headers.get("x-correlation-id");
  return provided && CORRELATION_ID_PATTERN.test(provided)
    ? provided
    : randomUUID();
}

export function getIntegrationHeaders(correlationId: string) {
  return {
    "cache-control": "private, no-store",
    "x-correlation-id": correlationId,
  };
}

export function integrationErrorResponse(
  status: number,
  code: string,
  message: string,
  correlationId: string,
  headers: Record<string, string> = {},
) {
  return Response.json(
    {
      error: { code, message },
      meta: {
        schemaVersion: "1.0.0",
        correlationId,
      },
    },
    {
      status,
      headers: {
        ...getIntegrationHeaders(correlationId),
        ...headers,
      },
    },
  );
}

export function integrationAuthorizationErrorResponse(
  authorization: Exclude<
    IntegrationAuthorization,
    { authorized: true }
  >,
  correlationId: string,
) {
  return integrationErrorResponse(
    authorization.status,
    authorization.code,
    authorization.message,
    correlationId,
    authorization.status === 401
      ? { "www-authenticate": 'Bearer realm="piccolo-integration"' }
      : {},
  );
}
