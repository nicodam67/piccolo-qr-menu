import { AdminLayout } from "@/features/admin/components/admin-layout";
import { LoyaltySettingsForm } from "@/features/admin/loyalty-settings/components/loyalty-settings-form";
import { getLoyaltySettings } from "@/features/admin/loyalty-settings/repository";
import { getAdminDashboardSummary } from "@/features/admin/repository";

export const dynamic = "force-dynamic";

export default async function LoyaltySettingsPage() {
  const [summary, data] = await Promise.all([
    getAdminDashboardSummary(),
    getLoyaltySettings(),
  ]);
  return (
    <AdminLayout
      restaurantName={summary.restaurantName}
      locale={summary.locale}
      databaseStatus={summary.databaseStatus}
    >
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <LoyaltySettingsForm settings={data.settings} />
      </div>
    </AdminLayout>
  );
}
