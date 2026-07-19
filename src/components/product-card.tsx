import Image from "next/image";
import { AlertCircle } from "lucide-react";

import type { DemoProduct, ProductTag } from "@/features/public-menu/types";
import { formatDemoPrice } from "@/features/public-menu/utils";

const tagTones: Record<ProductTag["tone"], string> = {
  green: "bg-emerald-50 text-emerald-800 ring-emerald-700/10",
  red: "bg-red-50 text-red-800 ring-red-700/10",
  gold: "bg-amber-50 text-amber-800 ring-amber-700/10",
};

type ProductCardProps = {
  product: DemoProduct;
};

export function ProductCard({ product }: ProductCardProps) {
  return (
    <article
      className={`group overflow-hidden rounded-[1.75rem] border bg-white shadow-[0_18px_50px_-36px_rgba(23,63,53,0.55)] ${
        product.isSoldOut ? "border-stone-300" : "border-white"
      }`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-stone-200">
        <Image
          src={product.imageUrl}
          alt={product.imageAlt}
          fill
          sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
          className={`object-cover transition-transform duration-500 group-hover:scale-[1.025] ${
            product.isSoldOut ? "grayscale-[35%]" : ""
          }`}
        />
        <span className="absolute top-3 left-3 rounded-full bg-black/65 px-3 py-1.5 text-[10px] font-extrabold tracking-[0.12em] text-white uppercase backdrop-blur-sm">
          Producto demo
        </span>
        {product.isSoldOut ? (
          <div className="absolute inset-0 grid place-items-center bg-[#17201d]/48">
            <span className="-rotate-3 rounded-full border border-white/50 bg-[#a8392f] px-5 py-2 text-sm font-extrabold tracking-[0.12em] text-white uppercase shadow-xl">
              Agotado
            </span>
          </div>
        ) : null}
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-display text-[1.55rem] leading-tight text-[#173f35]">
            {product.name}
          </h3>
          <div className="shrink-0 text-right">
            <p className="text-lg font-extrabold text-[#173f35]">
              {formatDemoPrice(product.fullPrice)}
            </p>
            <p className="text-[10px] font-semibold tracking-wide text-stone-400 uppercase">
              Precio demo
            </p>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-stone-600">
          {product.description}
        </p>

        {product.halfPrice ? (
          <div className="mt-4 flex items-center justify-between rounded-xl bg-[#f7f3eb] px-4 py-3">
            <span className="text-xs font-bold tracking-wide text-stone-600 uppercase">
              Media ración · demo
            </span>
            <span className="font-extrabold text-[#a8392f]">
              {formatDemoPrice(product.halfPrice)}
            </span>
          </div>
        ) : null}

        {product.tags.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Etiquetas">
            {product.tags.map((tag) => (
              <span
                key={tag.label}
                className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset ${tagTones[tag.tone]}`}
              >
                {tag.label}
              </span>
            ))}
          </div>
        ) : null}

        {product.allergens.length > 0 ? (
          <div className="mt-4 flex items-start gap-2 border-t border-stone-100 pt-4 text-xs leading-5 text-stone-500">
            <AlertCircle
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-[#a8392f]"
            />
            <p>
              <span className="font-bold text-stone-700">
                Alérgenos demo:
              </span>{" "}
              {product.allergens.join(", ")}
            </p>
          </div>
        ) : null}
      </div>
    </article>
  );
}
