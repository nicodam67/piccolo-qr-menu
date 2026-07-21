"use client";

import { useTransition } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";

import {
  addCustomerNoteAction,
  deleteCustomerAddressAction,
  saveCustomerAddressAction,
  updateCustomerAction,
} from "../actions";
import type { getAdminCustomerDetail } from "../repository";

type Detail = NonNullable<Awaited<ReturnType<typeof getAdminCustomerDetail>>>;

export function CustomerDetail({
  data,
  locales,
}: {
  data: Detail;
  locales: string[];
}) {
  const [isPending, startTransition] = useTransition();
  const customer = data.customer;
  const runForm = (
    action: (formData: FormData) => Promise<{ success: boolean; error: string | null }>,
  ) => (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await action(formData);
      if (!result.success) window.alert(result.error);
      else window.location.reload();
    });
  };
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/customers" className="text-sm font-bold text-[#173f35]">← Clientes</Link>
        <h1 className="font-display mt-2 text-3xl text-[#173f35]">
          {customer.firstName} {customer.lastName}
        </h1>
      </div>
      <form onSubmit={runForm((formData) => updateCustomerAction(customer.id, formData))} className="grid gap-4 rounded-2xl border border-stone-200 bg-white p-5 sm:grid-cols-2">
        <Field name="firstName" label="Nombre" value={customer.firstName} />
        <Field name="lastName" label="Apellidos" value={customer.lastName} required={false} />
        <Field name="phone" label="Teléfono" type="tel" value={customer.phone} />
        <Field name="email" label="Email" type="email" value={customer.email ?? ""} required={false} />
        <Field name="birthDate" label="Fecha de nacimiento" type="date" value={customer.birthDate ?? ""} required={false} />
        <label className="text-xs font-bold">Idioma preferido<select name="preferredLocale" defaultValue={customer.preferredLocale} className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3">{locales.map((locale)=><option key={locale} value={locale}>{locale.toUpperCase()}</option>)}</select></label>
        <label className="text-xs font-bold sm:col-span-2">Observaciones<textarea name="observations" defaultValue={customer.observations ?? ""} maxLength={2000} rows={3} className="mt-1 w-full rounded-xl border p-3" /></label>
        <label className="text-xs font-bold sm:col-span-2">Alergias importantes<textarea name="importantAllergies" defaultValue={customer.importantAllergies ?? ""} maxLength={1000} rows={3} className="mt-1 w-full rounded-xl border p-3" /></label>
        <label className="flex min-h-11 items-center gap-3 text-xs font-bold"><input name="isActive" type="checkbox" value="true" defaultChecked={customer.isActive} />Activo</label>
        <button disabled={isPending} className="min-h-11 rounded-xl bg-[#173f35] font-bold text-white">{isPending?<LoaderCircle className="mx-auto size-4 animate-spin"/>:"Guardar perfil"}</button>
      </form>

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="font-display text-2xl text-[#173f35]">Notas CRM</h2>
        <form onSubmit={runForm((formData) => addCustomerNoteAction(customer.id, formData))} className="mt-3 flex gap-2">
          <label className="sr-only" htmlFor="crm-note">Nueva nota</label>
          <textarea id="crm-note" name="body" required maxLength={2000} className="min-h-20 flex-1 rounded-xl border p-3" />
          <button disabled={isPending} className="rounded-xl bg-[#173f35] px-4 text-sm font-bold text-white">Añadir</button>
        </form>
        <ul className="mt-4 space-y-2">{data.notes.map((note)=><li key={note.id} className="rounded-xl bg-stone-50 p-3 text-sm"><p>{note.body}</p><time className="text-[10px] text-stone-400">{new Date(note.createdAt).toLocaleString("es-ES")}</time></li>)}</ul>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="font-display text-2xl text-[#173f35]">Direcciones</h2>
        <form onSubmit={runForm((formData) => saveCustomerAddressAction(customer.id, formData))} className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field name="label" label="Etiqueta" required={false} />
          <Field name="line1" label="Dirección" />
          <Field name="line2" label="Complemento" required={false} />
          <Field name="city" label="Ciudad" required={false} />
          <Field name="postalCode" label="Código postal" required={false} />
          <Field name="province" label="Provincia" required={false} />
          <Field name="countryCode" label="País" value="ES" />
          <label className="flex items-center gap-2 text-xs font-bold"><input name="isDefault" type="checkbox" value="true" />Predeterminada</label>
          <button className="min-h-11 rounded-xl border font-bold sm:col-span-2">Añadir dirección</button>
        </form>
        <ul className="mt-4 space-y-2">{data.addresses.map((address)=><li key={address.id} className="flex items-center justify-between rounded-xl bg-stone-50 p-3 text-sm"><span>{address.label ? `${address.label}: ` : ""}{address.line1}, {address.city} {address.postalCode}</span><button type="button" onClick={()=>startTransition(async()=>{await deleteCustomerAddressAction(customer.id,address.id);window.location.reload();})} className="min-h-11 px-3 text-xs font-bold text-red-700">Eliminar</button></li>)}</ul>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="font-display text-2xl text-[#173f35]">Historial de reservas</h2>
        <p className="mt-1 text-sm text-stone-500">Gasto total preparado para TPV: {(customer.totalSpendCents/100).toFixed(2)} € · Última visita: {customer.lastVisitAt ? new Date(customer.lastVisitAt).toLocaleString("es-ES") : "—"}</p>
        <ul className="mt-4 space-y-2">{data.history.map((reservation)=><li key={reservation.id}><Link href={`/admin/reservations?date=${reservation.date}&query=${reservation.locator}`} className="block rounded-xl bg-stone-50 p-3 text-sm font-bold">{reservation.date} · {reservation.time.slice(0,5)} · {reservation.partySize} personas · {reservation.status} · {reservation.locator}</Link></li>)}</ul>
      </section>
    </div>
  );
}

function Field({name,label,type="text",value,required=true}:{name:string;label:string;type?:string;value?:string;required?:boolean}) {
  return <label className="text-xs font-bold">{label}<input name={name} type={type} defaultValue={value} required={required} className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 px-3" /></label>;
}
