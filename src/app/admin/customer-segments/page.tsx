import { AdminLayout } from "@/features/admin/components/admin-layout";
import { SegmentsManager } from "@/features/admin/customer-segments/components/segments-manager";
import { getCustomerSegments } from "@/features/admin/customer-segments/repository";
import { getCustomerTags } from "@/features/admin/customer-tags/repository";
import { getAdminDashboardSummary } from "@/features/admin/repository";

export const dynamic = "force-dynamic";

export default async function CustomerSegmentsPage() {
  const [summary, segments, tags] = await Promise.all([
    getAdminDashboardSummary(),
    getCustomerSegments(),
    getCustomerTags(),
  ]);
  return (
    <AdminLayout
      restaurantName={summary.restaurantName}
      locale={summary.locale}
      databaseStatus={summary.databaseStatus}
    >
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <SegmentsManager segments={segments} tags={tags} />
      </div>
    </AdminLayout>
  );
}
