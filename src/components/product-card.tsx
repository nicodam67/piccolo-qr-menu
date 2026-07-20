import { AlertCircle } from "lucide-react";

import type { DemoProduct, ProductTag } from "@/features/public-menu/types";
import { formatDemoPrice } from "@/features/public-menu/utils";
import { ProductImage } from "./product-image";

const tagTones: Record<ProductTag["tone"], string> = {
  green: "text-emerald-700",
  red: "text-red-700",
  gold: "text-amber-700",
};

type ProductCardProps = {
  product: DemoProduct;
};

export function ProductCard({ product }: ProductCardProps) {
  return (
    <article
      data-testid="product-card"
      className="group border-b border-stone-200 pb-7"
    >
      <div className="relative aspect-[16/10] overflow-hidden rounded-[1.1rem] bg-stone-200">
        <ProductImage
          src={product.imageUrl}
          alt={product.imageAlt}
          isSoldOut={product.isSoldOut}
        />
        <span className="absolute top-2.5 left-2.5 rounded-full bg-black/55 px-2.5 py-1 text-[8px] font-extrabold tracking-[0.13em] text-white uppercase backdrop-blur-sm">
          Demo
        </span>
        {product.isSoldOut ? (
          <span className="absolute top-2.5 right-2.5 rounded-full bg-[#a8392f] px-3 py-1.5 text-[10px] font-extrabold tracking-[0.1em] text-white uppercase">
            Agotado
          </span>
        ) : null}
      </div>

      <div className="px-0.5 pt-4">
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-display text-[1.4rem] leading-tight text-[#173f35]">
            {product.name}
          </h3>
          <div className="shrink-0 text-right">
            <p className="text-base font-extrabold text-[#173f35]">
              {formatDemoPrice(product.fullPrice)}
            </p>
            <p className="text-[8px] font-semibold tracking-wide text-stone-400 uppercase">
              Demo
            </p>
          </div>
        </div>

        <p className="mt-2 text-[13px] leading-5 text-stone-600">
          {product.description}
        </p>

        {product.halfPrice ? (
          <div className="mt-3 flex items-center justify-between border-y border-stone-200 py-2">
            <span className="text-[10px] font-bold tracking-[0.08em] text-stone-500 uppercase">
              Media ración · demo
            </span>
            <span className="text-sm font-extrabold text-[#a8392f]">
              {formatDemoPrice(product.halfPrice)}
            </span>
          </div>
        ) : null}

        {product.tags.length > 0 ? (
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

        {product.allergens.length > 0 ? (
          <div className="mt-2 flex items-start gap-1.5 text-[10px] leading-4 text-stone-500">
            <AlertCircle
              aria-hidden="true"
              className="mt-px size-3.5 shrink-0 text-[#a8392f]"
            />
            <p>
              <span className="font-bold text-stone-600">Alérgenos demo:</span>{" "}
              {product.allergens.join(", ")}
            </p>
          </div>
        ) : null}
      </div>
    </article>
  );
}
