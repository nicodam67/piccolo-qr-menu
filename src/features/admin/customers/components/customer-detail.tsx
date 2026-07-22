"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import {
  addCustomerNoteAction,
  deleteCustomerAddressAction,
  saveCustomerAddressAction,
  updateCustomerAction,
  applyManualLoyaltyMovementAction,
  recordCustomerConsentAction,
} from "../actions";
import type { getAdminCustomerDetail } from "../repository";
import type { getCustomerLoyalty } from "@/features/loyalty/repository";
import type { getCustomerConsents } from "@/features/consents/repository";
import type { getCustomerTags } from "@/features/admin/customer-tags/repository";
import { setCustomerTagAssignmentAction } from "@/features/admin/customer-tags/actions";
import type { DEFAULT_LOYALTY_SETTINGS } from "@/features/admin/loyalty-settings/repository";

type Detail = NonNullable<Awaited<ReturnType<typeof getAdminCustomerDetail>>>;

export function CustomerDetail({
  data,
  locales,
  loyalty,
  consents,
  tags,
  loyaltySettings,
}: {
  data: Detail;
  locales: string[];
  loyalty: Awaited<ReturnType<typeof getCustomerLoyalty>>;
  consents: Awaited<ReturnType<typeof getCustomerConsents>>;
  tags: Awaited<ReturnType<typeof getCustomerTags>>;
  loyaltySettings: typeof DEFAULT_LOYALTY_SETTINGS;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const customer = data.customer;
  const runForm = (
    action: (formData: FormData) => Promise<{ success: boolean; error: string | null }>,
  ) => (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await action(formData);
      if (!result.success) window.alert(result.error);
      else router.refresh();
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
        <h2 className="font-display text-2xl text-[#173f35]">Fidelización</h2>
        <p className="mt-1 text-xs text-stone-500">{loyaltySettings.programName} · {loyaltySettings.isEnabled ? "Activo" : "Desactivado"}</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["Saldo",loyalty.account.balance],["Obtenidos",loyalty.account.totalEarned],["Utilizados",loyalty.account.totalRedeemed],["Caducados",loyalty.account.totalExpired]].map(([label,value])=><div key={String(label)} className="rounded-xl bg-stone-50 p-3"><p className="text-2xl font-black text-[#173f35]">{value}</p><p className="text-[10px] font-bold text-stone-500">{label}</p></div>)}
        </div>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)_auto]"
          onSubmit={(event)=>{
            event.preventDefault();
            if(!window.confirm("¿Aplicar este movimiento de puntos?")) return;
            runForm((formData)=>applyManualLoyaltyMovementAction(customer.id,formData))(event);
          }}
        >
          <label className="text-xs font-bold">Puntos<input name="amount" type="number" required placeholder="+100 o -50" className="mt-1 min-h-11 w-full rounded-xl border px-3" /></label>
          <label className="text-xs font-bold">Motivo<input name="reason" required minLength={3} maxLength={500} className="mt-1 min-h-11 w-full rounded-xl border px-3" /></label>
          <button disabled={isPending || !loyaltySettings.isEnabled || !loyaltySettings.manualAdjustmentsEnabled} className="min-h-11 self-end rounded-xl bg-[#173f35] px-4 text-sm font-bold text-white disabled:opacity-50">Aplicar</button>
        </form>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-bold">Historial ({loyalty.movements.length})</summary>
          <ul className="mt-2 space-y-1">{loyalty.movements.map((movement)=><li key={movement.id} className="rounded-lg bg-stone-50 p-2 text-xs">{new Date(movement.createdAt).toLocaleString("es-ES")} · {movement.amount>0?"+":""}{movement.amount} · {movement.movementType} · {movement.reason}</li>)}</ul>
        </details>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="font-display text-2xl text-[#173f35]">Consentimientos</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">{[
          ["marketing_email","Email comercial"],
          ["marketing_phone","SMS o teléfono"],
          ["loyalty_program","Programa de fidelización"],
          ["personalization","Personalización comercial"],
        ].map(([type,label])=><div key={type} className="rounded-xl bg-stone-50 p-3 text-xs"><strong>{label}</strong><p>{consents.current[type as keyof typeof consents.current]?.status ?? "Sin registrar"}</p><p className="text-[10px] text-stone-400">{consents.current[type as keyof typeof consents.current]?.createdAt ? new Date(consents.current[type as keyof typeof consents.current].createdAt).toLocaleString("es-ES") : "—"}</p></div>)}</div>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-4"
          onSubmit={(event)=>{
            event.preventDefault();
            if(!window.confirm("¿Registrar este nuevo estado de consentimiento?")) return;
            runForm((formData)=>recordCustomerConsentAction(customer.id,formData))(event);
          }}
        >
          <label className="text-xs font-bold">Tipo<select name="consentType" className="mt-1 min-h-11 w-full rounded-xl border bg-white px-2"><option value="marketing_email">Email</option><option value="marketing_phone">SMS/teléfono</option><option value="loyalty_program">Fidelización</option><option value="personalization">Personalización</option></select></label>
          <label className="text-xs font-bold">Estado<select name="status" className="mt-1 min-h-11 w-full rounded-xl border bg-white px-2"><option value="granted">Concedido</option><option value="rejected">Rechazado</option><option value="withdrawn">Retirado</option></select></label>
          <label className="text-xs font-bold">Versión legal<input name="legalVersion" required maxLength={80} className="mt-1 min-h-11 w-full rounded-xl border px-2" /></label>
          <button className="min-h-11 self-end rounded-xl bg-[#173f35] px-3 text-xs font-bold text-white">Registrar</button>
        </form>
        <details className="mt-4"><summary className="cursor-pointer text-sm font-bold">Historial ({consents.history.length})</summary><ul className="mt-2 space-y-1">{consents.history.map((item)=><li key={item.id} className="rounded-lg bg-stone-50 p-2 text-xs">{new Date(item.createdAt).toLocaleString("es-ES")} · {item.consentType} · {item.status} · {item.origin} · {item.legalVersion}</li>)}</ul></details>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="font-display text-2xl text-[#173f35]">Etiquetas</h2>
        <div className="mt-3 flex flex-wrap gap-2">{tags.map((tag)=>{
          const assigned = data.assignedTagIds.includes(tag.id);
          return <label key={tag.id} className="flex min-h-11 items-center gap-2 rounded-full border px-3 text-xs font-bold" style={{borderColor:tag.color}}><input type="checkbox" defaultChecked={assigned} onChange={(event)=>startTransition(async()=>{await setCustomerTagAssignmentAction(customer.id,tag.id,event.target.checked);router.refresh();})} />{tag.name}</label>;
        })}</div>
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
        <ul className="mt-4 space-y-2">{data.addresses.map((address)=><li key={address.id} className="flex items-center justify-between rounded-xl bg-stone-50 p-3 text-sm"><span>{address.label ? `${address.label}: ` : ""}{address.line1}, {address.city} {address.postalCode}</span><button type="button" onClick={()=>startTransition(async()=>{await deleteCustomerAddressAction(customer.id,address.id);router.refresh();})} className="min-h-11 px-3 text-xs font-bold text-red-700">Eliminar</button></li>)}</ul>
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
