"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

type ShareProductButtonProps = {
  title: string;
  description: string;
  shareLabel: string;
  copiedLabel: string;
  errorLabel: string;
};

function copyWithFallback(value: string) {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("Copy failed");
  }
}

export function ShareProductButton({
  title,
  description,
  shareLabel,
  copiedLabel,
  errorLabel,
}: ShareProductButtonProps) {
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleShare = async () => {
    setMessage(null);
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description || undefined,
          url,
        });
        return;
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        copyWithFallback(url);
      }

      setMessage({ type: "success", text: copiedLabel });
    } catch {
      setMessage({ type: "error", text: errorLabel });
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleShare}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#173f35]/20 bg-white px-5 text-sm font-bold text-[#173f35] hover:bg-[#173f35] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173f35]"
      >
        {message?.type === "success" ? (
          <Check aria-hidden="true" className="size-4" />
        ) : (
          <Share2 aria-hidden="true" className="size-4" />
        )}
        {shareLabel}
      </button>
      <div aria-live="polite" className="min-h-5">
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
