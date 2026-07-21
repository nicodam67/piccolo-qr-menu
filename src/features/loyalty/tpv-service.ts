import "server-only";

import { applyCustomerLoyaltyMovement } from "./repository";

export interface TpvLoyaltyMovementInput {
  restaurantId: string;
  customerId: string;
  points: number;
  operation: "earn" | "redeem";
  externalReference: string;
  idempotencyKey: string;
  reason: string;
}

export async function recordTpvLoyaltyMovement(
  input: TpvLoyaltyMovementInput,
) {
  if (!input.externalReference || !input.idempotencyKey) {
    throw new Error("La referencia e idempotencia TPV son obligatorias.");
  }
  return applyCustomerLoyaltyMovement({
    restaurantId: input.restaurantId,
    customerId: input.customerId,
    amount:
      input.operation === "earn"
        ? Math.abs(input.points)
        : -Math.abs(input.points),
    movementType:
      input.operation === "earn" ? "tpv_accrual" : "tpv_redemption",
    reason: input.reason,
    externalReference: input.externalReference,
    idempotencyKey: input.idempotencyKey,
  });
}
