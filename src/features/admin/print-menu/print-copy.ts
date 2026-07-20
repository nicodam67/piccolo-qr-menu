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
  ca:{title:"Carta imprimible",preview:"Vista prèvia",print:"Imprimir o desar com a PDF",orientation:"Orientació",columns:"Columnes",fontSize:"Mida del text",density:"Densitat",descriptions:"Mostrar descripcions",allergens:"Mostrar al·lèrgens",tags:"Mostrar etiquetes",halfPortion:"Mostrar mitja ració",soldOut:"Mostrar esgotats",qr:"Mostrar QR",oneColumn:"Una columna",twoColumns:"Dues columnes",portrait:"Vertical",landscape:"Horitzontal",compact:"Compacta",comfortable:"Còmoda",allergenInfo:"Informació sobre al·lèrgens",small:"Petit",normal:"Normal",large:"Gran",address:"Mostrar adreça",phone:"Mostrar telèfon",slogan:"Mostrar eslògan",soldOutLabel:"Esgotat",halfPortionLabel:"Mitja ració",administration:"Administració",language:"Idioma",generatingQr:"Generant QR…"},
  en:{title:"Printable menu",preview:"Preview",print:"Print or save as PDF",orientation:"Orientation",columns:"Columns",fontSize:"Text size",density:"Density",descriptions:"Show descriptions",allergens:"Show allergens",tags:"Show tags",halfPortion:"Show half portions",soldOut:"Show sold-out products",qr:"Show QR",oneColumn:"One column",twoColumns:"Two columns",portrait:"Portrait",landscape:"Landscape",compact:"Compact",comfortable:"Comfortable",allergenInfo:"Allergen information",small:"Small",normal:"Normal",large:"Large",address:"Show address",phone:"Show phone",slogan:"Show slogan",soldOutLabel:"Sold out",halfPortionLabel:"Half portion",administration:"Administration",language:"Language",generatingQr:"Generating QR…"},
  ro:{title:"Meniu imprimabil",preview:"Previzualizare",print:"Imprimă sau salvează PDF",orientation:"Orientare",columns:"Coloane",fontSize:"Dimensiunea textului",density:"Densitate",descriptions:"Arată descrierile",allergens:"Arată alergenii",tags:"Arată etichetele",halfPortion:"Arată jumătățile de porție",soldOut:"Arată produsele epuizate",qr:"Arată QR",oneColumn:"O coloană",twoColumns:"Două coloane",portrait:"Vertical",landscape:"Orizontal",compact:"Compactă",comfortable:"Confortabilă",allergenInfo:"Informații despre alergeni",small:"Mic",normal:"Normal",large:"Mare",address:"Arată adresa",phone:"Arată telefonul",slogan:"Arată sloganul",soldOutLabel:"Epuizat",halfPortionLabel:"Jumătate de porție",administration:"Administrare",language:"Limbă",generatingQr:"Se generează QR…"},
  fr:{title:"Carte imprimable",preview:"Aperçu",print:"Imprimer ou enregistrer en PDF",orientation:"Orientation",columns:"Colonnes",fontSize:"Taille du texte",density:"Densité",descriptions:"Afficher les descriptions",allergens:"Afficher les allergènes",tags:"Afficher les étiquettes",halfPortion:"Afficher les demi-portions",soldOut:"Afficher les produits épuisés",qr:"Afficher le QR",oneColumn:"Une colonne",twoColumns:"Deux colonnes",portrait:"Verticale",landscape:"Horizontale",compact:"Compacte",comfortable:"Confortable",allergenInfo:"Informations sur les allergènes",small:"Petit",normal:"Normal",large:"Grand",address:"Afficher l’adresse",phone:"Afficher le téléphone",slogan:"Afficher le slogan",soldOutLabel:"Épuisé",halfPortionLabel:"Demi-portion",administration:"Administration",language:"Langue",generatingQr:"Génération du QR…"},
  de:{title:"Druckbare Speisekarte",preview:"Vorschau",print:"Drucken oder als PDF speichern",orientation:"Ausrichtung",columns:"Spalten",fontSize:"Textgröße",density:"Dichte",descriptions:"Beschreibungen anzeigen",allergens:"Allergene anzeigen",tags:"Tags anzeigen",halfPortion:"Halbe Portionen anzeigen",soldOut:"Ausverkaufte Produkte anzeigen",qr:"QR anzeigen",oneColumn:"Eine Spalte",twoColumns:"Zwei Spalten",portrait:"Hochformat",landscape:"Querformat",compact:"Kompakt",comfortable:"Bequem",allergenInfo:"Allergeninformationen",small:"Klein",normal:"Normal",large:"Groß",address:"Adresse anzeigen",phone:"Telefon anzeigen",slogan:"Slogan anzeigen",soldOutLabel:"Ausverkauft",halfPortionLabel:"Halbe Portion",administration:"Verwaltung",language:"Sprache",generatingQr:"QR wird erstellt…"},
  nl:{title:"Afdrukbaar menu",preview:"Voorbeeld",print:"Afdrukken of opslaan als PDF",orientation:"Oriëntatie",columns:"Kolommen",fontSize:"Tekstgrootte",density:"Dichtheid",descriptions:"Beschrijvingen tonen",allergens:"Allergenen tonen",tags:"Labels tonen",halfPortion:"Halve porties tonen",soldOut:"Uitverkochte producten tonen",qr:"QR tonen",oneColumn:"Eén kolom",twoColumns:"Twee kolommen",portrait:"Staand",landscape:"Liggend",compact:"Compact",comfortable:"Comfortabel",allergenInfo:"Informatie over allergenen",small:"Klein",normal:"Normaal",large:"Groot",address:"Adres tonen",phone:"Telefoon tonen",slogan:"Slogan tonen",soldOutLabel:"Uitverkocht",halfPortionLabel:"Halve portie",administration:"Beheer",language:"Taal",generatingQr:"QR wordt gegenereerd…"},
  eu:{title:"Karta inprimagarria",preview:"Aurrebista",print:"Inprimatu edo PDF gisa gorde",orientation:"Orientazioa",columns:"Zutabeak",fontSize:"Testuaren tamaina",density:"Dentsitatea",descriptions:"Erakutsi deskribapenak",allergens:"Erakutsi alergenoak",tags:"Erakutsi etiketak",halfPortion:"Erakutsi anoa erdiak",soldOut:"Erakutsi agortuak",qr:"Erakutsi QR",oneColumn:"Zutabe bat",twoColumns:"Bi zutabe",portrait:"Bertikala",landscape:"Horizontala",compact:"Trinkoa",comfortable:"Erosoa",allergenInfo:"Alergenoei buruzko informazioa",small:"Txikia",normal:"Normala",large:"Handia",address:"Erakutsi helbidea",phone:"Erakutsi telefonoa",slogan:"Erakutsi eslogana",soldOutLabel:"Agortuta",halfPortionLabel:"Anoa erdia",administration:"Administrazioa",language:"Hizkuntza",generatingQr:"QR sortzen…"},
  it:{title:"Menu stampabile",preview:"Anteprima",print:"Stampa o salva come PDF",orientation:"Orientamento",columns:"Colonne",fontSize:"Dimensione testo",density:"Densità",descriptions:"Mostra descrizioni",allergens:"Mostra allergeni",tags:"Mostra etichette",halfPortion:"Mostra mezze porzioni",soldOut:"Mostra prodotti esauriti",qr:"Mostra QR",oneColumn:"Una colonna",twoColumns:"Due colonne",portrait:"Verticale",landscape:"Orizzontale",compact:"Compatta",comfortable:"Comoda",allergenInfo:"Informazioni sugli allergeni",small:"Piccolo",normal:"Normale",large:"Grande",address:"Mostra indirizzo",phone:"Mostra telefono",slogan:"Mostra slogan",soldOutLabel:"Esaurito",halfPortionLabel:"Mezza porzione",administration:"Amministrazione",language:"Lingua",generatingQr:"Generazione QR…"},
};

export function getPrintMenuCopy(locale: string) {
  const config = getLocaleConfig(locale);
  return { ...es, ...(config ? overrides[config.code] : {}) };
}
