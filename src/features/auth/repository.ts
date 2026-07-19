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
    })
    .from(admins)
    .where(eq(admins.email, normalizedEmail))
    .limit(1);

  return admin ?? null;
}
