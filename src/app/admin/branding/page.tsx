import type { Metadata } from "next";

import { BrandingEditor } from "@/features/admin/branding/components/branding-editor";
import { getRestaurantBranding } from "@/features/admin/branding/repository";
import { AdminLayout } from "@/features/admin/components/admin-layout";
import { getAdminDashboardSummary } from "@/features/admin/repository";

export const metadata: Metadata = {
  title: "Branding · Piccolo QR Menu",
  description: "Identidad e información pública del restaurante.",
};

export const dynamic = "force-dynamic";

export default async function AdminBrandingPage() {
  const [summary, branding] = await Promise.all([
    getAdminDashboardSummary(),
    getRestaurantBranding(),
  ]);

  return (
    <AdminLayout
      restaurantName={summary.restaurantName}
      locale={summary.locale}
      databaseStatus={summary.databaseStatus}
    >
      <div className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 sm:py-8 xl:px-8">
        <BrandingEditor
          key={JSON.stringify(branding)}
          initialData={branding}
        />
      </div>
    </AdminLayout>
  );
}
