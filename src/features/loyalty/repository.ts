import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { getDatabase } from "@/db";
import {
  customerLoyaltyAccounts,
  customerLoyaltyMovements,
  customers,
} from "@/db/schema";
import {
  applyLoyaltyMovement,
  normalizeLoyaltyReason,
  type LoyaltyMovementType,
} from "./domain";

export async function getCustomerLoyalty(customerId: string) {
  const { db } = getDatabase();
  const [account, movements] = await Promise.all([
    db
      .select()
      .from(customerLoyaltyAccounts)
      .where(eq(customerLoyaltyAccounts.customerId, customerId))
      .limit(1),
    db
      .select()
      .from(customerLoyaltyMovements)
      .where(eq(customerLoyaltyMovements.customerId, customerId))
      .orderBy(desc(customerLoyaltyMovements.createdAt))
      .limit(200),
  ]);
  return {
    account: account[0] ?? {
      customerId,
      balance: 0,
      totalEarned: 0,
      totalRedeemed: 0,
      totalExpired: 0,
      lastMovementAt: null,
    },
    movements,
  };
}

export async function applyCustomerLoyaltyMovement(input: {
  restaurantId: string;
  customerId: string;
  amount: number;
  movementType: LoyaltyMovementType;
  reason: string;
  adminId?: string | null;
  externalReference?: string | null;
  idempotencyKey?: string | null;
}) {
  const { db } = getDatabase();
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`loyalty:${input.restaurantId}:${input.customerId}`}))`,
    );
    if (input.idempotencyKey) {
      const [existing] = await tx
        .select()
        .from(customerLoyaltyMovements)
        .where(
          and(
            eq(customerLoyaltyMovements.restaurantId, input.restaurantId),
            eq(
              customerLoyaltyMovements.idempotencyKey,
              input.idempotencyKey,
            ),
          ),
        )
        .limit(1);
      if (existing) return existing;
    }
    const [customer] = await tx
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(
          eq(customers.id, input.customerId),
          eq(customers.restaurantId, input.restaurantId),
        ),
      )
      .limit(1);
    if (!customer) throw new Error("El cliente ya no existe.");
    await tx
      .insert(customerLoyaltyAccounts)
      .values({
        customerId: input.customerId,
        restaurantId: input.restaurantId,
      })
      .onConflictDoNothing();
    const [account] = await tx
      .select()
      .from(customerLoyaltyAccounts)
      .where(eq(customerLoyaltyAccounts.customerId, input.customerId))
      .for("update")
      .limit(1);
    if (!account) throw new Error("No se pudo cargar la cuenta de puntos.");
    const next = applyLoyaltyMovement(
      {
        balance: account.balance,
        totalEarned: account.totalEarned,
        totalRedeemed: account.totalRedeemed,
        totalExpired: account.totalExpired,
      },
      input.amount,
      input.movementType,
    );
    const now = new Date();
    const [movement] = await tx
      .insert(customerLoyaltyMovements)
      .values({
        restaurantId: input.restaurantId,
        customerId: input.customerId,
        amount: input.amount,
        movementType: input.movementType,
        reason: normalizeLoyaltyReason(input.reason),
        adminId: input.adminId ?? null,
        externalReference: input.externalReference ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
      })
      .returning();
    await tx
      .update(customerLoyaltyAccounts)
      .set({ ...next, lastMovementAt: now, updatedAt: now })
      .where(eq(customerLoyaltyAccounts.customerId, input.customerId));
    return movement;
  });
}
