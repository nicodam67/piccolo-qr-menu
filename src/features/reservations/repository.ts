import "server-only";

import { and, asc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";

import { getDatabase } from "@/db";
import {
  openingHours,
  reservations,
  reservationSettings,
  restaurantLocales,
  restaurantSettings,
  restaurantTranslations,
  specialOpeningHours,
} from "@/db/schema";
import {
  buildOpeningDays,
  buildSpecialOpeningDays,
} from "@/features/public-menu/repository";
import { getOpeningIntervalsForDate } from "@/features/public-menu/schedule";
import {
  generateReservationLocator,
  generateReservationSlots,
  DEFAULT_RESERVATION_SETTINGS,
  getReservableDateRange,
  isReservationSettingsReady,
  shiftReservationDate,
  type ReservationSettingsData,
  type ReservationSlot,
  type ReservationStatus,
  zonedLocalDateTimeToUtc,
} from "./domain";
import { calculateDeposit, calculateGraceDeadline } from "./payments/domain";

type ReservationTransaction = Parameters<
  Parameters<ReturnType<typeof getDatabase>["db"]["transaction"]>[0]
>[0];

function mapSettings(
  row: typeof reservationSettings.$inferSelect | undefined,
): ReservationSettingsData {
  return row
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
    : DEFAULT_RESERVATION_SETTINGS;
}

async function getContext(
  tx: ReservationTransaction,
  locale: string,
) {
  const [restaurant] = await tx
    .select({
      id: restaurantSettings.id,
      timezone: restaurantSettings.timezone,
      phone: restaurantSettings.phone,
      name: restaurantTranslations.name,
    })
    .from(restaurantSettings)
    .innerJoin(
      restaurantLocales,
      and(
        eq(restaurantLocales.restaurantId, restaurantSettings.id),
        eq(restaurantLocales.locale, locale),
        eq(restaurantLocales.isEnabled, true),
        eq(restaurantLocales.isPublished, true),
      ),
    )
    .innerJoin(
      restaurantTranslations,
      and(
        eq(restaurantTranslations.restaurantId, restaurantSettings.id),
        eq(restaurantTranslations.locale, locale),
      ),
    )
    .limit(1);
  if (!restaurant) return null;
  const [settingsRow] = await tx
    .select()
    .from(reservationSettings)
    .where(eq(reservationSettings.restaurantId, restaurant.id))
    .limit(1);
  return { restaurant, settings: mapSettings(settingsRow) };
}

async function calculateAvailability(
  tx: ReservationTransaction,
  {
    locale,
    date,
    partySize,
    now,
    excludeReservationId,
  }: {
    locale: string;
    date: string;
    partySize: number;
    now: Date;
    excludeReservationId?: string;
  },
) {
  const context = await getContext(tx, locale);
  if (!context) return { kind: "unavailable" as const, slots: [] };
  const { restaurant, settings } = context;
  if (!isReservationSettingsReady(settings)) {
    return { kind: "disabled" as const, slots: [], context };
  }
  if (
    !Number.isInteger(partySize) ||
    partySize < 1 ||
    partySize > settings.maximumPartySize
  ) {
    return { kind: "invalid_party" as const, slots: [], context };
  }
  const range = getReservableDateRange(
    now,
    restaurant.timezone,
    settings.maximumAdvanceDays,
  );
  if (date < range.minDate || date > range.maxDate) {
    return { kind: "out_of_range" as const, slots: [], context, range };
  }
  const occupancyConditions = [
    eq(reservations.restaurantId, restaurant.id),
    eq(reservations.reservationDate, date),
    inArray(reservations.status, ["pending", "confirmed", "seated"]),
  ];
  if (excludeReservationId) {
    occupancyConditions.push(ne(reservations.id, excludeReservationId));
  }
  const [weeklyRows, specialRows, occupancyRows] = await Promise.all([
    tx
      .select()
      .from(openingHours)
      .where(eq(openingHours.restaurantId, restaurant.id))
      .orderBy(asc(openingHours.dayOfWeek)),
    tx
      .select()
      .from(specialOpeningHours)
      .where(
        and(
          eq(specialOpeningHours.restaurantId, restaurant.id),
          gte(
            specialOpeningHours.exceptionDate,
            shiftReservationDate(date, -1),
          ),
          lte(specialOpeningHours.exceptionDate, date),
        ),
      ),
    tx
      .select({
        time: reservations.reservationTime,
        occupied: sql<number>`sum(${reservations.partySize})::integer`,
      })
      .from(reservations)
      .where(
        and(...occupancyConditions),
      )
      .groupBy(reservations.reservationTime),
  ]);
  const weeklySchedule = buildOpeningDays(weeklyRows);
  const specialSchedule = buildSpecialOpeningDays(specialRows);
  const intervals = getOpeningIntervalsForDate({
    date,
    weeklySchedule,
    specialSchedule,
  });
  if (intervals.length === 0) {
    return { kind: "closed" as const, slots: [], context, range };
  }
  const occupancy = Object.fromEntries(
    occupancyRows.map(({ time, occupied }) => [time.slice(0, 5), occupied]),
  );
  const slots = generateReservationSlots({
    date,
    intervals,
    durationMinutes: settings.durationMinutes,
    intervalMinutes: settings.slotIntervalMinutes,
    partySize,
    slotCapacity: settings.slotCapacity,
    occupancy,
    now,
    timeZone: restaurant.timezone,
    minimumAdvanceMinutes: settings.minimumAdvanceMinutes,
  });
  return {
    kind: slots.length > 0 ? ("available" as const) : ("full" as const),
    slots,
    context,
    range,
  };
}

async function createUniqueLocator(tx: ReservationTransaction) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const locator = generateReservationLocator();
    const [collision] = await tx
      .select({ id: reservations.id })
      .from(reservations)
      .where(eq(reservations.locator, locator))
      .limit(1);
    if (!collision) return locator;
  }
  throw new Error("No se pudo generar el localizador.");
}

