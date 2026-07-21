import { isSupportedLocale } from "@/config/locales";
import {
  normalizeEmail,
  normalizeGuestName,
  normalizeOptionalText,
  normalizePhone,
} from "@/features/reservations/domain";

export type CustomerInput = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  birthDate: string | null;
  preferredLocale: string;
  observations: string | null;
  importantAllergies: string | null;
  isActive: boolean;
};

export function splitCustomerName(fullName: string) {
  const normalized = normalizeGuestName(fullName);
  const [firstName, ...lastNames] = normalized.split(" ");
  return {
    firstName: firstName.slice(0, 100),
    lastName: lastNames.join(" ").slice(0, 160),
  };
}

export function normalizeCustomerInput(input: {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  birthDate: string;
  preferredLocale: string;
  observations: string;
  importantAllergies: string;
  isActive: boolean;
}): CustomerInput {
  const firstName = normalizeGuestName(input.firstName);
  const lastName = input.lastName.trim().replace(/\s+/g, " ");
  if (firstName.length > 100 || lastName.length > 160 || /[<>\u0000-\u001f]/.test(lastName)) {
    throw new Error("El nombre o los apellidos no son válidos.");
  }
  if (!isSupportedLocale(input.preferredLocale)) {
    throw new Error("El idioma preferido no es válido.");
  }
  const birthDate = input.birthDate.trim();
  if (
    birthDate &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ||
      new Date(`${birthDate}T00:00:00Z`).toISOString().slice(0, 10) !==
        birthDate)
  ) {
    throw new Error("La fecha de nacimiento no es válida.");
  }
  return {
    firstName,
    lastName,
    phone: normalizePhone(input.phone),
    email: normalizeEmail(input.email),
    birthDate: birthDate || null,
    preferredLocale: input.preferredLocale,
    observations: normalizeOptionalText(input.observations, 2000),
    importantAllergies: normalizeOptionalText(input.importantAllergies, 1000),
    isActive: input.isActive,
  };
}

export function normalizeCustomerNote(value: string) {
  const note = normalizeOptionalText(value, 2000);
  if (!note) throw new Error("La nota no puede estar vacía.");
  return note;
}
