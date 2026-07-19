import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { DatabaseStatus } from "./database-status";

type TopbarProps = {
  restaurantName: string;
  locale: string;
  databaseStatus: "connected";
  sidebarCollapsed: boolean;
  onMobileMenuOpen: () => void;
  onTabletSidebarToggle: () => void;
};

export function Topbar({
  restaurantName,
  locale,
  databaseStatus,
  sidebarCollapsed,
  onMobileMenuOpen,
  onTabletSidebarToggle,
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex min-h-[4.5rem] items-center border-b border-stone-200 bg-[#fffdfa]/95 px-3 backdrop-blur-lg sm:px-5">
      <button
        type="button"
        onClick={onMobileMenuOpen}
        aria-label="Abrir menú de administración"
        className="mr-2 grid size-10 place-items-center rounded-xl text-[#173f35] hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-[#173f35] md:hidden"
      >
        <Menu aria-hidden="true" className="size-5" />
      </button>

      <button
        type="button"
        onClick={onTabletSidebarToggle}
        aria-label={
          sidebarCollapsed ? "Expandir menú lateral" : "Contraer menú lateral"
        }
        className="mr-3 hidden size-10 place-items-center rounded-xl text-[#173f35] hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-[#173f35] md:grid lg:hidden"
      >
        {sidebarCollapsed ? (
          <PanelLeftOpen aria-hidden="true" className="size-5" />
        ) : (
          <PanelLeftClose aria-hidden="true" className="size-5" />
        )}
      </button>

      <div className="flex min-w-0 items-center gap-2.5">
        <span className="font-display grid size-9 shrink-0 place-items-center rounded-full bg-[#7d2f27] text-lg text-white">
          P
        </span>
        <div className="min-w-0">
          <p className="font-display text-lg leading-none text-[#173f35]">
            Piccolo
          </p>
          <p className="mt-1 hidden truncate text-[10px] font-semibold tracking-wide text-stone-500 uppercase sm:block">
            {restaurantName}
          </p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <span
          className="grid min-h-9 min-w-9 place-items-center rounded-full border border-stone-200 bg-white px-2 text-[11px] font-extrabold text-stone-600 uppercase"
          aria-label={`Idioma actual: ${locale}`}
        >
          {locale}
        </span>
        <DatabaseStatus status={databaseStatus} />
      </div>
    </header>
  );
}
