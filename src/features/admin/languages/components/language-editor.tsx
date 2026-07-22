"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Save, Search } from "lucide-react";

import { getLocaleConfig } from "@/config/locales";

import { saveLanguageTranslationsAction } from "../actions";
import type { LanguageEditorData } from "../repository";

type LanguageEditorProps = {
  editor: LanguageEditorData;
};

function StatusLabel({ complete }: { complete: boolean }) {
  return (
    <span
      className={`text-[10px] font-bold ${
        complete ? "text-emerald-700" : "text-amber-700"
      }`}
    >
      {complete ? "Completo" : "Pendiente"}
    </span>
  );
}

export function LanguageEditor({ editor }: LanguageEditorProps) {
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const localeConfig = getLocaleConfig(editor.locale);
  const filteredProducts = editor.products.filter((product) =>
    `${product.referenceName} ${product.categoryName}`
      .toLocaleLowerCase("es")
      .includes(productQuery.trim().toLocaleLowerCase("es")),
  );

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setFeedback(null);
    const payload = {
      restaurant: {
        name: formData.get("restaurant-name"),
        slogan: formData.get("restaurant-slogan"),
        description: formData.get("restaurant-description"),
      },
      categories: editor.categories.map((item) => ({
        id: item.id,
        name: formData.get(`category-${item.id}`),
      })),
      products: editor.products.map((item) => ({
        id: item.id,
        name: formData.get(`product-name-${item.id}`),
        description: formData.get(`product-description-${item.id}`),
      })),
      tags: editor.tags.map((item) => ({
        id: item.id,
        name: formData.get(`tag-${item.id}`),
      })),
      allergens: editor.allergens.map((item) => ({
        id: item.id,
        name: formData.get(`allergen-${item.id}`),
      })),
    };

    startTransition(async () => {
      const result = await saveLanguageTranslationsAction(
        editor.locale,
        payload,
      );
      setFeedback(
        result.success
          ? "Traducciones guardadas correctamente."
          : result.error,
      );
      if (result.success) {
        setDirty(false);
        router.refresh();
      }
    });
  };

  const inputClass =
    "mt-1 min-h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm outline-none focus:border-[#245849] focus:ring-2 focus:ring-[#245849]/10";

  return (
    <form
      onSubmit={handleSubmit}
      onChange={() => setDirty(true)}
      className="mt-6 space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-wide text-[#a8392f] uppercase">
            Editor
          </p>
          <h2 className="font-display text-2xl text-[#173f35]">
            {localeConfig?.nativeName ?? editor.locale.toUpperCase()}
          </h2>
        </div>
        <button
          type="submit"
          disabled={isPending || !dirty}
          className="flex min-h-11 items-center gap-2 rounded-xl bg-[#173f35] px-5 text-sm font-bold text-white disabled:opacity-50"
        >
          {isPending ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Guardar traducciones
        </button>
      </div>

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h3 className="font-display text-xl text-[#173f35]">Restaurante</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[
            ["name", "Nombre", editor.restaurant.referenceName, editor.restaurant.name],
            ["slogan", "Eslogan", editor.restaurant.referenceSlogan, editor.restaurant.slogan],
          ].map(([key, label, reference, value]) => (
            <label key={key} className="text-xs font-bold text-stone-600">
              {label}
              <span className="mt-1 block text-[10px] font-normal text-stone-400">
                Referencia: {reference || "—"}
              </span>
              <input
                name={`restaurant-${key}`}
                defaultValue={value}
                maxLength={key === "name" ? 160 : 240}
                className={inputClass}
              />
            </label>
          ))}
          <label className="text-xs font-bold text-stone-600 sm:col-span-2">
            Descripción
            <span className="mt-1 block text-[10px] font-normal text-stone-400">
              Referencia: {editor.restaurant.referenceDescription || "—"}
            </span>
            <textarea
              name="restaurant-description"
              defaultValue={editor.restaurant.description}
              rows={3}
              className={`${inputClass} py-2`}
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h3 className="font-display text-xl text-[#173f35]">Categorías</h3>
        <div className="mt-3 divide-y divide-stone-100">
          {editor.categories.map((item) => (
            <label key={item.id} className="block py-3 text-xs font-bold text-stone-600">
              {item.referenceName}
              <StatusLabel complete={Boolean(item.translatedName.trim())} />
              <input
                name={`category-${item.id}`}
                defaultValue={item.translatedName}
                maxLength={160}
                className={inputClass}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-xl text-[#173f35]">Productos</h3>
          <label className="relative">
            <span className="sr-only">Buscar productos</span>
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" />
            <input
              type="search"
              value={productQuery}
              onChange={(event) => setProductQuery(event.target.value)}
              placeholder="Buscar productos…"
              className="min-h-10 rounded-lg border border-stone-200 pl-9 pr-3 text-sm"
            />
          </label>
        </div>
        <div className="mt-3 space-y-3">
          {filteredProducts.map((item) => (
            <article key={item.id} className="rounded-xl border border-stone-100 p-3">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-[#173f35]">{item.referenceName}</p>
                  <p className="text-[10px] text-stone-400">{item.categoryName}</p>
                </div>
                <StatusLabel
                  complete={
                    Boolean(item.translatedName.trim()) &&
                    (!item.descriptionRequired ||
                      Boolean(item.translatedDescription?.trim()))
                  }
                />
              </div>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <label className="text-[10px] font-bold text-stone-500">
                  Nombre traducido
                  <input
                    name={`product-name-${item.id}`}
                    defaultValue={item.translatedName}
                    maxLength={200}
                    className={inputClass}
                  />
                </label>
                <label className="text-[10px] font-bold text-stone-500">
                  Descripción traducida
                  {item.descriptionRequired ? " · obligatoria" : " · opcional"}
                  <textarea
                    name={`product-description-${item.id}`}
                    defaultValue={item.translatedDescription}
                    rows={2}
                    className={`${inputClass} py-2`}
                  />
                </label>
              </div>
            </article>
          ))}
        </div>
      </section>

      {[
        { title: "Etiquetas", items: editor.tags, prefix: "tag" },
        { title: "Alérgenos", items: editor.allergens, prefix: "allergen" },
      ].map((group) => (
        <section
          key={group.title}
          className="rounded-2xl border border-stone-200 bg-white p-5"
        >
          <h3 className="font-display text-xl text-[#173f35]">{group.title}</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {group.items.map((item) => (
              <label key={item.id} className="text-xs font-bold text-stone-600">
                {item.referenceName}
                {item.technicalCode ? ` · ${item.technicalCode}` : ""}
                <StatusLabel complete={Boolean(item.translatedName.trim())} />
                <input
                  name={`${group.prefix}-${item.id}`}
                  defaultValue={item.translatedName}
                  maxLength={120}
                  className={inputClass}
                />
              </label>
            ))}
          </div>
        </section>
      ))}

      <div aria-live="polite" className="min-h-6 text-sm font-semibold text-stone-600">
        {feedback}
      </div>
    </form>
  );
}
