import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getRestaurantOpenStatus } from "../../src/features/public-menu/schedule";
import type {
  DayKey,
  OpeningDay,
  OpeningPeriod,
} from "../../src/features/public-menu/types";

const dayKeys: DayKey[] = [
  "monday", "tuesday", "wednesday", "thursday",
  "friday", "saturday", "sunday",
];

function schedule(
  overrides: Partial<Record<DayKey, OpeningPeriod[]>>,
): OpeningDay[] {
  return dayKeys.map((day) => ({
    day,
    label: day,
    periods: overrides[day] ?? [],
  }));
}

const status = (
  iso: string,
  weeklySchedule: OpeningDay[],
  timeZone = "UTC",
) =>
  getRestaurantOpenStatus({
    now: new Date(iso),
    timeZone,
    weeklySchedule,
  });

describe("getRestaurantOpenStatus", () => {
  it("detecta un día completamente cerrado", () => {
    const result = status(
      "2026-01-05T12:00:00Z",
      schedule({ tuesday: [{ opensAt: "12:00", closesAt: "14:00" }] }),
    );
    assert.equal(result.state, "closedToday");
  });

  it("encuentra la apertura antes del primer turno", () => {
    const result = status(
      "2026-01-05T10:00:00Z",
      schedule({ monday: [{ opensAt: "12:00", closesAt: "14:00" }] }),
    );
    assert.equal(result.nextOpening?.opensAt, "12:00");
  });

  it("detecta el interior del primer turno", () => {
    assert.equal(
      status(
        "2026-01-05T12:30:00Z",
        schedule({ monday: [{ opensAt: "12:00", closesAt: "14:00" }] }),
      ).isOpen,
      true,
    );
  });

  it("detecta el intervalo entre dos turnos", () => {
    const result = status(
      "2026-01-05T16:00:00Z",
      schedule({
        monday: [
          { opensAt: "12:00", closesAt: "14:00" },
          { opensAt: "19:00", closesAt: "23:00" },
        ],
      }),
    );
    assert.equal(result.isOpen, false);
    assert.equal(result.nextOpening?.opensAt, "19:00");
  });

  it("detecta el interior del segundo turno", () => {
    assert.equal(
      status(
        "2026-01-05T20:00:00Z",
        schedule({
          monday: [
            { opensAt: "12:00", closesAt: "14:00" },
            { opensAt: "19:00", closesAt: "23:00" },
          ],
        }),
      ).isOpen,
      true,
    );
  });

  it("queda cerrado después del último cierre", () => {
    assert.equal(
      status(
        "2026-01-05T23:30:00Z",
        schedule({ monday: [{ opensAt: "19:00", closesAt: "23:00" }] }),
      ).state,
      "closed",
    );
  });

  it("encuentra una apertura mañana", () => {
    const result = status(
      "2026-01-05T23:30:00Z",
      schedule({ tuesday: [{ opensAt: "12:00", closesAt: "14:00" }] }),
    );
    assert.equal(result.nextOpening?.dayOffset, 1);
  });

  it("encuentra una apertura varios días después", () => {
    const result = status(
      "2026-01-05T18:00:00Z",
      schedule({ thursday: [{ opensAt: "12:00", closesAt: "14:00" }] }),
    );
    assert.equal(result.nextOpening?.dayOffset, 3);
  });

  it("cambia correctamente de domingo a lunes", () => {
    const result = status(
      "2026-01-11T23:00:00Z",
      schedule({ monday: [{ opensAt: "09:00", closesAt: "12:00" }] }),
    );
    assert.equal(result.nextOpening?.day, "monday");
    assert.equal(result.nextOpening?.dayOffset, 1);
  });

  it("devuelve no disponible sin horario configurado", () => {
    assert.equal(
      status("2026-01-05T12:00:00Z", schedule({})).state,
      "unavailable",
    );
  });

  it("usa una zona distinta a la del proceso", () => {
    const result = status(
      "2026-01-05T00:30:00Z",
      schedule({ monday: [{ opensAt: "09:00", closesAt: "11:00" }] }),
      "Asia/Tokyo",
    );
    assert.equal(result.isOpen, true);
  });

  it("respeta el horario de verano de la zona configurada", () => {
    const result = status(
      "2026-07-06T11:30:00Z",
      schedule({ monday: [{ opensAt: "13:00", closesAt: "16:00" }] }),
      "Europe/Madrid",
    );
    assert.equal(result.isOpen, true);
  });

  it("mantiene abierto un turno que cruza medianoche", () => {
    const result = status(
      "2026-01-06T00:15:00Z",
      schedule({ monday: [{ opensAt: "19:00", closesAt: "00:30" }] }),
    );
    assert.equal(result.isOpen, true);
    assert.equal(result.closesAt, "00:30");
  });
});
