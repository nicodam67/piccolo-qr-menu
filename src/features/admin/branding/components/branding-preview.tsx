"use client";

import { Clock3, MapPin, Phone } from "lucide-react";

import type { BrandingOpeningDay } from "../repository";

type BrandingPreviewProps = {
  name: string;
  slogan: string;
  description: string;
  address: string;
  phone: string;
  heroImageUrl: string;
  openingHours: BrandingOpeningDay[];
};

export function BrandingPreview({
  name,
  slogan,
  description,
  address,
  phone,
  heroImageUrl,
  openingHours,
}: BrandingPreviewProps) {
  const firstOpenDay = openingHours.find((day) => !day.isClosed);

  return (
    <aside className="lg:sticky lg:top-24">
      <p className="mb-3 text-[10px] font-extrabold tracking-[0.16em] text-[#a8392f] uppercase">
        Vista previa en tiempo real
      </p>
      <div className="overflow-hidden rounded-[1.75rem] border border-stone-200 bg-[#fffdfa] shadow-[0_24px_70px_-45px_rgba(23,63,53,0.65)]">
        <div
          className="relative flex min-h-64 items-end bg-[#173f35] bg-cover bg-center p-5 text-white"
          style={{
            backgroundImage: `linear-gradient(to bottom, transparent, rgba(0,0,0,.75)), url("${heroImageUrl}")`,
          }}
        >
          <div>
            <p className="text-[9px] font-bold tracking-[0.22em] text-amber-100 uppercase">
              Cucina italiana
            </p>
            <h2 className="font-display mt-2 text-3xl leading-none">
              {name || "Nombre del restaurante"}
            </h2>
            <p className="mt-2 font-serif text-sm italic text-stone-100">
              {slogan || "Eslogan del restaurante"}
            </p>
          </div>
        </div>

        <div className="space-y-3 px-5 py-4">
          {description ? (
            <p className="text-xs leading-5 text-stone-500">{description}</p>
          ) : null}
          <div className="flex items-start gap-2 border-t border-stone-100 pt-3 text-xs text-stone-600">
            <MapPin
              aria-hidden="true"
              className="mt-0.5 size-3.5 shrink-0 text-[#a8392f]"
            />
            <span>{address || "Dirección"}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-stone-600">
            <Phone
              aria-hidden="true"
              className="size-3.5 shrink-0 text-[#173f35]"
            />
            <span>{phone || "Teléfono"}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-stone-600">
            <Clock3
              aria-hidden="true"
              className="size-3.5 shrink-0 text-[#173f35]"
            />
            <span>
              {firstOpenDay
                ? `${firstOpenDay.label}: ${firstOpenDay.firstOpensAt}–${firstOpenDay.firstClosesAt}`
                : "Sin horario disponible"}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
