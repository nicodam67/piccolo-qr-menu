import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  getAdminCookieSecurityOptions,
  getSessionTtlSeconds,
  type AdminSession,
  verifyAdminSessionToken,
} from "./session";
import { findAdminSessionStateById } from "./repository";

type AdminIdentity = Pick<
  AdminSession,
  "adminId" | "email" | "fullName" | "sessionVersion"
>;

export async function createAdminSession(identity: AdminIdentity) {
  const token = await createAdminSessionToken(identity);
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    ...getAdminCookieSecurityOptions(),
    maxAge: getSessionTtlSeconds(),
  });
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const tokenSession = await verifyAdminSessionToken(token);

  if (!tokenSession) {
    return null;
  }

  try {
    const admin = await findAdminSessionStateById(tokenSession.adminId);

    if (
      !admin ||
      !admin.isActive ||
      admin.sessionVersion !== tokenSession.sessionVersion
    ) {
      return null;
    }

    return {
      ...tokenSession,
      email: admin.email,
      fullName: admin.fullName,
    };
  } catch {
    return null;
  }
}

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getAdminSession();

  if (!session) {
    redirect("/auth/clear-session");
  }

  return session;
}

export async function destroyAdminSession() {
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_SESSION_COOKIE, "", {
    ...getAdminCookieSecurityOptions(),
    expires: new Date(0),
    maxAge: 0,
  });
}
