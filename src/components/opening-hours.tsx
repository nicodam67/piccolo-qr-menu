"use client";

import { useEffect, useRef, useState } from "react";
import { Clock3, X } from "lucide-react";
import type { OpeningDay, OpeningStatus } from "@/features/public-menu/types";
import {
  formatOpeningStatus,
  getScheduleCopy,
} from "@/features/public-menu/schedule-copy";

type OpeningHoursProps = {
  openingHours: OpeningDay[];
  status: OpeningStatus;
  locale: string;
  timeZone: string;
};

export function OpeningHours({
  openingHours,
  status,
  locale,
  timeZone,
}: OpeningHoursProps) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const copy = getScheduleCopy(locale);
  const formattedStatus = formatOpeningStatus(status, copy);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#173f35] focus-visible:ring-inset"
      >
        <span className="flex items-center gap-2.5">
          <Clock3 aria-hidden="true" className="size-4 text-[#173f35]" />
          <span>
            <span className="block text-xs font-bold text-stone-700">
              {copy.hours}
            </span>
            <span className="block text-[10px] text-stone-400">
              {formattedStatus.detail || formattedStatus.label}
            </span>
          </span>
        </span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[90] grid place-items-end bg-black/45 p-0 backdrop-blur-[2px] sm:place-items-center sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="opening-hours-title"
            className="max-h-[90vh] w-full overflow-y-auto rounded-t-[1.75rem] bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-[1.75rem]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="opening-hours-title" className="font-display text-2xl text-[#173f35]">
                  {copy.hours}
                </h2>
                <p className="mt-1 text-sm font-bold text-stone-600">
                  {formattedStatus.label}
                </p>
                {formattedStatus.detail ? (
                  <p className="mt-1 text-xs text-stone-500">{formattedStatus.detail}</p>
                ) : null}
                <p className="mt-1 text-[10px] text-stone-400">{timeZone}</p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label={copy.close}
                className="grid size-11 place-items-center rounded-full bg-stone-100 focus-visible:outline-2 focus-visible:outline-[#173f35]"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
            <dl className="mt-5 divide-y divide-stone-100">
              {openingHours.map((day) => {
                const isToday = status.currentDay === day.day;
                return (
                  <div
                    key={day.day}
                    aria-current={isToday ? "date" : undefined}
                    className={`grid grid-cols-[6rem_1fr] gap-3 py-3 text-xs ${
                      isToday ? "rounded-xl bg-emerald-50 px-3" : ""
                    }`}
                  >
                    <dt className="font-bold text-[#173f35]">
                      {copy.days[day.day]}
                      {isToday ? ` · ${copy.today}` : ""}
                    </dt>
                    <dd className="space-y-1 text-right tabular-nums text-stone-500">
                      {day.periods.length === 0 ? (
                        <span>{copy.closed}</span>
                      ) : (
                        day.periods.map((period, index) => (
                          <span key={`${period.opensAt}-${period.closesAt}`} className="block">
                            {index === 0 ? copy.firstShift : copy.secondShift}:{" "}
                            {period.opensAt}–{period.closesAt}
                          </span>
                        ))
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        </div>
      ) : null}
    </>
  );
}
