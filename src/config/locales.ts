export const SUPPORTED_LOCALES = [
  {
    code: "es",
    adminName: "Español",
    nativeName: "Español",
    htmlLang: "es",
    openGraphLocale: "es_ES",
    direction: "ltr",
    supported: true,
    order: 1,
  },
  {
    code: "ca",
    adminName: "Catalán",
    nativeName: "Català",
    htmlLang: "ca",
    openGraphLocale: "ca_ES",
    direction: "ltr",
    supported: true,
    order: 2,
  },
  {
    code: "en",
    adminName: "Inglés",
    nativeName: "English",
    htmlLang: "en",
    openGraphLocale: "en_GB",
    direction: "ltr",
    supported: true,
    order: 3,
  },
  {
    code: "ro",
    adminName: "Rumano",
    nativeName: "Română",
    htmlLang: "ro",
    openGraphLocale: "ro_RO",
    direction: "ltr",
    supported: true,
    order: 4,
  },
  {
    code: "fr",
    adminName: "Francés",
    nativeName: "Français",
    htmlLang: "fr",
    openGraphLocale: "fr_FR",
    direction: "ltr",
    supported: true,
    order: 5,
  },
  {
    code: "de",
    adminName: "Alemán",
    nativeName: "Deutsch",
    htmlLang: "de",
    openGraphLocale: "de_DE",
    direction: "ltr",
    supported: true,
    order: 6,
  },
  {
    code: "nl",
    adminName: "Neerlandés",
    nativeName: "Nederlands",
    htmlLang: "nl",
    openGraphLocale: "nl_NL",
    direction: "ltr",
    supported: true,
    order: 7,
  },
  {
    code: "eu",
    adminName: "Euskera",
    nativeName: "Euskara",
    htmlLang: "eu",
    openGraphLocale: "eu_ES",
    direction: "ltr",
    supported: true,
    order: 8,
  },
  {
    code: "it",
    adminName: "Italiano",
    nativeName: "Italiano",
    htmlLang: "it",
    openGraphLocale: "it_IT",
    direction: "ltr",
    supported: true,
    order: 9,
  },
] as const;

export type SupportedLocaleCode = (typeof SUPPORTED_LOCALES)[number]["code"];
export type SupportedLocaleConfig = (typeof SUPPORTED_LOCALES)[number];

export const SUPPORTED_LOCALE_CODES = SUPPORTED_LOCALES.map(
  ({ code }) => code,
) as SupportedLocaleCode[];

export function isSupportedLocale(
  value: string,
): value is SupportedLocaleCode {
  return SUPPORTED_LOCALE_CODES.includes(value as SupportedLocaleCode);
}

export function getLocaleConfig(value: string) {
  return SUPPORTED_LOCALES.find(({ code }) => code === value) ?? null;
}
