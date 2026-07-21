import "server-only";

import { eq } from "drizzle-orm";

import { getDatabase } from "@/db";
import { reservationSettings, restaurantSettings } from "@/db/schema";
import {
  DEFAULT_RESERVATION_SETTINGS,
  type ReservationSettingsData,
} from "@/features/reservations/domain";

export async function getAdminReservationSettings() {
  const { db } = getDatabase();
  const [restaurant] = await db
    .select({ id: restaurantSettings.id })
    .from(restaurantSettings)
    .limit(1);
  if (!restaurant) throw new Error("No existe un restaurante configurado.");
  const [row] = await db
    .select()
    .from(reservationSettings)
    .where(eq(reservationSettings.restaurantId, restaurant.id))
    .limit(1);
  return {
    restaurantId: restaurant.id,
    settings: row
      ? {
          isEnabled: row.isEnabled,
          durationMinutes: row.durationMinutes,
          slotIntervalMinutes: row.slotIntervalMinutes as 15 | 30 | 60,
          minimumAdvanceMinutes: row.minimumAdvanceMinutes,
          maximumAdvanceDays: row.maximumAdvanceDays,
          maximumPartySize: row.maximumPartySize,
          slotCapacity: row.slotCapacity,
          largeGroupPhone: row.largeGroupPhone ?? "",
          customerMessage: row.customerMessage,
          policyText: row.policyText,
          initialStatus: row.initialStatus as "pending" | "confirmed",
          depositEnabled:row.depositEnabled,depositPerGuestCents:row.depositPerGuestCents,
          depositMinimumPartySize:row.depositMinimumPartySize,gracePeriodMinutes:row.gracePeriodMinutes,
          paymentTimeoutMinutes:row.paymentTimeoutMinutes,refundDeadlineHours:row.refundDeadlineHours,
          allowFullRefund:row.allowFullRefund,allowPartialRefund:row.allowPartialRefund,
          cancellationPolicy:row.cancellationPolicy,noShowPolicy:row.noShowPolicy,
          gracePolicy:row.gracePolicy,policyVersion:row.policyVersion,
          cardEnabled:row.cardEnabled,bizumEnabled:row.bizumEnabled,cashEnabled:row.cashEnabled,
          manualDepositRequired:row.manualDepositRequired,confirmOnlyAfterPayment:row.confirmOnlyAfterPayment,
        }
      : DEFAULT_RESERVATION_SETTINGS,
  };
}

export async function saveReservationSettings(
  input: ReservationSettingsData,
) {
  const { db } = getDatabase();
  const [restaurant] = await db
    .select({ id: restaurantSettings.id })
    .from(restaurantSettings)
    .limit(1);
  if (!restaurant) throw new Error("No existe un restaurante configurado.");
  await db
    .insert(reservationSettings)
    .values({
      restaurantId: restaurant.id,
      ...input,
      largeGroupPhone: input.largeGroupPhone || null,
    })
    .onConflictDoUpdate({
      target: reservationSettings.restaurantId,
      set: {
        ...input,
        largeGroupPhone: input.largeGroupPhone || null,
        updatedAt: new Date(),
      },
    });
}
