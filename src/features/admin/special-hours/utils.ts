export const SPECIAL_HOURS_TYPES = ["open", "closed", "special"] as const;
export type SpecialHoursType = (typeof SPECIAL_HOURS_TYPES)[number];

export function isSpecialHoursType(value: string): value is SpecialHoursType {
  return SPECIAL_HOURS_TYPES.includes(value as SpecialHoursType);
}

export function getMonthBounds(month: string) {
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month)) {
    throw new Error("El mes seleccionado no es válido.");
  }
  const [year, monthNumber] = month.split("-").map(Number);
  const from = `${month}-01`;
  const untilDate = new Date(Date.UTC(year, monthNumber, 0));
  return {
    month,
    from,
    until: untilDate.toISOString().slice(0, 10),
  };
}

export function shiftCalendarMonth(month: string, offset: number) {
  const { from } = getMonthBounds(month);
  const date = new Date(`${from}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

export function getNextAvailableDuplicateDate(
  date: string,
  occupiedDates: string[],
) {
  const candidate = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(candidate.getTime())) {
    throw new Error("La fecha no es válida.");
  }
  const occupied = new Set(occupiedDates);
  do {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  } while (occupied.has(candidate.toISOString().slice(0, 10)));
  return candidate.toISOString().slice(0, 10);
}

export function buildCalendarDays<T extends { date: string }>(
  month: string,
  records: T[],
) {
  const { from } = getMonthBounds(month);
  const first = new Date(`${from}T00:00:00Z`);
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const start = new Date(first);
  start.setUTCDate(start.getUTCDate() - mondayOffset);
  const byDate = new Map(records.map((record) => [record.date, record]));

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const isoDate = date.toISOString().slice(0, 10);
    return {
      date: isoDate,
      day: date.getUTCDate(),
      inMonth: isoDate.startsWith(month),
      record: byDate.get(isoDate) ?? null,
    };
  });
}

export function filterSpecialHoursByDate<T extends { date: string }>(
  records: T[],
  date: string,
) {
  return date ? records.filter((record) => record.date === date) : records;
}
