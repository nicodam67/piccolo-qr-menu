import {
  ProductValidationError,
  updateProductAvailability,
} from "@/features/integration/catalog-service";
import {
  IntegrationContractError,
  isUuid,
  parseAvailabilityCommand,
} from "@/features/integration/contracts";
import { authorizeIntegrationRequest } from "@/features/integration/auth";
import {
  getCorrelationId,
  getIntegrationHeaders,
  integrationAuthorizationErrorResponse,
  integrationErrorResponse,
} from "@/features/integration/http";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 1_024;

type AvailabilityRouteContext = {
  params: Promise<{ productId: string }>;
};

export async function PUT(
  request: Request,
  context: AvailabilityRouteContext,
) {
  const correlationId = getCorrelationId(request);
  const authorization = authorizeIntegrationRequest(request, "catalog:write");

  if (!authorization.authorized) {
    return integrationAuthorizationErrorResponse(
      authorization,
      correlationId,
    );
  }

  const { productId } = await context.params;

  if (!isUuid(productId)) {
    return integrationErrorResponse(
      400,
      "invalid_product_id",
      "El identificador del producto no es un UUID válido.",
      correlationId,
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (contentLength > MAX_BODY_BYTES) {
    return integrationErrorResponse(
      413,
      "payload_too_large",
      "El cuerpo de la petición supera el tamaño permitido.",
      correlationId,
    );
  }

  try {
    const rawBody = await request.text();

    if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) {
      return integrationErrorResponse(
        413,
        "payload_too_large",
        "El cuerpo de la petición supera el tamaño permitido.",
        correlationId,
      );
    }

    const command = parseAvailabilityCommand(JSON.parse(rawBody));
    const product = await updateProductAvailability(
      productId,
      command.isSoldOut,
    );

    return Response.json(
      {
        data: {
          productId: product.id,
          isSoldOut: product.isSoldOut,
          updatedAt: product.updatedAt.toISOString(),
        },
        meta: {
          schemaVersion: "1.0.0",
          correlationId,
        },
      },
      { headers: getIntegrationHeaders(correlationId) },
    );
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return integrationErrorResponse(
        400,
        "invalid_json",
        "El cuerpo de la petición no contiene JSON válido.",
        correlationId,
      );
    }

    if (error instanceof ProductValidationError) {
      return integrationErrorResponse(
        404,
        "product_not_found",
        error.message,
        correlationId,
      );
    }

    if (error instanceof IntegrationContractError) {
      return integrationErrorResponse(
        400,
        "invalid_availability",
        error.message,
        correlationId,
      );
    }

    console.error("integration_catalog_availability_update_failed", {
      correlationId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return integrationErrorResponse(
      500,
      "availability_update_failed",
      "No se pudo actualizar la disponibilidad del producto.",
      correlationId,
    );
  }
}
