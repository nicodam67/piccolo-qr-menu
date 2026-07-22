export const LOYALTY_MOVEMENT_TYPES = [
  "manual_credit",
  "manual_debit",
  "correction",
  "redemption",
  "expiry",
  "tpv_accrual",
  "tpv_redemption",
] as const;

export type LoyaltyMovementType =
  (typeof LOYALTY_MOVEMENT_TYPES)[number];

export type LoyaltyTotals = {
  balance: number;
  totalEarned: number;
  totalRedeemed: number;
  totalExpired: number;
};

export function applyLoyaltyMovement(
  current: LoyaltyTotals,
  amount: number,
  type: LoyaltyMovementType,
): LoyaltyTotals {
  if (!Number.isInteger(amount) || amount === 0) {
    throw new Error("La cantidad de puntos debe ser un entero distinto de cero.");
  }
  const balance = current.balance + amount;
  if (balance < 0) {
    throw new Error("El movimiento dejaría el saldo de puntos por debajo de cero.");
  }
  return {
    balance,
    totalEarned:
      current.totalEarned +
      (amount > 0 && type !== "correction" ? amount : 0),
    totalRedeemed:
      current.totalRedeemed +
      (amount < 0 &&
      ["manual_debit", "redemption", "tpv_redemption"].includes(type)
        ? Math.abs(amount)
        : 0),
    totalExpired:
      current.totalExpired +
      (amount < 0 && type === "expiry" ? Math.abs(amount) : 0),
  };
}

export function normalizeLoyaltyReason(value: string) {
  const reason = value.trim();
  if (
    reason.length < 3 ||
    reason.length > 500 ||
    /[<>\u0000-\u001f]/.test(reason)
  ) {
    throw new Error("El motivo del movimiento no es válido.");
  }
  return reason;
}
