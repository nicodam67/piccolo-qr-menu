import type { Metadata } from "next";

import { AdminLayout } from "@/features/admin/components/admin-layout";
import { getAdminDashboardSummary } from "@/features/admin/repository";
import { SpecialHoursManager } from "@/features/admin/special-hours/components/special-hours-manager";
import { getSpecialHoursData } from "@/features/admin/special-hours/repository";

export const metadata: Metadata = {
  title: "Horarios especiales · Piccolo QR Menu",
  description: "Gestión de cierres y aperturas excepcionales.",
};

export const dynamic = "force-dynamic";

export default async function AdminSpecialHoursPage() {
  const [summary, data] = await Promise.all([
    getAdminDashboardSummary(),
    getSpecialHoursData(),
  ]);

  return (
    <AdminLayout
      restaurantName={summary.restaurantName}
      locale={summary.locale}
      databaseStatus={summary.databaseStatus}
    >
      <div className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 sm:py-8 xl:px-8">
        <SpecialHoursManager records={data.records} timezone={data.timezone} />
      </div>
    </AdminLayout>
  );
}
