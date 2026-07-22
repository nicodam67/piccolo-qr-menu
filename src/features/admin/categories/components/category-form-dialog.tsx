"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, X } from "lucide-react";

import {
  createCategoryAction,
  updateCategoryAction,
} from "../actions";
import type { AdminCategory } from "../repository";

type CategoryFormDialogProps = {
  mode: "create" | "edit";
  category?: AdminCategory;
  categories: AdminCategory[];
  initialParentCategoryId?: string | null;
  locales: string[];
  defaultLocale: string;
  onClose: () => void;
  onSaved: () => void;
};

export function CategoryFormDialog({
  mode,
  category,
  categories,
  initialParentCategoryId,
  locales,
  defaultLocale,
  onClose,
  onSaved,
}: CategoryFormDialogProps) {
  const initialLocale =
    category?.translations.find(
      (translation) => translation.locale === defaultLocale,
    )?.locale ??
    category?.translations[0]?.locale ??
    defaultLocale;
  const initialTranslation = category?.translations.find(
    (translation) => translation.locale === initialLocale,
  );
  const [locale, setLocale] = useState(initialLocale);
  const [name, setName] = useState(initialTranslation?.name ?? "");
  const [description, setDescription] = useState(
    initialTranslation?.description ?? "",
  );
  const [isActive, setIsActive] = useState(category?.isActive ?? true);
  const [parentCategoryId, setParentCategoryId] = useState(
    category?.parentCategoryId ?? initialParentCategoryId ?? "",
  );
  const maxOrder =
    categories.filter(
      (item) =>
        item.id !== category?.id &&
        (item.parentCategoryId ?? "") === parentCategoryId,
    ).length + 1;
  const [sortOrder, setSortOrder] = useState(
    String(category?.sortOrder ?? maxOrder),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleLocaleChange = (nextLocale: string) => {
    const translation = category?.translations.find(
      (item) => item.locale === nextLocale,
    );
    setLocale(nextLocale);
    setName(translation?.name ?? "");
    setDescription(translation?.description ?? "");
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result =
        mode === "edit" && category
          ? await updateCategoryAction(category.id, formData)
          : await createCategoryAction(formData);

      if (!result.success) {
        setError(result.error);
        return;
      }

      onSaved();
    });
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-end bg-[#17201d]/40 p-0 backdrop-blur-[2px] sm:place-items-center sm:p-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-dialog-title"
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-[1.75rem] bg-[#fffdfa] shadow-2xl sm:max-w-xl sm:rounded-[1.75rem]"
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4 sm:px-6">
          <div>
            <p className="text-[9px] font-extrabold tracking-[0.16em] text-[#a8392f] uppercase">
              Gestión de categorías
            </p>
            <h2
              id="category-dialog-title"
              className="font-display mt-1 text-2xl text-[#173f35]"
            >
              {mode === "create" ? "Nueva categoría" : "Editar categoría"}
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
          <div>
            <label
              htmlFor="category-parent"
              className="text-xs font-bold text-stone-700"
            >
              Categoría principal
            </label>
            <select
              id="category-parent"
              name="parentCategoryId"
              value={parentCategoryId}
              disabled={isPending}
              onChange={(event) => {
                setParentCategoryId(event.target.value);
                setSortOrder("1");
              }}
              className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none focus:border-[#245849]"
            >
              <option value="">Sin padre · categoría principal</option>
              {categories
                .filter(
                  (item) => item.id !== category?.id,
                )
                .map((item) => {
                  const translation =
                    item.translations.find(
                      (entry) => entry.locale === locale,
                    ) ?? item.translations[0];
                  return (
                    <option
                      key={item.id}
                      value={item.id}
                      disabled={item.parentCategoryId !== null}
                    >
                      {item.parentCategoryId ? "↳ " : ""}
                      {translation?.name ?? "Sin traducción"}
                      {item.parentCategoryId ? " · no puede ser padre" : ""}
                    </option>
                  );
                })}
            </select>
            <p className="mt-1 text-[10px] text-stone-500">
              Sin padre crea una categoría principal. Con padre crea una
              subcategoría.
            </p>
          </div>

          <div>
            <label
              htmlFor="category-locale"
              className="text-xs font-bold text-stone-700"
            >
              Idioma
            </label>
            <select
              id="category-locale"
              name="locale"
              value={locale}
              disabled={isPending}
              onChange={(event) => handleLocaleChange(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none focus:border-[#245849] focus:ring-3 focus:ring-[#245849]/10"
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
              htmlFor="category-name"
              className="text-xs font-bold text-stone-700"
            >
              Nombre
            </label>
            <input
              id="category-name"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isPending}
              required
              maxLength={160}
              autoFocus
              className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none focus:border-[#245849] focus:ring-3 focus:ring-[#245849]/10"
            />
          </div>

          <div>
            <label
              htmlFor="category-description"
              className="text-xs font-bold text-stone-700"
            >
              Descripción
            </label>
            <textarea
              id="category-description"
              name="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={isPending}
              rows={3}
              className="mt-2 w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm text-stone-900 outline-none focus:border-[#245849] focus:ring-3 focus:ring-[#245849]/10"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="category-order"
                className="text-xs font-bold text-stone-700"
              >
                Orden
              </label>
              <input
                id="category-order"
                name="sortOrder"
                type="number"
                min={1}
                max={maxOrder}
                step={1}
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
                disabled={isPending}
                required
                className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none focus:border-[#245849] focus:ring-3 focus:ring-[#245849]/10"
              />
            </div>

            <label className="mt-[1.65rem] flex min-h-11 cursor-pointer items-center justify-between rounded-xl border border-stone-200 bg-white px-3">
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
          </div>

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
              className="min-h-11 flex-1 rounded-xl border border-stone-200 bg-white px-4 text-sm font-bold text-stone-600 hover:bg-stone-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#173f35] px-4 text-sm font-bold text-white hover:bg-[#245849] disabled:opacity-60"
            >
              {isPending ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
              ) : null}
              {mode === "create" ? "Crear categoría" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
