import Image from "next/image";
import { ImageOff } from "lucide-react";

import { getMobileImageUrl } from "@/features/images/variant-url";

type ProductImageProps = {
  src: string;
  alt: string;
  isSoldOut?: boolean;
};

export function ProductImage({
  src,
  alt,
  isSoldOut = false,
}: ProductImageProps) {
  const imageClassName = `h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025] ${
    isSoldOut ? "grayscale-[35%]" : ""
  }`;

  if (!src) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-stone-100 text-center text-stone-400">
        <div>
          <ImageOff aria-hidden="true" className="mx-auto size-7" />
          <p className="mt-2 text-[10px] font-bold uppercase">Sin imagen</p>
        </div>
      </div>
    );
  }

  if (src.endsWith(".desktop.webp")) {
    return (
      <picture className="absolute inset-0">
        <source
          media="(max-width: 640px)"
          srcSet={getMobileImageUrl(src)}
          type="image/webp"
        />
        {/* Managed variants are already optimized and may live on any configured CDN. */}
        <img src={src} alt={alt} className={imageClassName} loading="lazy" />
      </picture>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
      className={`object-cover transition-transform duration-500 group-hover:scale-[1.025] ${
        isSoldOut ? "grayscale-[35%]" : ""
      }`}
    />
  );
}
