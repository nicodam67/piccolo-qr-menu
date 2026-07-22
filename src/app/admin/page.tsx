import type { Metadata } from "next";
import { Clock3, Construction } from "lucide-react";

import { AdminLayout } from "@/features/admin/components/admin-layout";
import { DashboardCards } from "@/features/admin/components/dashboard-cards";
import { getAdminDashboardSummary } from "@/features/admin/repository";

export const metadata: Metadata = {
  title: "Administración · Piccolo QR Menu",
  description: "Estructura inicial del panel de administración.",
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const summary = await getAdminDashboardSummary();

  return (
    <AdminLayout
      restaurantName={summary.restaurantName}
      locale={summary.locale}
      databaseStatus={summary.databaseStatus}
    >
      <div className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 sm:py-8 xl:px-8">
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
          <Construction
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          <div>
            <p className="text-sm font-bold">
              Panel de Administración
            </p>
            <p className="mt-0.5 text-xs leading-5 text-amber-800/75">
              Acceso administrativo protegido.
            </p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-[10px] font-extrabold tracking-[0.18em] text-[#a8392f] uppercase">
            Vista general
          </p>
          <h1 className="font-display mt-1 text-3xl text-[#173f35] sm:text-4xl">
            Dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
            Resumen actual de la información almacenada en PostgreSQL.
          </p>
        </div>

        <DashboardCards
          categoryCount={summary.categoryCount}
          subcategoryCount={summary.subcategoryCount}
          productCount={summary.productCount}
          languageCount={summary.languageCount}
          allergenCount={summary.allergenCount}
          tagCount={summary.tagCount}
          todayReservationCount={summary.todayReservationCount}
          todayGuestCount={summary.todayGuestCount}
          todayPendingCount={summary.todayPendingCount}
          customerCount={summary.customerCount}
        />

        <section
          aria-labelledby="recent-activity-title"
          className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6"
        >
          <div className="flex items-center gap-3 border-b border-stone-100 pb-4">
            <span className="grid size-9 place-items-center rounded-xl bg-stone-100 text-stone-500">
              <Clock3 aria-hidden="true" className="size-4" />
            </span>
            <div>
              <h2
                id="recent-activity-title"
                className="font-display text-xl text-[#173f35]"
              >
                Últimos cambios
              </h2>
              <p className="text-[10px] text-stone-400">
                Actividad del restaurante
              </p>
            </div>
          </div>
          <div className="grid min-h-36 place-items-center text-center">
            <div>
              <p className="text-sm font-semibold text-stone-500">
                Sin actividad reciente
              </p>
              <p className="mt-1 text-xs text-stone-400">
                Los cambios futuros aparecerán en este espacio.
              </p>
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
