"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { LoaderCircle, Plus, X } from "lucide-react";

import {
  createCustomerAction,
  toggleCustomerAction,
} from "../actions";
import type { getAdminCustomers } from "../repository";

type CustomerRow = Awaited<ReturnType<typeof getAdminCustomers>>[number];

export function CustomersManager({
  customers,
  query,
  locales,
}: {
  customers: CustomerRow[];
  query: string;
  locales: string[];
}) {
  const [creating, setCreating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a8392f]">
            CRM
          </p>
          <h1 className="font-display mt-1 text-3xl text-[#173f35] sm:text-4xl">
            Clientes
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#173f35] px-5 text-sm font-bold text-white"
        >
          <Plus className="size-4" /> Nuevo cliente
        </button>
      </div>
      <form method="get" className="mt-5 flex gap-2">
        <label className="sr-only" htmlFor="customer-search">Buscar clientes</label>
        <input
          id="customer-search"
          name="query"
          defaultValue={query}
          placeholder="Nombre, teléfono o email"
          className="min-h-11 flex-1 rounded-xl border border-stone-200 bg-white px-3"
        />
        <button className="min-h-11 rounded-xl border border-stone-200 bg-white px-4 text-sm font-bold">
          Buscar
        </button>
      </form>
      <p aria-live="polite" className="mt-3 min-h-5 text-xs font-bold text-stone-600">
        {isPending ? "Actualizando…" : feedback}
      </p>
      <section className="mt-2 overflow-hidden rounded-2xl border border-stone-200 bg-white">
        {customers.length === 0 ? (
          <p className="p-10 text-center text-sm text-stone-500">
            No hay clientes para esta búsqueda.
          </p>
        ) : (
          customers.map((customer) => (
            <article
              key={customer.id}
              data-testid={`customer-${customer.id}`}
              className="grid gap-3 border-b border-stone-100 p-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <div>
                <Link
                  href={`/admin/customers/${customer.id}`}
                  className="text-base font-black text-[#173f35] hover:underline"
                >
                  {customer.firstName} {customer.lastName}
                </Link>
                <p className="mt-1 text-xs text-stone-500">
                  {customer.phone} · {customer.email || "Sin email"} ·{" "}
                  {customer.preferredLocale.toUpperCase()}
                </p>
                <p className="mt-1 text-[10px] text-stone-400">
                  {customer.reservationCount} reservas ·{" "}
                  {customer.cancellationCount} cancelaciones ·{" "}
                  {customer.noShowCount} no-show ·{" "}
                  {(customer.totalSpendCents / 100).toFixed(2)} € preparados TPV
                  · Última reserva {customer.lastReservationDate ?? "—"}
                </p>
              </div>
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await toggleCustomerAction(
                      customer.id,
                      !customer.isActive,
                    );
                    setFeedback(
                      result.success
                        ? customer.isActive
                          ? "Cliente desactivado."
                          : "Cliente reactivado."
                        : result.error,
                    );
                  })
                }
                className="min-h-11 rounded-xl border border-stone-200 px-3 text-xs font-bold"
              >
                {customer.isActive ? "Desactivar" : "Reactivar"}
              </button>
            </article>
          ))
        )}
      </section>
      {creating ? (
        <CustomerDialog
          locales={locales}
          pending={isPending}
          onClose={() => setCreating(false)}
          onSubmit={(formData) =>
            startTransition(async () => {
              const result = await createCustomerAction(formData);
              if (!result.success) {
                setFeedback(result.error);
                return;
              }
              setCreating(false);
              window.location.assign(`/admin/customers/${result.id}`);
            })
          }
        />
      ) : null}
    </>
  );
}

function CustomerDialog({
  locales,
  pending,
  onClose,
  onSubmit,
}: {
  locales: string[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-end bg-black/40 sm:place-items-center sm:p-5">
      <section role="dialog" aria-modal="true" aria-labelledby="new-customer-title" className="max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 sm:max-w-xl sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <h2 id="new-customer-title" className="font-display text-2xl text-[#173f35]">Nuevo cliente</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar formulario" className="grid size-11 place-items-center rounded-full bg-stone-100"><X className="size-5" /></button>
        </div>
        <CustomerFields
          locales={locales}
          submitLabel="Crear cliente"
          pending={pending}
          onSubmit={onSubmit}
        />
      </section>
    </div>
  );
}

export function CustomerFields({
  customer,
  locales,
  submitLabel,
  pending,
  onSubmit,
}: {
  customer?: CustomerRow;
  locales: string[];
  submitLabel: string;
  pending: boolean;
  onSubmit: (formData: FormData) => void;
}) {
  return (
    <form
      className="mt-5 grid gap-4 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(new FormData(event.currentTarget));
      }}
    >
      <Field name="firstName" label="Nombre" value={customer?.firstName} />
      <Field name="lastName" label="Apellidos" value={customer?.lastName} required={false} />
      <Field name="phone" label="Teléfono" type="tel" value={customer?.phone} />
      <Field name="email" label="Email" type="email" value={customer?.email ?? ""} required={false} />
      <Field name="birthDate" label="Fecha de nacimiento" type="date" value={undefined} required={false} />
      <label className="text-xs font-bold">Idioma preferido<select name="preferredLocale" defaultValue={customer?.preferredLocale ?? "es"} className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3">{locales.map((locale)=><option key={locale} value={locale}>{locale.toUpperCase()}</option>)}</select></label>
      <label className="text-xs font-bold sm:col-span-2">Observaciones<textarea name="observations" maxLength={2000} rows={3} className="mt-1 w-full rounded-xl border border-stone-200 p-3" /></label>
      <label className="text-xs font-bold sm:col-span-2">Alergias importantes<textarea name="importantAllergies" maxLength={1000} rows={3} className="mt-1 w-full rounded-xl border border-stone-200 p-3" /></label>
      <label className="flex min-h-11 items-center gap-3 text-xs font-bold sm:col-span-2"><input name="isActive" type="checkbox" value="true" defaultChecked={customer?.isActive ?? true} />Cliente activo</label>
      <button type="submit" disabled={pending} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#173f35] font-bold text-white sm:col-span-2">{pending?<LoaderCircle className="size-4 animate-spin"/>:null}{submitLabel}</button>
    </form>
  );
}

function Field({name,label,type="text",value,required=true}:{name:string;label:string;type?:string;value?:string;required?:boolean}) {
  return <label className="text-xs font-bold">{label}<input name={name} type={type} defaultValue={value} required={required} className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 px-3" /></label>;
}
