import type { Metadata } from "next";

import { SUPPORTED_LOCALE_CODES } from "@/config/locales";
import { AdminLayout } from "@/features/admin/components/admin-layout";
import { CustomersManager } from "@/features/admin/customers/components/customers-manager";
import { getAdminCustomers } from "@/features/admin/customers/repository";
import { getAdminDashboardSummary } from "@/features/admin/repository";

export const metadata: Metadata = { title: "Clientes · Piccolo QR Menu" };
export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = typeof params.query === "string" ? params.query : "";
  const [summary, customers] = await Promise.all([
    getAdminDashboardSummary(),
    getAdminCustomers(query),
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
          query={query}
          locales={[...SUPPORTED_LOCALE_CODES]}
        />
      </div>
    </AdminLayout>
  );
}
