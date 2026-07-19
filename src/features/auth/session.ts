import { jwtVerify, SignJWT } from "jose";

export const ADMIN_SESSION_COOKIE = "piccolo_admin_session";

const SESSION_ISSUER = "piccolo-qr-menu";
const SESSION_AUDIENCE = "piccolo-admin";
const DEFAULT_SESSION_TTL_SECONDS = 8 * 60 * 60;

export type AdminSession = {
  adminId: string;
  email: string;
  fullName: string;
  expiresAt: number;
};

type SessionIdentity = Omit<AdminSession, "expiresAt">;

function getAuthSecret() {
  const authSecret = process.env.AUTH_SECRET;

  if (!authSecret || authSecret.length < 32) {
    throw new Error("AUTH_SECRET debe contener al menos 32 caracteres.");
  }

  return new TextEncoder().encode(authSecret);
}

export function getSessionTtlSeconds() {
  const configuredTtl = process.env.AUTH_SESSION_TTL_SECONDS;

  if (!configuredTtl) {
    return DEFAULT_SESSION_TTL_SECONDS;
  }

  const ttl = Number(configuredTtl);

  if (!Number.isInteger(ttl) || ttl < 300 || ttl > 7 * 24 * 60 * 60) {
    throw new Error(
      "AUTH_SESSION_TTL_SECONDS debe ser un entero entre 300 y 604800.",
    );
  }

  return ttl;
}

export async function createAdminSessionToken(
  identity: SessionIdentity,
): Promise<string> {
  const ttl = getSessionTtlSeconds();

  return new SignJWT({
    email: identity.email,
    fullName: identity.fullName,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(identity.adminId)
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(getAuthSecret());
}

export async function verifyAdminSessionToken(
  token: string,
): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecret(), {
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
      algorithms: ["HS256"],
    });

    if (
      !payload.sub ||
      typeof payload.email !== "string" ||
      typeof payload.fullName !== "string" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }

    return {
      adminId: payload.sub,
      email: payload.email,
      fullName: payload.fullName,
      expiresAt: payload.exp,
    };
  } catch {
    return null;
  }
}
