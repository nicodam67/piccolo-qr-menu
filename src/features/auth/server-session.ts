import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  getSessionTtlSeconds,
  type AdminSession,
  verifyAdminSessionToken,
} from "./session";

type AdminIdentity = Pick<AdminSession, "adminId" | "email" | "fullName">;

function getCookieSecurityOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

export async function createAdminSession(identity: AdminIdentity) {
  const token = await createAdminSessionToken(identity);
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    ...getCookieSecurityOptions(),
    maxAge: getSessionTtlSeconds(),
  });
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  return verifyAdminSessionToken(token);
}

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getAdminSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function destroyAdminSession() {
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_SESSION_COOKIE, "", {
    ...getCookieSecurityOptions(),
    expires: new Date(0),
    maxAge: 0,
  });
}
