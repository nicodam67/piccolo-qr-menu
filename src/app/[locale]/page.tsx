import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getLocaleConfig, isSupportedLocale } from "@/config/locales";
import {
  getPublishedLocales,
  isLocalePublished,
} from "@/features/locales/repository";
import { PublicMenuPage } from "@/features/public-menu/public-menu-page";
import { getPublicMenu } from "@/features/public-menu/repository";
import {
  getPublicSiteUrl,
  makeAbsolutePublicUrl,
} from "@/features/public-menu/site-url";
import { getRestaurantOpenStatus } from "@/features/public-menu/schedule";

type LocalePageProps = {
  params: Promise<{ locale: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: LocalePageProps): Promise<Metadata> {
  const { locale } = await params;

  if (!isSupportedLocale(locale) || !(await isLocalePublished(locale))) {
    notFound();
  }

  const [menu, publishedLocales, siteUrl] = await Promise.all([
    getPublicMenu(locale),
    getPublishedLocales(),
    getPublicSiteUrl(),
  ]);
  const config = getLocaleConfig(locale);
  const languageAlternates = Object.fromEntries(
    publishedLocales.map((published) => [
      published.code,
      makeAbsolutePublicUrl(`/${published.code}`, siteUrl),
    ]),
  );
  const primary = publishedLocales.find((published) => published.isPrimary);

  return {
    title: `${menu.restaurant.name} · Carta`,
    description: menu.restaurant.slogan,
    alternates: {
      canonical: makeAbsolutePublicUrl(`/${locale}`, siteUrl),
      languages: {
        ...languageAlternates,
        "x-default": makeAbsolutePublicUrl(
          `/${primary?.code ?? locale}`,
          siteUrl,
        ),
      },
    },
    openGraph: {
      title: `${menu.restaurant.name} · Carta`,
      description: menu.restaurant.slogan,
      url: makeAbsolutePublicUrl(`/${locale}`, siteUrl),
      locale: config?.openGraphLocale,
      alternateLocale: publishedLocales
        .filter((published) => published.code !== locale)
        .map((published) => published.openGraphLocale),
      siteName: menu.restaurant.name,
    },
  };
}

export default async function LocalePage({ params }: LocalePageProps) {
  const { locale } = await params;

  if (!isSupportedLocale(locale) || !(await isLocalePublished(locale))) {
    notFound();
  }

  const [menu, publishedLocales] = await Promise.all([
    getPublicMenu(locale),
    getPublishedLocales(),
  ]);
  const initialOpeningStatus = getRestaurantOpenStatus({
    now: new Date(),
    weeklySchedule: menu.openingHours,
    timeZone: menu.timeZone,
  });
  const schemaDays: Record<string, string> = {
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    sunday: "Sunday",
  };
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: menu.restaurant.name,
    ...(menu.restaurant.phoneDisplay
      ? { telephone: menu.restaurant.phoneDisplay }
      : {}),
    ...(menu.restaurant.address ? { address: menu.restaurant.address } : {}),
    openingHoursSpecification: menu.openingHours.flatMap((day) =>
      day.periods.map((period) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: `https://schema.org/${schemaDays[day.day]}`,
        opens: period.opensAt,
        closes: period.closesAt,
      })),
    ),
  };

  return (
    <>
      <script type="application/ld+json">
        {JSON.stringify(jsonLd).replace(/</g, "\\u003c")}
      </script>
      <PublicMenuPage
        menu={menu}
        initialOpeningStatus={initialOpeningStatus}
        publishedLocales={publishedLocales}
      />
    </>
  );
}
