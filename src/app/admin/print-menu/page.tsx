import type { Metadata } from "next";

import { AdminLayout } from "@/features/admin/components/admin-layout";
import { PrintMenuEditor } from "@/features/admin/print-menu/components/print-menu-editor";
import { selectPublishedPrintLocale } from "@/features/admin/print-menu/print-settings";
import { getAdminDashboardSummary } from "@/features/admin/repository";
import { buildPublicMenuUrl } from "@/features/admin/qr/qr-url";
import { getPublishedLocales } from "@/features/locales/repository";
import { getPublicMenu } from "@/features/public-menu/repository";
import { getRestaurantOpenStatus } from "@/features/public-menu/schedule";
import { getPublicSiteUrl } from "@/features/public-menu/site-url";

export const metadata: Metadata = {
  title: "Carta imprimible · Piccolo QR Menu",
  description: "Vista previa e impresión de la carta real.",
};

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ locale?: string | string[] }>;
};

export default async function AdminPrintMenuPage({ searchParams }: Props) {
  const params = await searchParams;
  const [summary, locales, siteUrl] = await Promise.all([
    getAdminDashboardSummary(),
    getPublishedLocales(),
    getPublicSiteUrl(),
  ]);
  const requestedLocale =
    typeof params.locale === "string" ? params.locale : summary.locale;
  const locale = selectPublishedPrintLocale(
    requestedLocale,
    locales.map(({ code }) => code),
    summary.locale,
  );
  const menu = await getPublicMenu(locale);
  const initialOpeningStatus = getRestaurantOpenStatus({
    now: new Date(),
    weeklySchedule: menu.openingHours,
    specialSchedule: menu.specialOpeningHours,
    timeZone: menu.timeZone,
  });
  const publicUrl = buildPublicMenuUrl(
    siteUrl.toString(),
    locale,
    locales.map(({ code }) => code),
  );

  return (
    <AdminLayout
      restaurantName={summary.restaurantName}
      locale={summary.locale}
      databaseStatus={summary.databaseStatus}
    >
      <div className="mx-auto w-full max-w-[100rem] px-4 py-6 sm:px-6 xl:px-8 print:p-0">
        <PrintMenuEditor
          menu={menu}
          currencyCode={menu.currencyCode}
          locales={locales}
          publicUrl={publicUrl}
          initialOpeningStatus={initialOpeningStatus}
        />
      </div>
    </AdminLayout>
  );
}
