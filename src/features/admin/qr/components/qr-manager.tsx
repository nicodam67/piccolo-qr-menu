"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clipboard, Globe2, Ruler } from "lucide-react";

import { generateQrPreviewDataUrl } from "../qr-export";
import type { PublishedLocale } from "@/features/locales/repository";
import { getQrAdminCopy } from "../qr-copy";
import {
  buildPublicMenuUrl,
  type QrDownloadSize,
} from "../qr-url";
import {
  DEFAULT_QR_CUSTOMIZATION,
  validateQrCustomization,
  verifyQrDestination,
  type QrBackground,
  type QrErrorCorrectionLevel,
  type QrPosterLayout,
} from "../qr-settings";
import { QrDownloadButtons } from "./qr-download-buttons";
import { QrPreview } from "./qr-preview";

type QrManagerProps = {
  baseUrl: string;
  configuredDomain: boolean;
  locales: PublishedLocale[];
  defaultLocale: string;
  restaurantNames: Record<string, string>;
  restaurantSlogans: Record<string, string>;
};

const downloadSizes: QrDownloadSize[] = [512, 1024, 2048];

export function QrManager({
  baseUrl,
  configuredDomain,
  locales,
  defaultLocale,
  restaurantNames,
  restaurantSlogans,
}: QrManagerProps) {
  const [locale, setLocale] = useState(
    locales.some(({ code }) => code === defaultLocale)
      ? defaultLocale
      : (locales[0]?.code ?? defaultLocale),
  );
  const [size, setSize] = useState<QrDownloadSize>(
    DEFAULT_QR_CUSTOMIZATION.size,
  );
  const [margin, setMargin] = useState(DEFAULT_QR_CUSTOMIZATION.margin);
  const [errorCorrectionLevel, setErrorCorrectionLevel] =
    useState<QrErrorCorrectionLevel>(
      DEFAULT_QR_CUSTOMIZATION.errorCorrectionLevel,
    );
  const [darkColor, setDarkColor] = useState(
    DEFAULT_QR_CUSTOMIZATION.darkColor,
  );
  const [lightColor, setLightColor] = useState(
    DEFAULT_QR_CUSTOMIZATION.lightColor,
  );
  const [background, setBackground] = useState<QrBackground>(
    DEFAULT_QR_CUSTOMIZATION.background,
  );
  const [layout, setLayout] = useState<QrPosterLayout>(
    DEFAULT_QR_CUSTOMIZATION.layout,
  );
  const [showRestaurantName, setShowRestaurantName] = useState(true);
  const [showSlogan, setShowSlogan] = useState(true);
  const [showCallToAction, setShowCallToAction] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const copy = getQrAdminCopy(locale);
  const localeCodes = useMemo(
    () => locales.map(({ code }) => code),
    [locales],
  );
  const restaurantName =
    restaurantNames[locale] ??
    restaurantNames[defaultLocale] ??
    Object.values(restaurantNames)[0] ??
    "Piccolo";
  const slogan =
    restaurantSlogans[locale] ??
    restaurantSlogans[defaultLocale] ??
    Object.values(restaurantSlogans)[0] ??
    "";
  const customization = useMemo(
    () => ({
      size,
      margin,
      errorCorrectionLevel,
      darkColor,
      lightColor,
      background,
      layout,
      showRestaurantName,
      showSlogan,
      showCallToAction,
    }),
    [
      background,
      darkColor,
      errorCorrectionLevel,
      layout,
      lightColor,
      margin,
      showCallToAction,
      showRestaurantName,
      showSlogan,
      size,
    ],
  );
  const destinationUrl = useMemo(
    () => buildPublicMenuUrl(baseUrl, locale, localeCodes),
    [baseUrl, locale, localeCodes],
  );

  useEffect(() => {
    let cancelled = false;

    try {
      validateQrCustomization(customization);
      verifyQrDestination({
        destinationUrl,
        visibleUrl: destinationUrl,
        publicBaseUrl: baseUrl,
        locale,
        publishedLocales: localeCodes,
      });
    } catch {
      setGenerationError(copy.downloadError);
      return;
    }

    void generateQrPreviewDataUrl(destinationUrl, customization)
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
  }, [
    baseUrl,
    copy.downloadError,
    customization,
    destinationUrl,
    locale,
    localeCodes,
  ]);

  const copyDestination = async () => {
    try {
      await navigator.clipboard.writeText(destinationUrl);
      setCopyMessage(copy.linkCopied);
    } catch {
      setCopyMessage(copy.downloadError);
    }
  };

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
                    <option
                      key={availableLocale.code}
                      value={availableLocale.code}
                    >
                      {availableLocale.nativeName} (
                      {availableLocale.code.toUpperCase()})
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

              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-bold text-stone-700">
                  {copy.margin}
                  <input
                    type="number"
                    min={2}
                    max={8}
                    step={1}
                    value={margin}
                    onChange={(event) => setMargin(Number(event.target.value))}
                    className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 px-3"
                  />
                </label>
                <label className="text-xs font-bold text-stone-700">
                  {copy.correctionLevel}
                  <select
                    value={errorCorrectionLevel}
                    onChange={(event) =>
                      setErrorCorrectionLevel(
                        event.target.value as QrErrorCorrectionLevel,
                      )
                    }
                    className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3"
                  >
                    <option value="M">M</option>
                    <option value="Q">Q</option>
                    <option value="H">H</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-bold text-stone-700">
                  {copy.codeColor}
                  <input
                    type="color"
                    value={darkColor}
                    onChange={(event) => setDarkColor(event.target.value)}
                    className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 p-1"
                  />
                </label>
                <label className="text-xs font-bold text-stone-700">
                  {copy.backgroundColor}
                  <input
                    type="color"
                    value={lightColor}
                    disabled={background === "transparent"}
                    onChange={(event) => setLightColor(event.target.value)}
                    className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 p-1 disabled:opacity-40"
                  />
                </label>
              </div>

              <fieldset>
                <legend className="text-xs font-bold text-stone-700">
                  Formato
                </legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {[
                    { value: "vertical" as const, label: copy.verticalFormat },
                    { value: "square" as const, label: copy.squareFormat },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`cursor-pointer rounded-xl border px-3 py-3 text-center text-xs font-bold ${
                        layout === option.value
                          ? "border-[#173f35] bg-emerald-50"
                          : "border-stone-200"
                      }`}
                    >
                      {option.label}
                      <input
                        type="radio"
                        name="qr-layout"
                        value={option.value}
                        checked={layout === option.value}
                        onChange={() => setLayout(option.value)}
                        className="sr-only"
                      />
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="flex min-h-11 cursor-pointer items-center justify-between rounded-xl border border-stone-200 px-3">
                <span className="text-xs font-bold text-stone-700">
                  {copy.transparentBackground}
                </span>
                <input
                  type="checkbox"
                  checked={background === "transparent"}
                  onChange={(event) =>
                    setBackground(event.target.checked ? "transparent" : "white")
                  }
                  className="size-4 accent-[#173f35]"
                />
              </label>

              <label className="flex min-h-11 cursor-pointer items-center justify-between rounded-xl border border-stone-200 px-3">
                <span className="text-xs font-bold text-stone-700">
                  {copy.showRestaurantName}
                </span>
                <input
                  type="checkbox"
                  checked={showRestaurantName}
                  disabled={layout === "square"}
                  onChange={(event) =>
                    setShowRestaurantName(event.target.checked)
                  }
                  className="size-4 accent-[#173f35]"
                />
              </label>
              <label className="flex min-h-11 cursor-pointer items-center justify-between rounded-xl border border-stone-200 px-3">
                <span className="text-xs font-bold text-stone-700">
                  {copy.showSlogan}
                </span>
                <input
                  type="checkbox"
                  checked={showSlogan}
                  disabled={layout === "square"}
                  onChange={(event) => setShowSlogan(event.target.checked)}
                  className="size-4 accent-[#173f35] disabled:opacity-40"
                />
              </label>
              <label className="flex min-h-11 cursor-pointer items-center justify-between rounded-xl border border-stone-200 px-3">
                <span className="text-xs font-bold text-stone-700">
                  {copy.showCallToAction}
                </span>
                <input
                  type="checkbox"
                  checked={showCallToAction}
                  disabled={layout === "square"}
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
            <button
              type="button"
              onClick={() => void copyDestination()}
              className="mt-3 flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 px-4 text-xs font-bold text-[#173f35]"
            >
              <Clipboard aria-hidden="true" className="size-4" />
              {copy.copyLink}
            </button>
            <div aria-live="polite" className="mt-1 min-h-5 text-xs font-semibold text-emerald-700">
              {copyMessage}
            </div>
          </section>

          <QrDownloadButtons
            options={{
              url: destinationUrl,
              size,
              margin,
              errorCorrectionLevel,
              darkColor,
              lightColor,
              background,
              layout,
              restaurantName,
              slogan,
              callToAction: copy.callToAction,
              showRestaurantName,
              showSlogan,
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
          slogan={slogan}
          showRestaurantName={showRestaurantName}
          showSlogan={showSlogan}
          showCallToAction={showCallToAction}
          layout={layout}
          transparent={background === "transparent"}
          configuredDomain={configuredDomain}
          copy={copy}
        />
      </div>
    </>
  );
}
