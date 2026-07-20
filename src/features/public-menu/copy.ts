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
};

const copies: Record<string, PublicMenuCopy> = {
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
  },
};

export function getPublicMenuCopy(locale: string) {
  return copies[locale] ?? copies.es;
}
