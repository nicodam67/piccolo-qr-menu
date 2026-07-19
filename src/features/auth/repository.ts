import "server-only";

import { eq } from "drizzle-orm";

import { getDatabase } from "@/db";
import { admins } from "@/db/schema";

export type AdminAccount = {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  isActive: boolean;
  sessionVersion: number;
};

export async function findAdminByEmail(
  normalizedEmail: string,
): Promise<AdminAccount | null> {
  const { db } = getDatabase();
  const [admin] = await db
    .select({
      id: admins.id,
      email: admins.email,
      passwordHash: admins.passwordHash,
      fullName: admins.fullName,
      isActive: admins.isActive,
      sessionVersion: admins.sessionVersion,
    })
    .from(admins)
    .where(eq(admins.email, normalizedEmail))
    .limit(1);

  return admin ?? null;
}

export async function findAdminSessionStateById(adminId: string) {
  const { db } = getDatabase();
  const [admin] = await db
    .select({
      id: admins.id,
      email: admins.email,
      fullName: admins.fullName,
      isActive: admins.isActive,
      sessionVersion: admins.sessionVersion,
    })
    .from(admins)
    .where(eq(admins.id, adminId))
    .limit(1);

  return admin ?? null;
}
