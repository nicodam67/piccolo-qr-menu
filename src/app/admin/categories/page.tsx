import type { Metadata } from "next";

import { AdminLayout } from "@/features/admin/components/admin-layout";
import { CategoryManager } from "@/features/admin/categories/components/category-manager";
import { getAdminCategoryData } from "@/features/admin/categories/repository";
import { getAdminDashboardSummary } from "@/features/admin/repository";

export const metadata: Metadata = {
  title: "Categorías · Piccolo QR Menu",
  description: "Gestión de categorías de la carta.",
};

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const [summary, categoryData] = await Promise.all([
    getAdminDashboardSummary(),
    getAdminCategoryData(),
  ]);

  return (
    <AdminLayout
      restaurantName={summary.restaurantName}
      locale={summary.locale}
      databaseStatus={summary.databaseStatus}
    >
      <div className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 sm:py-8 xl:px-8">
        <CategoryManager
          initialCategories={categoryData.categories}
          locales={categoryData.locales}
          defaultLocale={categoryData.defaultLocale}
        />
      </div>
    </AdminLayout>
  );
}
