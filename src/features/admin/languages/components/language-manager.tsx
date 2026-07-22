"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  CircleOff,
  Globe2,
  LoaderCircle,
  Star,
} from "lucide-react";

import {
  setLanguageEnabledAction,
  setLanguagePublishedAction,
  setPrimaryLanguageAction,
} from "../actions";
import type { LanguageManagementData } from "../repository";
import { LanguageEditor } from "./language-editor";

type LanguageManagerProps = {
  data: LanguageManagementData;
};

export function LanguageManager({ data }: LanguageManagerProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (
    action: () => Promise<{ success: boolean; error: string | null }>,
  ) => {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      setMessage(result.success ? "Cambios guardados." : result.error);
      if (result.success) router.refresh();
    });
  };

  return (
    <>
      <div className="mb-6">
        <p className="text-[10px] font-extrabold tracking-[0.18em] text-[#a8392f] uppercase">
          Carta pública
        </p>
        <h1 className="font-display mt-1 text-3xl text-[#173f35] sm:text-4xl">
          Idiomas
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
          Activa idiomas para traducirlos y publícalos únicamente cuando el
          contenido obligatorio esté completo.
        </p>
      </div>

      <div aria-live="polite" className="mb-3 min-h-6 text-xs font-semibold text-stone-600">
        {isPending ? (
          <span className="inline-flex items-center gap-2">
            <LoaderCircle className="size-4 animate-spin" />
            Guardando…
          </span>
        ) : (
          message
        )}
      </div>

      <section
        aria-label="Idiomas soportados"
        className="overflow-hidden rounded-2xl border border-stone-200 bg-white"
      >
        <div className="hidden grid-cols-[minmax(10rem,1.2fr)_8rem_8rem_8rem_8rem_auto] gap-3 border-b border-stone-200 bg-stone-50 px-4 py-3 text-[9px] font-bold uppercase text-stone-400 lg:grid">
          <span>Idioma</span>
          <span>Activado</span>
          <span>Publicado</span>
          <span>Principal</span>
          <span>Cobertura</span>
          <span>Acciones</span>
        </div>
        {data.languages.map((language) => (
          <article
            key={language.config.code}
            data-testid={`language-${language.config.code}`}
            className="border-b border-stone-100 p-4 last:border-0"
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(10rem,1.2fr)_8rem_8rem_8rem_8rem_auto] lg:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <Globe2 className="size-4 text-[#173f35]" />
                  <h2 className="text-sm font-bold text-[#173f35]">
                    {language.config.nativeName}
                  </h2>
                  <code className="rounded bg-stone-100 px-1.5 py-0.5 text-[9px]">
                    {language.config.code}
                  </code>
                </div>
                <p className="mt-1 text-[10px] text-stone-400">
                  {language.config.adminName} · Soportado
                </p>
              </div>
              {[
                ["Activado", language.isEnabled],
                ["Publicado", language.isPublished],
                ["Principal", language.isPrimary],
              ].map(([label, active]) => (
                <p
                  key={String(label)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600"
                >
                  {active ? (
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  ) : (
                    <CircleOff className="size-4 text-stone-400" />
                  )}
                  {label}: {active ? "Sí" : "No"}
                </p>
              ))}
              <div>
                <p className="text-lg font-extrabold text-[#173f35]">
                  {language.coverage.percentage} %
                </p>
                <p className="text-[10px] text-stone-400">
                  {language.coverage.pending} pendientes
                </p>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <button
                  type="button"
                  disabled={isPending || language.isPrimary}
                  onClick={() => {
                    const next = !language.isEnabled;
                    const confirmed =
                      next ||
                      !language.hasTranslations ||
                      window.confirm(
                        "Este idioma tiene traducciones. ¿Quieres desactivarlo sin borrarlas?",
                      );
                    if (confirmed) {
                      run(() =>
                        setLanguageEnabledAction(
                          language.config.code,
                          next,
                          true,
                        ),
                      );
                    }
                  }}
                  className="min-h-11 rounded-lg border border-stone-200 px-3 text-xs font-bold disabled:opacity-40"
                >
                  {language.isEnabled ? "Desactivar" : "Activar"}
                </button>
                <button
                  type="button"
                  disabled={
                    isPending ||
                    !language.isEnabled ||
                    language.isPrimary ||
                    (!language.isPublished && !language.coverage.complete)
                  }
                  onClick={() => {
                    const next = !language.isPublished;
                    const confirmed =
                      next ||
                      window.confirm(
                        "¿Quieres despublicar este idioma? Sus traducciones se conservarán.",
                      );
                    if (confirmed) {
                      run(() =>
                        setLanguagePublishedAction(
                          language.config.code,
                          next,
                          true,
                        ),
                      );
                    }
                  }}
                  className="min-h-11 rounded-lg border border-stone-200 px-3 text-xs font-bold disabled:opacity-40"
                >
                  {language.isPublished ? "Despublicar" : "Publicar"}
                </button>
                {!language.isPrimary ? (
                  <button
                    type="button"
                    disabled={
                      isPending ||
                      !language.isEnabled ||
                      !language.isPublished ||
                      !language.coverage.complete
                    }
                    onClick={() => {
                      if (
                        window.confirm(
                          "Cambiar el idioma principal afectará carta, x-default, SEO, QR y enlaces compartidos. ¿Continuar?",
                        )
                      ) {
                        run(() =>
                          setPrimaryLanguageAction(
                            language.config.code,
                            true,
                          ),
                        );
                      }
                    }}
                    className="min-h-11 rounded-lg border border-stone-200 px-3 text-xs font-bold disabled:opacity-40"
                  >
                    <Star className="mr-1 inline size-3.5" />
                    Hacer principal
                  </button>
                ) : null}
                {language.isEnabled ? (
                  <Link
                    href={`/admin/languages?edit=${language.config.code}`}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-[#173f35] px-3 text-xs font-bold text-white"
                  >
                    <BookOpen className="size-3.5" />
                    Traducciones
                  </Link>
                ) : null}
              </div>
            </div>
            <details className="mt-3 text-xs text-stone-500">
              <summary className="cursor-pointer font-semibold">
                Ver cobertura
              </summary>
              <dl className="mt-2 grid gap-1 sm:grid-cols-3">
                {Object.entries(language.coverage)
                  .filter(([, value]) => typeof value === "object")
                  .map(([name, value]) => {
                    const metric = value as { translated: number; total: number };
                    return (
                      <div key={name} className="flex justify-between gap-2">
                        <dt className="capitalize">{name}</dt>
                        <dd>{metric.translated}/{metric.total}</dd>
                      </div>
                    );
                  })}
              </dl>
            </details>
          </article>
        ))}
      </section>

      {data.editor ? <LanguageEditor editor={data.editor} /> : null}
    </>
  );
}
