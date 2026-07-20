import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCalendarDays,
  filterSpecialHoursByDate,
  getMonthBounds,
  getNextAvailableDuplicateDate,
  isSpecialHoursType,
  shiftCalendarMonth,
} from "../../src/features/admin/special-hours/utils";
import {
  formatOpeningStatus,
  getScheduleCopy,
  getSpecialScheduleCopy,
} from "../../src/features/public-menu/schedule-copy";

describe("special hours administration", () => {
  it("calcula los límites de un mes", () => {
    assert.deepEqual(getMonthBounds("2028-02"), {
      month: "2028-02",
      from: "2028-02-01",
      until: "2028-02-29",
    });
  });
  it("rechaza meses no válidos", () => {
    assert.throws(() => getMonthBounds("2028-13"), /no es válido/);
  });
  it("navega entre años", () => {
    assert.equal(shiftCalendarMonth("2026-01", -1), "2025-12");
    assert.equal(shiftCalendarMonth("2026-12", 1), "2027-01");
  });
  it("duplica en la siguiente fecha libre", () => {
    assert.equal(
      getNextAvailableDuplicateDate("2026-07-20", [
        "2026-07-21",
        "2026-07-22",
      ]),
      "2026-07-23",
    );
  });
  it("crea una cuadrícula mensual completa", () => {
    const days = buildCalendarDays("2026-07", []);
    assert.equal(days.length, 42);
    assert.equal(new Date(`${days[0].date}T00:00:00Z`).getUTCDay(), 1);
  });
  it("asocia excepciones con sus días", () => {
    const record = { date: "2026-07-20", exceptionType: "closed" };
    assert.equal(
      buildCalendarDays("2026-07", [record]).find(
        ({ date }) => date === record.date,
      )?.record,
      record,
    );
  });
  it("filtra por una fecha exacta", () => {
    const records = [{ date: "2026-07-20" }, { date: "2026-07-21" }];
    assert.deepEqual(filterSpecialHoursByDate(records, "2026-07-21"), [
      records[1],
    ]);
  });
  it("valida los tres tipos autorizados", () => {
    assert.equal(isSpecialHoursType("open"), true);
    assert.equal(isSpecialHoursType("closed"), true);
    assert.equal(isSpecialHoursType("special"), true);
    assert.equal(isSpecialHoursType("holiday"), false);
  });
  it("muestra Abierto ahora y hora de cierre", () => {
    assert.deepEqual(
      formatOpeningStatus(
        {
          isOpen: true,
          state: "open",
          currentDay: "monday",
          closesAt: "23:30",
        },
        getScheduleCopy("es"),
      ),
      { label: "Abierto ahora", detail: "Cierra a las 23:30" },
    );
  });
  it("muestra cierres por vacaciones", () => {
    assert.deepEqual(
      formatOpeningStatus(
        {
          isOpen: false,
          state: "closedToday",
          currentDay: "monday",
          isSpecial: true,
          reason: "vacaciones",
        },
        getScheduleCopy("es"),
        getSpecialScheduleCopy("es"),
      ),
      { label: "Cerrado por vacaciones", detail: "" },
    );
  });
});
