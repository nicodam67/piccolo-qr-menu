import type { LucideIcon } from "lucide-react";
import {
  Languages,
  CalendarCheck,
  Clock3,
  Leaf,
  ShieldAlert,
  Tags,
  UtensilsCrossed,
  Users,
} from "lucide-react";

import type { AdminDashboardSummary } from "../repository";

type DashboardCardsProps = Pick<
  AdminDashboardSummary,
  | "categoryCount"
  | "subcategoryCount"
  | "productCount"
  | "languageCount"
  | "allergenCount"
  | "tagCount"
  | "todayReservationCount"
  | "todayGuestCount"
  | "todayPendingCount"
>;

type Metric = {
  id: string;
  label: string;
  value: number;
  icon: LucideIcon;
  tone: string;
};

export function DashboardCards({
  categoryCount,
  subcategoryCount,
  productCount,
  languageCount,
  allergenCount,
  tagCount,
  todayReservationCount,
  todayGuestCount,
  todayPendingCount,
}: DashboardCardsProps) {
  const metrics: Metric[] = [
    {
      id: "today-reservations",
      label: "Reservas de hoy",
      value: todayReservationCount,
      icon: CalendarCheck,
      tone: "bg-violet-50 text-violet-700",
    },
    {
      id: "today-guests",
      label: "Comensales previstos",
      value: todayGuestCount,
      icon: Users,
      tone: "bg-cyan-50 text-cyan-700",
    },
    {
      id: "today-pending",
      label: "Reservas pendientes",
      value: todayPendingCount,
      icon: Clock3,
      tone: "bg-yellow-50 text-yellow-700",
    },
    {
      id: "categories",
      label: "Categorías principales activas",
      value: categoryCount,
      icon: Tags,
      tone: "bg-amber-50 text-amber-700",
    },
    {
      id: "subcategories",
      label: "Subcategorías activas",
      value: subcategoryCount,
      icon: Tags,
      tone: "bg-orange-50 text-orange-700",
    },
    {
      id: "products",
      label: "Productos activos",
      value: productCount,
      icon: UtensilsCrossed,
      tone: "bg-rose-50 text-[#a8392f]",
    },
    {
      id: "languages",
      label: "Idiomas disponibles",
      value: languageCount,
      icon: Languages,
      tone: "bg-sky-50 text-sky-700",
    },
    {
      id: "allergens",
      label: "Alérgenos",
      value: allergenCount,
      icon: ShieldAlert,
      tone: "bg-orange-50 text-orange-700",
    },
    {
      id: "tags",
      label: "Etiquetas dietéticas",
      value: tagCount,
      icon: Leaf,
      tone: "bg-emerald-50 text-emerald-700",
    },
  ];

  return (
    <section
      aria-label="Resumen de la carta"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
    >
      {metrics.map((metric) => {
        const Icon = metric.icon;

        return (
          <article
            key={metric.label}
            data-testid={`admin-metric-${metric.id}`}
            className="min-w-0 rounded-2xl border border-stone-200 bg-white p-4 last:col-span-2 sm:p-5 sm:last:col-span-1"
          >
            <div
              className={`grid size-10 place-items-center rounded-xl ${metric.tone}`}
            >
              <Icon aria-hidden="true" className="size-[18px]" />
            </div>
            <p className="mt-5 text-3xl font-extrabold tracking-tight text-[#173f35]">
              {metric.value}
            </p>
            <p className="mt-1 text-xs font-semibold leading-4 text-stone-500">
              {metric.label}
            </p>
          </article>
        );
      })}
    </section>
  );
}
