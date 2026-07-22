import { randomBytes } from "node:crypto";

import type { LocalOpeningInterval } from "@/features/public-menu/schedule";

export const RESERVATION_STATUSES = [
  "pending",
  "confirmed",
  "seated",
  "completed",
  "cancelled",
  "no_show",
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];
export type ReservationOrigin = "online" | "manual";

export type ReservationSettingsData = {
  isEnabled: boolean;
  durationMinutes: number;
  slotIntervalMinutes: 15 | 30 | 60;
  minimumAdvanceMinutes: number;
  maximumAdvanceDays: number;
  maximumPartySize: number;
  slotCapacity: number;
  largeGroupPhone: string;
  customerMessage: string;
  policyText: string;
  initialStatus: "pending" | "confirmed";
  depositEnabled: boolean; depositPerGuestCents: number;
  depositMinimumPartySize: number; gracePeriodMinutes: number;
  paymentTimeoutMinutes: number; refundDeadlineHours: number;
  allowFullRefund: boolean; allowPartialRefund: boolean;
  cancellationPolicy: string; noShowPolicy: string; gracePolicy: string;
  policyVersion: string; cardEnabled: boolean; bizumEnabled: boolean;
  cashEnabled: boolean; manualDepositRequired: boolean;
  confirmOnlyAfterPayment: boolean;
};

export const DEFAULT_RESERVATION_SETTINGS: ReservationSettingsData = {
  isEnabled: false,
  durationMinutes: 90,
  slotIntervalMinutes: 30,
  minimumAdvanceMinutes: 120,
  maximumAdvanceDays: 30,
  maximumPartySize: 8,
  slotCapacity: 20,
  largeGroupPhone: "",
  customerMessage: "",
  policyText: "",
  initialStatus: "pending",
  depositEnabled:false,depositPerGuestCents:0,depositMinimumPartySize:1,
  gracePeriodMinutes:15,paymentTimeoutMinutes:15,refundDeadlineHours:24,
  allowFullRefund:true,allowPartialRefund:false,cancellationPolicy:"",
  noShowPolicy:"",gracePolicy:"",policyVersion:"1",cardEnabled:false,
  bizumEnabled:false,cashEnabled:true,manualDepositRequired:false,
  confirmOnlyAfterPayment:true,
};

export type ReservationSlot = {
  time: string;
  occupied: number;
  remaining: number;
};

const statusTransitions: Record<ReservationStatus, ReservationStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["seated", "cancelled", "no_show"],
  seated: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  no_show: [],
};

export function canTransitionReservation(
  from: ReservationStatus,
  to: ReservationStatus,
) {
  return statusTransitions[from].includes(to);
}

export function isReservationStatus(value: string): value is ReservationStatus {
  return RESERVATION_STATUSES.includes(value as ReservationStatus);
}

export function consumesCapacity(status: ReservationStatus) {
  return status === "pending" || status === "confirmed" || status === "seated";
}

export function isReservationSettingsReady(
  settings: ReservationSettingsData | null,
) {
  return Boolean(
    settings?.isEnabled &&
      settings.policyText.trim() &&
      settings.maximumPartySize > 0 &&
      settings.slotCapacity > 0,
  );
}

export function minutesToTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
    minutes % 60,
  ).padStart(2, "0")}`;
}

export function timeToMinutes(value: string) {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function getLocalDateTime(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  };
}

export function shiftReservationDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function zonedLocalDateTimeToUtc(
  date: string,
  time: string,
  timeZone: string,
) {
  const desired = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(desired)) return null;
  let candidate = desired;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const observed = getLocalDateTime(new Date(candidate), timeZone);
    const observedValue = Date.parse(`${observed.date}T${observed.time}:00Z`);
    candidate += desired - observedValue;
  }
  const roundTrip = getLocalDateTime(new Date(candidate), timeZone);
  return roundTrip.date === date && roundTrip.time === time
    ? new Date(candidate)
    : null;
}

export function getReservableDateRange(
  now: Date,
  timeZone: string,
  maximumAdvanceDays: number,
) {
  const today = getLocalDateTime(now, timeZone).date;
  return {
    minDate: today,
    maxDate: shiftReservationDate(today, maximumAdvanceDays),
  };
}

export function generateReservationSlots({
  date,
  intervals,
  durationMinutes,
  intervalMinutes,
  partySize,
  slotCapacity,
  occupancy,
  now,
  timeZone,
  minimumAdvanceMinutes,
}: {
  date: string;
  intervals: LocalOpeningInterval[];
  durationMinutes: number;
  intervalMinutes: 15 | 30 | 60;
  partySize: number;
  slotCapacity: number;
  occupancy: Record<string, number>;
  now: Date;
  timeZone: string;
  minimumAdvanceMinutes: number;
}) {
  return intervals.flatMap((interval) => {
    const slots: ReservationSlot[] = [];
    for (
      let start = interval.startMinutes;
      start + durationMinutes <= interval.endMinutes;
      start += intervalMinutes
    ) {
      const time = minutesToTime(start);
      const occupied = occupancy[time] ?? 0;
      const remaining = Math.max(0, slotCapacity - occupied);
      const slotInstant = zonedLocalDateTimeToUtc(date, time, timeZone);
      if (!slotInstant) continue;
      const minutesFromNow =
        (slotInstant.getTime() - now.getTime()) / 60_000;
      if (
        minutesFromNow >= minimumAdvanceMinutes &&
        partySize <= remaining
      ) {
        slots.push({ time, occupied, remaining });
      }
    }
    return slots;
  });
}

export function normalizeGuestName(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (
    normalized.length < 2 ||
    normalized.length > 160 ||
    /[<>\u0000-\u001f]/.test(normalized)
  ) {
    throw new Error("El nombre no es válido.");
  }
  return normalized;
}

export function normalizePhone(value: string) {
  const normalized = value.trim().replace(/[^\d+]/g, "");
  if (!/^\+?\d{7,15}$/.test(normalized)) {
    throw new Error("El teléfono no es válido.");
  }
  return normalized;
}

export function normalizeEmail(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (
    normalized.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    throw new Error("El correo electrónico no es válido.");
  }
  return normalized;
}

export function normalizeOptionalText(value: string, maxLength: number) {
  const normalized = value.trim();
  if (
    normalized.length > maxLength ||
    /[<>\u0000-\u001f]/.test(normalized)
  ) {
    throw new Error("El texto contiene caracteres no permitidos.");
  }
  return normalized || null;
}

export function isValidReservationIdempotencyKey(value: string) {
  return /^[a-f0-9-]{20,64}$/i.test(value);
}

const locatorAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateReservationLocator(
  bytes: Uint8Array = randomBytes(10),
) {
  return Array.from(bytes, (byte) =>
    locatorAlphabet.charAt(byte % locatorAlphabet.length),
  )
    .join("")
    .slice(0, 10);
}
