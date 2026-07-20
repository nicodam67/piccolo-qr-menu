"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Eye,
  EyeOff,
  GripVertical,
  Pencil,
  Trash2,
} from "lucide-react";

import type { AdminProduct, AdminProductTranslation } from "../repository";

type ProductRowProps = {
  product: AdminProduct;
  translation?: AdminProductTranslation;
  currencyCode: string;
  isPending: boolean;
  onEdit: (product: AdminProduct) => void;
  onToggle: (product: AdminProduct) => void;
  onDelete: (product: AdminProduct) => void;
};

function formatPrice(cents: number, currencyCode: string) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currencyCode,
  }).format(cents / 100);
}

export function ProductRow({
  product,
  translation,
  currencyCode,
  isPending,
  onEdit,
  onToggle,
  onDelete,
}: ProductRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id });

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      data-testid={`product-row-${product.id}`}
      className={`grid grid-cols-[auto_3rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 border-b border-stone-100 bg-white px-3 py-3 last:border-b-0 sm:grid-cols-[auto_3.5rem_minmax(0,1.4fr)_minmax(7rem,0.5fr)_minmax(7rem,0.5fr)_4rem_auto] sm:gap-3 sm:px-4 ${
        isDragging ? "relative z-20 rounded-xl shadow-xl ring-2 ring-[#d7ae6a]" : ""
      }`}
    >
      <button
        type="button"
        aria-label={`Reordenar ${translation?.name ?? "producto"}`}
        disabled={isPending}
        className="grid size-10 cursor-grab touch-none place-items-center rounded-xl text-stone-400 hover:bg-stone-100 hover:text-[#173f35] focus-visible:outline-2 focus-visible:outline-[#173f35] active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" className="size-5" />
      </button>

      <div
        role="img"
        aria-label={`Imagen de ${translation?.name ?? "producto"}`}
        className="aspect-square w-12 rounded-xl bg-cover bg-center bg-stone-100 sm:w-14"
        style={{ backgroundImage: `url("${product.imageUrl}")` }}
      />

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-extrabold text-[#173f35]">
            {translation?.name ?? "Sin traducción"}
          </h3>
          <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[8px] font-bold text-stone-500 uppercase">
            {translation?.locale ?? "—"}
          </span>
        </div>
        <p className="mt-1 line-clamp-1 text-xs text-stone-500">
          {translation?.description || "Sin descripción"}
        </p>
        <p className="mt-1 text-[9px] text-stone-400 sm:hidden">
          {formatPrice(product.fullPriceCents, currencyCode)} ·{" "}
          {product.isActive ? "Visible" : "No visible"} · Orden{" "}
          {product.sortOrder}
          {product.isSoldOut ? " · Agotado" : ""}
        </p>
      </div>

      <div className="hidden sm:block">
        <p className="text-sm font-extrabold text-[#173f35]">
          {formatPrice(product.fullPriceCents, currencyCode)}
        </p>
        {product.halfPriceCents !== null ? (
          <p className="mt-1 text-[9px] text-stone-400">
            Media: {formatPrice(product.halfPriceCents, currencyCode)}
          </p>
        ) : null}
      </div>

      <div className="hidden sm:block">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${
            product.isActive
              ? "bg-emerald-50 text-emerald-700"
              : "bg-stone-100 text-stone-500"
          }`}
        >
          <span
            className={`size-1.5 rounded-full ${
              product.isActive ? "bg-emerald-500" : "bg-stone-400"
            }`}
          />
          {product.isActive ? "Visible" : "No visible"}
        </span>
        {product.isSoldOut ? (
          <p className="mt-1 text-[9px] font-bold text-[#a8392f]">Agotado</p>
        ) : null}
      </div>

      <p className="hidden text-center text-sm font-extrabold tabular-nums text-stone-500 sm:block">
        {product.sortOrder}
      </p>

      <div className="col-start-3 flex items-center justify-start gap-1 sm:col-start-auto sm:justify-end">
        <button
          type="button"
          onClick={() => onEdit(product)}
          disabled={isPending}
          aria-label={`Editar ${translation?.name ?? "producto"}`}
          className="grid size-9 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-[#173f35] focus-visible:outline-2 focus-visible:outline-[#173f35]"
        >
          <Pencil aria-hidden="true" className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => onToggle(product)}
          disabled={isPending}
          aria-label={`${product.isActive ? "Ocultar" : "Mostrar"} ${
            translation?.name ?? "producto"
          }`}
          className="grid size-9 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-[#173f35] focus-visible:outline-2 focus-visible:outline-[#173f35]"
        >
          {product.isActive ? (
            <EyeOff aria-hidden="true" className="size-4" />
          ) : (
            <Eye aria-hidden="true" className="size-4" />
          )}
        </button>
        <button
          type="button"
          onClick={() => onDelete(product)}
          disabled={isPending}
          aria-label={`Eliminar ${translation?.name ?? "producto"}`}
          className="grid size-9 place-items-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-red-700"
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </button>
      </div>
    </article>
  );
}
