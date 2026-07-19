import { notFound } from "next/navigation";

import { demoMenu } from "@/features/public-menu/demo-data";
import { PublicMenuPage } from "@/features/public-menu/public-menu-page";
import { getOpeningStatus } from "@/features/public-menu/utils";

type LocalePageProps = {
  params: Promise<{ locale: string }>;
};

export default async function LocalePage({ params }: LocalePageProps) {
  const { locale } = await params;

  if (locale !== "es") {
    notFound();
  }

  const initialOpeningStatus = getOpeningStatus(
    new Date(),
    demoMenu.openingHours,
    demoMenu.timeZone,
  );

  return (
    <PublicMenuPage
      menu={demoMenu}
      initialOpeningStatus={initialOpeningStatus}
    />
  );
}
