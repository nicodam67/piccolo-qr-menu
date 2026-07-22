"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { AlertTriangle, ListOrdered, LoaderCircle, Plus } from "lucide-react";
import { buildCategoryHierarchy } from "@/features/categories/hierarchy";

import {
  deleteCategoryAction,
  reorderCategoriesAction,
  toggleCategoryAction,
} from "../actions";
import type { AdminCategory } from "../repository";
import { CategoryFormDialog } from "./category-form-dialog";
import { CategoryRow } from "./category-row";

type CategoryManagerProps = {
  initialCategories: AdminCategory[];
  locales: string[];
  defaultLocale: string;
};

type DialogState =
  | { type: "create"; parentCategoryId: string | null }
  | { type: "edit"; category: AdminCategory }
  | null;

export function CategoryManager({
  initialCategories,
  locales,
  defaultLocale,
}: CategoryManagerProps) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [selectedLocale, setSelectedLocale] = useState(defaultLocale);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deleteCandidate, setDeleteCandidate] =
    useState<AdminCategory | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const [expandedIds, setExpandedIds] = useState(
    () =>
      new Set(
        initialCategories
          .filter(({ parentCategoryId }) => parentCategoryId === null)
          .map(({ id }) => id),
      ),
  );
  const hierarchy = useMemo(
    () => buildCategoryHierarchy(categories),
    [categories],
  );
  const displayedCategories = useMemo(
    () =>
      hierarchy.flatMap((root) => [
        root,
        ...(expandedIds.has(root.id) ? root.children : []),
      ]),
    [expandedIds, hierarchy],
  );
  const categoryIds = displayedCategories.map(({ id }) => id);

  const getTranslation = (category: AdminCategory) =>
    category.translations.find(
      (translation) => translation.locale === selectedLocale,
    ) ?? category.translations[0];

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || isPending) {
      return;
    }

    const activeCategory = categories.find(({ id }) => id === active.id);
    const overCategory = categories.find(({ id }) => id === over.id);
    if (
      !activeCategory ||
      !overCategory ||
      activeCategory.parentCategoryId !== overCategory.parentCategoryId
    ) {
      setFeedback("Solo se puede ordenar dentro del mismo nivel.");
      return;
    }
    const previousCategories = categories;
    const siblings = categories
      .filter(
        ({ parentCategoryId }) =>
          parentCategoryId === activeCategory.parentCategoryId,
      )
      .sort((left, right) => left.sortOrder - right.sortOrder);
    const oldIndex = siblings.findIndex(({ id }) => id === active.id);
    const newIndex = siblings.findIndex(({ id }) => id === over.id);

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const reorderedSiblings = arrayMove(siblings, oldIndex, newIndex).map(
      (category, index) => ({ ...category, sortOrder: index + 1 }),
    );
    const orders = new Map(
      reorderedSiblings.map(({ id, sortOrder }) => [id, sortOrder]),
    );
    const reorderedCategories = categories.map((category) => ({
      ...category,
      sortOrder: orders.get(category.id) ?? category.sortOrder,
    }));
    setCategories(reorderedCategories);
    setFeedback("Guardando el nuevo orden…");

    startTransition(async () => {
      const result = await reorderCategoriesAction(
        activeCategory.parentCategoryId,
        reorderedSiblings.map(({ id }) => id),
      );

      if (!result.success) {
        setCategories(previousCategories);
        setFeedback(result.error);
        return;
      }

      setFeedback("Orden guardado automáticamente.");
      router.refresh();
    });
  };

  const handleToggle = (category: AdminCategory) => {
    const nextIsActive = !category.isActive;
    setFeedback(null);
    setCategories((current) =>
      current.map((item) =>
        item.id === category.id
          ? { ...item, isActive: nextIsActive }
          : item,
      ),
    );

    startTransition(async () => {
      const result = await toggleCategoryAction(category.id, nextIsActive);

      if (!result.success) {
        setCategories((current) =>
          current.map((item) =>
            item.id === category.id
              ? { ...item, isActive: category.isActive }
              : item,
          ),
        );
        setFeedback(result.error);
        return;
      }

      setFeedback(
        nextIsActive ? "Categoría activada." : "Categoría desactivada.",
      );
      router.refresh();
    });
  };

  const handleDelete = () => {
    if (!deleteCandidate) {
      return;
    }

    const categoryId = deleteCandidate.id;
    setFeedback(null);

    startTransition(async () => {
      const result = await deleteCategoryAction(categoryId);

      if (!result.success) {
        setFeedback(result.error);
        setDeleteCandidate(null);
        return;
      }

      setCategories((current) =>
        current.filter(({ id }) => id !== categoryId),
      );
      setDeleteCandidate(null);
      setFeedback("Categoría eliminada.");
      router.refresh();
    });
  };

  const closeFormAndRefresh = () => {
    setDialog(null);
    setFeedback("Cambios guardados.");
    router.refresh();
  };

  return (
    <>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-extrabold tracking-[0.18em] text-[#a8392f] uppercase">
            Carta
          </p>
          <h1 className="font-display mt-1 text-3xl text-[#173f35] sm:text-4xl">
            Categorías
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
            Organiza las secciones visibles de la carta. El orden se guarda al
            soltar cada fila.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialog({ type: "create", parentCategoryId: null })}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#173f35] px-5 text-sm font-bold text-white hover:bg-[#245849] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173f35]"
        >
          <Plus aria-hidden="true" className="size-4" />
          Nueva categoría
        </button>
      </div>

      <div className="mb-3 flex min-h-10 items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs font-bold text-stone-600">
          Idioma
          <select
            value={selectedLocale}
            onChange={(event) => setSelectedLocale(event.target.value)}
            className="min-h-9 rounded-lg border border-stone-200 bg-white px-2.5 text-xs uppercase outline-none focus:border-[#245849]"
          >
            {locales.map((locale) => (
              <option key={locale} value={locale}>
                {locale.toUpperCase()}
              </option>
            ))}
          </select>
        </label>

        <div
          aria-live="polite"
          className="flex min-h-8 items-center gap-2 text-right text-[11px] font-semibold text-stone-500"
        >
          {isPending ? (
            <LoaderCircle
              aria-hidden="true"
              className="size-3.5 animate-spin"
            />
          ) : null}
          {feedback}
        </div>
      </div>

      <section
        aria-label="Listado de categorías"
        className="overflow-hidden rounded-2xl border border-stone-200 bg-white"
      >
        <div className="hidden grid-cols-[auto_minmax(0,1.5fr)_minmax(8rem,0.7fr)_5rem_auto] items-center gap-3 border-b border-stone-200 bg-stone-50 px-4 py-2.5 text-[9px] font-extrabold tracking-[0.12em] text-stone-400 uppercase sm:grid">
          <span className="w-10" />
          <span>Nombre y descripción</span>
          <span>Estado</span>
          <span className="text-center">Orden</span>
          <span className="w-[7.25rem] text-right">Acciones</span>
        </div>

        {categories.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={categoryIds}
              strategy={verticalListSortingStrategy}
            >
              {displayedCategories.map((category) => (
                <CategoryRow
                  key={category.id}
                  category={category}
                  translation={getTranslation(category)}
                  isPending={isPending}
                  onEdit={(selectedCategory) =>
                    setDialog({
                      type: "edit",
                      category: selectedCategory,
                    })
                  }
                  onToggle={handleToggle}
                  onDelete={setDeleteCandidate}
                  depth={category.parentCategoryId ? 1 : 0}
                  isExpanded={expandedIds.has(category.id)}
                  onToggleExpanded={() =>
                    setExpandedIds((current) => {
                      const next = new Set(current);
                      if (next.has(category.id)) next.delete(category.id);
                      else next.add(category.id);
                      return next;
                    })
                  }
                  onCreateChild={(parentCategoryId) =>
                    setDialog({ type: "create", parentCategoryId })
                  }
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          <div className="grid min-h-56 place-items-center px-6 text-center">
            <div>
              <ListOrdered
                aria-hidden="true"
                className="mx-auto size-7 text-stone-300"
              />
              <p className="mt-3 text-sm font-bold text-stone-600">
                Todavía no hay categorías
              </p>
              <p className="mt-1 text-xs text-stone-400">
                Crea la primera para comenzar a organizar la carta.
              </p>
            </div>
          </div>
        )}
      </section>

      {dialog ? (
        <CategoryFormDialog
          key={
            dialog.type === "edit"
              ? `edit-${dialog.category.id}`
              : "create-category"
          }
          mode={dialog.type}
          category={dialog.type === "edit" ? dialog.category : undefined}
          initialParentCategoryId={
            dialog.type === "create" ? dialog.parentCategoryId : undefined
          }
          categories={categories}
          locales={locales}
          defaultLocale={selectedLocale}
          onClose={() => setDialog(null)}
          onSaved={closeFormAndRefresh}
        />
      ) : null}

      {deleteCandidate ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-[#17201d]/40 p-4 backdrop-blur-[2px]">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-category-title"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-red-50 text-red-700">
              <AlertTriangle aria-hidden="true" className="size-5" />
            </span>
            <h2
              id="delete-category-title"
              className="font-display mt-4 text-2xl text-[#173f35]"
            >
              Eliminar categoría
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              Se eliminará{" "}
              <strong className="text-stone-700">
                {getTranslation(deleteCandidate)?.name ?? "esta categoría"}
              </strong>
              . Solo es posible si no contiene productos.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                disabled={isPending}
                className="min-h-11 flex-1 rounded-xl border border-stone-200 px-4 text-sm font-bold text-stone-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="min-h-11 flex-1 rounded-xl bg-red-700 px-4 text-sm font-bold text-white disabled:opacity-60"
              >
                Eliminar
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
