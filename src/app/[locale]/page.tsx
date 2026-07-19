import { notFound } from "next/navigation";

import { PublicMenuPage } from "@/features/public-menu/public-menu-page";
import { getPublicMenu } from "@/features/public-menu/repository";
import { getOpeningStatus } from "@/features/public-menu/utils";

type LocalePageProps = {
  params: Promise<{ locale: string }>;
};

export const dynamicParams = false;
export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return [{ locale: "es" }];
}

export default async function LocalePage({ params }: LocalePageProps) {
  const { locale } = await params;

  if (locale !== "es") {
    notFound();
  }

  const menu = await getPublicMenu(locale);
  const initialOpeningStatus = getOpeningStatus(
    new Date(),
    menu.openingHours,
    menu.timeZone,
  );

  return (
    <PublicMenuPage menu={menu} initialOpeningStatus={initialOpeningStatus} />
  );
}
