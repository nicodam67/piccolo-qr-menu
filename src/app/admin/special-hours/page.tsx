import type { Metadata } from "next";

import { AdminLayout } from "@/features/admin/components/admin-layout";
import { getAdminDashboardSummary } from "@/features/admin/repository";
import { SpecialHoursManager } from "@/features/admin/special-hours/components/special-hours-manager";
import { getSpecialHoursData } from "@/features/admin/special-hours/repository";
import { getMonthBounds } from "@/features/admin/special-hours/utils";

export const metadata: Metadata = {
  title: "Horarios especiales · Piccolo QR Menu",
  description: "Gestión de cierres y aperturas excepcionales.",
};

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ month?: string | string[] }>;
};

export default async function AdminSpecialHoursPage({ searchParams }: Props) {
  const params = await searchParams;
  const candidate = typeof params.month === "string" ? params.month : undefined;
  let month: string | undefined;
  if (candidate) {
    try {
      month = getMonthBounds(candidate).month;
    } catch {
      month = undefined;
    }
  }
  const [summary, data] = await Promise.all([
    getAdminDashboardSummary(),
    getSpecialHoursData(month),
  ]);

  return (
    <AdminLayout
      restaurantName={summary.restaurantName}
      locale={summary.locale}
      databaseStatus={summary.databaseStatus}
    >
      <div className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 sm:py-8 xl:px-8">
        <SpecialHoursManager
          records={data.records}
          timezone={data.timezone}
          month={data.month}
        />
      </div>
    </AdminLayout>
  );
}
