"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, X } from "lucide-react";

import { TaxonomyIcon } from "@/components/taxonomy-icon";

import {
  createProductAction,
  updateProductAction,
} from "../actions";
import type {
  AdminProduct,
  ProductAllergenOption,
  ProductCategoryOption,
  ProductTagOption,
} from "../repository";
import { ProductImageManager } from "./product-image-manager";

type ProductFormDialogProps = {
  mode: "create" | "edit";
  product?: AdminProduct;
  categories: ProductCategoryOption[];
  tags: ProductTagOption[];
  allergens: ProductAllergenOption[];
  locales: string[];
  defaultLocale: string;
  onClose: () => void;
  onSaved: () => void;
};

function formatPrice(cents: number | null) {
  return cents === null ? "" : (cents / 100).toFixed(2);
}

export function ProductFormDialog({
  mode,
  product,
  categories,
  tags,
  allergens,
  locales,
  defaultLocale,
  onClose,
  onSaved,
}: ProductFormDialogProps) {
  const initialLocale =
    product?.translations.find(
      (translation) => translation.locale === defaultLocale,
    )?.locale ??
    product?.translations[0]?.locale ??
    defaultLocale;
  const initialTranslation = product?.translations.find(
    (translation) => translation.locale === initialLocale,
  );
  const initialCategoryId = product?.categoryId ?? categories[0]?.id ?? "";
  const [locale, setLocale] = useState(initialLocale);
  const [name, setName] = useState(initialTranslation?.name ?? "");
  const [description, setDescription] = useState(
    initialTranslation?.description ?? "",
  );
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [fullPrice, setFullPrice] = useState(
    formatPrice(product?.fullPriceCents ?? 0),
  );
  const [halfPrice, setHalfPrice] = useState(
    formatPrice(product?.halfPriceCents ?? null),
  );
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? "");
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [isSoldOut, setIsSoldOut] = useState(product?.isSoldOut ?? false);
  const [selectedTagIds, setSelectedTagIds] = useState(product?.tagIds ?? []);
  const [selectedAllergenIds, setSelectedAllergenIds] = useState(
    product?.allergenIds ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [uploadCommitState] = useState(() => ({ committed: false }));

  const getMaxOrder = (nextCategoryId: string) => {
    const category = categories.find(({ id }) => id === nextCategoryId);

    if (!category) {
      return 1;
    }

    return mode === "edit" && product?.categoryId === nextCategoryId
      ? Math.max(category.productCount, 1)
      : category.productCount + 1;
  };

  const [sortOrder, setSortOrder] = useState(
    String(product?.sortOrder ?? getMaxOrder(initialCategoryId)),
  );
  const maxOrder = getMaxOrder(categoryId);
  const availableTags = tags.filter(
    (tag) => tag.isActive || selectedTagIds.includes(tag.id),
  );
  const availableAllergens = allergens.filter(
    (allergen) =>
      allergen.isActive || selectedAllergenIds.includes(allergen.id),
  );
  const selectedTags = tags.filter((tag) => selectedTagIds.includes(tag.id));
  const selectedAllergens = allergens.filter((allergen) =>
    selectedAllergenIds.includes(allergen.id),
  );

  const handleLocaleChange = (nextLocale: string) => {
    const translation = product?.translations.find(
      (item) => item.locale === nextLocale,
    );
    setLocale(nextLocale);
    setName(translation?.name ?? "");
    setDescription(translation?.description ?? "");
  };

  const handleCategoryChange = (nextCategoryId: string) => {
    setCategoryId(nextCategoryId);
    setSortOrder(String(getMaxOrder(nextCategoryId)));
  };

  const toggleSelection = (
    id: string,
    selectedIds: string[],
    setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    setSelectedIds(
      selectedIds.includes(id)
        ? selectedIds.filter((selectedId) => selectedId !== id)
        : [...selectedIds, id],
    );
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result =
        mode === "edit" && product
          ? await updateProductAction(product.id, formData)
          : await createProductAction(formData);

      if (!result.success) {
        setError(result.error);
        return;
      }

      uploadCommitState.committed = true;
      onSaved();
    });
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-end bg-[#17201d]/40 p-0 backdrop-blur-[2px] sm:place-items-center sm:p-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-dialog-title"
        className="max-h-[94vh] w-full overflow-y-auto rounded-t-[1.75rem] bg-[#fffdfa] shadow-2xl sm:max-w-3xl sm:rounded-[1.75rem]"
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4 sm:px-6">
          <div>
            <p className="text-[9px] font-extrabold tracking-[0.16em] text-[#a8392f] uppercase">
              Gestión de productos
            </p>
            <h2
              id="product-dialog-title"
              className="font-display mt-1 text-2xl text-[#173f35]"
            >
              {mode === "create" ? "Nuevo producto" : "Editar producto"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar formulario"
            className="grid size-10 place-items-center rounded-full text-stone-500 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-[#173f35]"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="product-locale"
                className="text-xs font-bold text-stone-700"
              >
                Idioma
              </label>
              <select
                id="product-locale"
                name="locale"
                value={locale}
                disabled={isPending}
                onChange={(event) => handleLocaleChange(event.target.value)}
                className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm uppercase outline-none focus:border-[#245849]"
              >
                {locales.map((availableLocale) => (
                  <option key={availableLocale} value={availableLocale}>
                    {availableLocale.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="product-category"
                className="text-xs font-bold text-stone-700"
              >
                Categoría
              </label>
              <select
                id="product-category"
                name="categoryId"
                value={categoryId}
                required
                disabled={isPending}
                onChange={(event) =>
                  handleCategoryChange(event.target.value)
                }
                className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none focus:border-[#245849]"
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.path}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="product-name"
              className="text-xs font-bold text-stone-700"
            >
              Nombre
            </label>
            <input
              id="product-name"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={200}
              autoFocus
              disabled={isPending}
              className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none focus:border-[#245849] focus:ring-3 focus:ring-[#245849]/10"
            />
          </div>

          <div>
            <label
              htmlFor="product-description"
              className="text-xs font-bold text-stone-700"
            >
              Descripción
            </label>
            <textarea
              id="product-description"
              name="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              disabled={isPending}
              className="mt-2 w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm outline-none focus:border-[#245849] focus:ring-3 focus:ring-[#245849]/10"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="product-full-price"
                className="text-xs font-bold text-stone-700"
              >
                Precio completo
              </label>
              <input
                id="product-full-price"
                name="fullPrice"
                type="text"
                inputMode="decimal"
                value={fullPrice}
                onChange={(event) => setFullPrice(event.target.value)}
                required
                disabled={isPending}
                className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none focus:border-[#245849]"
              />
            </div>
            <div>
              <label
                htmlFor="product-half-price"
                className="text-xs font-bold text-stone-700"
              >
                Media ración
              </label>
              <input
                id="product-half-price"
                name="halfPrice"
                type="text"
                inputMode="decimal"
                value={halfPrice}
                onChange={(event) => setHalfPrice(event.target.value)}
                disabled={isPending}
                className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none focus:border-[#245849]"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label
                htmlFor="product-order"
                className="text-xs font-bold text-stone-700"
              >
                Orden
              </label>
              <input
                id="product-order"
                name="sortOrder"
                type="number"
                min={1}
                max={maxOrder}
                step={1}
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
                required
                disabled={isPending}
                className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none focus:border-[#245849]"
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold text-stone-700">
              Imagen del producto
            </p>
            <ProductImageManager
              value={imageUrl}
              initialValue={product?.imageUrl ?? ""}
              onChange={setImageUrl}
              commitState={uploadCommitState}
              disabled={isPending}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex min-h-11 cursor-pointer items-center justify-between rounded-xl border border-stone-200 bg-white px-3">
              <span className="text-xs font-bold text-stone-700">Visible</span>
              <input
                type="checkbox"
                name="isActive"
                value="true"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
                disabled={isPending}
                className="size-4 accent-[#173f35]"
              />
            </label>
            <label className="flex min-h-11 cursor-pointer items-center justify-between rounded-xl border border-stone-200 bg-white px-3">
              <span className="text-xs font-bold text-stone-700">Agotado</span>
              <input
                type="checkbox"
                name="isSoldOut"
                value="true"
                checked={isSoldOut}
                onChange={(event) => setIsSoldOut(event.target.checked)}
                disabled={isPending}
                className="size-4 accent-[#a8392f]"
              />
            </label>
          </div>

          <fieldset>
            <legend className="text-xs font-bold text-stone-700">
              Etiquetas existentes
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {availableTags.map((tag) => (
                <label
                  key={tag.id}
                  className="flex cursor-pointer items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600"
                >
                  <input
                    type="checkbox"
                    name="tagIds"
                    value={tag.id}
                    checked={selectedTagIds.includes(tag.id)}
                    onChange={() =>
                      toggleSelection(
                        tag.id,
                        selectedTagIds,
                        setSelectedTagIds,
                      )
                    }
                    disabled={isPending}
                    className="size-3.5 accent-[#173f35]"
                  />
                  {tag.name}
                  {!tag.isActive ? " · inactiva" : ""}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-bold text-stone-700">
              Alérgenos existentes
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {availableAllergens.map((allergen) => (
                <label
                  key={allergen.id}
                  className="flex cursor-pointer items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600"
                >
                  <input
                    type="checkbox"
                    name="allergenIds"
                    value={allergen.id}
                    checked={selectedAllergenIds.includes(allergen.id)}
                    onChange={() =>
                      toggleSelection(
                        allergen.id,
                        selectedAllergenIds,
                        setSelectedAllergenIds,
                      )
                    }
                    disabled={isPending}
                    className="size-3.5 accent-[#a8392f]"
                  />
                  {allergen.name}
                  {!allergen.isActive ? " · inactivo" : ""}
                </label>
              ))}
            </div>
          </fieldset>

          <section
            aria-label="Vista previa de etiquetas y alérgenos"
            className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
          >
            <p className="text-[10px] font-extrabold tracking-[0.12em] text-stone-500 uppercase">
              Vista previa de la selección
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedTags.map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#173f35] ring-1 ring-stone-200"
                >
                  {tag.name}
                </span>
              ))}
              {selectedAllergens.map((allergen) => (
                <span
                  key={allergen.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs text-stone-600 ring-1 ring-stone-200"
                >
                  <TaxonomyIcon
                    icon={allergen.icon}
                    label={allergen.name}
                  />
                  {allergen.name}
                </span>
              ))}
              {selectedTags.length === 0 &&
              selectedAllergens.length === 0 ? (
                <span className="text-xs text-stone-400">
                  Sin etiquetas ni alérgenos seleccionados.
                </span>
              ) : null}
            </div>
          </section>

          <div aria-live="polite" className="min-h-5">
            {error ? (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
              >
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex gap-3 border-t border-stone-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="min-h-11 flex-1 rounded-xl border border-stone-200 bg-white px-4 text-sm font-bold text-stone-600"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending || categories.length === 0}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#173f35] px-4 text-sm font-bold text-white disabled:opacity-60"
            >
              {isPending ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
              ) : null}
              {mode === "create" ? "Crear producto" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
