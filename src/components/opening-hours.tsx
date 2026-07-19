import { ChevronDown, Clock3 } from "lucide-react";

import type { OpeningDay, OpeningStatus } from "@/features/public-menu/types";
import { formatOpeningPeriods } from "@/features/public-menu/utils";

type OpeningHoursProps = {
  openingHours: OpeningDay[];
  status: OpeningStatus;
};

export function OpeningHours({
  openingHours,
}: OpeningHoursProps) {
  return (
    <details className="group">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-[#173f35] focus-visible:ring-inset">
        <span className="flex items-center gap-2.5">
          <Clock3
            aria-hidden="true"
            className="size-4 shrink-0 text-[#173f35]"
          />
          <span>
            <span className="block text-xs font-bold text-stone-700">
              Horario de demostración
            </span>
            <span className="block text-[10px] text-stone-400">
              Ver semana · Europe/Madrid
            </span>
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className="mr-1 size-4 shrink-0 text-stone-400 transition-transform group-open:rotate-180"
        />
      </summary>

      <div className="border-t border-stone-200 bg-[#faf7f1] px-3 py-3">
        <p className="mb-2.5 text-[9px] font-bold tracking-[0.16em] text-[#a8392f] uppercase">
          Horario no oficial · solo prototipo
        </p>
        <dl className="space-y-1.5">
          {openingHours.map((openingDay) => (
            <div
              key={openingDay.day}
              className="flex justify-between gap-3 text-[11px]"
            >
              <dt className="font-medium text-stone-700">{openingDay.label}</dt>
              <dd className="text-right tabular-nums text-stone-500">
                {formatOpeningPeriods(openingDay.periods)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
  );
}
