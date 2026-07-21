"use client";

import { useState, useTransition } from "react";
import { saveLoyaltySettingsAction } from "../actions";
import type { DEFAULT_LOYALTY_SETTINGS } from "../repository";

export function LoyaltySettingsForm({
  settings,
}: {
  settings: typeof DEFAULT_LOYALTY_SETTINGS;
}) {
  const [expires, setExpires] = useState(settings.pointsExpire);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await saveLoyaltySettingsAction(data);
          setFeedback(
            result.success ? "Configuración guardada." : result.error,
          );
        });
      }}
    >
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a8392f]">
          CRM
        </p>
        <h1 className="font-display mt-1 text-3xl text-[#173f35]">
          Programa de fidelización
        </h1>
      </div>
      <section className="grid gap-4 rounded-2xl border border-stone-200 bg-white p-5 sm:grid-cols-2">
        <label className="flex min-h-11 items-center justify-between text-xs font-bold sm:col-span-2">Activar programa<input name="isEnabled" type="checkbox" value="true" defaultChecked={settings.isEnabled} /></label>
        <label className="text-xs font-bold">Nombre visible<input name="programName" required maxLength={120} defaultValue={settings.programName} className="mt-1 min-h-11 w-full rounded-xl border px-3" /></label>
        <label className="text-xs font-bold">Puntos futuros por euro<input name="pointsPerEuro" type="number" min={1} required defaultValue={settings.pointsPerEuro} className="mt-1 min-h-11 w-full rounded-xl border px-3" /></label>
        <label className="flex min-h-11 items-center gap-3 text-xs font-bold"><input name="pointsExpire" type="checkbox" value="true" checked={expires} onChange={(event)=>setExpires(event.target.checked)} />Los puntos caducan</label>
        <label className="text-xs font-bold">Meses de validez<input name="expiryMonths" type="number" min={1} max={120} disabled={!expires} required={expires} defaultValue={settings.expiryMonths ?? 12} className="mt-1 min-h-11 w-full rounded-xl border px-3 disabled:bg-stone-100" /></label>
        <label className="flex min-h-11 items-center gap-3 text-xs font-bold sm:col-span-2"><input name="manualAdjustmentsEnabled" type="checkbox" value="true" defaultChecked={settings.manualAdjustmentsEnabled} />Permitir ajustes manuales</label>
        <p className="text-xs text-stone-500 sm:col-span-2">No se otorgan puntos automáticamente por gasto hasta integrar el TPV.</p>
      </section>
      <button disabled={pending} className="min-h-11 rounded-xl bg-[#173f35] px-5 font-bold text-white">Guardar configuración</button>
      <p aria-live="polite" className="min-h-5 text-xs font-bold">{feedback}</p>
    </form>
  );
}
