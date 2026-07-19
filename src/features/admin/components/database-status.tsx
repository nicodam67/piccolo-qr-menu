import { Database } from "lucide-react";

type DatabaseStatusProps = {
  status: "connected";
};

export function DatabaseStatus({ status }: DatabaseStatusProps) {
  return (
    <div
      className="flex min-h-9 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-bold text-emerald-800 sm:gap-2 sm:px-3"
      title="Estado de PostgreSQL"
      aria-label="Base de datos conectada"
    >
      <Database aria-hidden="true" className="size-3.5" />
      <span className="size-1.5 rounded-full bg-emerald-500" />
      <span className="hidden sm:inline">
        {status === "connected" ? "Conectada" : null}
      </span>
    </div>
  );
}
