"use server";

import { redirect } from "next/navigation";

import { DUMMY_PASSWORD_HASH, verifyPasswordHash } from "./password";
import { findAdminByEmail } from "./repository";
import {
  createAdminSession,
  destroyAdminSession,
} from "./server-session";

export type LoginActionState = {
  error: string | null;
};

export const initialLoginState: LoginActionState = {
  error: null,
};

const INVALID_CREDENTIALS_MESSAGE = "Email o contraseña incorrectos.";
const LOGIN_SERVICE_ERROR =
  "No se ha podido iniciar sesión. Inténtalo de nuevo.";

function getSafeDestination(value: FormDataEntryValue | null) {
  if (
    typeof value === "string" &&
    value.startsWith("/admin") &&
    !value.startsWith("//")
  ) {
    return value;
  }

  return "/admin";
}

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const emailValue = formData.get("email");
  const passwordValue = formData.get("password");
  const email =
    typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
  const password = typeof passwordValue === "string" ? passwordValue : "";

  if (
    !email ||
    email.length > 320 ||
    !email.includes("@") ||
    !password ||
    password.length > 1_024
  ) {
    return { error: INVALID_CREDENTIALS_MESSAGE };
  }

  let admin;

  try {
    admin = await findAdminByEmail(email);
  } catch {
    return { error: LOGIN_SERVICE_ERROR };
  }

  const passwordIsValid = await verifyPasswordHash(
    admin?.passwordHash ?? DUMMY_PASSWORD_HASH,
    password,
  );

  if (!admin || !admin.isActive || !passwordIsValid) {
    return { error: INVALID_CREDENTIALS_MESSAGE };
  }

  try {
    await createAdminSession({
      adminId: admin.id,
      email: admin.email,
      fullName: admin.fullName,
    });
  } catch {
    return { error: LOGIN_SERVICE_ERROR };
  }

  redirect(getSafeDestination(formData.get("next")));
}

export async function logoutAction() {
  await destroyAdminSession();
  redirect("/login");
}
