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

export type OpeningStatus = {
  isOpen: boolean;
  label: string;
  detail: string;
};

export type ProductTag = {
  label: string;
  tone: "green" | "red" | "gold";
};

export type DemoProduct = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  fullPriceCents: number;
  halfPriceCents?: number;
  fullPrice: number;
  halfPrice?: number;
  tags: ProductTag[];
  allergens: string[];
  isSoldOut?: boolean;
};

export type DemoCategory = {
  id: string;
  name: string;
  eyebrow: string;
};

export type DemoMenu = {
  restaurant: {
    id: string;
    name: string;
    slogan: string;
    phoneDisplay: string;
    phoneHref: string;
    address: string;
    currencyCode: string;
    heroImageUrl: string;
    heroImageAlt: string;
  };
  locale: string;
  timeZone: string;
  categories: DemoCategory[];
  products: DemoProduct[];
  openingHours: OpeningDay[];
};
