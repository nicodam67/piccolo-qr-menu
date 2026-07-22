import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { getDatabase } from "@/db";
import { customers } from "@/db/schema";
import { splitCustomerName } from "./domain";

export type CustomerTransaction = Parameters<
  Parameters<ReturnType<typeof getDatabase>["db"]["transaction"]>[0]
>[0];

export async function resolveCustomerForReservation(
  tx: CustomerTransaction,
  input: {
    restaurantId: string;
    guestName: string;
    guestPhone: string;
    guestEmail: string | null;
    locale: string;
  },
) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`customer:${input.restaurantId}:${input.guestPhone}`}))`,
  );
  const [byPhone] = await tx
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.restaurantId, input.restaurantId),
        eq(customers.phone, input.guestPhone),
      ),
    )
    .for("update")
    .limit(1);
  const [byEmail] =
    !byPhone && input.guestEmail
      ? await tx
          .select()
          .from(customers)
          .where(
            and(
              eq(customers.restaurantId, input.restaurantId),
              eq(sql`lower(${customers.email})`, input.guestEmail),
            ),
          )
          .for("update")
          .limit(1)
      : [undefined];
  const existing = byPhone ?? byEmail;
  const names = splitCustomerName(input.guestName);
  if (existing) {
    await tx
      .update(customers)
      .set({
        firstName: names.firstName,
        lastName: names.lastName || existing.lastName,
        email: existing.email ?? input.guestEmail,
        preferredLocale: input.locale,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, existing.id));
    return existing.id;
  }
  const [created] = await tx
    .insert(customers)
    .values({
      restaurantId: input.restaurantId,
      firstName: names.firstName,
      lastName: names.lastName,
      phone: input.guestPhone,
      email: input.guestEmail,
      preferredLocale: input.locale,
    })
    .returning({ id: customers.id });
  if (!created) throw new Error("No se pudo crear el cliente.");
  return created.id;
}
