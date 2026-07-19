import { Database } from "lucide-react";

type DatabaseStatusProps = {
  status: "connected";
};

export function DatabaseStatus({ status }: DatabaseStatusProps) {
  return (
    <div
      className="flex min-h-9 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-800"
      title="Estado de PostgreSQL"
    >
      <Database aria-hidden="true" className="size-3.5" />
      <span className="size-1.5 rounded-full bg-emerald-500" />
      <span>{status === "connected" ? "Conectada" : null}</span>
    </div>
  );
}
