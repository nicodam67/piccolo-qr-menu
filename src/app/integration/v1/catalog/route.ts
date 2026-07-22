import { authorizeIntegrationRequest } from "@/features/integration/auth";
import { getIntegrationCatalog } from "@/features/integration/catalog-service";
import { isCatalogVersion } from "@/features/integration/contracts";
import {
  getCorrelationId,
  getIntegrationHeaders,
  integrationAuthorizationErrorResponse,
  integrationErrorResponse,
} from "@/features/integration/http";

export const dynamic = "force-dynamic";

const SUPPORTED_LOCALE = "es";

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  const authorization = authorizeIntegrationRequest(request, "catalog:read");

  if (!authorization.authorized) {
    return integrationAuthorizationErrorResponse(
      authorization,
      correlationId,
    );
  }

  const url = new URL(request.url);
  const locale = url.searchParams.get("locale") ?? SUPPORTED_LOCALE;

  if (locale !== SUPPORTED_LOCALE) {
    return integrationErrorResponse(
      400,
      "unsupported_locale",
      `El locale ${locale} no está publicado.`,
      correlationId,
    );
  }

  const since = url.searchParams.get("since");

  if (since !== null && !isCatalogVersion(since)) {
    return integrationErrorResponse(
      400,
      "invalid_catalog_version",
      "La versión de catálogo no es válida.",
      correlationId,
    );
  }

  try {
    const catalog = await getIntegrationCatalog(locale, correlationId);
    const etag = `"${catalog.data.version}"`;

    if (
      since === catalog.data.version ||
      request.headers.get("if-none-match") === etag
    ) {
      return new Response(null, {
        status: 304,
        headers: {
          ...getIntegrationHeaders(correlationId),
          etag,
        },
      });
    }

    return Response.json(catalog, {
      headers: {
        ...getIntegrationHeaders(correlationId),
        etag,
      },
    });
  } catch (error: unknown) {
    console.error("integration_catalog_read_failed", {
      correlationId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return integrationErrorResponse(
      500,
      "catalog_unavailable",
      "No se pudo cargar el catálogo de integración.",
      correlationId,
    );
  }
}
