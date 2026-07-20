import type { QrDownloadSize } from "./qr-url";

export type QrErrorCorrectionLevel = "M" | "Q" | "H";
export type QrPosterLayout = "square" | "vertical";
export type QrBackground = "white" | "transparent";

export type QrCustomization = {
  size: QrDownloadSize;
  margin: number;
  errorCorrectionLevel: QrErrorCorrectionLevel;
  darkColor: string;
  lightColor: string;
  background: QrBackground;
  layout: QrPosterLayout;
  showRestaurantName: boolean;
  showSlogan: boolean;
  showCallToAction: boolean;
};

export const DEFAULT_QR_CUSTOMIZATION: QrCustomization = {
  size: 1024,
  margin: 4,
  errorCorrectionLevel: "H",
  darkColor: "#111111",
  lightColor: "#ffffff",
  background: "white",
  layout: "vertical",
  showRestaurantName: true,
  showSlogan: true,
  showCallToAction: true,
};

const allowedSizes = new Set<QrDownloadSize>([512, 1024, 2048]);
const allowedCorrection = new Set<QrErrorCorrectionLevel>(["M", "Q", "H"]);
const colorPattern = /^#[0-9a-f]{6}$/i;

function relativeLuminance(color: string) {
  const channels = [1, 3, 5].map((index) => {
    const value = Number.parseInt(color.slice(index, index + 2), 16) / 255;
    return value <= 0.03928
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return (
    channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  );
}

export function getColorContrast(foreground: string, background: string) {
  const light = Math.max(
    relativeLuminance(foreground),
    relativeLuminance(background),
  );
  const dark = Math.min(
    relativeLuminance(foreground),
    relativeLuminance(background),
  );
  return (light + 0.05) / (dark + 0.05);
}

export function validateQrCustomization(value: QrCustomization) {
  if (!allowedSizes.has(value.size)) {
    throw new Error("Tamaño de QR no permitido.");
  }
  if (!Number.isInteger(value.margin) || value.margin < 2 || value.margin > 8) {
    throw new Error("El margen debe ser un entero entre 2 y 8.");
  }
  if (!allowedCorrection.has(value.errorCorrectionLevel)) {
    throw new Error("Nivel de corrección no permitido.");
  }
  if (!colorPattern.test(value.darkColor) || !colorPattern.test(value.lightColor)) {
    throw new Error("Los colores deben utilizar formato hexadecimal.");
  }
  const effectiveBackground =
    value.background === "transparent" ? "#ffffff" : value.lightColor;
  if (getColorContrast(value.darkColor, effectiveBackground) < 4.5) {
    throw new Error("El contraste del código QR es insuficiente.");
  }
  if (value.layout !== "square" && value.layout !== "vertical") {
    throw new Error("Formato de QR no permitido.");
  }
  if (value.background !== "white" && value.background !== "transparent") {
    throw new Error("Fondo de QR no permitido.");
  }
  return value;
}

export function verifyQrDestination({
  destinationUrl,
  visibleUrl,
  publicBaseUrl,
  locale,
  publishedLocales,
}: {
  destinationUrl: string;
  visibleUrl: string;
  publicBaseUrl: string;
  locale: string;
  publishedLocales: string[];
}) {
  const destination = new URL(destinationUrl);
  const visible = new URL(visibleUrl);
  const base = new URL(publicBaseUrl);

  if (
    !["http:", "https:"].includes(destination.protocol) ||
    destination.toString() !== visible.toString() ||
    destination.origin !== base.origin ||
    !publishedLocales.includes(locale) ||
    !destination.pathname.split("/").filter(Boolean).includes(locale)
  ) {
    throw new Error("La URL codificada no coincide con la URL pública válida.");
  }
  return true;
}