export type ReservationAvailability = Awaited<
  ReturnType<typeof calculateAvailability>
>;

export async function getReservationPublicData(locale: string, now = new Date()) {
  const { db } = getDatabase();
  return db.transaction(async (tx) => {
    const context = await getContext(tx, locale);
    if (!context) return null;
    const range = getReservableDateRange(
      now,
      context.restaurant.timezone,
      context.settings.maximumAdvanceDays,
    );
    return {
      restaurantName: context.restaurant.name,
      restaurantPhone: context.restaurant.phone,
      settings: context.settings,
      isReady: isReservationSettingsReady(context.settings),
      range,
    };
  });
}

export async function getReservationAvailability(
  locale: string,
  date: string,
  partySize: number,
  now = new Date(),
) {
  const { db } = getDatabase();
  return db.transaction((tx) =>
    calculateAvailability(tx, { locale, date, partySize, now }),
  );
}

export type OnlineReservationInput = {
  locale: string;
  date: string;
  time: string;
  partySize: number;
  guestName: string;
  guestPhone: string;
  guestEmail: string | null;
  customerNotes: string | null;
  idempotencyKey: string;
  acceptedDepositTerms: boolean;
};

export async function createOnlineReservation(
  input: OnlineReservationInput,
  now = new Date(),
) {
  const { db } = getDatabase();
  return db.transaction(async (tx) => {
    const initialContext = await getContext(tx, input.locale);
    if (!initialContext) throw new Error("Las reservas no están disponibles.");
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`${input.date}:${input.time}`}))`,
    );
    const existing = await tx
      .select({
        id: reservations.id,
        locator: reservations.locator,
        date: reservations.reservationDate,
        time: reservations.reservationTime,
        partySize: reservations.partySize,
        status: reservations.status,
        depositRequired: reservations.depositRequired,
      })
      .from(reservations)
      .where(
        and(
          eq(reservations.restaurantId, initialContext.restaurant.id),
          eq(reservations.idempotencyKey, input.idempotencyKey),
        ),
      )
      .limit(1);
    if (existing[0]) return existing[0];

    const availability = await calculateAvailability(tx, {
      locale: input.locale,
      date: input.date,
      partySize: input.partySize,
      now,
    });
    if (
      availability.kind !== "available" ||
      !availability.slots.some(({ time }) => time === input.time)
    ) {
      throw new Error("La hora seleccionada ya no está disponible.");
    }
    const context = availability.context;
    if (!context) throw new Error("Las reservas no están disponibles.");

    const locator = await createUniqueLocator(tx);
    const depositTotalCents = calculateDeposit(input.partySize,context.settings.depositPerGuestCents,context.settings.depositMinimumPartySize,context.settings.depositEnabled);
    if (depositTotalCents > 0 && !input.acceptedDepositTerms) throw new Error("Debes aceptar las condiciones del adelanto.");
    const reservationAt = zonedLocalDateTimeToUtc(input.date,input.time,context.restaurant.timezone);
    if (!reservationAt) throw new Error("Fecha u hora no válida.");

    const [created] = await tx
      .insert(reservations)
      .values({
        restaurantId: context.restaurant.id,
        locator,
        reservationDate: input.date,
        reservationTime: input.time,
        partySize: input.partySize,
        guestName: input.guestName,
        guestPhone: input.guestPhone,
        guestEmail: input.guestEmail,
        customerNotes: input.customerNotes,
        status: depositTotalCents > 0 && context.settings.confirmOnlyAfterPayment ? "pending" : context.settings.initialStatus,
        origin: "online",
        locale: input.locale,
        idempotencyKey: input.idempotencyKey,
        depositRequired: depositTotalCents > 0,
        depositTotalCents,
        economicStatus: depositTotalCents > 0 ? "pending" : "exempt",
        graceDeadlineAt: calculateGraceDeadline(reservationAt,context.settings.gracePeriodMinutes),
        remainingDepositCents: 0,
        acceptedPolicyVersion: context.settings.policyVersion,
        policyAcceptedAt: now,
      })
      .returning({
        id: reservations.id,
        locator: reservations.locator,
        date: reservations.reservationDate,
        time: reservations.reservationTime,
        partySize: reservations.partySize,
        status: reservations.status,
        depositRequired: reservations.depositRequired,
      });
    if (!created) throw new Error("No se pudo guardar la reserva.");
    return created;
  });
}

export type ManualReservationInput = Omit<
  OnlineReservationInput,
  "idempotencyKey" | "acceptedDepositTerms"
> & {
  internalNotes: string | null;
  overrideWarning: boolean;
};

export async function createManualReservation(
  input: ManualReservationInput,
  now = new Date(),
) {
  const { db } = getDatabase();
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`${input.date}:${input.time}`}))`,
    );
    const availability = await calculateAvailability(tx, {
      locale: input.locale,
      date: input.date,
      partySize: input.partySize,
      now,
    });
    const isAvailable =
      availability.kind === "available" &&
      availability.slots.some(({ time }) => time === input.time);
    if (!isAvailable && !input.overrideWarning) {
      throw new Error(
        "La reserva está fuera de horario o supera la capacidad. Marca la autorización explícita para continuar.",
      );
    }
    const context = availability.context ?? (await getContext(tx, input.locale));
    if (!context) throw new Error("No existe un restaurante configurado.");
    const locator = await createUniqueLocator(tx);
    const depositTotalCents = calculateDeposit(input.partySize,context.settings.depositPerGuestCents,context.settings.depositMinimumPartySize,context.settings.depositEnabled && context.settings.manualDepositRequired);
    const reservationAt = zonedLocalDateTimeToUtc(input.date,input.time,context.restaurant.timezone);
    const [created] = await tx
      .insert(reservations)
      .values({
        restaurantId: context.restaurant.id,
        locator,
        reservationDate: input.date,
        reservationTime: input.time,
        partySize: input.partySize,
        guestName: input.guestName,
        guestPhone: input.guestPhone,
        guestEmail: input.guestEmail,
        customerNotes: input.customerNotes,
        internalNotes: input.internalNotes,
        status: "confirmed",
        origin: "manual",
        locale: input.locale,
        depositRequired: depositTotalCents > 0,
        depositTotalCents,
        economicStatus: depositTotalCents > 0 ? "pending" : "exempt",
        graceDeadlineAt: reservationAt ? calculateGraceDeadline(reservationAt,context.settings.gracePeriodMinutes) : null,
        acceptedPolicyVersion: context.settings.policyVersion,
      })
      .returning({ id: reservations.id, locator: reservations.locator });
    if (!created) throw new Error("No se pudo guardar la reserva.");
    return created;
  });
}

