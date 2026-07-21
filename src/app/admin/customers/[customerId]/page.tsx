import { notFound } from "next/navigation";

import { SUPPORTED_LOCALE_CODES } from "@/config/locales";
import { AdminLayout } from "@/features/admin/components/admin-layout";
import { CustomerDetail } from "@/features/admin/customers/components/customer-detail";
import { getAdminCustomerDetail } from "@/features/admin/customers/repository";
import { getAdminDashboardSummary } from "@/features/admin/repository";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const [summary, data] = await Promise.all([
    getAdminDashboardSummary(),
    getAdminCustomerDetail(customerId),
  ]);
  if (!data) notFound();
  return (
    <AdminLayout
      restaurantName={summary.restaurantName}
      locale={summary.locale}
      databaseStatus={summary.databaseStatus}
    >
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        <CustomerDetail data={data} locales={[...SUPPORTED_LOCALE_CODES]} />
      </div>
    </AdminLayout>
  );
}
