"use client";

import { useState } from "react";
import { Download, LoaderCircle, Printer } from "lucide-react";

import {
  createQrPngBlob,
  createQrSvgBlob,
  downloadQrBlob,
  type QrExportOptions,
} from "../qr-export";
import type { QrAdminCopy } from "../qr-copy";
import {
  getQrDownloadFilename,
  type QrDownloadFormat,
} from "../qr-url";

type QrDownloadButtonsProps = {
  options: QrExportOptions;
  locale: string;
  qrReady: boolean;
  copy: QrAdminCopy;
};

export function QrDownloadButtons({
  options,
  locale,
  qrReady,
  copy,
}: QrDownloadButtonsProps) {
  const [generating, setGenerating] =
    useState<QrDownloadFormat | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleDownload = async (format: QrDownloadFormat) => {
    setGenerating(format);
    setMessage(null);

    try {
      const blob =
        format === "png"
          ? await createQrPngBlob(options)
          : await createQrSvgBlob(options);
      downloadQrBlob(blob, getQrDownloadFilename(locale, format), format);
      setMessage({ type: "success", text: copy.downloaded });
    } catch {
      setMessage({ type: "error", text: copy.downloadError });
    } finally {
      setGenerating(null);
    }
  };

  const disabled = !qrReady || generating !== null;

  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => void handleDownload("png")}
          disabled={disabled}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#173f35] px-4 text-xs font-bold text-white disabled:cursor-wait disabled:opacity-50"
        >
          {generating === "png" ? (
            <LoaderCircle
              aria-hidden="true"
              className="size-4 animate-spin"
            />
          ) : (
            <Download aria-hidden="true" className="size-4" />
          )}
          {copy.downloadPng}
        </button>
        <button
          type="button"
          onClick={() => void handleDownload("svg")}
          disabled={disabled}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#173f35]/20 bg-white px-4 text-xs font-bold text-[#173f35] disabled:cursor-wait disabled:opacity-50"
        >
          {generating === "svg" ? (
            <LoaderCircle
              aria-hidden="true"
              className="size-4 animate-spin"
            />
          ) : (
            <Download aria-hidden="true" className="size-4" />
          )}
          {copy.downloadSvg}
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={!qrReady || generating !== null}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-xs font-bold text-stone-600 disabled:opacity-50"
        >
          <Printer aria-hidden="true" className="size-4" />
          {copy.printPoster}
        </button>
      </div>
      <div aria-live="polite" className="mt-2 min-h-5">
        {message ? (
          <p
            role={message.type === "error" ? "alert" : "status"}
            className={`text-xs font-semibold ${
              message.type === "error" ? "text-red-700" : "text-emerald-700"
            }`}
          >
            {message.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}
