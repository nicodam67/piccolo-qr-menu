import "server-only";

import { and, asc, eq, ilike, or, sql } from "drizzle-orm";

import { getDatabase } from "@/db";
import {
  reservationEconomicEvents,
  reservations,
  restaurantSettings,
} from "@/db/schema";
import {
  canTransitionReservation,
  getLocalDateTime,
  type ReservationOrigin,
  type ReservationStatus,
} from "@/features/reservations/domain";

export type AdminReservation = {
  id: string;
  locator: string;
  date: string;
  time: string;
  partySize: number;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  customerNotes: string;
  internalNotes: string;
  status: ReservationStatus;
  origin: ReservationOrigin;
  locale: string;
  createdAt: string;
  depositTotalCents:number; economicStatus:string; graceDeadlineAt:string;
  arrivedAt:string; tpvApplicationStatus:string; remainingDepositCents:number;
  economicEvents: Array<{ type:string; amountCents:number|null; reason:string; createdAt:string }>;
};

export async function getAdminReservations({
  date,
  status,
  query,
  economicStatus,
  paymentMethod,
}: {
  date?: string;
  status?: ReservationStatus;
  query?: string;
  economicStatus?: string;
  paymentMethod?: string;
}) {
  const { db } = getDatabase();
  const [restaurant] = await db
    .select({
      id: restaurantSettings.id,
      timezone: restaurantSettings.timezone,
      defaultLocale: restaurantSettings.defaultLocale,
    })
    .from(restaurantSettings)
    .limit(1);
  if (!restaurant) throw new Error("No existe un restaurante configurado.");
  const selectedDate =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : getLocalDateTime(new Date(), restaurant.timezone).date;
  const conditions = [
    eq(reservations.restaurantId, restaurant.id),
    eq(reservations.reservationDate, selectedDate),
  ];
  if (status) conditions.push(eq(reservations.status, status));
  if (economicStatus) conditions.push(eq(reservations.economicStatus,economicStatus));
  if (paymentMethod) conditions.push(sql`exists (select 1 from reservation_payments rp where rp.reservation_id = ${reservations.id} and rp.method = ${paymentMethod})`);
  if (query?.trim()) {
    const pattern = `%${query.trim().slice(0, 160)}%`;
    const search = or(
      ilike(reservations.guestName, pattern),
      ilike(reservations.guestPhone, pattern),
      ilike(reservations.locator, pattern),
    );
    if (search) conditions.push(search);
  }
  const [rows, [summary], eventRows] = await Promise.all([
    db
      .select()
      .from(reservations)
      .where(and(...conditions))
      .orderBy(asc(reservations.reservationTime), asc(reservations.createdAt)),
    db
      .select({
        totalReservations: sql<number>`count(*)::integer`,
        totalGuests: sql<number>`coalesce(sum(${reservations.partySize}) filter (where ${reservations.status} not in ('cancelled', 'no_show')), 0)::integer`,
        pending: sql<number>`count(*) filter (where ${reservations.status} = 'pending')::integer`,
        confirmed: sql<number>`count(*) filter (where ${reservations.status} = 'confirmed')::integer`,
        cancelled: sql<number>`count(*) filter (where ${reservations.status} = 'cancelled')::integer`,
        noShow: sql<number>`count(*) filter (where ${reservations.status} = 'no_show')::integer`,
      })
      .from(reservations)
      .where(
        and(
          eq(reservations.restaurantId, restaurant.id),
          eq(reservations.reservationDate, selectedDate),
        ),
      ),
    db
      .select({
        reservationId: reservationEconomicEvents.reservationId,
        type: reservationEconomicEvents.eventType,
        amountCents: reservationEconomicEvents.amountCents,
        reason: reservationEconomicEvents.reason,
        createdAt: reservationEconomicEvents.createdAt,
      })
      .from(reservationEconomicEvents)
      .innerJoin(
        reservations,
        eq(reservationEconomicEvents.reservationId, reservations.id),
      )
      .where(
        and(
          eq(reservations.restaurantId, restaurant.id),
          eq(reservations.reservationDate, selectedDate),
        ),
      )
      .orderBy(asc(reservationEconomicEvents.createdAt)),
  ]);
  const eventsByReservation = new Map<string, AdminReservation["economicEvents"]>();
  for (const event of eventRows) {
    const list = eventsByReservation.get(event.reservationId) ?? [];
    list.push({
      type: event.type,
      amountCents: event.amountCents,
      reason: event.reason ?? "",
      createdAt: event.createdAt.toISOString(),
    });
    eventsByReservation.set(event.reservationId, list);
  }
  return {
    date: selectedDate,
    defaultLocale: restaurant.defaultLocale,
    records: rows.map((row) => ({
      id: row.id,
      locator: row.locator,
      date: row.reservationDate,
      time: row.reservationTime.slice(0, 5),
      partySize: row.partySize,
      guestName: row.guestName,
      guestPhone: row.guestPhone,
      guestEmail: row.guestEmail ?? "",
      customerNotes: row.customerNotes ?? "",
      internalNotes: row.internalNotes ?? "",
      status: row.status as ReservationStatus,
      origin: row.origin as ReservationOrigin,
      locale: row.locale,
      createdAt: row.createdAt.toISOString(),
      depositTotalCents:row.depositTotalCents,economicStatus:row.economicStatus,
      graceDeadlineAt:row.graceDeadlineAt?.toISOString() ?? "",
      arrivedAt:row.arrivedAt?.toISOString() ?? "",tpvApplicationStatus:row.tpvApplicationStatus,
      remainingDepositCents:row.remainingDepositCents,
      economicEvents: eventsByReservation.get(row.id) ?? [],
    })),
    summary: summary ?? {
      totalReservations: 0,
      totalGuests: 0,
      pending: 0,
      confirmed: 0,
      cancelled: 0,
      noShow: 0,
    },
  };
}

export async function transitionReservationStatus(
  id: string,
  nextStatus: ReservationStatus,
) {
  const { db } = getDatabase();
  await db.transaction(async (tx) => {
    const [record] = await tx
      .select({ status: reservations.status })
      .from(reservations)
      .where(eq(reservations.id, id))
      .for("update")
      .limit(1);
    if (!record) throw new Error("La reserva ya no existe.");
    const currentStatus = record.status as ReservationStatus;
    if (!canTransitionReservation(currentStatus, nextStatus)) {
      throw new Error("La transición de estado no está permitida.");
    }
    await tx
      .update(reservations)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(eq(reservations.id, id));
  });
}

