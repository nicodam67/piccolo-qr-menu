import { notFound } from "next/navigation";

import { SUPPORTED_LOCALE_CODES } from "@/config/locales";
import { AdminLayout } from "@/features/admin/components/admin-layout";
import { CustomerDetail } from "@/features/admin/customers/components/customer-detail";
import { getAdminCustomerDetail } from "@/features/admin/customers/repository";
import { getAdminDashboardSummary } from "@/features/admin/repository";
import { getCustomerLoyalty } from "@/features/loyalty/repository";
import { getCustomerConsents } from "@/features/consents/repository";
import { getCustomerTags } from "@/features/admin/customer-tags/repository";
import { getLoyaltySettings } from "@/features/admin/loyalty-settings/repository";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const [summary, data, loyalty, consents, tags, loyaltySettings] = await Promise.all([
    getAdminDashboardSummary(),
    getAdminCustomerDetail(customerId),
    getCustomerLoyalty(customerId),
    getCustomerConsents(customerId),
    getCustomerTags(),
    getLoyaltySettings(),
  ]);
  if (!data) notFound();
  return (
    <AdminLayout
      restaurantName={summary.restaurantName}
      locale={summary.locale}
      databaseStatus={summary.databaseStatus}
    >
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        <CustomerDetail
          data={data}
          locales={[...SUPPORTED_LOCALE_CODES]}
          loyalty={loyalty}
          consents={consents}
          tags={tags}
          loyaltySettings={loyaltySettings.settings}
        />
      </div>
    </AdminLayout>
  );
}
