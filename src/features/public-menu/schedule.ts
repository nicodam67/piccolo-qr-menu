import type {
  DayKey,
  OpeningDay,
  OpeningPeriod,
  OpeningStatus,
  SpecialOpeningDay,
} from "./types";

const dayKeys: DayKey[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];
const weekdayIndexes: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

function timeToMinutes(value: string) {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return null;
  }
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function getZonedTime(now: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    );
    const dayIndex = weekdayIndexes[values.weekday];

    if (dayIndex === undefined) return null;
    return {
      dayIndex,
      minutes: Number(values.hour) * 60 + Number(values.minute),
      localDate: `${values.year}-${values.month}-${values.day}`,
    };
  } catch {
    return null;
  }
}

function shiftDate(value: string, dayOffset: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return date.toISOString().slice(0, 10);
}

function getEffectiveDay(
  localDate: string,
  dayIndex: number,
  weeklySchedule: OpeningDay[],
  specialSchedule: SpecialOpeningDay[],
) {
  const special = specialSchedule.find((item) => item.date === localDate);
  const weekly = weeklySchedule.find((item) => item.day === dayKeys[dayIndex]);
  return {
    periods: special
      ? special.isClosed
        ? []
        : validPeriods(special)
      : validPeriods(weekly),
    special,
  };
}

function validPeriods(day: { periods: OpeningPeriod[] } | undefined) {
  return (day?.periods ?? []).filter(
    (period) =>
      timeToMinutes(period.opensAt) !== null &&
      timeToMinutes(period.closesAt) !== null &&
      period.opensAt !== period.closesAt,
  );
}

function getClosingMinutes(
  period: OpeningPeriod,
  currentMinutes: number,
  fromPreviousDay: boolean,
) {
  const opens = timeToMinutes(period.opensAt) ?? 0;
  const closes = timeToMinutes(period.closesAt) ?? 0;

  if (fromPreviousDay) return closes - currentMinutes;
  return closes <= opens
    ? closes + 1_440 - currentMinutes
    : closes - currentMinutes;
}

export function getRestaurantOpenStatus({
  now,
  timeZone,
  weeklySchedule,
  specialSchedule = [],
  soonThresholdMinutes = 60,
}: {
  now: Date;
  timeZone: string;
  weeklySchedule: OpeningDay[];
  specialSchedule?: SpecialOpeningDay[];
  soonThresholdMinutes?: number;
}): OpeningStatus {
  const zoned = getZonedTime(now, timeZone);

  if (
    !zoned ||
    (weeklySchedule.every((day) => validPeriods(day).length === 0) &&
      specialSchedule.every((day) => validPeriods(day).length === 0))
  ) {
    return {
      isOpen: false,
      state: "unavailable",
      currentDay: zoned ? dayKeys[zoned.dayIndex] : null,
    };
  }

  const currentDay = getEffectiveDay(
    zoned.localDate,
    zoned.dayIndex,
    weeklySchedule,
    specialSchedule,
  );
  const previousIndex = (zoned.dayIndex + 6) % 7;
  const previousDate = shiftDate(zoned.localDate, -1);
  const previousDay = getEffectiveDay(
    previousDate,
    previousIndex,
    weeklySchedule,
    specialSchedule,
  );
  const previousOvernight = previousDay.periods.find((period) => {
    const opens = timeToMinutes(period.opensAt) ?? 0;
    const closes = timeToMinutes(period.closesAt) ?? 0;
    return closes <= opens && zoned.minutes < closes;
  });
  const currentPeriod = currentDay.periods.find((period) => {
    const opens = timeToMinutes(period.opensAt) ?? 0;
    const closes = timeToMinutes(period.closesAt) ?? 0;
    return closes <= opens
      ? zoned.minutes >= opens
      : zoned.minutes >= opens && zoned.minutes < closes;
  });
  const openPeriod = previousOvernight ?? currentPeriod;

  if (openPeriod) {
    const minutesToClose = getClosingMinutes(
      openPeriod,
      zoned.minutes,
      Boolean(previousOvernight),
    );
    return {
      isOpen: true,
      state:
        minutesToClose <= soonThresholdMinutes ? "closingSoon" : "open",
      currentDay: dayKeys[zoned.dayIndex],
      closesAt: openPeriod.closesAt,
      isSpecial: Boolean(
        previousOvernight ? previousDay.special : currentDay.special,
      ),
      reason: (previousOvernight
        ? previousDay.special?.reason
        : currentDay.special?.reason
      )?.trim(),
      specialDate: previousOvernight ? previousDate : zoned.localDate,
    };
  }

  let nextOpening: OpeningStatus["nextOpening"];
  let minutesUntilOpening = Number.POSITIVE_INFINITY;

  for (let dayOffset = 0; dayOffset <= 7; dayOffset += 1) {
    const dayIndex = (zoned.dayIndex + dayOffset) % 7;
    const candidateDate = shiftDate(zoned.localDate, dayOffset);
    const day = getEffectiveDay(
      candidateDate,
      dayIndex,
      weeklySchedule,
      specialSchedule,
    );
    const candidate = day.periods
      .map((period) => ({
        period,
        minutes: timeToMinutes(period.opensAt) ?? 0,
      }))
      .filter(({ minutes }) => dayOffset > 0 || minutes > zoned.minutes)
      .sort((left, right) => left.minutes - right.minutes)[0];

    if (candidate) {
      nextOpening = {
        day: dayKeys[dayIndex],
        dayOffset,
        opensAt: candidate.period.opensAt,
      };
      minutesUntilOpening =
        dayOffset * 1_440 + candidate.minutes - zoned.minutes;
      break;
    }
  }

  const closedToday = currentDay.periods.length === 0;
  const reopensToday =
    nextOpening?.dayOffset === 0 &&
    currentDay.periods.some((period) => {
      const opens = timeToMinutes(period.opensAt) ?? 0;
      const closes = timeToMinutes(period.closesAt) ?? 0;
      return closes > opens && closes <= zoned.minutes;
    });
  return {
    isOpen: false,
    state:
      nextOpening?.dayOffset === 0 &&
      minutesUntilOpening <= soonThresholdMinutes
        ? "openingSoon"
        : closedToday
          ? "closedToday"
          : "closed",
    currentDay: dayKeys[zoned.dayIndex],
    isSpecial: Boolean(currentDay.special),
    reason: currentDay.special?.reason?.trim(),
    specialDate: currentDay.special ? zoned.localDate : undefined,
    reopensToday,
    ...(nextOpening ? { nextOpening } : {}),
  };
}
