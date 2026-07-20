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
import {
  AlertTriangle,
  LoaderCircle,
  Plus,
  Search,
} from "lucide-react";

import {
  deleteTaxonomyAction,
  reorderTaxonomyAction,
  toggleTaxonomyAction,
} from "../actions";
import type {
  AdminTaxonomyItem,
  TaxonomyKind,
} from "../repository";
import { TaxonomyFormDialog } from "./taxonomy-form-dialog";
import { TaxonomyRow } from "./taxonomy-row";

type TaxonomyManagerProps = {
  kind: TaxonomyKind;
  initialItems: AdminTaxonomyItem[];
  locales: string[];
  defaultLocale: string;
};

type DialogState =
  | { type: "create" }
  | { type: "edit"; item: AdminTaxonomyItem }
  | null;

export function TaxonomyManager({
  kind,
  initialItems,
  locales,
  defaultLocale,
}: TaxonomyManagerProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [selectedLocale, setSelectedLocale] = useState(defaultLocale);
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deleteCandidate, setDeleteCandidate] =
    useState<AdminTaxonomyItem | null>(null);
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
  const labels =
    kind === "allergen"
      ? {
          singular: "alérgeno",
          plural: "Alérgenos",
          description:
            "Gestiona los alérgenos disponibles y sus iconos públicos.",
        }
      : {
          singular: "etiqueta",
          plural: "Etiquetas dietéticas",
          description:
            "Gestiona las etiquetas dietéticas disponibles para los productos.",
        };

  const getTranslation = (item: AdminTaxonomyItem) =>
    item.translations.find(
      (translation) => translation.locale === selectedLocale,
    ) ?? item.translations[0];
  const normalizedQuery = query.trim().toLocaleLowerCase("es");
  const filteredItems = useMemo(
    () =>
      normalizedQuery
        ? items.filter((item) =>
            (item.translations.find(
              (translation) => translation.locale === selectedLocale,
            )?.name ??
              item.translations[0]?.name ??
              "")
              .toLocaleLowerCase("es")
              .includes(normalizedQuery),
          )
        : items,
    [items, normalizedQuery, selectedLocale],
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (
      normalizedQuery ||
      !over ||
      active.id === over.id ||
      isPending
    ) {
      return;
    }

    const oldIndex = items.findIndex(({ id }) => id === active.id);
    const newIndex = items.findIndex(({ id }) => id === over.id);

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const previousItems = items;
    const reorderedItems = arrayMove(items, oldIndex, newIndex).map(
      (item, index) => ({ ...item, sortOrder: index + 1 }),
    );
    setItems(reorderedItems);
    setFeedback("Guardando el nuevo orden…");

    startTransition(async () => {
      const result = await reorderTaxonomyAction(
        kind,
        reorderedItems.map(({ id }) => id),
      );

      if (!result.success) {
        setItems(previousItems);
        setFeedback(result.error);
        return;
      }

      setFeedback("Orden guardado automáticamente.");
      router.refresh();
    });
  };

  const handleToggle = (item: AdminTaxonomyItem) => {
    const nextIsActive = !item.isActive;
    setItems((current) =>
      current.map((candidate) =>
        candidate.id === item.id
          ? { ...candidate, isActive: nextIsActive }
          : candidate,
      ),
    );

    startTransition(async () => {
      const result = await toggleTaxonomyAction(
        kind,
        item.id,
        nextIsActive,
      );

      if (!result.success) {
        setItems((current) =>
          current.map((candidate) =>
            candidate.id === item.id
              ? { ...candidate, isActive: item.isActive }
              : candidate,
          ),
        );
        setFeedback(result.error);
        return;
      }

      setFeedback(
        nextIsActive
          ? `${labels.singular} activado.`
          : `${labels.singular} desactivado.`,
      );
      router.refresh();
    });
  };

  const handleDelete = () => {
    if (!deleteCandidate) {
      return;
    }

    const item = deleteCandidate;

    startTransition(async () => {
      const result = await deleteTaxonomyAction(kind, item.id);

      if (!result.success) {
        setFeedback(result.error);
        setDeleteCandidate(null);
        return;
      }

      setItems((current) =>
        current
          .filter(({ id }) => id !== item.id)
          .map((candidate, index) => ({
            ...candidate,
            sortOrder: index + 1,
          })),
      );
      setDeleteCandidate(null);
      setFeedback(`${labels.singular} eliminado.`);
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
            {labels.plural}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
            {labels.description}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialog({ type: "create" })}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#173f35] px-5 text-sm font-bold text-white hover:bg-[#245849]"
        >
          <Plus aria-hidden="true" className="size-4" />
          {kind === "allergen" ? "Nuevo alérgeno" : "Nueva etiqueta"}
        </button>
      </div>

      <div className="mb-3 grid gap-3 sm:grid-cols-[minmax(12rem,1fr)_auto_minmax(10rem,auto)] sm:items-center">
        <label className="relative">
          <span className="sr-only">Buscar por nombre</span>
          <Search
            aria-hidden="true"
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Buscar ${labels.plural.toLocaleLowerCase("es")}…`}
            className="min-h-10 w-full rounded-xl border border-stone-200 bg-white pr-3 pl-9 text-sm outline-none focus:border-[#245849]"
          />
        </label>
        <label className="flex items-center gap-2 text-xs font-bold text-stone-600">
          Idioma
          <select
            value={selectedLocale}
            onChange={(event) => setSelectedLocale(event.target.value)}
            className="min-h-9 rounded-lg border border-stone-200 bg-white px-2.5 text-xs uppercase outline-none"
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
          className="flex min-h-8 items-center gap-2 text-[11px] font-semibold text-stone-500"
        >
          {isPending ? (
            <LoaderCircle
              aria-hidden="true"
              className="size-3.5 animate-spin"
            />
          ) : null}
          {normalizedQuery
            ? `${filteredItems.length} resultados · limpia la búsqueda para reordenar`
            : feedback}
        </div>
      </div>

      <section
        aria-label={`Listado de ${labels.plural.toLocaleLowerCase("es")}`}
        className="overflow-hidden rounded-2xl border border-stone-200 bg-white"
      >
        <div className="hidden grid-cols-[auto_3rem_minmax(0,1.3fr)_minmax(8rem,0.6fr)_5rem_auto] items-center gap-3 border-b border-stone-200 bg-stone-50 px-4 py-2.5 text-[9px] font-extrabold tracking-[0.12em] text-stone-400 uppercase sm:grid">
          <span className="w-10" />
          <span>Icono</span>
          <span>Nombre</span>
          <span>Estado</span>
          <span className="text-center">Orden</span>
          <span className="w-[7.25rem] text-right">Acciones</span>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredItems.map(({ id }) => id)}
            strategy={verticalListSortingStrategy}
          >
            {filteredItems.map((item) => (
              <TaxonomyRow
                key={item.id}
                kind={kind}
                item={item}
                translation={getTranslation(item)}
                isPending={isPending || Boolean(normalizedQuery)}
                onEdit={(selectedItem) =>
                  setDialog({ type: "edit", item: selectedItem })
                }
                onToggle={handleToggle}
                onDelete={setDeleteCandidate}
              />
            ))}
          </SortableContext>
        </DndContext>

        {filteredItems.length === 0 ? (
          <div className="grid min-h-40 place-items-center text-center">
            <p className="text-sm text-stone-400">
              No hay resultados para esta búsqueda.
            </p>
          </div>
        ) : null}
      </section>

      {dialog ? (
        <TaxonomyFormDialog
          key={
            dialog.type === "edit"
              ? `${kind}-${dialog.item.id}`
              : `create-${kind}`
          }
          kind={kind}
          mode={dialog.type}
          item={dialog.type === "edit" ? dialog.item : undefined}
          locales={locales}
          defaultLocale={selectedLocale}
          maxOrder={
            dialog.type === "create" ? items.length + 1 : items.length
          }
          onClose={() => setDialog(null)}
          onSaved={closeFormAndRefresh}
        />
      ) : null}

      {deleteCandidate ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-[#17201d]/40 p-4 backdrop-blur-[2px]">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-taxonomy-title"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-red-50 text-red-700">
              <AlertTriangle aria-hidden="true" className="size-5" />
            </span>
            <h2
              id="delete-taxonomy-title"
              className="font-display mt-4 text-2xl text-[#173f35]"
            >
              Eliminar {labels.singular}
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              Solo se eliminará si no está asociado a ningún producto.
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
