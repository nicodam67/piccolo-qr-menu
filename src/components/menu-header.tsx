import Image from "next/image";
import { MapPin, Phone } from "lucide-react";

import type {
  DemoMenu,
  OpeningStatus,
} from "@/features/public-menu/types";
import type { PublishedLocale } from "@/features/locales/repository";
import { getPublicMenuCopy } from "@/features/public-menu/copy";

import { LanguageSelector } from "./language-selector";
import { OpeningHours } from "./opening-hours";

type MenuHeaderProps = {
  menu: DemoMenu;
  openingStatus: OpeningStatus;
  publishedLocales: PublishedLocale[];
};

export function MenuHeader({
  menu,
  openingStatus,
  publishedLocales,
}: MenuHeaderProps) {
  const { restaurant } = menu;
  const copy = getPublicMenuCopy(menu.locale);

  return (
    <header className="bg-[#fffdfa]">
      <div className="relative h-[21.5rem] overflow-hidden bg-[#173f35] sm:h-[25rem]">
        <Image
          src={restaurant.heroImageUrl}
          alt={restaurant.heroImageAlt}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-black/75" />

        <div className="absolute inset-x-0 top-0 mx-auto flex max-w-5xl items-center justify-between px-4 pt-4">
          <span className="rounded-full border border-white/20 bg-black/30 px-2.5 py-1.5 text-[9px] font-bold tracking-[0.14em] text-white uppercase backdrop-blur-md">
            Imagen demo
          </span>
          <LanguageSelector
            locales={publishedLocales}
            currentLocale={menu.locale}
            unavailableMessage={copy.productUnavailableInLanguage}
          />
        </div>

        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-5xl px-5 pb-8 text-center text-white sm:pb-10">
          <p className="mb-3 text-[10px] font-bold tracking-[0.3em] text-amber-100 uppercase">
            Cucina italiana · Demo
          </p>
          <h1 className="font-display mx-auto max-w-xl text-[2.55rem] leading-[0.96] text-balance drop-shadow-sm sm:text-6xl">
            {restaurant.name}
          </h1>
          <p className="mt-3 font-serif text-base italic text-stone-100 sm:text-lg">
            {restaurant.slogan}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl border-b border-stone-200 px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden="true"
              className={`size-2.5 shrink-0 rounded-full ${
                openingStatus.isOpen ? "bg-emerald-500" : "bg-[#a8392f]"
              }`}
            />
            <div className="min-w-0">
              <p
                className={`text-sm font-extrabold ${
                  openingStatus.isOpen
                    ? "text-emerald-700"
                    : "text-[#a8392f]"
                }`}
              >
                {openingStatus.label}
              </p>
              <p className="truncate text-[11px] text-stone-500">
                {openingStatus.detail} · horario demo
              </p>
            </div>
          </div>

          <a
            href={restaurant.phoneHref}
            aria-label={`Llamar al teléfono de demostración ${restaurant.phoneDisplay}`}
            className="flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-[#173f35] px-4 text-xs font-bold text-white transition-colors hover:bg-[#245849] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173f35]"
          >
            <Phone aria-hidden="true" className="size-4" />
            Llamar
          </a>
        </div>

        <div className="mt-3 grid border-y border-stone-200 sm:grid-cols-2">
          <OpeningHours
            openingHours={menu.openingHours}
            status={openingStatus}
          />

          <div className="flex min-h-12 items-center gap-2.5 border-t border-stone-200 py-2 sm:border-t-0 sm:border-l sm:pl-4">
            <MapPin
              aria-hidden="true"
              className="size-4 shrink-0 text-[#a8392f]"
            />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-stone-700">
                {restaurant.address}
              </p>
              <p className="text-[10px] text-stone-400">
                Dirección no oficial · teléfono demo
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
