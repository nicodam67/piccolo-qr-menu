import {
  getLocaleConfig,
  type SupportedLocaleCode,
} from "@/config/locales";

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
  copyLink: string;
  linkCopied: string;
  personalization: string;
  transparentBackground: string;
  correctionLevel: string;
  margin: string;
  codeColor: string;
  backgroundColor: string;
  showSlogan: string;
  verticalFormat: string;
  squareFormat: string;
  format: string;
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
    copyLink: "Copiar enlace",
    linkCopied: "Enlace copiado",
    personalization: "Personalización",
    transparentBackground: "Fondo transparente",
    correctionLevel: "Nivel de corrección",
    margin: "Margen exterior",
    codeColor: "Color del código",
    backgroundColor: "Color de fondo",
    showSlogan: "Mostrar eslogan",
    verticalFormat: "Vertical",
    squareFormat: "Cuadrado",
    format: "Formato",
  },
};

const localizedOverrides: Record<
  SupportedLocaleCode,
  Partial<QrAdminCopy>
> = {
  es: {},
  ca: { callToAction: "Escaneja per veure la nostra carta", copyLink: "Copiar enllaç", linkCopied: "Enllaç copiat", downloadPng: "Descarregar PNG", downloadSvg: "Descarregar SVG", printPoster: "Imprimir", language: "Idioma", personalization: "Personalització", preview: "Vista prèvia", transparentBackground: "Fons transparent", correctionLevel: "Nivell de correcció", downloadError: "Error en generar el codi" },
  en: { callToAction: "Scan to view our menu", copyLink: "Copy link", linkCopied: "Link copied", downloadPng: "Download PNG", downloadSvg: "Download SVG", printPoster: "Print", language: "Language", personalization: "Customization", preview: "Preview", transparentBackground: "Transparent background", correctionLevel: "Error correction", downloadError: "Could not generate the code" },
  ro: { callToAction: "Scanează pentru a vedea meniul", copyLink: "Copiază linkul", linkCopied: "Link copiat", downloadPng: "Descarcă PNG", downloadSvg: "Descarcă SVG", printPoster: "Imprimă", language: "Limbă", personalization: "Personalizare", preview: "Previzualizare", transparentBackground: "Fundal transparent", correctionLevel: "Nivel de corecție", downloadError: "Codul nu a putut fi generat" },
  fr: { callToAction: "Scannez pour voir notre carte", copyLink: "Copier le lien", linkCopied: "Lien copié", downloadPng: "Télécharger PNG", downloadSvg: "Télécharger SVG", printPoster: "Imprimer", language: "Langue", personalization: "Personnalisation", preview: "Aperçu", transparentBackground: "Fond transparent", correctionLevel: "Correction d’erreur", downloadError: "Impossible de générer le code" },
  de: { callToAction: "Scannen, um unsere Karte zu sehen", copyLink: "Link kopieren", linkCopied: "Link kopiert", downloadPng: "PNG herunterladen", downloadSvg: "SVG herunterladen", printPoster: "Drucken", language: "Sprache", personalization: "Anpassung", preview: "Vorschau", transparentBackground: "Transparenter Hintergrund", correctionLevel: "Fehlerkorrektur", downloadError: "Code konnte nicht erstellt werden" },
  nl: { callToAction: "Scan om ons menu te bekijken", copyLink: "Link kopiëren", linkCopied: "Link gekopieerd", downloadPng: "PNG downloaden", downloadSvg: "SVG downloaden", printPoster: "Afdrukken", language: "Taal", personalization: "Personalisatie", preview: "Voorbeeld", transparentBackground: "Transparante achtergrond", correctionLevel: "Foutcorrectie", downloadError: "Code kon niet worden gemaakt" },
  eu: { callToAction: "Eskaneatu gure karta ikusteko", copyLink: "Kopiatu esteka", linkCopied: "Esteka kopiatuta", downloadPng: "Deskargatu PNG", downloadSvg: "Deskargatu SVG", printPoster: "Inprimatu", language: "Hizkuntza", personalization: "Pertsonalizazioa", preview: "Aurrebista", transparentBackground: "Atzeko plano gardena", correctionLevel: "Errore-zuzenketa", downloadError: "Ezin izan da kodea sortu" },
  it: { callToAction: "Scansiona per vedere il nostro menu", copyLink: "Copia link", linkCopied: "Link copiato", downloadPng: "Scarica PNG", downloadSvg: "Scarica SVG", printPoster: "Stampa", language: "Lingua", personalization: "Personalizzazione", preview: "Anteprima", transparentBackground: "Sfondo trasparente", correctionLevel: "Correzione errori", downloadError: "Impossibile generare il codice" },
};

export function getQrAdminCopy(locale: string) {
  const config = getLocaleConfig(locale);
  return {
    ...copies.es,
    ...(config ? localizedOverrides[config.code] : {}),
  };
}
