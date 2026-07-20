"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/features/auth/server-session";
import {
  createSpecialHours,
  deleteSpecialHours,
  updateSpecialHours,
  type SpecialHoursInput,
} from "./repository";

export type SpecialHoursActionResult = {
  success: boolean;
  error: string | null;
};

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const timeToMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

function parseForm(formData: FormData): SpecialHoursInput {
  const date = String(formData.get("date") ?? "");
  const isClosed = formData.get("isClosed") === "true";
  const reason = String(formData.get("reason") ?? "").trim();
  const firstOpensAt = String(formData.get("firstOpensAt") ?? "");
  const firstClosesAt = String(formData.get("firstClosesAt") ?? "");
  const secondOpensAt = String(formData.get("secondOpensAt") ?? "");
  const secondClosesAt = String(formData.get("secondClosesAt") ?? "");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("La fecha no es válida.");
  }
  const parsedDate = new Date(`${date}T00:00:00Z`);
  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== date
  ) {
    throw new Error("La fecha no es válida.");
  }
  if (reason.length > 240 || /[<>]/.test(reason)) {
    throw new Error("El motivo no es válido o supera 240 caracteres.");
  }

  if (!isClosed) {
    if (
      !timePattern.test(firstOpensAt) ||
      !timePattern.test(firstClosesAt) ||
      firstOpensAt === firstClosesAt
    ) {
      throw new Error("El primer turno debe estar completo y ser válido.");
    }
    const hasSecondOpen = Boolean(secondOpensAt);
    const hasSecondClose = Boolean(secondClosesAt);
    if (hasSecondOpen !== hasSecondClose) {
      throw new Error(
        "El segundo turno debe estar completo o completamente vacío.",
      );
    }
    if (hasSecondOpen) {
      if (
        !timePattern.test(secondOpensAt) ||
        !timePattern.test(secondClosesAt) ||
        secondOpensAt === secondClosesAt
      ) {
        throw new Error("El segundo turno no es válido.");
      }
      if (
        timeToMinutes(firstClosesAt) <= timeToMinutes(firstOpensAt) ||
        timeToMinutes(secondOpensAt) < timeToMinutes(firstClosesAt)
      ) {
        throw new Error("Los turnos se solapan o no están ordenados.");
      }
    }
  }

  return {
    date,
    isClosed,
    reason,
    firstOpensAt: isClosed ? "" : firstOpensAt,
    firstClosesAt: isClosed ? "" : firstClosesAt,
    secondOpensAt: isClosed ? "" : secondOpensAt,
    secondClosesAt: isClosed ? "" : secondClosesAt,
  };
}

function revalidate() {
  revalidatePath("/admin/special-hours");
  revalidatePath("/", "layout");
}

export async function createSpecialHoursAction(
  formData: FormData,
): Promise<SpecialHoursActionResult> {
  await requireAdminSession();
  try {
    await createSpecialHours(parseForm(formData));
    revalidate();
    return { success: true, error: null };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "No se pudo guardar.",
    };
  }
}

export async function updateSpecialHoursAction(
  id: string,
  formData: FormData,
): Promise<SpecialHoursActionResult> {
  await requireAdminSession();
  try {
    await updateSpecialHours(id, parseForm(formData));
    revalidate();
    return { success: true, error: null };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "No se pudo guardar.",
    };
  }
}

export async function deleteSpecialHoursAction(
  id: string,
): Promise<SpecialHoursActionResult> {
  await requireAdminSession();
  try {
    await deleteSpecialHours(id);
    revalidate();
    return { success: true, error: null };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "No se pudo eliminar.",
    };
  }
}
