"use client";

import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import {
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import type { AdminCategory, AdminCategoryTranslation } from "../repository";

type CategoryRowProps = {
  category: AdminCategory;
  translation?: AdminCategoryTranslation;
  isPending: boolean;
  onEdit: (category: AdminCategory) => void;
  onToggle: (category: AdminCategory) => void;
  onDelete: (category: AdminCategory) => void;
  depth: 0 | 1;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onCreateChild: (categoryId: string) => void;
};

export function CategoryRow({
  category,
  translation,
  isPending,
  onEdit,
  onToggle,
  onDelete,
  depth,
  isExpanded,
  onToggleExpanded,
  onCreateChild,
}: CategoryRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      data-testid={`category-row-${category.id}`}
      className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-stone-100 px-3 py-3 last:border-b-0 sm:grid-cols-[auto_minmax(0,1.5fr)_minmax(8rem,0.7fr)_5rem_auto] sm:px-4 ${
        depth === 1 ? "bg-stone-50 pl-8 sm:pl-12" : "bg-white"
      } ${
        isDragging ? "relative z-20 rounded-xl shadow-xl ring-2 ring-[#d7ae6a]" : ""
      }`}
    >
      <button
        type="button"
        aria-label={`Reordenar ${translation?.name ?? "categoría"}`}
        disabled={isPending}
        className="grid size-10 cursor-grab touch-none place-items-center rounded-xl text-stone-400 hover:bg-stone-100 hover:text-[#173f35] focus-visible:outline-2 focus-visible:outline-[#173f35] active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" className="size-5" />
      </button>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {depth === 0 && category.childCount > 0 ? (
            <button
              type="button"
              onClick={onToggleExpanded}
              aria-label={`${isExpanded ? "Contraer" : "Expandir"} ${
                translation?.name ?? "categoría"
              }`}
              aria-expanded={isExpanded}
              className="grid size-7 shrink-0 place-items-center rounded-md text-stone-500 focus-visible:outline-2 focus-visible:outline-[#173f35]"
            >
              {isExpanded ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </button>
          ) : null}
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
          {category.isActive ? "Visible" : "No visible"} · Orden{" "}
          {category.sortOrder} · {category.productCount} productos ·{" "}
          {category.childCount} subcategorías
        </p>
      </div>

      <div className="hidden sm:block">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${
            category.isActive
              ? "bg-emerald-50 text-emerald-700"
              : "bg-stone-100 text-stone-500"
          }`}
        >
          <span
            className={`size-1.5 rounded-full ${
              category.isActive ? "bg-emerald-500" : "bg-stone-400"
            }`}
          />
          {category.isActive ? "Visible" : "No visible"}
        </span>
        <p className="mt-1 text-[9px] text-stone-400">
          {category.productCount}{" "}
          {category.productCount === 1 ? "producto" : "productos"}
          {depth === 0 ? ` · ${category.childCount} subcategorías` : ""}
        </p>
      </div>

      <p className="hidden text-center text-sm font-extrabold tabular-nums text-stone-500 sm:block">
        {category.sortOrder}
      </p>

      <div className="flex items-center justify-end gap-1">
        {depth === 0 ? (
          <button
            type="button"
            onClick={() => onCreateChild(category.id)}
            disabled={isPending}
            aria-label={`Crear subcategoría en ${translation?.name ?? "categoría"}`}
            className="grid size-9 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-[#173f35]"
          >
            <Plus aria-hidden="true" className="size-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onEdit(category)}
          disabled={isPending}
          aria-label={`Editar ${translation?.name ?? "categoría"}`}
          className="grid size-9 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-[#173f35] focus-visible:outline-2 focus-visible:outline-[#173f35]"
        >
          <Pencil aria-hidden="true" className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => onToggle(category)}
          disabled={isPending}
          aria-label={`${category.isActive ? "Ocultar" : "Mostrar"} ${
            translation?.name ?? "categoría"
          }`}
          className="grid size-9 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-[#173f35] focus-visible:outline-2 focus-visible:outline-[#173f35]"
        >
          {category.isActive ? (
            <EyeOff aria-hidden="true" className="size-4" />
          ) : (
            <Eye aria-hidden="true" className="size-4" />
          )}
        </button>
        <button
          type="button"
          onClick={() => onDelete(category)}
          disabled={isPending}
          aria-label={`Eliminar ${translation?.name ?? "categoría"}`}
          className="grid size-9 place-items-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-red-700"
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </button>
      </div>
    </article>
  );
}
