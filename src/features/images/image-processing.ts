import "server-only";

import sharp from "sharp";

import { MAX_IMAGE_FILE_SIZE } from "./image-constants";

const acceptedSharpFormats = new Set(["jpeg", "png", "webp"]);
const sharpInputOptions = {
  failOn: "error" as const,
  limitInputPixels: 40_000_000,
};

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageValidationError";
  }
}

export type OptimizedProductImage = {
  mobile: Buffer;
  desktop: Buffer;
  width: number;
  height: number;
};

async function readImageMetadata(input: Buffer) {
  try {
    return await sharp(input, sharpInputOptions).metadata();
  } catch {
    throw new ImageValidationError(
      "No se ha podido leer la imagen. Comprueba el archivo.",
    );
  }
}

export async function optimizeProductImage(
  input: Buffer,
): Promise<OptimizedProductImage> {
  if (input.byteLength === 0) {
    throw new ImageValidationError("El archivo está vacío.");
  }

  if (input.byteLength > MAX_IMAGE_FILE_SIZE) {
    throw new ImageValidationError(
      "La imagen supera el tamaño máximo de 10 MB.",
    );
  }

  const metadata = await readImageMetadata(input);

  if (!metadata.format || !acceptedSharpFormats.has(metadata.format)) {
    throw new ImageValidationError(
      "Formato no permitido. Usa JPG, JPEG, PNG o WEBP.",
    );
  }

  if (!metadata.width || !metadata.height) {
    throw new ImageValidationError("La imagen no tiene dimensiones válidas.");
  }

  try {
    const [mobile, desktop] = await Promise.all([
      sharp(input, sharpInputOptions)
        .rotate()
        .resize({
          width: 640,
          height: 640,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 80, effort: 4 })
        .toBuffer(),
      sharp(input, sharpInputOptions)
        .rotate()
        .resize({
          width: 1_440,
          height: 1_440,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 84, effort: 4 })
        .toBuffer(),
    ]);

    return {
      mobile,
      desktop,
      width: metadata.width,
      height: metadata.height,
    };
  } catch {
    throw new ImageValidationError(
      "No se ha podido optimizar la imagen para web.",
    );
  }
}
