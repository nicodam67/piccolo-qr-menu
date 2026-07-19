import type {
  DemoProduct,
  OpeningDay,
  OpeningPeriod,
  OpeningStatus,
} from "./types";

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
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function getZonedTime(date: Date, targetTimeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: targetTimeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    dayIndex: weekdayIndexes[values.weekday] ?? 0,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  };
}

function findOpenPeriod(
  minutes: number,
  currentDay: OpeningDay,
  previousDay: OpeningDay,
): OpeningPeriod | undefined {
  const currentPeriod = currentDay.periods.find((period) => {
    const opensAt = timeToMinutes(period.opensAt);
    const closesAt = timeToMinutes(period.closesAt);

    if (closesAt <= opensAt) {
      return minutes >= opensAt;
    }

    return minutes >= opensAt && minutes < closesAt;
  });

  if (currentPeriod) {
    return currentPeriod;
  }

  return previousDay.periods.find((period) => {
    const opensAt = timeToMinutes(period.opensAt);
    const closesAt = timeToMinutes(period.closesAt);
    return closesAt <= opensAt && minutes < closesAt;
  });
}

export function getOpeningStatus(
  date: Date,
  openingHours: OpeningDay[],
  targetTimeZone: string,
): OpeningStatus {
  const { dayIndex, minutes } = getZonedTime(date, targetTimeZone);
  const currentDay = openingHours[dayIndex];
  const previousDay = openingHours[(dayIndex + 6) % 7];

  if (!currentDay || !previousDay) {
    return {
      isOpen: false,
      label: "Horario no disponible",
      detail: "Horario de demostración",
    };
  }

  const openPeriod = findOpenPeriod(minutes, currentDay, previousDay);

  if (openPeriod) {
    return {
      isOpen: true,
      label: "Abierto ahora",
      detail: `Hasta las ${openPeriod.closesAt}`,
    };
  }

  return {
    isOpen: false,
    label: "Cerrado ahora",
    detail: "Consulta el horario demo",
  };
}

export function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .trim();
}

export function filterProducts(products: DemoProduct[], query: string) {
  const normalizedQuery = normalizeSearchValue(query);

  if (!normalizedQuery) {
    return products;
  }

  return products.filter((product) => {
    const searchableText = [
      product.name,
      product.description,
      ...product.tags.map((tag) => tag.label),
      ...product.allergens,
    ].join(" ");

    return normalizeSearchValue(searchableText).includes(normalizedQuery);
  });
}

export function formatDemoPrice(price: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(price);
}

export function formatOpeningPeriods(periods: OpeningPeriod[]) {
  if (periods.length === 0) {
    return "Cerrado";
  }

  return periods
    .map((period) => `${period.opensAt}–${period.closesAt}`)
    .join(" · ");
}
