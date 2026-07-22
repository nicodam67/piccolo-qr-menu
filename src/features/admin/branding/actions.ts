"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/features/auth/server-session";

import {
  BrandingValidationError,
  updateRestaurantBranding,
  type BrandingOpeningDay,
  type RestaurantBrandingInput,
} from "./repository";

export type BrandingActionResult = {
  success: boolean;
  error: string | null;
};

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function requiredString(
  formData: FormData,
  field: string,
  label: string,
  maxLength?: number,
) {
  const value = formData.get(field);

  if (typeof value !== "string" || !value.trim()) {
    throw new BrandingValidationError(`${label} es obligatorio.`);
  }

  if (value !== value.trim()) {
    throw new BrandingValidationError(
      `${label} no puede empezar ni terminar con espacios.`,
    );
  }

  if (maxLength && value.length > maxLength) {
    throw new BrandingValidationError(
      `${label} no puede superar ${maxLength} caracteres.`,
    );
  }

  return value;
}

function optionalString(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function validateOpeningHours(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    throw new BrandingValidationError("El horario no es válido.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new BrandingValidationError("El horario no es válido.");
  }

  if (!Array.isArray(parsed) || parsed.length !== 7) {
    throw new BrandingValidationError(
      "El horario debe contener exactamente siete días.",
    );
  }

  const days = parsed as BrandingOpeningDay[];
  const uniqueDays = new Set(days.map(({ dayOfWeek }) => dayOfWeek));

  if (
    uniqueDays.size !== 7 ||
    days.some(
      ({ dayOfWeek }) =>
        !Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7,
    )
  ) {
    throw new BrandingValidationError("Los días del horario no son válidos.");
  }

  return days
    .sort((left, right) => left.dayOfWeek - right.dayOfWeek)
    .map((day) => {
      if (day.isClosed) {
        return {
          ...day,
          firstOpensAt: "",
          firstClosesAt: "",
          secondOpensAt: "",
          secondClosesAt: "",
        };
      }

      if (
        !timePattern.test(day.firstOpensAt) ||
        !timePattern.test(day.firstClosesAt) ||
        day.firstOpensAt === day.firstClosesAt
      ) {
        throw new BrandingValidationError(
          `${day.label}: el primer turno no es válido.`,
        );
      }

      const hasSecondOpening = Boolean(day.secondOpensAt);
      const hasSecondClosing = Boolean(day.secondClosesAt);

      if (hasSecondOpening !== hasSecondClosing) {
        throw new BrandingValidationError(
          `${day.label}: completa ambos campos del segundo turno.`,
        );
      }

      if (hasSecondOpening) {
        if (
          !timePattern.test(day.secondOpensAt) ||
          !timePattern.test(day.secondClosesAt) ||
          day.secondOpensAt === day.secondClosesAt
        ) {
          throw new BrandingValidationError(
            `${day.label}: el segundo turno no es válido.`,
          );
        }

        const firstOpen = timeToMinutes(day.firstOpensAt);
        const firstClose = timeToMinutes(day.firstClosesAt);
        const secondOpen = timeToMinutes(day.secondOpensAt);

        if (firstClose <= firstOpen || secondOpen < firstClose) {
          throw new BrandingValidationError(
            `${day.label}: los turnos se solapan o no están ordenados.`,
          );
        }
      }

      return day;
    });
}

function parseBrandingForm(formData: FormData): RestaurantBrandingInput {
  const locale = requiredString(formData, "locale", "El idioma", 10);
  const defaultLocale = requiredString(
    formData,
    "defaultLocale",
    "El idioma predeterminado",
    10,
  );
  const timezone = requiredString(
    formData,
    "timezone",
    "La zona horaria",
    64,
  );
  const currencyCode = requiredString(
    formData,
    "currencyCode",
    "La moneda",
    3,
  ).toUpperCase();
  const heroImageUrl = requiredString(
    formData,
    "heroImageUrl",
    "La imagen principal",
  );

  try {
    new Intl.DateTimeFormat("es-ES", { timeZone: timezone }).format();
  } catch {
    throw new BrandingValidationError("La zona horaria no es válida.");
  }

  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    throw new BrandingValidationError(
      "La moneda debe usar un código ISO de tres letras.",
    );
  }

  try {
    new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: currencyCode,
    }).format(0);
  } catch {
    throw new BrandingValidationError("El código de moneda no es válido.");
  }

  try {
    const parsedImageUrl = new URL(heroImageUrl);

    if (
      parsedImageUrl.protocol !== "https:" &&
      parsedImageUrl.protocol !== "http:"
    ) {
      throw new Error("Unsupported protocol");
    }
  } catch {
    throw new BrandingValidationError(
      "La imagen principal debe ser una URL HTTP o HTTPS.",
    );
  }

  return {
    locale,
    defaultLocale,
    timezone,
    currencyCode,
    heroImageUrl,
    name: requiredString(formData, "name", "El nombre", 160),
    slogan: requiredString(formData, "slogan", "El eslogan", 240),
    description: optionalString(formData, "description"),
    phone: requiredString(formData, "phone", "El teléfono", 40),
    address: requiredString(formData, "address", "La dirección"),
    openingHours: validateOpeningHours(formData.get("openingHours")),
  };
}

function getActionError(error: unknown) {
  if (error instanceof BrandingValidationError) {
    return error.message;
  }

  return "No se han podido guardar los cambios. Inténtalo de nuevo.";
}

export async function updateBrandingAction(
  formData: FormData,
): Promise<BrandingActionResult> {
  await requireAdminSession();

  try {
    await updateRestaurantBranding(parseBrandingForm(formData));
    revalidatePath("/admin");
    revalidatePath("/admin/branding");
    revalidatePath("/login");
    revalidatePath("/es");
    return { success: true, error: null };
  } catch (error: unknown) {
    return { success: false, error: getActionError(error) };
  }
}
