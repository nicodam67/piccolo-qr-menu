"use client";

import { Languages } from "lucide-react";
import { useRouter } from "next/navigation";

import type { PublishedLocale } from "@/features/locales/repository";
import { getPublicProductPath } from "@/features/public-menu/product-url";

type LanguageSelectorProps = {
  locales: PublishedLocale[];
  currentLocale: string;
  productId?: string;
  productLocales?: Array<{ code: string; name: string }>;
  unavailableMessage: string;
};

export function LanguageSelector({
  locales,
  currentLocale,
  productId,
  productLocales = [],
  unavailableMessage,
}: LanguageSelectorProps) {
  const router = useRouter();

  return (
    <label className="flex min-h-10 items-center gap-1.5 rounded-full border border-white/20 bg-black/25 px-3 text-xs font-bold text-white backdrop-blur-md">
      <Languages aria-hidden="true" className="size-3.5" />
      <span className="sr-only">Seleccionar idioma</span>
      <select
        aria-label="Idioma"
        value={currentLocale}
        onChange={(event) => {
          const targetLocale = event.target.value;
          const translatedProduct = productLocales.find(
            (candidate) => candidate.code === targetLocale,
          );

          if (productId && translatedProduct) {
            router.push(
              getPublicProductPath(
                targetLocale,
                productId,
                translatedProduct.name,
              ),
            );
            return;
          }

          if (productId && !translatedProduct) {
            window.alert(unavailableMessage);
          }

          router.push(`/${targetLocale}`);
        }}
        className="cursor-pointer appearance-none bg-transparent pr-1 outline-none"
      >
        {locales.map((locale) => (
          <option
            key={locale.code}
            value={locale.code}
            className="text-stone-900"
          >
            {locale.nativeName} ({locale.code.toUpperCase()})
          </option>
        ))}
      </select>
    </label>
  );
}
