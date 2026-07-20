"use server";

import { isSupportedLocale } from "@/config/locales";
import {
  normalizeEmail,
  normalizeGuestName,
  normalizeOptionalText,
  normalizePhone,
  isValidReservationIdempotencyKey,
  type ReservationStatus,
} from "./domain";
import {
  createOnlineReservation,
  getReservationAvailability,
} from "./repository";
import { startOnlinePayment } from "./payments/service";

export type AvailabilityActionResult = {
  success: boolean;
  kind:
    | "available"
    | "disabled"
    | "out_of_range"
    | "closed"
    | "full"
    | "invalid_party"
    | "unavailable"
    | "error";
  slots: Array<{ time: string; remaining: number }>;
  error: string | null;
};

export async function getReservationAvailabilityAction(
  locale: string,
  date: string,
  partySize: number,
): Promise<AvailabilityActionResult> {
  if (
    !isSupportedLocale(locale) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isInteger(partySize)
  ) {
    return { success: false, kind: "error", slots: [], error: "Datos no válidos." };
  }
  try {
    const result = await getReservationAvailability(locale, date, partySize);
    return {
      success: result.kind === "available",
      kind: result.kind,
      slots: result.slots.map(({ time, remaining }) => ({ time, remaining })),
      error: null,
    };
  } catch {
    return {
      success: false,
      kind: "error",
      slots: [],
      error: "No se pudo consultar la disponibilidad.",
    };
  }
}

export type CreateReservationActionResult = {
  success: boolean;
  error: string | null;
  confirmation?: {
    locator: string;
    date: string;
    time: string;
    partySize: number;
    status: ReservationStatus;
  };
  redirectUrl?: string;
};

export async function createOnlineReservationAction(
  locale: string,
  formData: FormData,
): Promise<CreateReservationActionResult> {
  try {
    if (!isSupportedLocale(locale)) throw new Error("Idioma no válido.");
    const date = String(formData.get("date") ?? "");
    const time = String(formData.get("time") ?? "");
    const partySize = Number(formData.get("partySize"));
    const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error("La fecha no es válida.");
    }
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      throw new Error("Selecciona una hora disponible.");
    }
    if (!Number.isInteger(partySize) || partySize < 1 || partySize > 100) {
      throw new Error("El número de personas no es válido.");
    }
    if (!isValidReservationIdempotencyKey(idempotencyKey)) {
      throw new Error("La solicitud no es válida.");
    }
    if (formData.get("acceptPolicy") !== "true") {
      throw new Error("Debes aceptar la política de reserva.");
    }
    const created = await createOnlineReservation({
      locale,
      date,
      time,
      partySize,
      guestName: normalizeGuestName(String(formData.get("guestName") ?? "")),
      guestPhone: normalizePhone(String(formData.get("guestPhone") ?? "")),
      guestEmail: normalizeEmail(String(formData.get("guestEmail") ?? "")),
      customerNotes: normalizeOptionalText(
        String(formData.get("customerNotes") ?? ""),
        1000,
      ),
      idempotencyKey,
      acceptedDepositTerms:
        formData.get("acceptDeposit") === "true" &&
        formData.get("acceptNoShow") === "true" &&
        formData.get("acceptGrace") === "true",
    });
    const paymentMethod=String(formData.get("paymentMethod") ?? "");
    let redirectUrl:string|undefined;
    if(created.depositRequired) {
      if(paymentMethod!=="card"&&paymentMethod!=="bizum") throw new Error("Selecciona un método de pago online.");
      redirectUrl=await startOnlinePayment(created.id,paymentMethod);
    }
    return {
      success: true,
      error: null,
      confirmation: {
        ...created,
        time: created.time.slice(0, 5),
        status: created.status as ReservationStatus,
      },
      redirectUrl,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo completar la reserva.",
    };
  }
}
