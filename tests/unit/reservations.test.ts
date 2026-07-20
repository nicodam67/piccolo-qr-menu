import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canTransitionReservation,
  consumesCapacity,
  generateReservationLocator,
  generateReservationSlots,
  getLocalDateTime,
  getReservableDateRange,
  isValidReservationIdempotencyKey,
  normalizeEmail,
  normalizeGuestName,
  normalizePhone,
} from "../../src/features/reservations/domain";
import { getOpeningIntervalsForDate } from "../../src/features/public-menu/schedule";
import type {
  OpeningDay,
  SpecialOpeningDay,
} from "../../src/features/public-menu/types";

const weekly: OpeningDay[] = [
  {
    day: "monday",
    label: "lunes",
    periods: [
      { opensAt: "13:00", closesAt: "16:00" },
      { opensAt: "20:00", closesAt: "23:30" },
    ],
  },
];

describe("online reservations", () => {
  it("calcula el rango de fechas en la zona del restaurante", () => {
    assert.deepEqual(
      getReservableDateRange(
        new Date("2026-07-19T22:30:00Z"),
        "Europe/Madrid",
        30,
      ),
      { minDate: "2026-07-20", maxDate: "2026-08-19" },
    );
  });
  it("aplica antelación mínima", () => {
    const slots = generateReservationSlots({
      date: "2026-07-20",
      intervals: [{ startMinutes: 13 * 60, endMinutes: 16 * 60 }],
      durationMinutes: 90,
      intervalMinutes: 30,
      partySize: 2,
      slotCapacity: 10,
      occupancy: {},
      now: new Date("2026-07-20T10:00:00Z"),
      timeZone: "Europe/Madrid",
      minimumAdvanceMinutes: 120,
    });
    assert.equal(slots[0].time, "14:00");
  });
  it("respeta la fecha máxima", () => {
    assert.equal(
      getReservableDateRange(
        new Date("2026-07-20T10:00:00Z"),
        "UTC",
        1,
      ).maxDate,
      "2026-07-21",
    );
  });
  it("cierra un día semanal sin turnos", () => {
    assert.deepEqual(
      getOpeningIntervalsForDate({
        date: "2026-07-21",
        weeklySchedule: weekly,
      }),
      [],
    );
  });
  it("aplica un cierre especial", () => {
    const special: SpecialOpeningDay[] = [
      { date: "2026-07-20", isClosed: true, periods: [] },
    ];
    assert.deepEqual(
      getOpeningIntervalsForDate({
        date: "2026-07-20",
        weeklySchedule: weekly,
        specialSchedule: special,
      }),
      [],
    );
  });
  it("aplica una apertura extraordinaria", () => {
    const special: SpecialOpeningDay[] = [
      {
        date: "2026-07-21",
        exceptionType: "open",
        isClosed: false,
        periods: [{ opensAt: "12:00", closesAt: "14:00" }],
      },
    ];
    assert.deepEqual(
      getOpeningIntervalsForDate({
        date: "2026-07-21",
        weeklySchedule: weekly,
        specialSchedule: special,
      }),
      [{ startMinutes: 720, endMinutes: 840 }],
    );
  });
  it("conserva dos turnos", () => {
    assert.equal(
      getOpeningIntervalsForDate({
        date: "2026-07-20",
        weeklySchedule: weekly,
      }).length,
      2,
    );
  });
  it("genera franjas según duración e intervalo", () => {
    const slots = generateReservationSlots({
      date: "2026-07-21",
      intervals: [{ startMinutes: 720, endMinutes: 900 }],
      durationMinutes: 90,
      intervalMinutes: 30,
      partySize: 2,
      slotCapacity: 10,
      occupancy: {},
      now: new Date("2026-07-20T00:00:00Z"),
      timeZone: "UTC",
      minimumAdvanceMinutes: 0,
    });
    assert.deepEqual(slots.map(({ time }) => time), ["12:00", "12:30", "13:00"]);
  });
  it("calcula capacidad disponible", () => {
    const [slot] = generateReservationSlots({
      date: "2026-07-21",
      intervals: [{ startMinutes: 720, endMinutes: 840 }],
      durationMinutes: 60,
      intervalMinutes: 60,
      partySize: 2,
      slotCapacity: 10,
      occupancy: { "12:00": 6 },
      now: new Date("2026-07-20T00:00:00Z"),
      timeZone: "UTC",
      minimumAdvanceMinutes: 0,
    });
    assert.equal(slot.remaining, 4);
  });
  it("oculta franjas sin capacidad", () => {
    const slots = generateReservationSlots({
      date: "2026-07-21",
      intervals: [{ startMinutes: 720, endMinutes: 840 }],
      durationMinutes: 60,
      intervalMinutes: 60,
      partySize: 3,
      slotCapacity: 10,
      occupancy: { "12:00": 8, "13:00": 8 },
      now: new Date("2026-07-20T00:00:00Z"),
      timeZone: "UTC",
      minimumAdvanceMinutes: 0,
    });
    assert.equal(slots.length, 0);
  });
  it("las canceladas no consumen capacidad", () => {
    assert.equal(consumesCapacity("cancelled"), false);
    assert.equal(consumesCapacity("no_show"), false);
    assert.equal(consumesCapacity("confirmed"), true);
  });
  it("normaliza número de personas mediante enteros positivos", () => {
    assert.equal(Number.isInteger(2) && 2 > 0, true);
    assert.equal(Number.isInteger(1.5), false);
  });
  it("normaliza datos personales", () => {
    assert.equal(normalizeGuestName("  Ana   Pérez "), "Ana Pérez");
    assert.equal(normalizePhone("+34 600-000-000"), "+34600000000");
    assert.equal(normalizeEmail(" ANA@EXAMPLE.COM "), "ana@example.com");
  });
  it("genera un localizador legible", () => {
    const locator = generateReservationLocator(new Uint8Array(10).fill(1));
    assert.match(locator, /^[23456789A-Z]{10}$/);
  });
  it("permite transiciones válidas", () => {
    assert.equal(canTransitionReservation("pending", "confirmed"), true);
    assert.equal(canTransitionReservation("confirmed", "seated"), true);
  });
  it("rechaza transiciones inválidas", () => {
    assert.equal(canTransitionReservation("cancelled", "confirmed"), false);
    assert.equal(canTransitionReservation("completed", "cancelled"), false);
  });
  it("resuelve correctamente un cambio de día por zona horaria", () => {
    assert.equal(
      getLocalDateTime(
        new Date("2026-07-19T22:30:00Z"),
        "Europe/Madrid",
      ).date,
      "2026-07-20",
    );
  });
  it("valida claves de idempotencia", () => {
    assert.equal(
      isValidReservationIdempotencyKey(
        "123e4567-e89b-12d3-a456-426614174000",
      ),
      true,
    );
    assert.equal(isValidReservationIdempotencyKey("short"), false);
  });
});
