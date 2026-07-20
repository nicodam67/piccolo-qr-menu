"use client";

import type { LucideIcon } from "lucide-react";
import {
  CalendarClock,
  CalendarCheck,
  Download,
  Languages,
  LayoutDashboard,
  PackageOpen,
  Palette,
  QrCode,
  Settings,
  SlidersHorizontal,
  ShieldAlert,
  Tags,
  UtensilsCrossed,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type SidebarProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
};

type NavigationItem = {
  label: string;
  icon: LucideIcon;
  available: boolean;
  href?: string;
};

const navigationItems: NavigationItem[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    available: true,
    href: "/admin",
  },
  {
    label: "Categorías",
    icon: UtensilsCrossed,
    available: true,
    href: "/admin/categories",
  },
  {
    label: "Productos",
    icon: PackageOpen,
    available: true,
    href: "/admin/products",
  },
  {
    label: "Alérgenos",
    icon: ShieldAlert,
    available: true,
    href: "/admin/allergens",
  },
  {
    label: "Etiquetas",
    icon: Tags,
    available: true,
    href: "/admin/tags",
  },
  {
    label: "Branding",
    icon: Palette,
    available: true,
    href: "/admin/branding",
  },
  {
    label: "Horarios especiales",
    icon: CalendarClock,
    available: true,
    href: "/admin/special-hours",
  },
  {
    label: "Reservas",
    icon: CalendarCheck,
    available: true,
    href: "/admin/reservations",
  },
  {
    label: "Configuración de reservas",
    icon: SlidersHorizontal,
    available: true,
    href: "/admin/reservation-settings",
  },
  {
    label: "Idiomas",
    icon: Languages,
    available: true,
    href: "/admin/languages",
  },
  {
    label: "Código QR",
    icon: QrCode,
    available: true,
    href: "/admin/qr-code",
  },
  {
    label: "Carta imprimible",
    icon: Download,
    available: true,
    href: "/admin/print-menu",
  },
  {
    label: "Carta pública",
    icon: Settings,
    available: true,
    href: "/admin/menu-settings",
  },
];

export function Sidebar({
  collapsed,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const collapsedLabelClass = collapsed ? "md:hidden lg:block" : "";

  return (
    <>
      <button
        type="button"
        aria-label="Cerrar menú de administración"
        onClick={onMobileClose}
        className={`fixed inset-0 z-40 bg-[#17201d]/35 backdrop-blur-[2px] transition-opacity md:hidden ${
          mobileOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        id="admin-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-stone-200 bg-[#173f35] text-white transition-[width,transform] duration-200 md:translate-x-0 lg:w-64 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "md:w-20" : "md:w-64"}`}
      >
        <div className="flex min-h-[4.5rem] items-center border-b border-white/10 px-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.2em] text-[#d7ae6a] uppercase">
              Piccolo
            </p>
            <p
              className={`mt-1 truncate text-sm font-semibold ${collapsedLabelClass}`}
            >
              Administración
            </p>
          </div>
          <button
            type="button"
            onClick={onMobileClose}
            aria-label="Cerrar menú"
            className="ml-auto grid size-10 place-items-center rounded-xl text-white/80 hover:bg-white/10 md:hidden"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto p-3">
          {navigationItems.map((item) => {
            const Icon = item.icon;

            if (item.available && item.href) {
              const isCurrent =
                item.href === "/admin"
                  ? pathname === item.href
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={onMobileClose}
                  title={item.label}
                  aria-current={isCurrent ? "page" : undefined}
                  className={`flex min-h-12 items-center gap-3 rounded-xl px-3 font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                    isCurrent
                      ? "bg-white text-[#173f35] shadow-sm"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon aria-hidden="true" className="size-5 shrink-0" />
                  <span className={collapsedLabelClass}>{item.label}</span>
                </Link>
              );
            }

            return (
              <div
                key={item.label}
                title={`${item.label} · Disponible próximamente`}
                aria-disabled="true"
                className="flex min-h-14 items-center gap-3 rounded-xl px-3 text-white/60"
              >
                <Icon aria-hidden="true" className="size-5 shrink-0" />
                <div className={`min-w-0 ${collapsedLabelClass}`}>
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="mt-0.5 text-[9px] tracking-wide text-white/40 uppercase">
                    Disponible próximamente
                  </p>
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <p
            className={`text-[10px] leading-4 text-white/45 ${collapsedLabelClass}`}
          >
            Estructura temporal de desarrollo
          </p>
        </div>
      </aside>
    </>
  );
}
