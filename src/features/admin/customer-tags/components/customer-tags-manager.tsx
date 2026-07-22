"use client";

import { useState, useTransition } from "react";
import {
  createCustomerTagAction,
  toggleCustomerTagAction,
  updateCustomerTagAction,
} from "../actions";
import type { getCustomerTags } from "../repository";

type Tag = Awaited<ReturnType<typeof getCustomerTags>>[number];

export function CustomerTagsManager({ tags }: { tags: Tag[] }) {
  const [editing, setEditing] = useState<Tag | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = editing
        ? await updateCustomerTagAction(editing.id, data)
        : await createCustomerTagAction(data);
      setFeedback(result.success ? "Etiqueta guardada." : result.error);
      if (result.success) window.location.reload();
    });
  };
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a8392f]">CRM</p>
      <h1 className="font-display mt-1 text-3xl text-[#173f35]">Etiquetas de clientes</h1>
      <form onSubmit={submit} className="mt-5 grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-4">
        <label className="text-xs font-bold">Nombre<input name="name" required maxLength={120} defaultValue={editing?.name} className="mt-1 min-h-11 w-full rounded-xl border px-3" /></label>
        <label className="text-xs font-bold">Color<input name="color" type="color" defaultValue={editing?.color ?? "#64748b"} className="mt-1 min-h-11 w-full rounded-xl border" /></label>
        <label className="text-xs font-bold">Orden<input name="sortOrder" type="number" min={1} required defaultValue={editing?.sortOrder ?? tags.length + 1} className="mt-1 min-h-11 w-full rounded-xl border px-3" /></label>
        <label className="flex items-center gap-2 text-xs font-bold"><input name="isActive" type="checkbox" value="true" defaultChecked={editing?.isActive ?? true} />Activa</label>
        <button disabled={pending} className="min-h-11 rounded-xl bg-[#173f35] font-bold text-white sm:col-span-4">{editing ? "Guardar cambios" : "Crear etiqueta"}</button>
      </form>
      <p aria-live="polite" className="mt-2 min-h-5 text-xs font-bold">{feedback}</p>
      <section className="mt-3 overflow-hidden rounded-2xl border bg-white">
        {tags.map((tag)=><article key={tag.id} className="flex items-center justify-between gap-3 border-b p-4 last:border-0"><div><span className="inline-block size-3 rounded-full" style={{backgroundColor:tag.color}} /> <strong>{tag.name}</strong><p className="text-[10px] text-stone-500">Orden {tag.sortOrder} · {tag.assignmentCount} clientes · {tag.isActive?"Activa":"Inactiva"}</p></div><div className="flex gap-2"><button type="button" onClick={()=>setEditing(tag)} className="min-h-11 rounded-xl border px-3 text-xs font-bold">Editar</button><button type="button" onClick={()=>startTransition(async()=>{await toggleCustomerTagAction(tag.id,!tag.isActive);window.location.reload();})} className="min-h-11 rounded-xl border px-3 text-xs font-bold">{tag.isActive?"Desactivar":"Reactivar"}</button></div></article>)}
      </section>
    </div>
  );
}
