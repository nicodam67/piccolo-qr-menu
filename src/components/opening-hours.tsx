import { ChevronDown, Clock3 } from "lucide-react";

import type { OpeningDay, OpeningStatus } from "@/features/public-menu/types";
import { formatOpeningPeriods } from "@/features/public-menu/utils";

type OpeningHoursProps = {
  openingHours: OpeningDay[];
  status: OpeningStatus;
};

export function OpeningHours({
  openingHours,
  status,
}: OpeningHoursProps) {
  return (
    <details className="group border-t border-stone-200/80 pt-4">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#173f35] focus-visible:ring-offset-2">
        <span className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#eef3ef] text-[#173f35]">
            <Clock3 aria-hidden="true" className="size-[18px]" />
          </span>
          <span>
            <span className="block text-sm font-bold text-stone-800">
              Horario de demostración
            </span>
            <span className="block text-xs text-stone-500">
              {status.detail} · Europe/Madrid
            </span>
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className="size-5 shrink-0 text-stone-400 transition-transform group-open:rotate-180"
        />
      </summary>

      <div className="mt-4 rounded-2xl bg-[#f7f3eb] p-4">
        <p className="mb-3 text-[11px] font-bold tracking-[0.16em] text-[#a8392f] uppercase">
          Horario no oficial · solo prototipo
        </p>
        <dl className="space-y-2.5">
          {openingHours.map((openingDay) => (
            <div
              key={openingDay.day}
              className="flex justify-between gap-4 text-sm"
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
