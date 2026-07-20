"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, X } from "lucide-react";

import { TaxonomyIcon } from "@/components/taxonomy-icon";

import {
  createTaxonomyAction,
  updateTaxonomyAction,
} from "../actions";
import type {
  AdminTaxonomyItem,
  TaxonomyKind,
} from "../repository";

type TaxonomyFormDialogProps = {
  kind: TaxonomyKind;
  mode: "create" | "edit";
  item?: AdminTaxonomyItem;
  locales: string[];
  defaultLocale: string;
  maxOrder: number;
  onClose: () => void;
  onSaved: () => void;
};

export function TaxonomyFormDialog({
  kind,
  mode,
  item,
  locales,
  defaultLocale,
  maxOrder,
  onClose,
  onSaved,
}: TaxonomyFormDialogProps) {
  const initialLocale =
    item?.translations.find(
      (translation) => translation.locale === defaultLocale,
    )?.locale ??
    item?.translations[0]?.locale ??
    defaultLocale;
  const initialTranslation = item?.translations.find(
    (translation) => translation.locale === initialLocale,
  );
  const [locale, setLocale] = useState(initialLocale);
  const [name, setName] = useState(initialTranslation?.name ?? "");
  const [code, setCode] = useState(item?.code ?? "");
  const [icon, setIcon] = useState(item?.icon ?? "");
  const [color, setColor] = useState(item?.color ?? "green");
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState(
    String(item?.sortOrder ?? maxOrder),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const singular = kind === "allergen" ? "alérgeno" : "etiqueta";

  const handleLocaleChange = (nextLocale: string) => {
    const translation = item?.translations.find(
      (candidate) => candidate.locale === nextLocale,
    );
    setLocale(nextLocale);
    setName(translation?.name ?? "");
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result =
        mode === "edit" && item
          ? await updateTaxonomyAction(kind, item.id, formData)
          : await createTaxonomyAction(kind, formData);

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
        aria-labelledby="taxonomy-dialog-title"
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-[1.75rem] bg-[#fffdfa] shadow-2xl sm:max-w-xl sm:rounded-[1.75rem]"
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4 sm:px-6">
          <div>
            <p className="text-[9px] font-extrabold tracking-[0.16em] text-[#a8392f] uppercase">
              Gestión de {kind === "allergen" ? "alérgenos" : "etiquetas"}
            </p>
            <h2
              id="taxonomy-dialog-title"
              className="font-display mt-1 text-2xl text-[#173f35]"
            >
              {mode === "create"
                ? kind === "allergen"
                  ? "Nuevo alérgeno"
                  : "Nueva etiqueta"
                : `Editar ${singular}`}
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
              htmlFor="taxonomy-locale"
              className="text-xs font-bold text-stone-700"
            >
              Idioma
            </label>
            <select
              id="taxonomy-locale"
              name="locale"
              value={locale}
              onChange={(event) => handleLocaleChange(event.target.value)}
              disabled={isPending}
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
              htmlFor="taxonomy-name"
              className="text-xs font-bold text-stone-700"
            >
              Nombre
            </label>
            <input
              id="taxonomy-name"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={120}
              autoFocus
              disabled={isPending}
              className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none focus:border-[#245849] focus:ring-3 focus:ring-[#245849]/10"
            />
          </div>

          {kind === "allergen" ? (
            <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
              <div>
                <label
                  htmlFor="taxonomy-code"
                  className="text-xs font-bold text-stone-700"
                >
                  Código
                </label>
                <input
                  id="taxonomy-code"
                  name="code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  required
                  maxLength={50}
                  disabled={isPending}
                  className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none focus:border-[#245849]"
                />
              </div>
              <div>
                <label
                  htmlFor="taxonomy-icon"
                  className="text-xs font-bold text-stone-700"
                >
                  Icono
                </label>
                <input
                  id="taxonomy-icon"
                  name="icon"
                  value={icon}
                  onChange={(event) => setIcon(event.target.value)}
                  required
                  maxLength={100}
                  disabled={isPending}
                  className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none focus:border-[#245849]"
                />
              </div>
              <span className="grid size-11 place-items-center rounded-xl bg-stone-100 text-xl">
                <TaxonomyIcon icon={icon} label={name || "Vista previa"} />
              </span>
            </div>
          ) : (
            <div>
              <label
                htmlFor="taxonomy-color"
                className="text-xs font-bold text-stone-700"
              >
                Color
              </label>
              <div className="mt-2 flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="size-8 rounded-full border border-stone-200"
                  style={{ backgroundColor: color }}
                />
                <input
                  id="taxonomy-color"
                  name="color"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  required
                  maxLength={30}
                  disabled={isPending}
                  className="min-h-11 flex-1 rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none focus:border-[#245849]"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="taxonomy-order"
                className="text-xs font-bold text-stone-700"
              >
                Orden
              </label>
              <input
                id="taxonomy-order"
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
            <label className="mt-[1.65rem] flex min-h-11 cursor-pointer items-center justify-between rounded-xl border border-stone-200 bg-white px-3">
              <span className="text-xs font-bold text-stone-700">Activo</span>
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
              className="min-h-11 flex-1 rounded-xl border border-stone-200 bg-white px-4 text-sm font-bold text-stone-600"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#173f35] px-4 text-sm font-bold text-white disabled:opacity-60"
            >
              {isPending ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
              ) : null}
              {mode === "create" ? `Crear ${singular}` : "Guardar cambios"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
