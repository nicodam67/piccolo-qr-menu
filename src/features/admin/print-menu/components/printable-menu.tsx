"use client";

import { TaxonomyIcon } from "@/components/taxonomy-icon";
import type { DemoMenu } from "@/features/public-menu/types";
import {
  formatPrintPriceFromCents,
  preparePrintableMenu,
  type PrintMenuSettings,
} from "../print-settings";
import type { PrintMenuCopy } from "../print-copy";

type Props = {
  menu: DemoMenu;
  currencyCode: string;
  settings: PrintMenuSettings;
  qrDataUrl: string | null;
  copy: PrintMenuCopy;
};

export function PrintableMenu({
  menu,
  currencyCode,
  settings,
  qrDataUrl,
  copy,
}: Props) {
  const sections = preparePrintableMenu(menu, settings);
  const allergens = [
    ...new Map(
      sections
        .flatMap((section) => section.products)
        .flatMap((product) => product.allergens)
        .map((allergen) => [allergen.label, allergen]),
    ).values(),
  ];
  const fontClass =
    settings.fontSize === "small"
      ? "text-[11px]"
      : settings.fontSize === "large"
        ? "text-[15px]"
        : "text-[13px]";
  const spacingClass =
    settings.density === "compact" ? "space-y-2" : "space-y-4";

  return (
    <article
      data-print-menu
      data-orientation={settings.orientation}
      className={`mx-auto bg-white p-7 text-stone-900 shadow-xl ${fontClass} ${
        settings.orientation === "landscape"
          ? "aspect-[1.414/1] w-full"
          : "min-h-[297mm] max-w-[210mm]"
      }`}
    >
      <header className="border-b-2 border-[#173f35] pb-5 text-center">
        <h1 className="font-display text-3xl text-[#173f35]">
          {menu.restaurant.name}
        </h1>
        {settings.showSlogan && menu.restaurant.slogan ? (
          <p className="mt-1 font-serif italic">{menu.restaurant.slogan}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap justify-center gap-x-4 text-[10px] text-stone-500">
          {settings.showAddress && menu.restaurant.address ? (
            <span>{menu.restaurant.address}</span>
          ) : null}
          {settings.showPhone && menu.restaurant.phoneDisplay ? (
            <span>{menu.restaurant.phoneDisplay}</span>
          ) : null}
        </div>
      </header>

      <div
        data-print-columns={settings.columns}
        className={`mt-6 grid gap-x-8 gap-y-7 ${
          settings.columns === 2 ? "grid-cols-2" : "grid-cols-1"
        }`}
      >
        {sections.map(({ category, products }) => (
          <section
            key={category.id}
            className="break-inside-avoid"
            aria-labelledby={`print-category-${category.id}`}
          >
            <h2
              id={`print-category-${category.id}`}
              className="font-display border-b border-[#a8392f] pb-1 text-xl text-[#a8392f]"
            >
              {category.name}
            </h2>
            <ul className={`mt-3 ${spacingClass}`}>
              {products.map((product) => (
                <li key={product.id} className="break-inside-avoid">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-bold text-[#173f35]">
                      {product.name}
                      {product.isSoldOut ? (
                        <span className="ml-2 text-[9px] font-bold uppercase text-[#a8392f]">
                          {copy.soldOutLabel}
                        </span>
                      ) : null}
                    </h3>
                    <span className="shrink-0 font-extrabold">
                      {formatPrintPriceFromCents(
                        Math.round(product.fullPrice * 100),
                        currencyCode,
                        menu.locale,
                      )}
                    </span>
                  </div>
                  {settings.showDescriptions && product.description ? (
                    <p className="mt-1 leading-5 text-stone-600">
                      {product.description}
                    </p>
                  ) : null}
                  {settings.showHalfPortions &&
                  product.halfPrice !== undefined ? (
                    <p className="mt-1 text-[10px] font-semibold text-stone-500">
                      {copy.halfPortionLabel}:{" "}
                      {formatPrintPriceFromCents(
                        Math.round(product.halfPrice * 100),
                        currencyCode,
                        menu.locale,
                      )}
                    </p>
                  ) : null}
                  {settings.showTags && product.tags.length > 0 ? (
                    <p className="mt-1 text-[9px] text-stone-500">
                      {product.tags.map((tag) => tag.label).join(" · ")}
                    </p>
                  ) : null}
                  {settings.showAllergens && product.allergens.length > 0 ? (
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[9px] text-stone-500">
                      {product.allergens.map((allergen) => (
                        <span key={allergen.label} className="inline-flex items-center gap-1">
                          <TaxonomyIcon icon={allergen.icon} label={allergen.label} />
                          {allergen.label}
                        </span>
                      ))}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <footer className="mt-8 flex items-end justify-between gap-4 border-t border-stone-200 pt-4">
        {settings.showAllergens && allergens.length > 0 ? (
          <div className="max-w-[75%]">
            <p className="text-[9px] font-bold uppercase text-stone-500">
              {copy.allergenInfo}
            </p>
            <p className="mt-1 text-[8px] text-stone-500">
              {allergens.map((allergen) => allergen.label).join(" · ")}
            </p>
          </div>
        ) : <span />}
        {settings.showQr && qrDataUrl ? (
          // Generated locally by the existing QR module.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrDataUrl}
            alt={`QR ${menu.restaurant.name}`}
            className="size-24 object-contain"
          />
        ) : null}
      </footer>
    </article>
  );
}
