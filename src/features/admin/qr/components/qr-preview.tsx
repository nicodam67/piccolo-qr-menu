"use client";

import { LoaderCircle } from "lucide-react";

import type { QrAdminCopy } from "../qr-copy";

type QrPreviewProps = {
  qrDataUrl: string | null;
  destinationUrl: string;
  locale: string;
  restaurantName: string;
  slogan: string;
  showRestaurantName: boolean;
  showSlogan: boolean;
  showCallToAction: boolean;
  layout: "square" | "vertical";
  transparent: boolean;
  configuredDomain: boolean;
  copy: QrAdminCopy;
};

export function QrPreview({
  qrDataUrl,
  destinationUrl,
  locale,
  restaurantName,
  slogan,
  showRestaurantName,
  showSlogan,
  showCallToAction,
  layout,
  transparent,
  configuredDomain,
  copy,
}: QrPreviewProps) {
  const accessibleDescription = `Código QR para ${destinationUrl}`;

  return (
    <>
      <section aria-labelledby="qr-preview-title">
        <p
          id="qr-preview-title"
          className="mb-3 text-[10px] font-extrabold tracking-[0.16em] text-[#a8392f] uppercase"
        >
          {copy.preview}
        </p>
        <div
          data-testid="qr-preview-card"
          className={`rounded-[1.75rem] border border-stone-200 p-5 text-center shadow-[0_24px_70px_-45px_rgba(23,63,53,0.65)] sm:p-7 ${
            transparent
              ? "bg-[linear-gradient(45deg,#eee_25%,transparent_25%),linear-gradient(-45deg,#eee_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#eee_75%),linear-gradient(-45deg,transparent_75%,#eee_75%)] bg-[length:20px_20px]"
              : "bg-white"
          }`}
        >
          {layout === "vertical" && showRestaurantName ? (
            <h2 className="font-display text-2xl text-[#173f35]">
              {restaurantName}
            </h2>
          ) : null}
          {layout === "vertical" && showSlogan && slogan ? (
            <p className="mt-1 text-xs text-stone-500">{slogan}</p>
          ) : null}
          <div className="mx-auto mt-4 grid aspect-square w-full max-w-md place-items-center bg-white">
            {qrDataUrl ? (
              // Generated locally from a trusted data URL.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                data-testid="qr-preview-image"
                src={qrDataUrl}
                alt={accessibleDescription}
                className="h-full w-full object-contain"
              />
            ) : (
              <LoaderCircle
                aria-label={copy.generating}
                className="size-8 animate-spin text-[#173f35]"
              />
            )}
          </div>
          {layout === "vertical" && showCallToAction ? (
            <p className="font-display mt-4 text-xl text-[#173f35]">
              {copy.callToAction}
            </p>
          ) : null}
          <p className="mt-4 break-all text-[10px] leading-4 text-stone-500">
            {destinationUrl}
          </p>
          <div className="mt-3 flex justify-center gap-2 text-[10px] font-bold text-stone-400 uppercase">
            <span>{copy.language}: {locale.toUpperCase()}</span>
            <span aria-hidden="true">·</span>
            <span>
              {configuredDomain
                ? copy.configuredUrl
                : copy.temporaryPreview}
            </span>
          </div>
        </div>
        <p className="mt-3 text-center text-xs font-semibold text-stone-500">
          {copy.verifyBeforePrint}
        </p>
      </section>

      <section
        data-qr-print-poster
        aria-label={copy.printablePoster}
        className="hidden"
      >
        <h1>{restaurantName}</h1>
        {showSlogan && slogan ? <h2>{slogan}</h2> : null}
        {qrDataUrl ? (
          // Generated locally from a trusted data URL.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt={accessibleDescription} />
        ) : null}
        <p>{copy.callToAction}</p>
        <small>{destinationUrl}</small>
      </section>
    </>
  );
}
