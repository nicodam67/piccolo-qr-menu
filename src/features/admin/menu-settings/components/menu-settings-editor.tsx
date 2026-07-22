"use client";

import { useState, useTransition } from "react";
import {
  Eye,
  ImageIcon,
  LayoutList,
  LoaderCircle,
  Save,
  Tags,
  Text,
  UtensilsCrossed,
  WalletCards,
} from "lucide-react";

import { ProductCard } from "@/components/product-card";
import type { DemoMenu } from "@/features/public-menu/types";
import type { MenuDisplaySettings } from "@/features/menu-settings/config";

import { updateMenuSettingsAction } from "../actions";

type MenuSettingsEditorProps = {
  initialSettings: MenuDisplaySettings;
  previewMenu: DemoMenu;
};

type BooleanSettingKey = Exclude<
  keyof MenuDisplaySettings,
  "layout"
>;

const booleanOptions: Array<{
  key: BooleanSettingKey;
  label: string;
  description: string;
  icon: typeof Eye;
}> = [
  {
    key: "showImages",
    label: "Mostrar imágenes",
    description: "Fotografías principales de los productos.",
    icon: ImageIcon,
  },
  {
    key: "showDescriptions",
    label: "Mostrar descripciones",
    description: "Texto descriptivo bajo el nombre del producto.",
    icon: Text,
  },
  {
    key: "showPrices",
    label: "Mostrar precios",
    description: "Precio completo de cada producto.",
    icon: WalletCards,
  },
  {
    key: "showTags",
    label: "Mostrar etiquetas",
    description: "Indicadores dietéticos y comerciales.",
    icon: Tags,
  },
  {
    key: "showAllergens",
    label: "Mostrar alérgenos",
    description: "Iconos interactivos de alérgenos activos.",
    icon: Eye,
  },
  {
    key: "showHalfPortions",
    label: "Mostrar media ración",
    description: "Precio alternativo cuando exista.",
    icon: UtensilsCrossed,
  },
];

export function MenuSettingsEditor({
  initialSettings,
  previewMenu,
}: MenuSettingsEditorProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const previewProducts = previewMenu.products.slice(0, 2);
  const previewCategory = previewMenu.categories.find((category) =>
    previewProducts.some((product) => product.categoryId === category.id),
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateMenuSettingsAction(formData);
      setFeedback(
        result.success
          ? {
              type: "success",
              message: "Configuración de la carta guardada.",
            }
          : {
              type: "error",
              message:
                result.error ?? "No se pudo guardar la configuración.",
            },
      );
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-extrabold tracking-[0.18em] text-[#a8392f] uppercase">
            Carta pública
          </p>
          <h1 className="font-display mt-1 text-3xl text-[#173f35] sm:text-4xl">
            Configuración de la carta
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
            Elige qué información se muestra y revisa el resultado antes de
            guardar.
          </p>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#173f35] px-5 text-sm font-bold text-white hover:bg-[#245849] disabled:opacity-60"
        >
          {isPending ? (
            <LoaderCircle
              aria-hidden="true"
              className="size-4 animate-spin"
            />
          ) : (
            <Save aria-hidden="true" className="size-4" />
          )}
          Guardar configuración
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(20rem,0.75fr)_minmax(22rem,1.25fr)]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-stone-200 bg-white p-5">
            <h2 className="font-display text-xl text-[#173f35]">
              Datos visibles
            </h2>
            <div className="mt-4 space-y-2">
              {booleanOptions.map((option) => {
                const Icon = option.icon;

                return (
                  <label
                    key={option.key}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-stone-100 px-3 py-3 hover:bg-stone-50"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-stone-100 text-[#173f35]">
                      <Icon aria-hidden="true" className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-stone-700">
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-[10px] leading-4 text-stone-400">
                        {option.description}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      name={option.key}
                      value="true"
                      checked={settings[option.key]}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          [option.key]: event.target.checked,
                        }))
                      }
                      disabled={isPending}
                      className="size-4 accent-[#173f35]"
                    />
                  </label>
                );
              })}
            </div>
          </section>

          <fieldset className="rounded-2xl border border-stone-200 bg-white p-5">
            <legend className="font-display px-1 text-xl text-[#173f35]">
              Tipo de vista
            </legend>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {[
                {
                  value: "cards" as const,
                  label: "Tarjetas",
                  icon: WalletCards,
                },
                {
                  value: "list" as const,
                  label: "Lista",
                  icon: LayoutList,
                },
              ].map((layout) => {
                const Icon = layout.icon;
                const selected = settings.layout === layout.value;

                return (
                  <label
                    key={layout.value}
                    className={`cursor-pointer rounded-xl border p-4 text-center ${
                      selected
                        ? "border-[#173f35] bg-emerald-50 text-[#173f35]"
                        : "border-stone-200 text-stone-500"
                    }`}
                  >
                    <Icon aria-hidden="true" className="mx-auto size-5" />
                    <span className="mt-2 block text-xs font-bold">
                      {layout.label}
                    </span>
                    <input
                      type="radio"
                      name="layout"
                      value={layout.value}
                      checked={selected}
                      onChange={() =>
                        setSettings((current) => ({
                          ...current,
                          layout: layout.value,
                        }))
                      }
                      disabled={isPending}
                      className="sr-only"
                    />
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div aria-live="polite" className="min-h-10">
            {feedback ? (
              <p
                role={feedback.type === "error" ? "alert" : "status"}
                className={`rounded-xl border px-4 py-3 text-xs font-bold ${
                  feedback.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {feedback.message}
              </p>
            ) : null}
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-3 text-[10px] font-extrabold tracking-[0.16em] text-[#a8392f] uppercase">
            Vista previa en tiempo real
          </p>
          <div className="rounded-[1.75rem] border border-stone-200 bg-[#fffdfa] p-4 shadow-[0_24px_70px_-45px_rgba(23,63,53,0.65)]">
            <div className="mx-auto max-w-xl">
              <p className="text-[9px] font-bold tracking-[0.15em] text-stone-400 uppercase">
                {previewCategory?.eyebrow ?? "Categoría"}
              </p>
              <h2 className="font-display mt-1 border-b border-stone-200 pb-2 text-2xl text-[#a8392f]">
                {previewCategory?.name ?? "Vista de productos"}
              </h2>
              <div
                className={
                  settings.layout === "cards"
                    ? "mt-4 grid gap-5 sm:grid-cols-2"
                    : "mt-4 space-y-4"
                }
              >
                {previewProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    settings={settings}
                  />
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}
