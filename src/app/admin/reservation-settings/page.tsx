import type { Metadata } from "next";

import { AdminLayout } from "@/features/admin/components/admin-layout";
import { getAdminDashboardSummary } from "@/features/admin/repository";
import { ReservationSettingsForm } from "@/features/admin/reservation-settings/components/reservation-settings-form";
import { getAdminReservationSettings } from "@/features/admin/reservation-settings/repository";
import { isOnlinePaymentProviderEnabled } from "@/features/reservations/payments/provider-factory";

export const metadata: Metadata = {
  title: "Configuración de reservas · Piccolo QR Menu",
};
export const dynamic = "force-dynamic";

export default async function ReservationSettingsPage() {
  const [summary, data] = await Promise.all([
    getAdminDashboardSummary(),
    getAdminReservationSettings(),
  ]);
  return (
    <AdminLayout
      restaurantName={summary.restaurantName}
      locale={summary.locale}
      databaseStatus={summary.databaseStatus}
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <ReservationSettingsForm
          settings={data.settings}
          onlinePaymentsEnabled={isOnlinePaymentProviderEnabled()}
        />
      </div>
    </AdminLayout>
  );
}
