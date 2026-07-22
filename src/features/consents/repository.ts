import "server-only";

import { desc, eq } from "drizzle-orm";

import { getDatabase } from "@/db";
import { customerConsents } from "@/db/schema";
import type { ConsentStatus, ConsentType } from "./domain";

export async function getCustomerConsents(customerId: string) {
  const { db } = getDatabase();
  const history = await db
    .select()
    .from(customerConsents)
    .where(eq(customerConsents.customerId, customerId))
    .orderBy(desc(customerConsents.createdAt));
  const current = new Map<ConsentType, (typeof history)[number]>();
  for (const item of history) {
    const type = item.consentType as ConsentType;
    if (!current.has(type)) current.set(type, item);
  }
  return { current: Object.fromEntries(current), history };
}

export async function recordCustomerConsent(input: {
  restaurantId: string;
  customerId: string;
  consentType: ConsentType;
  status: ConsentStatus;
  origin: string;
  legalVersion: string;
  adminId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const { db } = getDatabase();
  await db.insert(customerConsents).values({
    restaurantId: input.restaurantId,
    customerId: input.customerId,
    consentType: input.consentType,
    status: input.status,
    origin: input.origin.slice(0, 40),
    legalVersion: input.legalVersion.slice(0, 80),
    adminId: input.adminId ?? null,
    ipAddress: input.ipAddress?.slice(0, 45) ?? null,
    userAgent: input.userAgent?.slice(0, 500) ?? null,
  });
}
