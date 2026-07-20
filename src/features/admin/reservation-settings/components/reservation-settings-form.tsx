"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Save } from "lucide-react";

import type { ReservationSettingsData } from "@/features/reservations/domain";
import { saveReservationSettingsAction } from "../actions";

export function ReservationSettingsForm({
  settings,
}: {
  settings: ReservationSettingsData;
}) {
  const [enabled, setEnabled] = useState(settings.isEnabled);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setFeedback(null);
    startTransition(async () => {
      const result = await saveReservationSettingsAction(formData);
      setFeedback(
        result.success ? "Configuración guardada correctamente." : result.error,
      );
    });
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a8392f]">
            Reservas
          </p>
          <h1 className="font-display mt-1 text-3xl text-[#173f35] sm:text-4xl">
            Configuración de reservas
          </h1>
        </div>
        <button type="submit" disabled={isPending} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#173f35] px-5 text-sm font-bold text-white disabled:opacity-50">
          {isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
          Guardar
        </button>
      </div>

      <section className="grid gap-4 rounded-2xl border border-stone-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex min-h-11 items-center justify-between rounded-xl border border-stone-200 px-3 text-xs font-bold sm:col-span-2 lg:col-span-3">
          Activar reservas online
          <input name="isEnabled" type="checkbox" value="true" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="size-4 accent-[#173f35]" />
        </label>
        <NumberField name="durationMinutes" label="Duración estimada (minutos)" value={settings.durationMinutes} min={15} max={480} />
        <label className="text-xs font-bold text-stone-700">Intervalo entre horas<select name="slotIntervalMinutes" defaultValue={settings.slotIntervalMinutes} className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3"><option value="15">15 minutos</option><option value="30">30 minutos</option><option value="60">60 minutos</option></select></label>
        <NumberField name="minimumAdvanceMinutes" label="Antelación mínima (minutos)" value={settings.minimumAdvanceMinutes} min={0} max={43200} />
        <NumberField name="maximumAdvanceDays" label="Máximo de días de antelación" value={settings.maximumAdvanceDays} min={1} max={365} />
        <NumberField name="maximumPartySize" label="Máximo de personas online" value={settings.maximumPartySize} min={1} max={100} />
        <NumberField name="slotCapacity" label="Capacidad por franja" value={settings.slotCapacity} min={1} max={1000} />
        <label className="text-xs font-bold text-stone-700">Teléfono para grupos grandes<input name="largeGroupPhone" type="tel" maxLength={40} defaultValue={settings.largeGroupPhone} className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 px-3" /></label>
        <label className="text-xs font-bold text-stone-700">Estado inicial<select name="initialStatus" defaultValue={settings.initialStatus} className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3"><option value="pending">Pendiente de confirmación</option><option value="confirmed">Confirmada automáticamente</option></select></label>
        <label className="text-xs font-bold text-stone-700 sm:col-span-2 lg:col-span-3">Mensaje informativo<textarea name="customerMessage" maxLength={1000} rows={3} defaultValue={settings.customerMessage} className="mt-2 w-full rounded-xl border border-stone-200 px-3 py-3" /></label>
        <label className="text-xs font-bold text-stone-700 sm:col-span-2 lg:col-span-3">Política y condiciones<textarea name="policyText" maxLength={4000} rows={5} required={enabled} defaultValue={settings.policyText} className="mt-2 w-full rounded-xl border border-stone-200 px-3 py-3" /></label>
      </section>
      <p aria-live="polite" className="min-h-5 text-xs font-bold text-stone-600">{feedback}</p>
    </form>
  );
}

function NumberField({
  name,
  label,
  value,
  min,
  max,
}: {
  name: string;
  label: string;
  value: number;
  min: number;
  max: number;
}) {
  return (
    <label className="text-xs font-bold text-stone-700">
      {label}
      <input name={name} type="number" defaultValue={value} min={min} max={max} required className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 px-3" />
    </label>
  );
}
