"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { saveCustomerSegmentAction } from "../actions";
import type { getCustomerSegments } from "../repository";
import type { getCustomerTags } from "@/features/admin/customer-tags/repository";

type Segment = Awaited<ReturnType<typeof getCustomerSegments>>[number];
type Tag = Awaited<ReturnType<typeof getCustomerTags>>[number];

export function SegmentsManager({
  segments,
  tags,
}: {
  segments: Segment[];
  tags: Tag[];
}) {
  const [editing, setEditing] = useState<Segment | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a8392f]">CRM</p>
      <h1 className="font-display mt-1 text-3xl text-[#173f35]">Segmentos guardados</h1>
      <form
        className="mt-5 grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-3"
        onSubmit={(event)=>{
          event.preventDefault();
          startTransition(async()=>{
            const result=await saveCustomerSegmentAction(new FormData(event.currentTarget));
            setFeedback(result.success?"Segmento guardado.":result.error);
            if(result.success) window.location.reload();
          });
        }}
      >
        <input type="hidden" name="id" value={editing?.id ?? ""} />
        <label className="text-xs font-bold">Nombre<input name="name" required maxLength={160} defaultValue={editing?.name} className="mt-1 min-h-11 w-full rounded-xl border px-3" /></label>
        <label className="text-xs font-bold sm:col-span-2">Descripción<input name="description" maxLength={1000} defaultValue={editing?.description ?? ""} className="mt-1 min-h-11 w-full rounded-xl border px-3" /></label>
        <label className="text-xs font-bold">Búsqueda<input name="query" maxLength={160} defaultValue={editing?.filters.query ?? ""} className="mt-1 min-h-11 w-full rounded-xl border px-3" /></label>
        <SelectFilter name="customerIsActive" label="Estado cliente" value={editing?.filters.isActive} trueLabel="Activo" falseLabel="Inactivo" />
        <SelectFilter name="loyaltyParticipating" label="Fidelización" value={editing?.filters.loyaltyParticipating} trueLabel="Participa" falseLabel="No participa" />
        <SelectFilter name="hasPoints" label="Puntos" value={editing?.filters.hasPoints} trueLabel="Con puntos" falseLabel="Sin puntos" />
        <ConsentFilter name="emailConsent" label="Consentimiento email" value={editing?.filters.emailConsent} />
        <ConsentFilter name="phoneConsent" label="Consentimiento telefónico" value={editing?.filters.phoneConsent} />
        <SelectFilter name="hasNoShows" label="No-show" value={editing?.filters.hasNoShows} trueLabel="Con no-show" falseLabel="Sin no-show" />
        <label className="text-xs font-bold">Sin visitas desde días<input name="noVisitsSinceDays" type="number" min={1} max={3650} defaultValue={editing?.filters.noVisitsSinceDays} className="mt-1 min-h-11 w-full rounded-xl border px-3" /></label>
        <fieldset className="sm:col-span-2"><legend className="text-xs font-bold">Etiquetas</legend><div className="mt-1 flex flex-wrap gap-2">{tags.map(tag=><label key={tag.id} className="flex gap-1 text-xs"><input name="tagIds" type="checkbox" value={tag.id} defaultChecked={editing?.filters.tagIds?.includes(tag.id)} />{tag.name}</label>)}</div></fieldset>
        <label className="flex items-center gap-2 text-xs font-bold"><input name="isActive" type="checkbox" value="true" defaultChecked={editing?.isActive ?? true} />Segmento activo</label>
        <button disabled={pending} className="min-h-11 rounded-xl bg-[#173f35] font-bold text-white sm:col-span-3">{editing?"Guardar cambios":"Crear segmento"}</button>
      </form>
      <p aria-live="polite" className="mt-2 min-h-5 text-xs font-bold">{feedback}</p>
      <section className="mt-3 overflow-hidden rounded-2xl border bg-white">{segments.map(segment=><article key={segment.id} className="flex flex-wrap items-center justify-between gap-3 border-b p-4 last:border-0"><div><strong>{segment.name}</strong><p className="text-xs text-stone-500">{segment.description}</p><p className="text-[10px] text-stone-400">{segment.matchingCount} clientes · {segment.isActive?"Activo":"Inactivo"}</p></div><div className="flex gap-2"><Link href={`/admin/customers?segmentId=${segment.id}`} className="grid min-h-11 place-items-center rounded-xl border px-3 text-xs font-bold">Ver clientes</Link><button type="button" onClick={()=>setEditing(segment)} className="min-h-11 rounded-xl border px-3 text-xs font-bold">Editar</button></div></article>)}</section>
    </div>
  );
}

function SelectFilter({name,label,value,trueLabel,falseLabel}:{name:string;label:string;value?:boolean;trueLabel:string;falseLabel:string}) {
  return <label className="text-xs font-bold">{label}<select name={name} defaultValue={value===undefined?"":String(value)} className="mt-1 min-h-11 w-full rounded-xl border bg-white px-2"><option value="">Cualquiera</option><option value="true">{trueLabel}</option><option value="false">{falseLabel}</option></select></label>;
}
function ConsentFilter({name,label,value}:{name:string;label:string;value?:string}) {
  return <label className="text-xs font-bold">{label}<select name={name} defaultValue={value ?? ""} className="mt-1 min-h-11 w-full rounded-xl border bg-white px-2"><option value="">Cualquiera</option><option value="granted">Concedido</option><option value="rejected">Rechazado</option><option value="withdrawn">Retirado</option></select></label>;
}