export type UpdateReservationInput = Omit<
  ManualReservationInput,
  "locale" | "overrideWarning"
> & {
  id: string;
  overrideWarning: boolean;
};

export async function updateAdminReservation(
  input: UpdateReservationInput,
  now = new Date(),
) {
  const { db } = getDatabase();
  await db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        restaurantId: reservations.restaurantId,
        locale: reservations.locale,
      })
      .from(reservations)
      .where(eq(reservations.id, input.id))
      .for("update")
      .limit(1);
    if (!current) throw new Error("La reserva ya no existe.");
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`${input.date}:${input.time}`}))`,
    );
    const availability = await calculateAvailability(tx, {
      locale: current.locale,
      date: input.date,
      partySize: input.partySize,
      now,
      excludeReservationId: input.id,
    });
    const isAvailable =
      availability.kind === "available" &&
      availability.slots.some(({ time }) => time === input.time);
    if (!isAvailable && !input.overrideWarning) {
      throw new Error(
        "El cambio queda fuera de horario o supera la capacidad. Autoriza explícitamente para continuar.",
      );
    }
    await tx
      .update(reservations)
      .set({
        reservationDate: input.date,
        reservationTime: input.time,
        partySize: input.partySize,
        guestName: input.guestName,
        guestPhone: input.guestPhone,
        guestEmail: input.guestEmail,
        customerNotes: input.customerNotes,
        internalNotes: input.internalNotes,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(reservations.id, input.id),
          eq(reservations.restaurantId, current.restaurantId),
        ),
      );
  });
}

export type PublicReservationConfirmation = {
  locator: string;
  date: string;
  time: string;
  partySize: number;
  status: ReservationStatus;
};

export function stripAvailabilitySlots(
  availability: ReservationAvailability,
): ReservationSlot[] {
  return availability.slots;
}
