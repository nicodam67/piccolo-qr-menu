export type QrAdminCopy = {
  title: string;
  description: string;
  language: string;
  size: string;
  showRestaurantName: string;
  showCallToAction: string;
  downloadPng: string;
  downloadSvg: string;
  printPoster: string;
  callToAction: string;
  downloaded: string;
  downloadError: string;
  publicUrl: string;
  preview: string;
  domainWarning: string;
  verifyBeforePrint: string;
  configuredUrl: string;
  temporaryPreview: string;
  generating: string;
  printablePoster: string;
  administration: string;
  settings: string;
};

const copies: Record<string, QrAdminCopy> = {
  es: {
    title: "Código QR",
    description: "Genera, descarga e imprime el acceso oficial a la carta.",
    language: "Idioma",
    size: "Tamaño",
    showRestaurantName: "Mostrar nombre del restaurante",
    showCallToAction: "Mostrar texto de llamada",
    downloadPng: "Descargar PNG",
    downloadSvg: "Descargar SVG",
    printPoster: "Imprimir cartel QR",
    callToAction: "Escanea para ver nuestra carta",
    downloaded: "Código QR descargado",
    downloadError: "No se pudo generar el código QR",
    publicUrl: "URL pública",
    preview: "Vista previa",
    domainWarning:
      "NEXT_PUBLIC_SITE_URL no está configurada. Esta vista usa temporalmente el origen actual del navegador y no debe considerarse definitiva.",
    verifyBeforePrint: "Comprueba el código con un teléfono antes de imprimirlo.",
    configuredUrl: "URL configurada",
    temporaryPreview: "Vista temporal",
    generating: "Generando código QR",
    printablePoster: "Cartel QR imprimible",
    administration: "Administración",
    settings: "Configuración",
  },
};

export function getQrAdminCopy(locale: string) {
  return copies[locale] ?? copies.es;
}
