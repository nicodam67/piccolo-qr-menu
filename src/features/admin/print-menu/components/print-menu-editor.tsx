"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Printer } from "lucide-react";

import type { PublishedLocale } from "@/features/locales/repository";
import type { DemoMenu } from "@/features/public-menu/types";
import { generateQrPreviewDataUrl } from "@/features/admin/qr/qr-export";
import { DEFAULT_QR_CUSTOMIZATION } from "@/features/admin/qr/qr-settings";
import { getPrintMenuCopy } from "../print-copy";
import {
  DEFAULT_PRINT_MENU_SETTINGS,
  type PrintMenuSettings,
} from "../print-settings";
import { PrintableMenu } from "./printable-menu";

type Props = {
  menu: DemoMenu;
  currencyCode: string;
  locales: PublishedLocale[];
  publicUrl: string;
};

export function PrintMenuEditor({
  menu,
  currencyCode,
  locales,
  publicUrl,
}: Props) {
  const router = useRouter();
  const [settings, setSettings] = useState(DEFAULT_PRINT_MENU_SETTINGS);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const copy = getPrintMenuCopy(menu.locale);

  useEffect(() => {
    let cancelled = false;
    if (!settings.showQr) {
      queueMicrotask(() => !cancelled && setQrDataUrl(null));
      return () => {
        cancelled = true;
      };
    }
    void generateQrPreviewDataUrl(publicUrl, DEFAULT_QR_CUSTOMIZATION).then(
      (value) => !cancelled && setQrDataUrl(value),
    );
    return () => {
      cancelled = true;
    };
  }, [publicUrl, settings.showQr]);

  const toggleOptions: Array<{
    key: keyof PrintMenuSettings;
    label: string;
  }> = [
    { key: "showDescriptions", label: copy.descriptions },
    { key: "showAllergens", label: copy.allergens },
    { key: "showTags", label: copy.tags },
    { key: "showHalfPortions", label: copy.halfPortion },
    { key: "showSoldOut", label: copy.soldOut },
    { key: "showAddress", label: copy.address },
    { key: "showPhone", label: copy.phone },
    { key: "showSlogan", label: copy.slogan },
    { key: "showQr", label: copy.qr },
  ];

  const setOption = <K extends keyof PrintMenuSettings>(
    key: K,
    value: PrintMenuSettings[K],
  ) => setSettings((current) => ({ ...current, [key]: value }));

  return (
    <>
      <style media="print">
        {`@page { size: A4 ${settings.orientation}; margin: 12mm; }`}
      </style>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between print:hidden">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a8392f]">
            {copy.administration}
          </p>
          <h1 className="font-display mt-1 text-3xl text-[#173f35] sm:text-4xl">
            {copy.title}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#173f35] px-5 text-sm font-bold text-white"
        >
          <Printer className="size-4" /> {copy.print}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="space-y-4 print:hidden">
          <section className="rounded-2xl border border-stone-200 bg-white p-4">
            <label className="text-xs font-bold text-stone-600">
              {copy.language}
              <select
                value={menu.locale}
                onChange={(event) =>
                  router.push(`/admin/print-menu?locale=${event.target.value}`)
                }
                className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3"
              >
                {locales.map((locale) => (
                  <option key={locale.code} value={locale.code}>
                    {locale.nativeName} ({locale.code.toUpperCase()})
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4">
            {[
              ["orientation", copy.orientation, [["portrait", copy.portrait], ["landscape", copy.landscape]]],
              ["columns", copy.columns, [[1, copy.oneColumn], [2, copy.twoColumns]]],
              ["fontSize", copy.fontSize, [["small", copy.small], ["normal", copy.normal], ["large", copy.large]]],
              ["density", copy.density, [["compact", copy.compact], ["comfortable", copy.comfortable]]],
            ].map(([key, label, options]) => (
              <label key={String(key)} className="block text-xs font-bold text-stone-600">
                {String(label)}
                <select
                  value={String(settings[key as keyof PrintMenuSettings])}
                  onChange={(event) => {
                    const raw = event.target.value;
                    setOption(
                      key as keyof PrintMenuSettings,
                      (key === "columns" ? Number(raw) : raw) as never,
                    );
                  }}
                  className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3"
                >
                  {(options as Array<[string | number, string]>).map(([value, text]) => (
                    <option key={String(value)} value={String(value)}>{text}</option>
                  ))}
                </select>
              </label>
            ))}
          </section>

          <section className="space-y-2 rounded-2xl border border-stone-200 bg-white p-4">
            {toggleOptions.map(({ key, label }) => (
              <label key={key} className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-stone-100 px-3 text-xs font-bold">
                {label}
                <input
                  type="checkbox"
                  checked={Boolean(settings[key])}
                  onChange={(event) => setOption(key, event.target.checked as never)}
                />
              </label>
            ))}
          </section>
          <div aria-live="polite" className="text-xs text-stone-500">
            {settings.showQr && !qrDataUrl ? (
              <span className="inline-flex gap-2"><LoaderCircle className="size-4 animate-spin" /> {copy.generatingQr}</span>
            ) : "Vista previa actualizada"}
          </div>
        </aside>

        <section aria-label={copy.preview} className="overflow-x-auto rounded-2xl bg-stone-200 p-3 print:overflow-visible print:bg-white print:p-0">
          <PrintableMenu
            menu={menu}
            currencyCode={currencyCode}
            settings={settings}
            qrDataUrl={qrDataUrl}
            copy={copy}
          />
        </section>
      </div>
    </>
  );
}
