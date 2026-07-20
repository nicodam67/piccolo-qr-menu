"use client";

import { useEffect, useRef, useState } from "react";
import { X, ZoomIn } from "lucide-react";

import { ProductImage } from "@/components/product-image";
import { getMobileImageUrl } from "@/features/images/variant-url";

type ProductImageLightboxProps = {
  src: string;
  alt: string;
  enlargeLabel: string;
  closeLabel: string;
  isSoldOut?: boolean;
};

export function ProductImageLightbox({
  src,
  alt,
  enlargeLabel,
  closeLabel,
  isSoldOut = false,
}: ProductImageLightboxProps) {
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const triggerElement = triggerRef.current;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }

      if (event.key === "Tab") {
        event.preventDefault();
        closeButtonRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      triggerElement?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={enlargeLabel}
        className="group relative aspect-[4/3] w-full overflow-hidden rounded-[1.5rem] bg-stone-100 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a8392f]"
      >
        <ProductImage src={src} alt={alt} isSoldOut={isSoldOut} />
        <span className="absolute right-3 bottom-3 inline-flex min-h-10 items-center gap-2 rounded-full bg-black/65 px-4 text-xs font-bold text-white backdrop-blur-sm">
          <ZoomIn aria-hidden="true" className="size-4" />
          {enlargeLabel}
        </span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={enlargeLabel}
          className="fixed inset-0 z-[100] grid place-items-center bg-black/90 p-3 sm:p-8"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => setOpen(false)}
            aria-label={closeLabel}
            className="absolute top-4 right-4 z-10 grid size-12 place-items-center rounded-full bg-white text-stone-900 shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <X aria-hidden="true" className="size-6" />
          </button>
          <picture className="flex max-h-full max-w-6xl items-center justify-center">
            <source
              media="(max-width: 640px)"
              srcSet={getMobileImageUrl(src)}
              type="image/webp"
            />
            {/* The managed file is already optimized and constrained by the modal. */}
            <img
              src={src}
              alt={alt}
              className="max-h-[92vh] max-w-full rounded-xl object-contain"
            />
          </picture>
        </div>
      ) : null}
    </>
  );
}
