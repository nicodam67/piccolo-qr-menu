import { getLocaleConfig, type SupportedLocaleCode } from "@/config/locales";

export type PrintMenuCopy = {
  title: string; preview: string; print: string; orientation: string;
  columns: string; fontSize: string; density: string; descriptions: string;
  allergens: string; tags: string; halfPortion: string; soldOut: string;
  qr: string; oneColumn: string; twoColumns: string; portrait: string;
  landscape: string; compact: string; comfortable: string;
  allergenInfo: string; small: string; normal: string; large: string;
  address: string; phone: string; slogan: string;
  soldOutLabel: string; halfPortionLabel: string;
  administration: string; language: string; generatingQr: string;
};

const es: PrintMenuCopy = {
  title:"Carta imprimible",preview:"Vista previa",print:"Imprimir o guardar como PDF",
  orientation:"Orientación",columns:"Columnas",fontSize:"Tamaño del texto",density:"Densidad",
  descriptions:"Mostrar descripciones",allergens:"Mostrar alérgenos",tags:"Mostrar etiquetas",
  halfPortion:"Mostrar media ración",soldOut:"Mostrar agotados",qr:"Mostrar QR",
  oneColumn:"Una columna",twoColumns:"Dos columnas",portrait:"Vertical",landscape:"Horizontal",
  compact:"Compacta",comfortable:"Cómoda",allergenInfo:"Información sobre alérgenos",
  small:"Pequeño",normal:"Normal",large:"Grande",address:"Mostrar dirección",
  phone:"Mostrar teléfono",slogan:"Mostrar eslogan",
  soldOutLabel:"Agotado",halfPortionLabel:"Media ración",
  administration:"Administración",language:"Idioma",generatingQr:"Generando QR…",
};

const overrides: Record<SupportedLocaleCode, Partial<PrintMenuCopy>> = {
  es:{},
  ca:{title:"Carta imprimible",preview:"Vista prèvia",print:"Imprimir o desar com a PDF",soldOut:"Mostrar esgotats",halfPortion:"Mostrar mitja ració"},
  en:{title:"Printable menu",preview:"Preview",print:"Print or save as PDF",soldOut:"Show sold-out products",halfPortion:"Show half portions"},
  ro:{title:"Meniu imprimabil",preview:"Previzualizare",print:"Imprimă sau salvează PDF"},
  fr:{title:"Carte imprimable",preview:"Aperçu",print:"Imprimer ou enregistrer en PDF"},
  de:{title:"Druckbare Speisekarte",preview:"Vorschau",print:"Drucken oder als PDF speichern"},
  nl:{title:"Afdrukbaar menu",preview:"Voorbeeld",print:"Afdrukken of opslaan als PDF"},
  eu:{title:"Karta inprimagarria",preview:"Aurrebista",print:"Inprimatu edo PDF gisa gorde"},
  it:{title:"Menu stampabile",preview:"Anteprima",print:"Stampa o salva come PDF"},
};

export function getPrintMenuCopy(locale: string) {
  const config = getLocaleConfig(locale);
  return { ...es, ...(config ? overrides[config.code] : {}) };
}
