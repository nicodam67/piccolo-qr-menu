import type { Metadata } from "next";

import { AdminLayout } from "@/features/admin/components/admin-layout";
import { LanguageManager } from "@/features/admin/languages/components/language-manager";
import { getLanguageManagementData } from "@/features/admin/languages/repository";
import { getAdminDashboardSummary } from "@/features/admin/repository";

export const metadata: Metadata = {
  title: "Idiomas · Piccolo QR Menu",
  description: "Gestión de idiomas, traducciones y publicación.",
};

export const dynamic = "force-dynamic";

type LanguagesPageProps = {
  searchParams: Promise<{ edit?: string | string[] }>;
};

export default async function AdminLanguagesPage({
  searchParams,
}: LanguagesPageProps) {
  const { edit } = await searchParams;
  const editorLocale = typeof edit === "string" ? edit : undefined;
  const [summary, languageData] = await Promise.all([
    getAdminDashboardSummary(),
    getLanguageManagementData(editorLocale),
  ]);

  return (
    <AdminLayout
      restaurantName={summary.restaurantName}
      locale={summary.locale}
      databaseStatus={summary.databaseStatus}
    >
      <div className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 sm:py-8 xl:px-8">
        <LanguageManager data={languageData} />
      </div>
    </AdminLayout>
  );
}
