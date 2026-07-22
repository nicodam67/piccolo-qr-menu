"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  buildCalendarDays,
  shiftCalendarMonth,
} from "../utils";
import type { SpecialHoursRecord } from "../repository";

type Props = {
  month: string;
  records: SpecialHoursRecord[];
  onMonthChange: (month: string) => void;
  onSelect: (record: SpecialHoursRecord) => void;
};

const weekdays = ["L", "M", "X", "J", "V", "S", "D"];

export function SpecialHoursCalendar({
  month,
  records,
  onMonthChange,
  onSelect,
}: Props) {
  const days = buildCalendarDays(month, records);
  const monthLabel = new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));

  return (
    <section
      aria-label={`Calendario de ${monthLabel}`}
      className="rounded-2xl border border-stone-200 bg-white p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          aria-label="Mes anterior"
          onClick={() => onMonthChange(shiftCalendarMonth(month, -1))}
          className="grid size-11 place-items-center rounded-xl hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-[#173f35]"
        >
          <ChevronLeft className="size-5" />
        </button>
        <h2 className="font-display text-xl capitalize text-[#173f35]">
          {monthLabel}
        </h2>
        <button
          type="button"
          aria-label="Mes siguiente"
          onClick={() => onMonthChange(shiftCalendarMonth(month, 1))}
          className="grid size-11 place-items-center rounded-xl hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-[#173f35]"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center">
        {weekdays.map((weekday) => (
          <span
            key={weekday}
            className="py-1 text-[10px] font-bold text-stone-400"
          >
            {weekday}
          </span>
        ))}
        {days.map((day) => {
          const tone =
            day.record?.exceptionType === "closed"
              ? "bg-red-100 text-red-800"
              : day.record?.exceptionType === "open"
                ? "bg-emerald-100 text-emerald-800"
                : day.record
                  ? "bg-amber-100 text-amber-800"
                  : "text-stone-600 hover:bg-stone-100";
          return (
            <button
              key={day.date}
              type="button"
              disabled={!day.inMonth}
              aria-label={
                day.record
                  ? `${day.date}: ${day.record.exceptionType}`
                  : day.date
              }
              onClick={() => day.record && onSelect(day.record)}
              className={`aspect-square min-h-11 rounded-lg text-xs font-bold focus-visible:outline-2 focus-visible:outline-[#173f35] disabled:opacity-20 ${tone}`}
            >
              {day.day}
              {day.record ? (
                <span className="mx-auto mt-0.5 block size-1.5 rounded-full bg-current" />
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-semibold text-stone-500">
        <span>● Cerrado</span>
        <span>● Apertura extraordinaria</span>
        <span>● Horario especial</span>
      </div>
    </section>
  );
}
