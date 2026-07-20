"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarDays,
  Copy,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import {
  createSpecialHoursAction,
  deleteSpecialHoursAction,
  updateSpecialHoursAction,
} from "../actions";
import type { SpecialHoursRecord } from "../repository";
import {
  filterSpecialHoursByDate,
  getNextAvailableDuplicateDate,
  type SpecialHoursType,
} from "../utils";
import { SpecialHoursCalendar } from "./special-hours-calendar";

type Props = {
  records: SpecialHoursRecord[];
  timezone: string;
  month: string;
};

export function SpecialHoursManager({ records, timezone, month }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<SpecialHoursRecord | null | "new">(null);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [dateFilter, setDateFilter] = useState("");
  const [deleting, setDeleting] = useState<SpecialHoursRecord | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setFeedback(null);
    startTransition(async () => {
      const result =
        editing && editing !== "new" && !isDuplicating
          ? await updateSpecialHoursAction(editing.id, formData)
          : await createSpecialHoursAction(formData);
      setFeedback(result.success ? "Excepción guardada." : result.error);
      if (result.success) {
        setEditing(null);
        setIsDuplicating(false);
        router.refresh();
      }
    });
  };
  const filteredRecords = filterSpecialHoursByDate(records, dateFilter);
  const duplicate = (record: SpecialHoursRecord) => {
    setIsDuplicating(true);
    setEditing({
      ...record,
      date: getNextAvailableDuplicateDate(
        record.date,
        records.map(({ date }) => date),
      ),
    });
  };

  const remove = () => {
    if (!deleting) return;
    startTransition(async () => {
      const result = await deleteSpecialHoursAction(deleting.id);
      setFeedback(result.success ? "Excepción eliminada." : result.error);
      setDeleting(null);
      if (result.success) router.refresh();
    });
  };

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] text-[#a8392f] uppercase">
            Restaurante
          </p>
          <h1 className="font-display mt-1 text-3xl text-[#173f35] sm:text-4xl">
            Horarios especiales
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            Excepciones por fecha con prioridad sobre el horario semanal · {timezone}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsDuplicating(false);
            setEditing("new");
          }}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#173f35] px-5 text-sm font-bold text-white"
        >
          <Plus className="size-4" /> Nueva excepción
        </button>
      </div>

      <div aria-live="polite" className="mb-3 min-h-6 text-xs font-semibold text-stone-600">
        {isPending ? (
          <span className="inline-flex items-center gap-2">
            <LoaderCircle className="size-4 animate-spin" /> Guardando…
          </span>
        ) : feedback}
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-[minmax(20rem,0.9fr)_minmax(0,1.1fr)]">
        <SpecialHoursCalendar
          month={month}
          records={records}
          onMonthChange={(nextMonth) =>
            router.push(`/admin/special-hours?month=${nextMonth}`)
          }
          onSelect={(record) => {
            setIsDuplicating(false);
            setEditing(record);
          }}
        />
        <section className="rounded-2xl border border-stone-200 bg-white p-4">
          <label className="text-xs font-bold text-stone-600">
            Filtrar por fecha
            <input
              type="date"
              value={dateFilter}
              min={`${month}-01`}
              max={`${month}-31`}
              onChange={(event) => setDateFilter(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 px-3"
            />
          </label>
          {dateFilter ? (
            <button
              type="button"
              onClick={() => setDateFilter("")}
              className="mt-3 min-h-11 rounded-xl border border-stone-200 px-4 text-xs font-bold"
            >
              Limpiar filtro
            </button>
          ) : null}
          <p className="mt-4 text-xs text-stone-500">
            {records.length} días configurados durante este mes.
          </p>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        {filteredRecords.length === 0 ? (
          <div className="grid min-h-48 place-items-center text-center text-stone-400">
            <div><CalendarDays className="mx-auto size-7" /><p className="mt-2 text-sm">No hay excepciones configuradas.</p></div>
          </div>
        ) : filteredRecords.map((record) => (
          <article key={record.id} className="grid gap-3 border-b border-stone-100 p-4 last:border-0 sm:grid-cols-[8rem_1fr_auto] sm:items-center">
            <div>
              <p className="text-sm font-bold text-[#173f35]">{record.date}</p>
              <p className="text-[10px] text-stone-400">{record.reason || "Sin motivo"}</p>
            </div>
            <div className="text-xs text-stone-600">
              {record.exceptionType === "closed" ? (
                <span className="font-bold text-[#a8392f]">Cerrado</span>
              ) : (
                <span>
                  <strong>
                    {record.exceptionType === "open"
                      ? "Apertura extraordinaria"
                      : "Horario especial"}
                    :{" "}
                  </strong>
                  {record.firstOpensAt}–{record.firstClosesAt}
                  {record.secondOpensAt
                    ? ` · ${record.secondOpensAt}–${record.secondClosesAt}`
                    : ""}
                </span>
              )}
            </div>
            <div className="flex gap-1">
              <button type="button" onClick={() => { setIsDuplicating(false); setEditing(record); }} aria-label={`Editar ${record.date}`} className="grid size-11 place-items-center rounded-lg hover:bg-stone-100"><Pencil className="size-4" /></button>
              <button type="button" onClick={() => duplicate(record)} aria-label={`Duplicar ${record.date}`} className="grid size-11 place-items-center rounded-lg hover:bg-stone-100"><Copy className="size-4" /></button>
              <button type="button" onClick={() => setDeleting(record)} aria-label={`Eliminar ${record.date}`} className="grid size-11 place-items-center rounded-lg text-red-700 hover:bg-red-50"><Trash2 className="size-4" /></button>
            </div>
          </article>
        ))}
      </section>

      {editing ? (
        <SpecialHoursDialog
          record={editing === "new" ? undefined : editing}
          isDuplicating={isDuplicating}
          pending={isPending}
          feedback={feedback}
          onClose={() => {
            setEditing(null);
            setIsDuplicating(false);
          }}
          onSubmit={submit}
        />
      ) : null}

      {deleting ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4">
          <section role="alertdialog" aria-modal="true" aria-labelledby="delete-special-title" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <AlertTriangle className="size-6 text-red-700" />
            <h2 id="delete-special-title" className="font-display mt-3 text-2xl text-[#173f35]">Eliminar excepción</h2>
            <p className="mt-2 text-sm text-stone-500">Se restaurará el horario semanal para {deleting.date}.</p>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setDeleting(null)} className="min-h-11 flex-1 rounded-xl border border-stone-200">Cancelar</button>
              <button type="button" onClick={remove} className="min-h-11 flex-1 rounded-xl bg-red-700 font-bold text-white">Eliminar</button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function SpecialHoursDialog({
  record,
  isDuplicating,
  pending,
  feedback,
  onClose,
  onSubmit,
}: {
  record?: SpecialHoursRecord;
  isDuplicating: boolean;
  pending: boolean;
  feedback: string | null;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const [exceptionType, setExceptionType] = useState<SpecialHoursType>(
    record?.exceptionType ?? "special",
  );
  const closed = exceptionType === "closed";
  return (
    <div className="fixed inset-0 z-[80] grid place-items-end bg-black/40 sm:place-items-center sm:p-5">
      <section role="dialog" aria-modal="true" aria-labelledby="special-hours-title" className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-3xl">
        <div className="flex justify-between gap-3">
          <h2 id="special-hours-title" className="font-display text-2xl text-[#173f35]">{isDuplicating ? "Duplicar excepción" : record ? "Editar excepción" : "Nueva excepción"}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar formulario" className="grid size-11 place-items-center rounded-full bg-stone-100"><X className="size-5" /></button>
        </div>
        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <label className="block text-xs font-bold text-stone-600">Fecha<input name="date" type="date" required defaultValue={record?.date} className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 px-3" /></label>
          <label className="block text-xs font-bold text-stone-600">
            Tipo
            <select
              name="exceptionType"
              value={exceptionType}
              onChange={(event) =>
                setExceptionType(event.target.value as SpecialHoursType)
              }
              className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3"
            >
              <option value="special">Horario especial</option>
              <option value="open">Apertura extraordinaria</option>
              <option value="closed">Cerrado</option>
            </select>
          </label>
          <label className="block text-xs font-bold text-stone-600">Motivo opcional<input name="reason" maxLength={240} defaultValue={record?.reason} className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 px-3" /></label>
          <div className="grid grid-cols-2 gap-3">
            {[
              ["firstOpensAt", "Apertura 1", record?.firstOpensAt],
              ["firstClosesAt", "Cierre 1", record?.firstClosesAt],
              ["secondOpensAt", "Apertura 2", record?.secondOpensAt],
              ["secondClosesAt", "Cierre 2", record?.secondClosesAt],
            ].map(([name, label, value]) => (
              <label key={name} className="text-xs font-bold text-stone-600">{label}<input name={name} type="time" disabled={closed} defaultValue={value} className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 px-3 disabled:bg-stone-50" /></label>
            ))}
          </div>
          <div aria-live="polite" className="min-h-5 text-xs font-semibold text-red-700">{feedback}</div>
          <div className="flex gap-3 border-t border-stone-100 pt-4">
            <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-xl border border-stone-200">Cancelar</button>
            <button type="submit" disabled={pending} className="min-h-11 flex-1 rounded-xl bg-[#173f35] font-bold text-white disabled:opacity-50">Guardar</button>
          </div>
        </form>
      </section>
    </div>
  );
}
