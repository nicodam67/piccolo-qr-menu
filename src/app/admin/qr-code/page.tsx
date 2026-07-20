import type { Metadata } from "next";

import { AdminLayout } from "@/features/admin/components/admin-layout";
import { QrManager } from "@/features/admin/qr/components/qr-manager";
import { getQrAdminData } from "@/features/admin/qr/repository";
import { getAdminDashboardSummary } from "@/features/admin/repository";
import {
  getConfiguredPublicSiteUrl,
  getPublicSiteUrl,
} from "@/features/public-menu/site-url";

export const metadata: Metadata = {
  title: "Código QR · Piccolo QR Menu",
  description: "Generador del código QR oficial de la carta.",
};

export const dynamic = "force-dynamic";

export default async function AdminQrCodePage() {
  const [summary, qrData] = await Promise.all([
    getAdminDashboardSummary(),
    getQrAdminData(),
  ]);
  const configuredSiteUrl = getConfiguredPublicSiteUrl();
  const siteUrl = configuredSiteUrl ?? (await getPublicSiteUrl());

  return (
    <AdminLayout
      restaurantName={summary.restaurantName}
      locale={summary.locale}
      databaseStatus={summary.databaseStatus}
    >
      <div className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 sm:py-8 xl:px-8">
        <QrManager
          baseUrl={siteUrl.toString()}
          configuredDomain={Boolean(configuredSiteUrl)}
          locales={qrData.locales}
          defaultLocale={qrData.defaultLocale}
          restaurantNames={qrData.restaurantNames}
          restaurantSlogans={qrData.restaurantSlogans}
        />
      </div>
    </AdminLayout>
  );
}
