import type { Metadata } from "next";

import { AdminLayout } from "@/features/admin/components/admin-layout";
import { getAdminDashboardSummary } from "@/features/admin/repository";
import { TaxonomyManager } from "@/features/admin/taxonomies/components/taxonomy-manager";
import { getAdminTaxonomyData } from "@/features/admin/taxonomies/repository";

export const metadata: Metadata = {
  title: "Etiquetas dietéticas · Piccolo QR Menu",
  description: "Gestión de etiquetas dietéticas de la carta.",
};

export const dynamic = "force-dynamic";

export default async function AdminTagsPage() {
  const [summary, data] = await Promise.all([
    getAdminDashboardSummary(),
    getAdminTaxonomyData("tag"),
  ]);

  return (
    <AdminLayout
      restaurantName={summary.restaurantName}
      locale={summary.locale}
      databaseStatus={summary.databaseStatus}
    >
      <div className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 sm:py-8 xl:px-8">
        <TaxonomyManager
          key={JSON.stringify(data.items)}
          kind="tag"
          initialItems={data.items}
          locales={data.locales}
          defaultLocale={data.defaultLocale}
        />
      </div>
    </AdminLayout>
  );
}
