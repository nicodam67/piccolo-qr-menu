import { AdminLayout } from "@/features/admin/components/admin-layout";
import { CustomerTagsManager } from "@/features/admin/customer-tags/components/customer-tags-manager";
import { getCustomerTags } from "@/features/admin/customer-tags/repository";
import { getAdminDashboardSummary } from "@/features/admin/repository";

export const dynamic = "force-dynamic";

export default async function CustomerTagsPage() {
  const [summary, tags] = await Promise.all([
    getAdminDashboardSummary(),
    getCustomerTags(),
  ]);
  return (
    <AdminLayout
      restaurantName={summary.restaurantName}
      locale={summary.locale}
      databaseStatus={summary.databaseStatus}
    >
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <CustomerTagsManager tags={tags} />
      </div>
    </AdminLayout>
  );
}
