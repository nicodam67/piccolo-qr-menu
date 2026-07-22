import type { Metadata } from "next";

import { AdminLayout } from "@/features/admin/components/admin-layout";
import { MenuSettingsEditor } from "@/features/admin/menu-settings/components/menu-settings-editor";
import { getMenuDisplaySettings } from "@/features/admin/menu-settings/repository";
import { getAdminDashboardSummary } from "@/features/admin/repository";
import { getPublicMenu } from "@/features/public-menu/repository";

export const metadata: Metadata = {
  title: "Configuración de carta · Piccolo QR Menu",
  description: "Personalización visual de la carta pública.",
};

export const dynamic = "force-dynamic";

export default async function AdminMenuSettingsPage() {
  const [summary, settingsData] = await Promise.all([
    getAdminDashboardSummary(),
    getMenuDisplaySettings(),
  ]);
  const previewMenu = await getPublicMenu(summary.locale);

  return (
    <AdminLayout
      restaurantName={summary.restaurantName}
      locale={summary.locale}
      databaseStatus={summary.databaseStatus}
    >
      <div className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 sm:py-8 xl:px-8">
        <MenuSettingsEditor
          initialSettings={settingsData.settings}
          previewMenu={previewMenu}
        />
      </div>
    </AdminLayout>
  );
}
