type PublicMenuCopy = {
  searchPlaceholder: string;
  searchLabel: string;
  clearSearch: string;
  noResultsTitle: string;
  noResultsHint: string;
  categoriesLabel: string;
  result: string;
  results: string;
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
  },
};

export function getPublicMenuCopy(locale: string) {
  return copies[locale] ?? copies.es;
}
