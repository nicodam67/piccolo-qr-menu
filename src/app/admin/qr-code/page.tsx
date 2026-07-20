import type { Metadata } from "next";

import { AdminLayout } from "@/features/admin/components/admin-layout";
import { QrManager } from "@/features/admin/qr/components/qr-manager";
import { getQrAdminData } from "@/features/admin/qr/repository";
import { parseQrCustomizationSearchParams } from "@/features/admin/qr/qr-settings";
import { getAdminDashboardSummary } from "@/features/admin/repository";

export const metadata: Metadata = {
  title: "Código QR · Piccolo QR Menu",
  description: "Generador del código QR oficial de la carta.",
};

export const dynamic = "force-dynamic";

type QrCodePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminQrCodePage({
  searchParams,
}: QrCodePageProps) {
  const params = await searchParams;
  const [summary, qrData] = await Promise.all([
    getAdminDashboardSummary(),
    getQrAdminData(),
  ]);
  return (
    <AdminLayout
      restaurantName={summary.restaurantName}
      locale={summary.locale}
      databaseStatus={summary.databaseStatus}
    >
      <div className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 sm:py-8 xl:px-8">
        <QrManager
          baseUrl={qrData.publicBaseUrl}
          configuredDomain={qrData.configuredDomain}
          locales={qrData.locales}
          defaultLocale={qrData.defaultLocale}
          initialLocale={
            typeof params.locale === "string" &&
            qrData.locales.some(({ code }) => code === params.locale)
              ? params.locale
              : qrData.defaultLocale
          }
          initialCustomization={parseQrCustomizationSearchParams(params)}
          restaurantNames={qrData.restaurantNames}
          restaurantSlogans={qrData.restaurantSlogans}
        />
      </div>
    </AdminLayout>
  );
}
