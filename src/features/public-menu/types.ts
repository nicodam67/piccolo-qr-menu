import type { MenuDisplaySettings } from "@/features/menu-settings/config";

export type DayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type OpeningPeriod = {
  opensAt: string;
  closesAt: string;
};

export type OpeningDay = {
  day: DayKey;
  label: string;
  periods: OpeningPeriod[];
};

export type SpecialOpeningDay = {
  date: string;
  exceptionType?: "open" | "closed" | "special";
  isClosed: boolean;
  reason?: string;
  periods: OpeningPeriod[];
};

export type OpeningStatus = {
  isOpen: boolean;
  state:
    | "open"
    | "closed"
    | "openingSoon"
    | "closingSoon"
    | "closedToday"
    | "unavailable";
  currentDay: DayKey | null;
  isSpecial?: boolean;
  reason?: string;
  specialDate?: string;
  reopensToday?: boolean;
  closesAt?: string;
  nextOpening?: {
    day: DayKey;
    dayOffset: number;
    opensAt: string;
  };
};

export type ProductTag = {
  label: string;
  tone: "green" | "red" | "gold";
};

export type ProductAllergen = {
  label: string;
  icon: string;
};

export type DemoProduct = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  fullPrice: number;
  halfPrice?: number;
  tags: ProductTag[];
  allergens: ProductAllergen[];
  isSoldOut?: boolean;
};

export type DemoCategory = {
  id: string;
  parentCategoryId?: string | null;
  sortOrder?: number;
  name: string;
  eyebrow: string;
};

export type DemoMenu = {
  restaurant: {
    name: string;
    slogan: string;
    phoneDisplay: string;
    phoneHref: string;
    address: string;
    heroImageUrl: string;
    heroImageAlt: string;
  };
  locale: string;
  currencyCode: string;
  reservationsEnabled?: boolean;
  timeZone: string;
  categories: DemoCategory[];
  products: DemoProduct[];
  openingHours: OpeningDay[];
  specialOpeningHours: SpecialOpeningDay[];
  displaySettings: MenuDisplaySettings;
};

export type PublicProductDetail = {
  locale: string;
  currencyCode: string;
  restaurant: DemoMenu["restaurant"];
  category: DemoCategory;
  parentCategory: DemoCategory | null;
  product: DemoProduct;
  relatedProducts: DemoProduct[];
  displaySettings: MenuDisplaySettings;
  openingHours: OpeningDay[];
  specialOpeningHours: SpecialOpeningDay[];
  timeZone: string;
};
