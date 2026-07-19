import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";

import { getDatabase } from "@/db";
import { adminLoginAttempts } from "@/db/schema";

const MAX_FAILED_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1_000;

export async function getClientIpAddress() {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  const candidate =
    forwardedFor?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip")?.trim() ||
    "unknown";

  return candidate.slice(0, 64);
}

export async function isLoginBlocked(email: string, ipAddress: string) {
  const { db } = getDatabase();
  const [attempt] = await db
    .select({ blockedUntil: adminLoginAttempts.blockedUntil })
    .from(adminLoginAttempts)
    .where(
      and(
        eq(adminLoginAttempts.emailNormalized, email),
        eq(adminLoginAttempts.ipAddress, ipAddress),
      ),
    )
    .limit(1);

  return Boolean(
    attempt?.blockedUntil && attempt.blockedUntil.getTime() > Date.now(),
  );
}

export async function registerFailedLoginAttempt(
  email: string,
  ipAddress: string,
) {
  const { db } = getDatabase();
  const now = new Date();
  const windowThreshold = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);
  const blockedUntil = new Date(now.getTime() + RATE_LIMIT_WINDOW_MS);

  await db
    .insert(adminLoginAttempts)
    .values({
      emailNormalized: email,
      ipAddress,
      failedAttempts: 1,
      windowStartedAt: now,
      blockedUntil: null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        adminLoginAttempts.emailNormalized,
        adminLoginAttempts.ipAddress,
      ],
      set: {
        failedAttempts: sql<number>`
          case
            when ${adminLoginAttempts.windowStartedAt} <= ${windowThreshold}
              then 1
            else ${adminLoginAttempts.failedAttempts} + 1
          end
        `,
        windowStartedAt: sql<Date>`
          case
            when ${adminLoginAttempts.windowStartedAt} <= ${windowThreshold}
              then ${now}
            else ${adminLoginAttempts.windowStartedAt}
          end
        `,
        blockedUntil: sql<Date | null>`
          case
            when ${adminLoginAttempts.windowStartedAt} <= ${windowThreshold}
              then null
            when ${adminLoginAttempts.failedAttempts} + 1 >= ${MAX_FAILED_ATTEMPTS}
              then ${blockedUntil}
            else ${adminLoginAttempts.blockedUntil}
          end
        `,
        updatedAt: now,
      },
    });
}

export async function clearLoginAttempts(email: string, ipAddress: string) {
  const { db } = getDatabase();

  await db
    .delete(adminLoginAttempts)
    .where(
      and(
        eq(adminLoginAttempts.emailNormalized, email),
        eq(adminLoginAttempts.ipAddress, ipAddress),
      ),
    );
}
