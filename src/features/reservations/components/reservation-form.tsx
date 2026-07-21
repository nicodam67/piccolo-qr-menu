"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, LoaderCircle } from "lucide-react";

import {
  createOnlineReservationAction,
  getReservationAvailabilityAction,
  type AvailabilityActionResult,
} from "../actions";
import { getOfflinePaymentNotice, getReservationCopy } from "../copy";
import type { ReservationSettingsData, ReservationStatus } from "../domain";
import { calculateDeposit, enabledPaymentMethods } from "../payments/domain";

type Props = {
  locale: string;
  restaurantName: string;
  restaurantPhone: string;
  settings: ReservationSettingsData;
  isReady: boolean;
  onlinePaymentsEnabled: boolean;
  minDate: string;
  maxDate: string;
};

export function ReservationForm({
  locale,
  restaurantName,
  restaurantPhone,
  settings,
  isReady,
  onlinePaymentsEnabled,
  minDate,
  maxDate,
}: Props) {
  const copy = getReservationCopy(locale);
  const [date, setDate] = useState(minDate);
  const [partySize, setPartySize] = useState(2);
  const depositTotal = calculateDeposit(partySize,settings.depositPerGuestCents,settings.depositMinimumPartySize,settings.depositEnabled);
  const paymentMethods = onlinePaymentsEnabled
    ? enabledPaymentMethods(settings, "online")
    : [];
  const [time, setTime] = useState("");
  const [availability, setAvailability] =
    useState<AvailabilityActionResult | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    locator: string;
    date: string;
    time: string;
    partySize: number;
    status: ReservationStatus;
    paymentPending?: boolean;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    if (!isReady || !date || partySize < 1) return;
    startTransition(async () => {
      const result = await getReservationAvailabilityAction(
        locale,
        date,
        partySize,
      );
      if (!cancelled) setAvailability(result);
    });
    return () => {
      cancelled = true;
    };
  }, [date, isReady, locale, partySize]);

  const availabilityMessage =
    !isReady ? copy.disabled :
    isPending ? copy.loading :
    availability?.kind === "closed" ? copy.closed :
    availability?.kind === "out_of_range" ? copy.outOfRange :
    availability?.kind === "full" ? copy.full :
    availability?.kind === "error" ? copy.temporaryError :
    availability?.slots.length === 0 ? copy.noSlots : "";

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    formData.set("idempotencyKey", idempotencyKey);
    startTransition(async () => {
      const result = await createOnlineReservationAction(locale, formData);
      if (!result.success || !result.confirmation) {
        setError(result.error);
        return;
      }
      if (result.redirectUrl) {
        window.location.assign(result.redirectUrl);
        return;
      }
      setConfirmation({
        ...result.confirmation,
        paymentPending: result.paymentPending,
      });
      setIdempotencyKey(crypto.randomUUID());
    });
  };

  if (confirmation) {
    return (
      <section
        aria-live="polite"
        className="rounded-3xl border border-emerald-200 bg-white p-6 text-center shadow-sm"
      >
        <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
        <h1 className="font-display mt-4 text-3xl text-[#173f35]">
          {copy.success}
        </h1>
        <p className="mt-4 text-xs font-bold uppercase tracking-wider text-stone-500">
          {copy.locator}
        </p>
        <p data-testid="reservation-locator" className="mt-1 text-3xl font-black tracking-[0.18em] text-[#a8392f]">
          {confirmation.locator}
        </p>
        <dl className="mx-auto mt-5 grid max-w-sm grid-cols-2 gap-3 text-sm">
          <div><dt className="text-stone-400">{copy.date}</dt><dd className="font-bold">{confirmation.date}</dd></div>
          <div><dt className="text-stone-400">{copy.time}</dt><dd className="font-bold">{confirmation.time}</dd></div>
          <div><dt className="text-stone-400">{copy.partySize}</dt><dd className="font-bold">{confirmation.partySize}</dd></div>
          <div><dt className="sr-only">{confirmation.status === "confirmed" ? copy.confirmed : copy.pending}</dt><dd className="font-bold">{confirmation.status === "confirmed" ? copy.confirmed : copy.pending}</dd></div>
        </dl>
        {confirmation.paymentPending ? (
          <p className="mx-auto mt-5 max-w-md rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            {getOfflinePaymentNotice(locale)}
          </p>
        ) : null}
        <Link
          href={`/${locale}`}
          className="mt-6 inline-flex min-h-11 items-center rounded-full bg-[#173f35] px-5 text-sm font-bold text-white"
        >
          {copy.backToMenu}
        </Link>
      </section>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-5 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7"
    >
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a8392f]">
          {restaurantName}
        </p>
        <h1 className="font-display mt-1 text-4xl text-[#173f35]">
          {copy.title}
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          {settings.customerMessage || copy.intro}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-bold text-stone-700">
          {copy.date}
          <input name="date" type="date" min={minDate} max={maxDate} value={date} onChange={(event) => { setDate(event.target.value); setTime(""); }} required disabled={!isReady || isPending} className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 px-3" />
        </label>
        <label className="text-xs font-bold text-stone-700">
          {copy.partySize}
          <input name="partySize" type="number" min={1} max={settings.maximumPartySize} value={partySize} onChange={(event) => { setPartySize(Number(event.target.value)); setTime(""); }} required disabled={!isReady || isPending} className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 px-3" />
        </label>
      </div>

      <fieldset disabled={!isReady || isPending}>
        <legend className="text-xs font-bold text-stone-700">{copy.time}</legend>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {availability?.slots.map((slot) => (
            <label key={slot.time} className={`grid min-h-11 cursor-pointer place-items-center rounded-xl border text-sm font-bold ${time === slot.time ? "border-[#173f35] bg-[#173f35] text-white" : "border-stone-200"}`}>
              <input type="radio" name="time" value={slot.time} checked={time === slot.time} onChange={() => setTime(slot.time)} className="sr-only" />
              {slot.time}
            </label>
          ))}
        </div>
        <p aria-live="polite" className="mt-2 min-h-5 text-xs text-stone-500">
          {availabilityMessage}
        </p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-bold text-stone-700">{copy.name}<input name="guestName" required maxLength={160} className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 px-3" /></label>
        <label className="text-xs font-bold text-stone-700">{copy.phone}<input name="guestPhone" type="tel" required maxLength={40} className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 px-3" /></label>
        <label className="text-xs font-bold text-stone-700">{copy.email} · {copy.optional}<input name="guestEmail" type="email" maxLength={254} className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 px-3" /></label>
        <label className="text-xs font-bold text-stone-700">{copy.notes} · {copy.optional}<textarea name="customerNotes" maxLength={1000} rows={3} className="mt-2 w-full rounded-xl border border-stone-200 px-3 py-3" /></label>
      </div>

      {partySize > settings.maximumPartySize ? (
        <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
          {copy.largeGroup} {settings.largeGroupPhone || restaurantPhone}
        </p>
      ) : null}

      <label className="flex items-start gap-3 text-xs leading-5 text-stone-600">
        <input name="acceptPolicy" type="checkbox" value="true" required className="mt-1 size-4 accent-[#173f35]" />
        <span>{copy.acceptPolicy}. {settings.policyText}</span>
      </label>
      {depositTotal > 0 ? <section className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900"><p className="font-bold">Adelanto: {(settings.depositPerGuestCents/100).toFixed(2)} € por persona · Total {(depositTotal/100).toFixed(2)} €</p>{onlinePaymentsEnabled ? <><p className="mt-1">Métodos disponibles:</p><div className="flex gap-3">{paymentMethods.map(method=><label key={method} className="flex gap-2"><input name="paymentMethod" type="radio" value={method} required />{method}</label>)}</div></> : <p className="mt-2">{getOfflinePaymentNotice(locale)}</p>}<p className="mt-2">{settings.cancellationPolicy}</p><p>{settings.noShowPolicy}</p><p>{settings.gracePolicy}</p>{["acceptDeposit","acceptNoShow","acceptGrace"].map((name)=><label key={name} className="mt-2 flex gap-2"><input name={name} type="checkbox" value="true" required />Acepto estas condiciones</label>)}</section> : null}
      <div aria-live="assertive" className="min-h-5">
        {error ? <p role="alert" className="text-xs font-bold text-red-700">{error}</p> : null}
      </div>
      <button type="submit" disabled={!isReady || !time || isPending} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#173f35] font-bold text-white disabled:opacity-50">
        {isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}
        {copy.submit}
      </button>
    </form>
  );
}
