import "server-only";

import { and, asc, eq, gte, lte, ne } from "drizzle-orm";

import { getDatabase } from "@/db";
import { restaurantSettings, specialOpeningHours } from "@/db/schema";
import {
  getMonthBounds,
  type SpecialHoursType,
} from "./utils";

export type SpecialHoursRecord = {
  id: string;
  date: string;
  exceptionType: SpecialHoursType;
  isClosed: boolean;
  reason: string;
  firstOpensAt: string;
  firstClosesAt: string;
  secondOpensAt: string;
  secondClosesAt: string;
};

export type SpecialHoursInput = Omit<SpecialHoursRecord, "id">;

const normalizeTime = (value: string | null) => value?.slice(0, 5) ?? "";

export async function getSpecialHoursData(month?: string) {
  const { db } = getDatabase();
  const [restaurant] = await db
    .select({ id: restaurantSettings.id, timezone: restaurantSettings.timezone })
    .from(restaurantSettings)
    .limit(1);
  if (!restaurant) throw new Error("No existe un restaurante configurado.");

  const monthParts = new Intl.DateTimeFormat("en", {
    timeZone: restaurant.timezone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const currentMonth = `${monthParts.find(({ type }) => type === "year")?.value}-${
    monthParts.find(({ type }) => type === "month")?.value
  }`;
  const bounds = getMonthBounds(month ?? currentMonth);
  const rows = await db
    .select()
    .from(specialOpeningHours)
    .where(
      and(
        eq(specialOpeningHours.restaurantId, restaurant.id),
        gte(specialOpeningHours.exceptionDate, bounds.from),
        lte(specialOpeningHours.exceptionDate, bounds.until),
      ),
    )
    .orderBy(asc(specialOpeningHours.exceptionDate));

  return {
    timezone: restaurant.timezone,
    month: bounds.month,
    records: rows.map((row) => ({
      id: row.id,
      date: row.exceptionDate,
      exceptionType: row.exceptionType as SpecialHoursType,
      isClosed: row.isClosed,
      reason: row.reason ?? "",
      firstOpensAt: normalizeTime(row.firstOpensAt),
      firstClosesAt: normalizeTime(row.firstClosesAt),
      secondOpensAt: normalizeTime(row.secondOpensAt),
      secondClosesAt: normalizeTime(row.secondClosesAt),
    })),
  };
}

export async function createSpecialHours(input: SpecialHoursInput) {
  const { db } = getDatabase();
  const [restaurant] = await db
    .select({ id: restaurantSettings.id })
    .from(restaurantSettings)
    .limit(1);
  if (!restaurant) throw new Error("No existe un restaurante configurado.");

  const [existing] = await db
    .select({ id: specialOpeningHours.id })
    .from(specialOpeningHours)
    .where(
      and(
        eq(specialOpeningHours.restaurantId, restaurant.id),
        eq(specialOpeningHours.exceptionDate, input.date),
      ),
    )
    .limit(1);
  if (existing) throw new Error("Ya existe una excepción para esa fecha.");

  await db.insert(specialOpeningHours).values({
    restaurantId: restaurant.id,
    exceptionDate: input.date,
    exceptionType: input.exceptionType,
    isClosed: input.isClosed,
    reason: input.reason || null,
    firstOpensAt: input.isClosed ? null : input.firstOpensAt,
    firstClosesAt: input.isClosed ? null : input.firstClosesAt,
    secondOpensAt:
      input.isClosed || !input.secondOpensAt ? null : input.secondOpensAt,
    secondClosesAt:
      input.isClosed || !input.secondClosesAt ? null : input.secondClosesAt,
  });
}

export async function updateSpecialHours(
  id: string,
  input: SpecialHoursInput,
) {
  const { db } = getDatabase();
  const [current] = await db
    .select({ restaurantId: specialOpeningHours.restaurantId })
    .from(specialOpeningHours)
    .where(eq(specialOpeningHours.id, id))
    .limit(1);
  if (!current) throw new Error("La excepción ya no existe.");
  const [existing] = await db
    .select({ id: specialOpeningHours.id })
    .from(specialOpeningHours)
    .where(
      and(
        eq(specialOpeningHours.restaurantId, current.restaurantId),
        eq(specialOpeningHours.exceptionDate, input.date),
        ne(specialOpeningHours.id, id),
      ),
    )
    .limit(1);
  if (existing) throw new Error("Ya existe una excepción para esa fecha.");
  const [updated] = await db
    .update(specialOpeningHours)
    .set({
      exceptionDate: input.date,
      exceptionType: input.exceptionType,
      isClosed: input.isClosed,
      reason: input.reason || null,
      firstOpensAt: input.isClosed ? null : input.firstOpensAt,
      firstClosesAt: input.isClosed ? null : input.firstClosesAt,
      secondOpensAt:
        input.isClosed || !input.secondOpensAt ? null : input.secondOpensAt,
      secondClosesAt:
        input.isClosed || !input.secondClosesAt ? null : input.secondClosesAt,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(specialOpeningHours.id, id),
        eq(specialOpeningHours.restaurantId, current.restaurantId),
      ),
    )
    .returning({ id: specialOpeningHours.id });
  if (!updated) throw new Error("La excepción ya no existe.");
}

export async function deleteSpecialHours(id: string) {
  const { db } = getDatabase();
  const [deleted] = await db
    .delete(specialOpeningHours)
    .where(eq(specialOpeningHours.id, id))
    .returning({ id: specialOpeningHours.id });
  if (!deleted) throw new Error("La excepción ya no existe.");
}
