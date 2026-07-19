import Image from "next/image";
import { MapPin, Phone } from "lucide-react";

import type {
  DemoMenu,
  OpeningStatus,
} from "@/features/public-menu/types";

import { LanguageSelector } from "./language-selector";
import { OpeningHours } from "./opening-hours";

type MenuHeaderProps = {
  menu: DemoMenu;
  openingStatus: OpeningStatus;
};

export function MenuHeader({ menu, openingStatus }: MenuHeaderProps) {
  const { restaurant } = menu;

  return (
    <header>
      <div className="relative h-[25rem] min-h-[400px] overflow-hidden bg-[#173f35] sm:h-[31rem]">
        <Image
          src={restaurant.heroImageUrl}
          alt={restaurant.heroImageAlt}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-black/80" />

        <div className="absolute inset-x-0 top-0 mx-auto flex max-w-5xl items-center justify-between px-4 pt-4">
          <span className="rounded-full border border-amber-200/35 bg-[#7d2f27]/90 px-3 py-2 text-[10px] font-bold tracking-[0.12em] text-white uppercase shadow-sm backdrop-blur-md">
            Imagen demo
          </span>
          <LanguageSelector />
        </div>

        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-5xl px-4 pb-24 text-white sm:pb-28">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-amber-100 uppercase">
            <span className="h-px w-7 bg-[#d7ae6a]" />
            Pizzeria · Ristorante
          </p>
          <h1 className="font-display max-w-lg text-[2.65rem] leading-[0.96] text-balance sm:text-6xl">
            {restaurant.name}
          </h1>
          <p className="mt-3 text-base text-stone-100">{restaurant.slogan}</p>
        </div>
      </div>

      <div className="relative z-10 mx-auto -mt-20 max-w-5xl px-3 sm:px-6">
        <div className="rounded-[1.75rem] border border-white/70 bg-white/95 p-5 shadow-[0_20px_60px_-30px_rgba(23,63,53,0.45)] backdrop-blur-md sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`size-2.5 rounded-full ${
                    openingStatus.isOpen
                      ? "bg-emerald-500 shadow-[0_0_0_4px_rgb(16_185_129/0.13)]"
                      : "bg-[#a8392f] shadow-[0_0_0_4px_rgb(168_57_47/0.12)]"
                  }`}
                />
                <p
                  className={`text-sm font-extrabold ${
                    openingStatus.isOpen
                      ? "text-emerald-700"
                      : "text-[#a8392f]"
                  }`}
                >
                  {openingStatus.label}
                </p>
              </div>
              <p className="mt-1 pl-[18px] text-xs text-stone-500">
                Calculado con horario demo
              </p>
            </div>

            <a
              href={restaurant.phoneHref}
              aria-label={`Llamar al teléfono de demostración ${restaurant.phoneDisplay}`}
              className="grid min-h-12 min-w-12 place-items-center rounded-full bg-[#173f35] text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173f35] active:scale-95"
            >
              <Phone aria-hidden="true" className="size-5" />
            </a>
          </div>

          <div className="my-4 flex gap-3 border-t border-stone-200/80 pt-4">
            <MapPin
              aria-hidden="true"
              className="mt-0.5 size-[18px] shrink-0 text-[#a8392f]"
            />
            <div>
              <p className="text-sm font-semibold text-stone-800">
                {restaurant.address}
              </p>
              <p className="mt-1 text-xs leading-5 text-stone-500">
                Esta dirección no es oficial y se muestra solo para revisar el
                diseño.
              </p>
            </div>
          </div>

          <OpeningHours
            openingHours={menu.openingHours}
            status={openingStatus}
          />
        </div>
      </div>
    </header>
  );
}
