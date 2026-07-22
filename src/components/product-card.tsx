import Link from "next/link";

import type { DemoProduct, ProductTag } from "@/features/public-menu/types";
import { formatDemoPrice } from "@/features/public-menu/utils";
import type { MenuDisplaySettings } from "@/features/menu-settings/config";
import { ProductImage } from "./product-image";
import { TaxonomyIcon } from "./taxonomy-icon";

const tagTones: Record<ProductTag["tone"], string> = {
  green: "text-emerald-700",
  red: "text-red-700",
  gold: "text-amber-700",
};

type ProductCardProps = {
  product: DemoProduct;
  settings: MenuDisplaySettings;
  href?: string;
  viewProductLabel?: string;
  onNavigate?: () => void;
};

export function ProductCard({
  product,
  settings,
  href,
  viewProductLabel,
  onNavigate,
}: ProductCardProps) {
  const isList = settings.layout === "list";

  return (
    <article
      data-testid="product-card"
      data-layout={settings.layout}
      className={`group border-b border-stone-200 pb-7 ${
        isList
          ? `grid items-start gap-4 ${
              settings.showImages
                ? "grid-cols-[6.5rem_minmax(0,1fr)]"
                : "grid-cols-1"
            }`
          : ""
      }`}
    >
      {settings.showImages ? (
        <div
          className={`relative overflow-hidden rounded-[1.1rem] bg-stone-200 ${
            isList ? "aspect-square" : "aspect-[16/10]"
          }`}
        >
          {href ? (
            <Link
              href={href}
              onNavigate={onNavigate}
              aria-label={`${viewProductLabel ?? "Ver producto"}: ${
                product.name
              }`}
              className="absolute inset-0 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white"
            >
              <ProductImage
                src={product.imageUrl}
                alt={product.imageAlt}
                isSoldOut={product.isSoldOut}
              />
            </Link>
          ) : (
            <ProductImage
              src={product.imageUrl}
              alt={product.imageAlt}
              isSoldOut={product.isSoldOut}
            />
          )}
          <span className="absolute top-2.5 left-2.5 rounded-full bg-black/55 px-2.5 py-1 text-[8px] font-extrabold tracking-[0.13em] text-white uppercase backdrop-blur-sm">
            Demo
          </span>
          {product.isSoldOut ? (
            <span className="absolute top-2.5 right-2.5 rounded-full bg-[#a8392f] px-3 py-1.5 text-[10px] font-extrabold tracking-[0.1em] text-white uppercase">
              Agotado
            </span>
          ) : null}
        </div>
      ) : null}

      <div className={`px-0.5 ${isList ? "pt-0" : "pt-4"}`}>
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-display text-[1.4rem] leading-tight text-[#173f35]">
            {href ? (
              <Link
                href={href}
                onNavigate={onNavigate}
                className="rounded-sm hover:text-[#a8392f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a8392f]"
              >
                {product.name}
              </Link>
            ) : (
              product.name
            )}
          </h3>
          {settings.showPrices ? (
            <div className="shrink-0 text-right">
              <p className="text-base font-extrabold text-[#173f35]">
                {formatDemoPrice(product.fullPrice)}
              </p>
              <p className="text-[8px] font-semibold tracking-wide text-stone-400 uppercase">
                Demo
              </p>
            </div>
          ) : null}
        </div>

        {settings.showDescriptions && product.description ? (
          <p className="mt-2 text-[13px] leading-5 text-stone-600">
            {product.description}
          </p>
        ) : null}

        {settings.showPrices &&
        settings.showHalfPortions &&
        product.halfPrice ? (
          <div className="mt-3 flex items-center justify-between border-y border-stone-200 py-2">
            <span className="text-[10px] font-bold tracking-[0.08em] text-stone-500 uppercase">
              Media ración · demo
            </span>
            <span className="text-sm font-extrabold text-[#a8392f]">
              {formatDemoPrice(product.halfPrice)}
            </span>
          </div>
        ) : null}

        {settings.showTags && product.tags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1" aria-label="Etiquetas">
            {product.tags.map((tag) => (
              <span
                key={tag.label}
                className={`text-[10px] font-bold ${tagTones[tag.tone]}`}
              >
                ● {tag.label}
              </span>
            ))}
          </div>
        ) : null}

        {settings.showAllergens && product.allergens.length > 0 ? (
          <div className="mt-3 flex items-center gap-2 text-[10px] text-stone-500">
            <span className="font-bold text-stone-600">Alérgenos:</span>
            <div className="flex flex-wrap gap-1.5">
              {product.allergens.map((allergen) => (
                <details
                  key={allergen.label}
                  className="group relative"
                >
                  <summary
                    aria-label={`Mostrar alérgeno ${allergen.label}`}
                    className="grid size-7 cursor-pointer list-none place-items-center rounded-full bg-stone-100 text-sm outline-none ring-[#a8392f] focus-visible:ring-2"
                  >
                    <TaxonomyIcon
                      icon={allergen.icon}
                      label={allergen.label}
                    />
                  </summary>
                  <span
                    role="tooltip"
                    className="absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#17201d] px-2.5 py-1.5 text-[10px] font-bold text-white shadow-lg group-open:block"
                  >
                    {allergen.label}
                  </span>
                </details>
              ))}
            </div>
          </div>
        ) : null}

        {href && viewProductLabel ? (
          <Link
            href={href}
            onNavigate={onNavigate}
            className="mt-4 inline-flex min-h-10 items-center rounded-full border border-[#173f35]/20 px-4 text-xs font-bold text-[#173f35] hover:bg-[#173f35] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173f35]"
          >
            {viewProductLabel}
          </Link>
        ) : null}
      </div>
    </article>
  );
}
