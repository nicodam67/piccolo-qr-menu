import type { Metadata } from "next";

import { SUPPORTED_LOCALE_CODES } from "@/config/locales";
import { AdminLayout } from "@/features/admin/components/admin-layout";
import { CustomersManager } from "@/features/admin/customers/components/customers-manager";
import { getAdminCustomers } from "@/features/admin/customers/repository";
import { getAdminDashboardSummary } from "@/features/admin/repository";
import { normalizeCustomerFilters } from "@/features/customer-segments/config";
import { getCustomerSegment } from "@/features/admin/customer-segments/repository";
import { getCustomerTags } from "@/features/admin/customer-tags/repository";

export const metadata: Metadata = { title: "Clientes · Piccolo QR Menu" };
export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const segmentId =
    typeof params.segmentId === "string" ? params.segmentId : undefined;
  const segment = segmentId ? await getCustomerSegment(segmentId) : null;
  const filters =
    segment?.filters ??
    normalizeCustomerFilters({
      ...(typeof params.query === "string" && params.query
        ? { query: params.query }
        : {}),
      ...(params.status === "active"
        ? { isActive: true }
        : params.status === "inactive"
          ? { isActive: false }
          : {}),
      ...(typeof params.tagId === "string" && params.tagId
        ? { tagIds: [params.tagId] }
        : {}),
      ...(params.loyalty === "true" ? { loyaltyParticipating: true } : {}),
      ...(params.hasPoints === "true" ? { hasPoints: true } : {}),
      ...(typeof params.emailConsent === "string" && params.emailConsent
        ? { emailConsent: params.emailConsent }
        : {}),
      ...(typeof params.phoneConsent === "string" && params.phoneConsent
        ? { phoneConsent: params.phoneConsent }
        : {}),
      ...(params.hasNoShows === "true" ? { hasNoShows: true } : {}),
      ...(typeof params.noVisitsSinceDays === "string" &&
      params.noVisitsSinceDays
        ? { noVisitsSinceDays: Number(params.noVisitsSinceDays) }
        : {}),
    });
  const page =
    typeof params.page === "string" && Number(params.page) > 0
      ? Number(params.page)
      : 1;
  const [summary, customers, tags] = await Promise.all([
    getAdminDashboardSummary(),
    getAdminCustomers(filters, page),
    getCustomerTags(),
  ]);
  return (
    <AdminLayout
      restaurantName={summary.restaurantName}
      locale={summary.locale}
      databaseStatus={summary.databaseStatus}
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <CustomersManager
          customers={customers}
          filters={filters}
          tags={tags}
          segmentName={segment?.name ?? null}
          page={page}
          locales={[...SUPPORTED_LOCALE_CODES]}
        />
      </div>
    </AdminLayout>
  );
}
