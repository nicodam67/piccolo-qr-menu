import type { Metadata } from "next";

import { AdminLayout } from "@/features/admin/components/admin-layout";
import { ProductManager } from "@/features/admin/products/components/product-manager";
import { getAdminProductData } from "@/features/admin/products/repository";
import { getAdminDashboardSummary } from "@/features/admin/repository";

export const metadata: Metadata = {
  title: "Productos · Piccolo QR Menu",
  description: "Gestión de productos de la carta.",
};

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const [summary, productData] = await Promise.all([
    getAdminDashboardSummary(),
    getAdminProductData(),
  ]);

  return (
    <AdminLayout
      restaurantName={summary.restaurantName}
      locale={summary.locale}
      databaseStatus={summary.databaseStatus}
    >
      <div className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 sm:py-8 xl:px-8">
        <ProductManager
          key={JSON.stringify(productData.products)}
          initialProducts={productData.products}
          categories={productData.categories}
          tags={productData.tags}
          allergens={productData.allergens}
          locales={productData.locales}
          defaultLocale={productData.defaultLocale}
          currencyCode={productData.currencyCode}
        />
      </div>
    </AdminLayout>
  );
}
