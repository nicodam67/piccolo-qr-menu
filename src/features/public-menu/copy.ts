import {
  getLocaleConfig,
  type SupportedLocaleCode,
} from "@/config/locales";

type PublicMenuCopy = {
  searchPlaceholder: string;
  searchLabel: string;
  clearSearch: string;
  noResultsTitle: string;
  noResultsHint: string;
  categoriesLabel: string;
  result: string;
  results: string;
  viewProduct: string;
  backToMenu: string;
  share: string;
  linkCopied: string;
  copyError: string;
  enlargeImage: string;
  closeImage: string;
  relatedProducts: string;
  soldOut: string;
  price: string;
  halfPortion: string;
  allergens: string;
  tags: string;
  category: string;
  productUnavailableInLanguage: string;
};

const copies: Record<SupportedLocaleCode, PublicMenuCopy> = {
  es: {
    searchPlaceholder: "Buscar platos...",
    searchLabel: "Buscar platos en la carta",
    clearSearch: "Borrar búsqueda",
    noResultsTitle: "No encontramos ningún plato",
    noResultsHint: "Prueba con otro nombre o descripción.",
    categoriesLabel: "Categorías de la carta",
    result: "resultado",
    results: "resultados",
    viewProduct: "Ver producto",
    backToMenu: "Volver a la carta",
    share: "Compartir",
    linkCopied: "Enlace copiado",
    copyError: "No se pudo copiar el enlace",
    enlargeImage: "Ampliar imagen",
    closeImage: "Cerrar imagen",
    relatedProducts: "Productos relacionados",
    soldOut: "Producto agotado",
    price: "Precio",
    halfPortion: "Media ración",
    allergens: "Alérgenos",
    tags: "Etiquetas",
    category: "Categoría",
    productUnavailableInLanguage:
      "El producto no está disponible en este idioma. Se abrirá la carta principal.",
  },
  ca: {
    searchPlaceholder: "Buscar plats...",
    searchLabel: "Buscar plats a la carta",
    clearSearch: "Esborrar cerca",
    noResultsTitle: "No hem trobat cap plat",
    noResultsHint: "Prova amb un altre nom o descripció.",
    categoriesLabel: "Categories de la carta",
    result: "resultat",
    results: "resultats",
    viewProduct: "Veure producte",
    backToMenu: "Tornar a la carta",
    share: "Compartir",
    linkCopied: "Enllaç copiat",
    copyError: "No s'ha pogut copiar l'enllaç",
    enlargeImage: "Ampliar imatge",
    closeImage: "Tancar imatge",
    relatedProducts: "Productes relacionats",
    soldOut: "Producte esgotat",
    price: "Preu",
    halfPortion: "Mitja ració",
    allergens: "Al·lèrgens",
    tags: "Etiquetes",
    category: "Categoria",
    productUnavailableInLanguage:
      "El producte no està disponible en aquest idioma. S'obrirà la carta principal.",
  },
  en: {
    searchPlaceholder: "Search dishes...",
    searchLabel: "Search dishes on the menu",
    clearSearch: "Clear search",
    noResultsTitle: "No dishes found",
    noResultsHint: "Try another name or description.",
    categoriesLabel: "Menu categories",
    result: "result",
    results: "results",
    viewProduct: "View product",
    backToMenu: "Back to menu",
    share: "Share",
    linkCopied: "Link copied",
    copyError: "Could not copy the link",
    enlargeImage: "Enlarge image",
    closeImage: "Close image",
    relatedProducts: "Related products",
    soldOut: "Sold out",
    price: "Price",
    halfPortion: "Half portion",
    allergens: "Allergens",
    tags: "Tags",
    category: "Category",
    productUnavailableInLanguage:
      "This product is not available in that language. The main menu will open.",
  },
  ro: {
    searchPlaceholder: "Caută preparate...",
    searchLabel: "Caută preparate în meniu",
    clearSearch: "Șterge căutarea",
    noResultsTitle: "Nu am găsit niciun preparat",
    noResultsHint: "Încearcă un alt nume sau o descriere.",
    categoriesLabel: "Categoriile meniului",
    result: "rezultat",
    results: "rezultate",
    viewProduct: "Vezi produsul",
    backToMenu: "Înapoi la meniu",
    share: "Distribuie",
    linkCopied: "Link copiat",
    copyError: "Linkul nu a putut fi copiat",
    enlargeImage: "Mărește imaginea",
    closeImage: "Închide imaginea",
    relatedProducts: "Produse similare",
    soldOut: "Produs epuizat",
    price: "Preț",
    halfPortion: "Jumătate de porție",
    allergens: "Alergeni",
    tags: "Etichete",
    category: "Categorie",
    productUnavailableInLanguage:
      "Produsul nu este disponibil în această limbă. Se va deschide meniul principal.",
  },
  fr: {
    searchPlaceholder: "Rechercher des plats...",
    searchLabel: "Rechercher des plats dans la carte",
    clearSearch: "Effacer la recherche",
    noResultsTitle: "Aucun plat trouvé",
    noResultsHint: "Essayez un autre nom ou une autre description.",
    categoriesLabel: "Catégories de la carte",
    result: "résultat",
    results: "résultats",
    viewProduct: "Voir le produit",
    backToMenu: "Retour à la carte",
    share: "Partager",
    linkCopied: "Lien copié",
    copyError: "Impossible de copier le lien",
    enlargeImage: "Agrandir l'image",
    closeImage: "Fermer l'image",
    relatedProducts: "Produits associés",
    soldOut: "Produit épuisé",
    price: "Prix",
    halfPortion: "Demi-portion",
    allergens: "Allergènes",
    tags: "Étiquettes",
    category: "Catégorie",
    productUnavailableInLanguage:
      "Ce produit n'est pas disponible dans cette langue. La carte principale va s'ouvrir.",
  },
  de: {
    searchPlaceholder: "Gerichte suchen...",
    searchLabel: "Gerichte in der Karte suchen",
    clearSearch: "Suche löschen",
    noResultsTitle: "Keine Gerichte gefunden",
    noResultsHint: "Versuche einen anderen Namen oder eine Beschreibung.",
    categoriesLabel: "Menükategorien",
    result: "Ergebnis",
    results: "Ergebnisse",
    viewProduct: "Produkt ansehen",
    backToMenu: "Zurück zur Speisekarte",
    share: "Teilen",
    linkCopied: "Link kopiert",
    copyError: "Link konnte nicht kopiert werden",
    enlargeImage: "Bild vergrößern",
    closeImage: "Bild schließen",
    relatedProducts: "Ähnliche Produkte",
    soldOut: "Produkt ausverkauft",
    price: "Preis",
    halfPortion: "Halbe Portion",
    allergens: "Allergene",
    tags: "Kennzeichnungen",
    category: "Kategorie",
    productUnavailableInLanguage:
      "Dieses Produkt ist in dieser Sprache nicht verfügbar. Die Hauptkarte wird geöffnet.",
  },
  nl: {
    searchPlaceholder: "Gerechten zoeken...",
    searchLabel: "Gerechten in het menu zoeken",
    clearSearch: "Zoekopdracht wissen",
    noResultsTitle: "Geen gerechten gevonden",
    noResultsHint: "Probeer een andere naam of beschrijving.",
    categoriesLabel: "Menucategorieën",
    result: "resultaat",
    results: "resultaten",
    viewProduct: "Product bekijken",
    backToMenu: "Terug naar het menu",
    share: "Delen",
    linkCopied: "Link gekopieerd",
    copyError: "Link kon niet worden gekopieerd",
    enlargeImage: "Afbeelding vergroten",
    closeImage: "Afbeelding sluiten",
    relatedProducts: "Gerelateerde producten",
    soldOut: "Product uitverkocht",
    price: "Prijs",
    halfPortion: "Halve portie",
    allergens: "Allergenen",
    tags: "Labels",
    category: "Categorie",
    productUnavailableInLanguage:
      "Dit product is niet beschikbaar in deze taal. Het hoofdmenu wordt geopend.",
  },
  eu: {
    searchPlaceholder: "Platerak bilatu...",
    searchLabel: "Platerak menuan bilatu",
    clearSearch: "Bilaketa garbitu",
    noResultsTitle: "Ez da platerik aurkitu",
    noResultsHint: "Saiatu beste izen edo deskribapen batekin.",
    categoriesLabel: "Menuko kategoriak",
    result: "emaitza",
    results: "emaitzak",
    viewProduct: "Produktua ikusi",
    backToMenu: "Itzuli menura",
    share: "Partekatu",
    linkCopied: "Esteka kopiatu da",
    copyError: "Ezin izan da esteka kopiatu",
    enlargeImage: "Irudia handitu",
    closeImage: "Irudia itxi",
    relatedProducts: "Lotutako produktuak",
    soldOut: "Produktua agortuta",
    price: "Prezioa",
    halfPortion: "Errazio erdia",
    allergens: "Alergenoak",
    tags: "Etiketak",
    category: "Kategoria",
    productUnavailableInLanguage:
      "Produktua ez dago hizkuntza honetan. Menu nagusia irekiko da.",
  },
  it: {
    searchPlaceholder: "Cerca piatti...",
    searchLabel: "Cerca piatti nel menu",
    clearSearch: "Cancella ricerca",
    noResultsTitle: "Nessun piatto trovato",
    noResultsHint: "Prova con un altro nome o una descrizione.",
    categoriesLabel: "Categorie del menu",
    result: "risultato",
    results: "risultati",
    viewProduct: "Vedi prodotto",
    backToMenu: "Torna al menu",
    share: "Condividi",
    linkCopied: "Link copiato",
    copyError: "Impossibile copiare il link",
    enlargeImage: "Ingrandisci immagine",
    closeImage: "Chiudi immagine",
    relatedProducts: "Prodotti correlati",
    soldOut: "Prodotto esaurito",
    price: "Prezzo",
    halfPortion: "Mezza porzione",
    allergens: "Allergeni",
    tags: "Etichette",
    category: "Categoria",
    productUnavailableInLanguage:
      "Questo prodotto non è disponibile in questa lingua. Si aprirà il menu principale.",
  },
};

export function getPublicMenuCopy(locale: string) {
  const config = getLocaleConfig(locale);
  return config ? copies[config.code] : copies.es;
}
