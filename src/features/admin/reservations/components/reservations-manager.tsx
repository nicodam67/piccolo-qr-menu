"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Pencil, X } from "lucide-react";

import {
  createManualReservationAction,
  transitionReservationAction,
  updateReservationAction,
  reservationEconomicAction,
} from "../actions";
import type { AdminReservation } from "../repository";
import type { ReservationStatus } from "@/features/reservations/domain";

const labels: Record<ReservationStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  seated: "Sentada",
  completed: "Finalizada",
  cancelled: "Cancelada",
  no_show: "No presentada",
};
const actions: Partial<Record<ReservationStatus, ReservationStatus[]>> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["seated", "cancelled", "no_show"],
  seated: ["completed", "cancelled"],
};

type Props = {
  records: AdminReservation[];
  date: string;
  defaultLocale: string;
  summary: {
    totalReservations: number;
    totalGuests: number;
    pending: number;
    confirmed: number;
    cancelled: number;
    noShow: number;
  };
};

export function ReservationsManager({
  records,
  date,
  defaultLocale,
  summary,
}: Props) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"new" | AdminReservation | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const transition = (record: AdminReservation, status: ReservationStatus) => {
    if (
      status === "cancelled" &&
      !window.confirm(`¿Cancelar la reserva ${record.locator}?`)
    ) {
      return;
    }
    startTransition(async () => {
      const result = await transitionReservationAction(record.id, status);
      setFeedback(result.success ? `Reserva ${labels[status].toLowerCase()}.` : result.error);
      if (result.success) router.refresh();
    });
  };
  const economic = (record: AdminReservation, action: string) => {
    const data = new FormData();
    if (action === "cash") {
      const amount = window.prompt("Importe recibido en céntimos", String(record.depositTotalCents));
      if (!amount) return;
      data.set("amountCents", amount);
      data.set("note", window.prompt("Observación", "Pago en efectivo") ?? "");
    }
    if (action === "external_card") {
      const amount = window.prompt("Importe recibido en céntimos", String(record.depositTotalCents));
      if (!amount) return;
      action = "cash";
      data.set("amountCents", amount);
      data.set("method", "card");
      data.set("note", window.prompt("Referencia u observación", "Tarjeta externa") ?? "");
    }
    if (action === "grace") {
      data.set("minutes", window.prompt("Minutos adicionales", "15") ?? "15");
      data.set("reason", window.prompt("Motivo", "Cliente llamó") ?? "");
    }
    if (action === "refund") {
      const amount = window.prompt("Importe a devolver en céntimos", String(record.remainingDepositCents));
      if (!amount) return;
      data.set("amountCents", amount);
      data.set("reason", window.prompt("Motivo de devolución", "Cancelación") ?? "");
    }
    if (action === "courtesy") {
      data.set(
        "reason",
        window.prompt("Motivo de la cortesía", "Cortesía administrativa") ??
          "",
      );
    }
    if (action === "no_show" && !window.confirm("¿Confirmar no presentación y retención?")) return;
    startTransition(async () => {
      const result = await reservationEconomicAction(record.id, action, data);
      setFeedback(result.success ? "Operación registrada." : result.error);
      if (result.success) router.refresh();
    });
  };

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a8392f]">Reservas</p>
          <h1 className="font-display mt-1 text-3xl text-[#173f35] sm:text-4xl">Reservas del {date}</h1>
        </div>
        <button type="button" onClick={() => setDialog("new")} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#173f35] px-5 text-sm font-bold text-white"><CalendarPlus className="size-4" />Reserva manual</button>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          ["Reservas", summary.totalReservations],
          ["Comensales", summary.totalGuests],
          ["Pendientes", summary.pending],
          ["Confirmadas", summary.confirmed],
          ["Canceladas", summary.cancelled],
          ["No presentadas", summary.noShow],
        ].map(([label, value]) => (
          <article key={String(label)} className="rounded-xl border border-stone-200 bg-white p-3"><p className="text-2xl font-black text-[#173f35]">{value}</p><p className="text-[10px] font-bold text-stone-500">{label}</p></article>
        ))}
      </div>
      <p aria-live="polite" className="mt-3 min-h-5 text-xs font-bold text-stone-600">{isPending ? "Actualizando…" : feedback}</p>
      <section className="mt-3 space-y-3">
        {records.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center text-sm text-stone-500">No hay reservas para los filtros seleccionados.</div>
        ) : records.map((record) => (
          <article key={record.id} data-testid={`reservation-${record.locator}`} className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-xl font-black text-[#173f35]">{record.time} · {record.guestName}</p><p className="text-xs text-stone-500">{record.partySize} personas · {record.guestPhone} · {record.guestEmail || "Sin email"}</p><p className="mt-1 text-[10px] font-bold uppercase text-stone-400">{record.locator} · {record.origin === "online" ? "Online" : "Manual"} · {record.locale.toUpperCase()}</p></div>
              <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold">{labels[record.status]}</span>
            </div>
            {record.customerNotes ? <p className="mt-3 text-xs text-stone-600">Cliente: {record.customerNotes}</p> : null}
            {record.internalNotes ? <p className="mt-1 text-xs font-bold text-stone-600">Interna: {record.internalNotes}</p> : null}
            <p className="mt-2 text-[10px] text-stone-400">Creada: {new Date(record.createdAt).toLocaleString("es-ES")}</p>
            <p className="mt-2 text-xs font-bold text-stone-600">Adelanto {(record.depositTotalCents / 100).toFixed(2)} € · {record.economicStatus} · TPV {record.tpvApplicationStatus}</p>
            <p className="text-[10px] text-stone-500">Cortesía: {record.graceDeadlineAt ? new Date(record.graceDeadlineAt).toLocaleString("es-ES") : "—"} · Llegada: {record.arrivedAt ? new Date(record.arrivedAt).toLocaleString("es-ES") : "No registrada"}</p>
            {record.economicEvents.length > 0 ? (
              <details className="mt-2 text-xs text-stone-600">
                <summary className="cursor-pointer font-bold">
                  Historial económico ({record.economicEvents.length})
                </summary>
                <ul className="mt-2 space-y-1">
                  {record.economicEvents.map((event) => (
                    <li key={`${event.type}-${event.createdAt}`}>
                      {new Date(event.createdAt).toLocaleString("es-ES")} ·{" "}
                      {event.type}
                      {event.amountCents !== null
                        ? ` · ${(event.amountCents / 100).toFixed(2)} €`
                        : ""}
                      {event.reason ? ` · ${event.reason}` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setDialog(record)} className="flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 px-3 text-xs font-bold"><Pencil className="size-4" />Editar</button>
              {(actions[record.status] ?? []).map((status) => (
                <button key={status} type="button" onClick={() => transition(record, status)} className={`min-h-11 rounded-xl px-3 text-xs font-bold ${status === "cancelled" ? "bg-red-50 text-red-700" : "bg-[#173f35] text-white"}`}>{labels[status]}</button>
              ))}
              {!record.arrivedAt ? <button type="button" onClick={() => economic(record, "arrival")} className="min-h-11 rounded-xl border px-3 text-xs font-bold">Registrar llegada</button> : null}
              <button type="button" onClick={() => economic(record, "grace")} className="min-h-11 rounded-xl border px-3 text-xs font-bold">Ampliar cortesía</button>
              <button type="button" onClick={() => economic(record, "cash")} className="min-h-11 rounded-xl border px-3 text-xs font-bold">Registrar efectivo</button>
              <button type="button" onClick={() => economic(record, "external_card")} className="min-h-11 rounded-xl border px-3 text-xs font-bold">Tarjeta externa</button>
              <button type="button" onClick={() => economic(record, "no_show")} className="min-h-11 rounded-xl bg-red-50 px-3 text-xs font-bold text-red-700">No presentada</button>
              <button type="button" onClick={() => economic(record, "refund")} className="min-h-11 rounded-xl border px-3 text-xs font-bold">Devolver adelanto</button>
              <button type="button" onClick={() => economic(record, "courtesy")} className="min-h-11 rounded-xl border px-3 text-xs font-bold">Registrar cortesía</button>
            </div>
          </article>
        ))}
      </section>
      {dialog ? (
        <ReservationDialog
          record={dialog === "new" ? undefined : dialog}
          date={date}
          locale={defaultLocale}
          pending={isPending}
          onClose={() => setDialog(null)}
          onSaved={(message) => {
            setDialog(null);
            setFeedback(message);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}

function ReservationDialog({
  record,
  date,
  locale,
  pending,
  onClose,
  onSaved,
}: {
  record?: AdminReservation;
  date: string;
  locale: string;
  pending: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    void (record
      ? updateReservationAction(record.id, formData)
      : createManualReservationAction(formData)
    ).then((result) => {
      if (!result.success) setError(result.error);
      else onSaved(record ? "Reserva actualizada." : `Reserva manual creada: ${"locator" in result ? result.locator : ""}`);
    });
  };
  return (
    <div className="fixed inset-0 z-[80] grid place-items-end bg-black/40 sm:place-items-center sm:p-5">
      <section role="dialog" aria-modal="true" aria-labelledby="reservation-dialog-title" className="max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 sm:max-w-xl sm:rounded-3xl">
        <div className="flex justify-between"><h2 id="reservation-dialog-title" className="font-display text-2xl text-[#173f35]">{record ? `Editar ${record.locator}` : "Nueva reserva manual"}</h2><button type="button" onClick={onClose} aria-label="Cerrar formulario" className="grid size-11 place-items-center rounded-full bg-stone-100"><X className="size-5" /></button></div>
        <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
          {!record ? <input type="hidden" name="locale" value={locale} /> : null}
          <Field name="date" label="Fecha" type="date" value={record?.date ?? date} />
          <Field name="time" label="Hora" type="time" value={record?.time ?? "20:00"} />
          <Field name="partySize" label="Personas" type="number" value={String(record?.partySize ?? 2)} />
          <Field name="guestName" label="Nombre" value={record?.guestName} />
          <Field name="guestPhone" label="Teléfono" type="tel" value={record?.guestPhone} />
          <Field name="guestEmail" label="Email" type="email" value={record?.guestEmail} required={false} />
          <label className="text-xs font-bold text-stone-700 sm:col-span-2">Observaciones del cliente<textarea name="customerNotes" maxLength={1000} defaultValue={record?.customerNotes} rows={3} className="mt-1 w-full rounded-xl border border-stone-200 p-3" /></label>
          <label className="text-xs font-bold text-stone-700 sm:col-span-2">Notas internas<textarea name="internalNotes" maxLength={1000} defaultValue={record?.internalNotes} rows={3} className="mt-1 w-full rounded-xl border border-stone-200 p-3" /></label>
          <label className="flex min-h-11 items-center gap-3 text-xs font-bold sm:col-span-2"><input name="overrideWarning" type="checkbox" value="true" />Continuar si está fuera de horario o supera capacidad</label>
          <p role={error ? "alert" : undefined} className="min-h-5 text-xs font-bold text-red-700 sm:col-span-2">{error}</p>
          <div className="flex gap-3 sm:col-span-2"><button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-xl border border-stone-200">Cancelar</button><button type="submit" disabled={pending} className="min-h-11 flex-1 rounded-xl bg-[#173f35] font-bold text-white">Guardar</button></div>
        </form>
      </section>
    </div>
  );
}

function Field({ name, label, type = "text", value, required = true }: { name: string; label: string; type?: string; value?: string; required?: boolean }) {
  return <label className="text-xs font-bold text-stone-700">{label}<input name={name} type={type} required={required} defaultValue={value} className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 px-3" /></label>;
}
