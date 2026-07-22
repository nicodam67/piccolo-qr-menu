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

import { TaxonomyIcon } from "@/components/taxonomy-icon";

import type {
  AdminTaxonomyItem,
  TaxonomyKind,
  TaxonomyTranslation,
} from "../repository";

type TaxonomyRowProps = {
  kind: TaxonomyKind;
  item: AdminTaxonomyItem;
  translation?: TaxonomyTranslation;
  isPending: boolean;
  onEdit: (item: AdminTaxonomyItem) => void;
  onToggle: (item: AdminTaxonomyItem) => void;
  onDelete: (item: AdminTaxonomyItem) => void;
};

export function TaxonomyRow({
  kind,
  item,
  translation,
  isPending,
  onEdit,
  onToggle,
  onDelete,
}: TaxonomyRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  const name = translation?.name ?? "Sin traducción";

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      data-testid={`${kind}-row-${item.id}`}
      className={`grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-stone-100 bg-white px-3 py-3 last:border-b-0 sm:grid-cols-[auto_3rem_minmax(0,1.3fr)_minmax(8rem,0.6fr)_5rem_auto] sm:px-4 ${
        isDragging ? "relative z-20 rounded-xl shadow-xl ring-2 ring-[#d7ae6a]" : ""
      }`}
    >
      <button
        type="button"
        aria-label={`Reordenar ${name}`}
        disabled={isPending}
        className="grid size-10 cursor-grab touch-none place-items-center rounded-xl text-stone-400 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-[#173f35] active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" className="size-5" />
      </button>

      <span className="grid size-10 place-items-center rounded-xl bg-stone-100 text-lg">
        {kind === "allergen" ? (
          <TaxonomyIcon icon={item.icon ?? ""} label={name} />
        ) : (
          <span
            role="img"
            aria-label={`Color ${item.color ?? ""}`}
            className="size-5 rounded-full border border-black/10"
            style={{ backgroundColor: item.color ?? "transparent" }}
          />
        )}
      </span>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-extrabold text-[#173f35]">
            {name}
          </h3>
          <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[8px] font-bold text-stone-500 uppercase">
            {translation?.locale ?? "—"}
          </span>
        </div>
        <p className="mt-1 text-[10px] text-stone-400">
          {kind === "allergen"
            ? `Código: ${item.code}`
            : `Color: ${item.color}`}
        </p>
        <p className="mt-1 text-[9px] text-stone-400 sm:hidden">
          {item.isActive ? "Activo" : "Inactivo"} · Orden {item.sortOrder} ·{" "}
          {item.productCount} productos
        </p>
      </div>

      <div className="hidden sm:block">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${
            item.isActive
              ? "bg-emerald-50 text-emerald-700"
              : "bg-stone-100 text-stone-500"
          }`}
        >
          <span
            className={`size-1.5 rounded-full ${
              item.isActive ? "bg-emerald-500" : "bg-stone-400"
            }`}
          />
          {item.isActive ? "Activo" : "Inactivo"}
        </span>
        <p className="mt-1 text-[9px] text-stone-400">
          {item.productCount}{" "}
          {item.productCount === 1 ? "producto" : "productos"}
        </p>
      </div>

      <p className="hidden text-center text-sm font-extrabold tabular-nums text-stone-500 sm:block">
        {item.sortOrder}
      </p>

      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => onEdit(item)}
          disabled={isPending}
          aria-label={`Editar ${name}`}
          className="grid size-9 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-[#173f35] focus-visible:outline-2 focus-visible:outline-[#173f35]"
        >
          <Pencil aria-hidden="true" className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => onToggle(item)}
          disabled={isPending}
          aria-label={`${item.isActive ? "Desactivar" : "Activar"} ${name}`}
          className="grid size-9 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-[#173f35] focus-visible:outline-2 focus-visible:outline-[#173f35]"
        >
          {item.isActive ? (
            <EyeOff aria-hidden="true" className="size-4" />
          ) : (
            <Eye aria-hidden="true" className="size-4" />
          )}
        </button>
        <button
          type="button"
          onClick={() => onDelete(item)}
          disabled={isPending}
          aria-label={`Eliminar ${name}`}
          className="grid size-9 place-items-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-red-700"
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </button>
      </div>
    </article>
  );
}
