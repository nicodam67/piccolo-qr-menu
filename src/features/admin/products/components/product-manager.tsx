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
import { AlertTriangle, LoaderCircle, PackageOpen, Plus } from "lucide-react";

import {
  deleteProductAction,
  reorderProductsAction,
  toggleProductAction,
} from "../actions";
import type {
  AdminProduct,
  ProductAllergenOption,
  ProductCategoryOption,
  ProductTagOption,
} from "../repository";
import { ProductFormDialog } from "./product-form-dialog";
import { ProductRow } from "./product-row";

type ProductManagerProps = {
  initialProducts: AdminProduct[];
  categories: ProductCategoryOption[];
  tags: ProductTagOption[];
  allergens: ProductAllergenOption[];
  locales: string[];
  defaultLocale: string;
  currencyCode: string;
};

type DialogState =
  | { type: "create" }
  | { type: "edit"; product: AdminProduct }
  | null;

export function ProductManager({
  initialProducts,
  categories,
  tags,
  allergens,
  locales,
  defaultLocale,
  currencyCode,
}: ProductManagerProps) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [selectedLocale, setSelectedLocale] = useState(defaultLocale);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deleteCandidate, setDeleteCandidate] =
    useState<AdminProduct | null>(null);
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
  const productsByCategory = useMemo(
    () =>
      new Map(
        categories.map((category) => [
          category.id,
          products
            .filter((product) => product.categoryId === category.id)
            .sort((left, right) => left.sortOrder - right.sortOrder),
        ]),
      ),
    [categories, products],
  );

  const getTranslation = (product: AdminProduct) =>
    product.translations.find(
      (translation) => translation.locale === selectedLocale,
    ) ?? product.translations[0];

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || isPending) {
      return;
    }

    const activeProduct = products.find(({ id }) => id === active.id);
    const overProduct = products.find(({ id }) => id === over.id);

    if (
      !activeProduct ||
      !overProduct ||
      activeProduct.categoryId !== overProduct.categoryId
    ) {
      setFeedback("Solo se puede reordenar dentro de la misma categoría.");
      return;
    }

    const categoryProducts =
      productsByCategory.get(activeProduct.categoryId) ?? [];
    const oldIndex = categoryProducts.findIndex(({ id }) => id === active.id);
    const newIndex = categoryProducts.findIndex(({ id }) => id === over.id);

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const previousProducts = products;
    const reorderedCategoryProducts = arrayMove(
      categoryProducts,
      oldIndex,
      newIndex,
    ).map((product, index) => ({ ...product, sortOrder: index + 1 }));
    const reorderedById = new Map(
      reorderedCategoryProducts.map((product) => [product.id, product]),
    );
    setProducts((current) =>
      current.map((product) => reorderedById.get(product.id) ?? product),
    );
    setFeedback("Guardando el nuevo orden…");

    startTransition(async () => {
      const result = await reorderProductsAction(
        activeProduct.categoryId,
        reorderedCategoryProducts.map(({ id }) => id),
      );

      if (!result.success) {
        setProducts(previousProducts);
        setFeedback(result.error);
        return;
      }

      setFeedback("Orden guardado automáticamente.");
      router.refresh();
    });
  };

  const handleToggle = (product: AdminProduct) => {
    const nextIsActive = !product.isActive;
    setProducts((current) =>
      current.map((item) =>
        item.id === product.id
          ? { ...item, isActive: nextIsActive }
          : item,
      ),
    );

    startTransition(async () => {
      const result = await toggleProductAction(product.id, nextIsActive);

      if (!result.success) {
        setProducts((current) =>
          current.map((item) =>
            item.id === product.id
              ? { ...item, isActive: product.isActive }
              : item,
          ),
        );
        setFeedback(result.error);
        return;
      }

      setFeedback(nextIsActive ? "Producto activado." : "Producto desactivado.");
      router.refresh();
    });
  };

  const handleDelete = () => {
    if (!deleteCandidate) {
      return;
    }

    const product = deleteCandidate;

    startTransition(async () => {
      const result = await deleteProductAction(product.id);

      if (!result.success) {
        setFeedback(result.error);
        setDeleteCandidate(null);
        return;
      }

      setProducts((current) =>
        current
          .filter(({ id }) => id !== product.id)
          .map((item) =>
            item.categoryId === product.categoryId &&
            item.sortOrder > product.sortOrder
              ? { ...item, sortOrder: item.sortOrder - 1 }
              : item,
          ),
      );
      setDeleteCandidate(null);
      setFeedback("Producto eliminado.");
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
            Productos
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
            Gestiona platos, precios y visibilidad. El orden se guarda al soltar
            cada fila dentro de su categoría.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialog({ type: "create" })}
          disabled={categories.length === 0}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#173f35] px-5 text-sm font-bold text-white hover:bg-[#245849] disabled:opacity-50"
        >
          <Plus aria-hidden="true" className="size-4" />
          Nuevo producto
        </button>
      </div>

      <div className="mb-3 flex min-h-10 items-center justify-between gap-3">
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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-5">
          {categories.map((category) => {
            const categoryProducts =
              productsByCategory.get(category.id) ?? [];

            return (
              <section
                key={category.id}
                aria-labelledby={`product-category-${category.id}`}
                className="overflow-hidden rounded-2xl border border-stone-200 bg-white"
              >
                <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-4 py-3">
                  <h2
                    id={`product-category-${category.id}`}
                    className="font-display text-xl text-[#173f35]"
                  >
                    {category.name}
                  </h2>
                  <span className="text-[10px] font-bold text-stone-400">
                    {categoryProducts.length}{" "}
                    {categoryProducts.length === 1 ? "producto" : "productos"}
                  </span>
                </div>

                {categoryProducts.length > 0 ? (
                  <SortableContext
                    items={categoryProducts.map(({ id }) => id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="hidden grid-cols-[auto_3.5rem_minmax(0,1.4fr)_minmax(7rem,0.5fr)_minmax(7rem,0.5fr)_4rem_auto] items-center gap-3 border-b border-stone-100 px-4 py-2 text-[9px] font-extrabold tracking-[0.12em] text-stone-400 uppercase sm:grid">
                      <span className="w-10" />
                      <span>Imagen</span>
                      <span>Nombre y descripción</span>
                      <span>Precio</span>
                      <span>Estado</span>
                      <span className="text-center">Orden</span>
                      <span className="w-[7.25rem] text-right">Acciones</span>
                    </div>
                    {categoryProducts.map((product) => (
                      <ProductRow
                        key={product.id}
                        product={product}
                        translation={getTranslation(product)}
                        currencyCode={currencyCode}
                        isPending={isPending}
                        onEdit={(selectedProduct) =>
                          setDialog({
                            type: "edit",
                            product: selectedProduct,
                          })
                        }
                        onToggle={handleToggle}
                        onDelete={setDeleteCandidate}
                      />
                    ))}
                  </SortableContext>
                ) : (
                  <div className="grid min-h-28 place-items-center text-center">
                    <p className="text-xs text-stone-400">
                      Sin productos en esta categoría.
                    </p>
                  </div>
                )}
              </section>
            );
          })}

          {categories.length === 0 ? (
            <div className="grid min-h-56 place-items-center rounded-2xl border border-stone-200 bg-white px-6 text-center">
              <div>
                <PackageOpen
                  aria-hidden="true"
                  className="mx-auto size-7 text-stone-300"
                />
                <p className="mt-3 text-sm font-bold text-stone-600">
                  Primero necesitas una categoría
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </DndContext>

      {dialog ? (
        <ProductFormDialog
          key={
            dialog.type === "edit"
              ? `edit-${dialog.product.id}`
              : "create-product"
          }
          mode={dialog.type}
          product={dialog.type === "edit" ? dialog.product : undefined}
          categories={categories.map((category) => ({
            ...category,
            productCount: (productsByCategory.get(category.id) ?? []).length,
          }))}
          tags={tags}
          allergens={allergens}
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
            aria-labelledby="delete-product-title"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-red-50 text-red-700">
              <AlertTriangle aria-hidden="true" className="size-5" />
            </span>
            <h2
              id="delete-product-title"
              className="font-display mt-4 text-2xl text-[#173f35]"
            >
              Eliminar producto
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              Se eliminará{" "}
              <strong className="text-stone-700">
                {getTranslation(deleteCandidate)?.name ?? "este producto"}
              </strong>{" "}
              y sus relaciones existentes.
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
