"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Globe2, Ruler } from "lucide-react";

import { generateQrPreviewDataUrl } from "../qr-export";
import { getQrAdminCopy } from "../qr-copy";
import {
  buildPublicMenuUrl,
  type QrDownloadSize,
} from "../qr-url";
import { QrDownloadButtons } from "./qr-download-buttons";
import { QrPreview } from "./qr-preview";

type QrManagerProps = {
  baseUrl: string;
  configuredDomain: boolean;
  locales: string[];
  defaultLocale: string;
  restaurantNames: Record<string, string>;
};

const downloadSizes: QrDownloadSize[] = [512, 1024, 2048];

export function QrManager({
  baseUrl,
  configuredDomain,
  locales,
  defaultLocale,
  restaurantNames,
}: QrManagerProps) {
  const [locale, setLocale] = useState(
    locales.includes(defaultLocale) ? defaultLocale : locales[0],
  );
  const [size, setSize] = useState<QrDownloadSize>(1024);
  const [showRestaurantName, setShowRestaurantName] = useState(true);
  const [showCallToAction, setShowCallToAction] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const copy = getQrAdminCopy(locale);
  const restaurantName =
    restaurantNames[locale] ??
    restaurantNames[defaultLocale] ??
    Object.values(restaurantNames)[0] ??
    "Piccolo";
  const destinationUrl = useMemo(
    () => buildPublicMenuUrl(baseUrl, locale, locales),
    [baseUrl, locale, locales],
  );

  useEffect(() => {
    let cancelled = false;

    void generateQrPreviewDataUrl(destinationUrl)
      .then((dataUrl) => {
        if (!cancelled) {
          setQrDataUrl(dataUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGenerationError(copy.downloadError);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [copy.downloadError, destinationUrl]);

  return (
    <>
      <div className="mb-6">
        <p className="text-[10px] font-extrabold tracking-[0.18em] text-[#a8392f] uppercase">
          {copy.administration}
        </p>
        <h1 className="font-display mt-1 text-3xl text-[#173f35] sm:text-4xl">
          {copy.title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
          {copy.description}
        </p>
      </div>

      {!configuredDomain ? (
        <div
          role="alert"
          className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900"
        >
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          <p className="text-xs leading-5">{copy.domainWarning}</p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(18rem,0.65fr)_minmax(22rem,1.35fr)]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-stone-200 bg-white p-5">
            <h2 className="font-display text-xl text-[#173f35]">
              {copy.settings}
            </h2>
            <div className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="qr-locale"
                  className="flex items-center gap-2 text-xs font-bold text-stone-700"
                >
                  <Globe2 aria-hidden="true" className="size-4" />
                  {copy.language}
                </label>
                <select
                  id="qr-locale"
                  value={locale}
                  onChange={(event) => {
                    setQrDataUrl(null);
                    setGenerationError(null);
                    setLocale(event.target.value);
                  }}
                  className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm uppercase outline-none focus:border-[#245849]"
                >
                  {locales.map((availableLocale) => (
                    <option key={availableLocale} value={availableLocale}>
                      {availableLocale.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <fieldset>
                <legend className="flex items-center gap-2 text-xs font-bold text-stone-700">
                  <Ruler aria-hidden="true" className="size-4" />
                  {copy.size}
                </legend>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {downloadSizes.map((downloadSize) => (
                    <label
                      key={downloadSize}
                      className={`cursor-pointer rounded-xl border px-2 py-3 text-center text-xs font-bold ${
                        size === downloadSize
                          ? "border-[#173f35] bg-emerald-50 text-[#173f35]"
                          : "border-stone-200 text-stone-500"
                      }`}
                    >
                      {downloadSize} px
                      <input
                        type="radio"
                        name="qr-size"
                        value={downloadSize}
                        checked={size === downloadSize}
                        onChange={() => setSize(downloadSize)}
                        className="sr-only"
                      />
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="flex min-h-11 cursor-pointer items-center justify-between rounded-xl border border-stone-200 px-3">
                <span className="text-xs font-bold text-stone-700">
                  {copy.showRestaurantName}
                </span>
                <input
                  type="checkbox"
                  checked={showRestaurantName}
                  onChange={(event) =>
                    setShowRestaurantName(event.target.checked)
                  }
                  className="size-4 accent-[#173f35]"
                />
              </label>
              <label className="flex min-h-11 cursor-pointer items-center justify-between rounded-xl border border-stone-200 px-3">
                <span className="text-xs font-bold text-stone-700">
                  {copy.showCallToAction}
                </span>
                <input
                  type="checkbox"
                  checked={showCallToAction}
                  onChange={(event) =>
                    setShowCallToAction(event.target.checked)
                  }
                  className="size-4 accent-[#173f35]"
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-4">
            <h2 className="text-xs font-bold text-stone-700">
              {copy.publicUrl}
            </h2>
            <output
              data-qr-destination
              className="mt-2 block break-all rounded-xl bg-stone-50 px-3 py-3 text-xs leading-5 text-stone-600"
            >
              {destinationUrl}
            </output>
          </section>

          <QrDownloadButtons
            options={{
              url: destinationUrl,
              size,
              restaurantName,
              callToAction: copy.callToAction,
              showRestaurantName,
              showCallToAction,
            }}
            locale={locale}
            qrReady={Boolean(qrDataUrl) && !generationError}
            copy={copy}
          />

          {generationError ? (
            <p role="alert" className="text-xs font-bold text-red-700">
              {generationError}
            </p>
          ) : null}
        </div>

        <QrPreview
          qrDataUrl={qrDataUrl}
          destinationUrl={destinationUrl}
          locale={locale}
          restaurantName={restaurantName}
          showRestaurantName={showRestaurantName}
          showCallToAction={showCallToAction}
          configuredDomain={configuredDomain}
          copy={copy}
        />
      </div>
    </>
  );
}
