"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Save } from "lucide-react";

import { updateBrandingAction } from "../actions";
import type {
  BrandingOpeningDay,
  RestaurantBrandingData,
} from "../repository";
import { BrandingPreview } from "./branding-preview";

type BrandingEditorProps = {
  initialData: RestaurantBrandingData;
};

export function BrandingEditor({ initialData }: BrandingEditorProps) {
  const initialTranslation =
    initialData.translations.find(
      (translation) => translation.locale === initialData.defaultLocale,
    ) ?? initialData.translations[0];
  const [locale, setLocale] = useState(
    initialTranslation?.locale ?? initialData.defaultLocale,
  );
  const [defaultLocale, setDefaultLocale] = useState(
    initialData.defaultLocale,
  );
  const [name, setName] = useState(initialTranslation?.name ?? "");
  const [slogan, setSlogan] = useState(initialTranslation?.slogan ?? "");
  const [description, setDescription] = useState(
    initialTranslation?.description ?? "",
  );
  const [phone, setPhone] = useState(initialData.phone);
  const [address, setAddress] = useState(initialData.address);
  const [timezone, setTimezone] = useState(initialData.timezone);
  const [currencyCode, setCurrencyCode] = useState(initialData.currencyCode);
  const [heroImageUrl, setHeroImageUrl] = useState(initialData.heroImageUrl);
  const [openingHours, setOpeningHours] = useState(initialData.openingHours);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleLocaleChange = (nextLocale: string) => {
    const translation = initialData.translations.find(
      (item) => item.locale === nextLocale,
    );
    setLocale(nextLocale);
    setName(translation?.name ?? "");
    setSlogan(translation?.slogan ?? "");
    setDescription(translation?.description ?? "");
  };

  const updateOpeningDay = (
    dayOfWeek: number,
    changes: Partial<BrandingOpeningDay>,
  ) => {
    setOpeningHours((current) =>
      current.map((day) =>
        day.dayOfWeek === dayOfWeek ? { ...day, ...changes } : day,
      ),
    );
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateBrandingAction(formData);

      setFeedback(
        result.success
          ? { type: "success", message: "Branding guardado correctamente." }
          : {
              type: "error",
              message: result.error ?? "No se pudieron guardar los cambios.",
            },
      );
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="hidden"
        name="openingHours"
        value={JSON.stringify(openingHours)}
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-extrabold tracking-[0.18em] text-[#a8392f] uppercase">
            Restaurante
          </p>
          <h1 className="font-display mt-1 text-3xl text-[#173f35] sm:text-4xl">
            Branding
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
            Edita la identidad y la información pública usando únicamente los
            campos existentes.
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
          Guardar cambios
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
            <h2 className="font-display text-xl text-[#173f35]">
              Identidad
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="branding-locale"
                  className="text-xs font-bold text-stone-700"
                >
                  Idioma de edición
                </label>
                <select
                  id="branding-locale"
                  name="locale"
                  value={locale}
                  onChange={(event) => handleLocaleChange(event.target.value)}
                  disabled={isPending}
                  className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm uppercase outline-none focus:border-[#245849]"
                >
                  {initialData.translations.map((translation) => (
                    <option
                      key={translation.locale}
                      value={translation.locale}
                    >
                      {translation.locale.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="branding-default-locale"
                  className="text-xs font-bold text-stone-700"
                >
                  Idioma predeterminado
                </label>
                <select
                  id="branding-default-locale"
                  name="defaultLocale"
                  value={defaultLocale}
                  onChange={(event) => setDefaultLocale(event.target.value)}
                  disabled={isPending}
                  className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm uppercase outline-none focus:border-[#245849]"
                >
                  {initialData.translations.map((translation) => (
                    <option
                      key={translation.locale}
                      value={translation.locale}
                    >
                      {translation.locale.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="branding-name"
                  className="text-xs font-bold text-stone-700"
                >
                  Nombre del restaurante
                </label>
                <input
                  id="branding-name"
                  name="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  maxLength={160}
                  disabled={isPending}
                  className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none focus:border-[#245849] focus:ring-3 focus:ring-[#245849]/10"
                />
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="branding-slogan"
                  className="text-xs font-bold text-stone-700"
                >
                  Eslogan
                </label>
                <input
                  id="branding-slogan"
                  name="slogan"
                  value={slogan}
                  onChange={(event) => setSlogan(event.target.value)}
                  required
                  maxLength={240}
                  disabled={isPending}
                  className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none focus:border-[#245849]"
                />
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="branding-description"
                  className="text-xs font-bold text-stone-700"
                >
                  Descripción
                </label>
                <textarea
                  id="branding-description"
                  name="description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  disabled={isPending}
                  className="mt-2 w-full resize-none rounded-xl border border-stone-200 px-3 py-3 text-sm outline-none focus:border-[#245849]"
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
            <h2 className="font-display text-xl text-[#173f35]">
              Contacto y portada
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="branding-phone"
                  className="text-xs font-bold text-stone-700"
                >
                  Teléfono
                </label>
                <input
                  id="branding-phone"
                  name="phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  required
                  maxLength={40}
                  disabled={isPending}
                  className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none focus:border-[#245849]"
                />
              </div>
              <div>
                <label
                  htmlFor="branding-timezone"
                  className="text-xs font-bold text-stone-700"
                >
                  Zona horaria
                </label>
                <input
                  id="branding-timezone"
                  name="timezone"
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  required
                  maxLength={64}
                  disabled={isPending}
                  className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none focus:border-[#245849]"
                />
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="branding-address"
                  className="text-xs font-bold text-stone-700"
                >
                  Dirección
                </label>
                <input
                  id="branding-address"
                  name="address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  required
                  disabled={isPending}
                  className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none focus:border-[#245849]"
                />
              </div>
              <div>
                <label
                  htmlFor="branding-currency"
                  className="text-xs font-bold text-stone-700"
                >
                  Moneda
                </label>
                <input
                  id="branding-currency"
                  name="currencyCode"
                  value={currencyCode}
                  onChange={(event) =>
                    setCurrencyCode(event.target.value.toUpperCase())
                  }
                  required
                  minLength={3}
                  maxLength={3}
                  disabled={isPending}
                  className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 px-3 text-sm uppercase outline-none focus:border-[#245849]"
                />
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="branding-hero-image"
                  className="text-xs font-bold text-stone-700"
                >
                  Imagen principal
                </label>
                <input
                  id="branding-hero-image"
                  name="heroImageUrl"
                  type="url"
                  value={heroImageUrl}
                  onChange={(event) => setHeroImageUrl(event.target.value)}
                  required
                  disabled={isPending}
                  className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none focus:border-[#245849]"
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
            <h2 className="font-display text-xl text-[#173f35]">Horario</h2>
            <p className="mt-1 text-xs text-stone-400">
              Configura uno o dos turnos por día.
            </p>
            <div className="mt-4 divide-y divide-stone-100">
              {openingHours.map((day) => (
                <fieldset
                  key={day.dayOfWeek}
                  className="grid gap-3 py-4 sm:grid-cols-[7rem_1fr]"
                >
                  <div>
                    <legend className="text-sm font-bold text-[#173f35]">
                      {day.label}
                    </legend>
                    <label className="mt-2 flex items-center gap-2 text-[10px] text-stone-500">
                      <input
                        type="checkbox"
                        checked={day.isClosed}
                        onChange={(event) =>
                          updateOpeningDay(day.dayOfWeek, {
                            isClosed: event.target.checked,
                          })
                        }
                        disabled={isPending}
                        aria-label={`${day.label} cerrado`}
                        className="size-3.5 accent-[#173f35]"
                      />
                      Cerrado
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      ["firstOpensAt", "Apertura 1"],
                      ["firstClosesAt", "Cierre 1"],
                      ["secondOpensAt", "Apertura 2"],
                      ["secondClosesAt", "Cierre 2"],
                    ].map(([field, label]) => (
                      <label
                        key={field}
                        className="text-[9px] font-bold text-stone-500"
                      >
                        {label}
                        <input
                          type="time"
                          value={day[field as keyof BrandingOpeningDay] as string}
                          onChange={(event) =>
                            updateOpeningDay(day.dayOfWeek, {
                              [field]: event.target.value,
                            })
                          }
                          disabled={day.isClosed || isPending}
                          aria-label={`${day.label} ${label.toLowerCase()}`}
                          className="mt-1 min-h-10 w-full rounded-lg border border-stone-200 px-2 text-xs outline-none focus:border-[#245849] disabled:bg-stone-50"
                        />
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          </section>

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

        <BrandingPreview
          name={name}
          slogan={slogan}
          description={description}
          address={address}
          phone={phone}
          heroImageUrl={heroImageUrl}
          openingHours={openingHours}
        />
      </div>
    </form>
  );
}
