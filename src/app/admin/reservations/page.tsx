import type { Metadata } from "next";
import Link from "next/link";

import { AdminLayout } from "@/features/admin/components/admin-layout";
import { getAdminDashboardSummary } from "@/features/admin/repository";
import { ReservationsManager } from "@/features/admin/reservations/components/reservations-manager";
import { getAdminReservations } from "@/features/admin/reservations/repository";
import {
  isReservationStatus,
  shiftReservationDate,
} from "@/features/reservations/domain";

export const metadata: Metadata = { title: "Reservas · Piccolo QR Menu" };
export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    date?: string | string[];
    status?: string | string[];
    query?: string | string[];
    economic?: string | string[];
    method?: string | string[];
  }>;
};

export default async function AdminReservationsPage({ searchParams }: Props) {
  const params = await searchParams;
  const date = typeof params.date === "string" ? params.date : undefined;
  const statusValue =
    typeof params.status === "string" ? params.status : undefined;
  const status =
    statusValue && isReservationStatus(statusValue) ? statusValue : undefined;
  const query = typeof params.query === "string" ? params.query : undefined;
  const economicStatus = typeof params.economic === "string" ? params.economic : undefined;
  const paymentMethod = typeof params.method === "string" ? params.method : undefined;
  const [summary, data] = await Promise.all([
    getAdminDashboardSummary(),
    getAdminReservations({ date, status, query, economicStatus, paymentMethod }),
  ]);

  return (
    <AdminLayout
      restaurantName={summary.restaurantName}
      locale={summary.locale}
      databaseStatus={summary.databaseStatus}
    >
      <div className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6">
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <Link href={`/admin/reservations?date=${shiftReservationDate(data.date, -1)}`} className="grid min-h-11 place-items-center rounded-xl border border-stone-200 bg-white px-4 text-sm font-bold">← Día anterior</Link>
          <form method="get" className="grid flex-1 gap-3 rounded-xl border border-stone-200 bg-white p-3 sm:grid-cols-3">
            <label className="text-xs font-bold">Fecha<input name="date" type="date" defaultValue={data.date} className="mt-1 min-h-11 w-full rounded-lg border border-stone-200 px-2" /></label>
            <label className="text-xs font-bold">Estado<select name="status" defaultValue={status ?? ""} className="mt-1 min-h-11 w-full rounded-lg border border-stone-200 bg-white px-2"><option value="">Todos</option><option value="pending">Pendiente</option><option value="confirmed">Confirmada</option><option value="seated">Sentada</option><option value="completed">Finalizada</option><option value="cancelled">Cancelada</option><option value="no_show">No presentada</option></select></label>
            <label className="text-xs font-bold">Buscar<input name="query" defaultValue={query} placeholder="Nombre, teléfono o localizador" className="mt-1 min-h-11 w-full rounded-lg border border-stone-200 px-2" /></label>
            <label className="text-xs font-bold">Pago<select name="economic" defaultValue={economicStatus ?? ""} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-2"><option value="">Todos</option><option value="pending">Pendiente</option><option value="paid">Pagado</option><option value="failed">Fallido</option><option value="expired">Caducado</option><option value="refunded">Reembolsado</option><option value="retained">Retenido</option></select></label>
            <label className="text-xs font-bold">Método<select name="method" defaultValue={paymentMethod ?? ""} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-2"><option value="">Todos</option><option value="card">Tarjeta</option><option value="bizum">Bizum</option><option value="cash">Efectivo</option></select></label>
            <button type="submit" className="min-h-11 rounded-xl bg-[#173f35] px-4 text-sm font-bold text-white sm:col-span-3">Aplicar filtros</button>
          </form>
          <Link href={`/admin/reservations?date=${shiftReservationDate(data.date, 1)}`} className="grid min-h-11 place-items-center rounded-xl border border-stone-200 bg-white px-4 text-sm font-bold">Día siguiente →</Link>
        </div>
        <ReservationsManager
          records={data.records}
          date={data.date}
          defaultLocale={data.defaultLocale}
          summary={data.summary}
        />
      </div>
    </AdminLayout>
  );
}
