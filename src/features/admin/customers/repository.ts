import "server-only";

import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import { getDatabase } from "@/db";
import {
  customerAddresses,
  customerNotes,
  customers,
  reservations,
  restaurantSettings,
} from "@/db/schema";
import type { CustomerInput } from "@/features/customers/domain";

async function getRestaurantId() {
  const { db } = getDatabase();
  const [restaurant] = await db
    .select({ id: restaurantSettings.id })
    .from(restaurantSettings)
    .limit(1);
  if (!restaurant) throw new Error("No existe un restaurante configurado.");
  return restaurant.id;
}

export async function getAdminCustomers(query = "") {
  const { db } = getDatabase();
  const restaurantId = await getRestaurantId();
  const conditions = [eq(customers.restaurantId, restaurantId)];
  if (query.trim()) {
    const pattern = `%${query.trim().slice(0, 160)}%`;
    const search = or(
      sql`${customers.firstName} || ' ' || ${customers.lastName} ilike ${pattern}`,
      ilike(customers.firstName, pattern),
      ilike(customers.lastName, pattern),
      ilike(customers.phone, pattern),
      ilike(customers.email, pattern),
    );
    if (search) conditions.push(search);
  }
  return db
    .select({
      id: customers.id,
      firstName: customers.firstName,
      lastName: customers.lastName,
      phone: customers.phone,
      email: customers.email,
      preferredLocale: customers.preferredLocale,
      isActive: customers.isActive,
      lastVisitAt: customers.lastVisitAt,
      totalSpendCents: customers.totalSpendCents,
      reservationCount: sql<number>`count(${reservations.id})::integer`,
      cancellationCount: sql<number>`count(${reservations.id}) filter (where ${reservations.status} = 'cancelled')::integer`,
      noShowCount: sql<number>`count(${reservations.id}) filter (where ${reservations.status} = 'no_show')::integer`,
      lastReservationDate: sql<string | null>`max(${reservations.reservationDate})`,
    })
    .from(customers)
    .leftJoin(reservations, eq(reservations.customerId, customers.id))
    .where(and(...conditions))
    .groupBy(customers.id)
    .orderBy(desc(customers.updatedAt))
    .limit(250);
}

export async function getAdminCustomerDetail(id: string) {
  const { db } = getDatabase();
  const restaurantId = await getRestaurantId();
  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, id), eq(customers.restaurantId, restaurantId)))
    .limit(1);
  if (!customer) return null;
  const [notes, addresses, history] = await Promise.all([
    db
      .select()
      .from(customerNotes)
      .where(eq(customerNotes.customerId, id))
      .orderBy(desc(customerNotes.createdAt)),
    db
      .select()
      .from(customerAddresses)
      .where(eq(customerAddresses.customerId, id))
      .orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.updatedAt)),
    db
      .select({
        id: reservations.id,
        locator: reservations.locator,
        date: reservations.reservationDate,
        time: reservations.reservationTime,
        partySize: reservations.partySize,
        status: reservations.status,
      })
      .from(reservations)
      .where(eq(reservations.customerId, id))
      .orderBy(desc(reservations.reservationDate), desc(reservations.reservationTime))
      .limit(50),
  ]);
  return { customer, notes, addresses, history };
}

export async function createCustomer(input: CustomerInput) {
  const { db } = getDatabase();
  const restaurantId = await getRestaurantId();
  const [created] = await db
    .insert(customers)
    .values({ restaurantId, ...input })
    .returning({ id: customers.id });
  if (!created) throw new Error("No se pudo crear el cliente.");
  return created.id;
}

export async function updateCustomer(id: string, input: CustomerInput) {
  const { db } = getDatabase();
  const restaurantId = await getRestaurantId();
  const [updated] = await db
    .update(customers)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(customers.id, id), eq(customers.restaurantId, restaurantId)))
    .returning({ id: customers.id });
  if (!updated) throw new Error("El cliente ya no existe.");
}

export async function setCustomerActive(id: string, isActive: boolean) {
  const { db } = getDatabase();
  const restaurantId = await getRestaurantId();
  const [updated] = await db
    .update(customers)
    .set({ isActive, updatedAt: new Date() })
    .where(and(eq(customers.id, id), eq(customers.restaurantId, restaurantId)))
    .returning({ id: customers.id });
  if (!updated) throw new Error("El cliente ya no existe.");
}

export async function addCustomerNote(
  customerId: string,
  adminId: string,
  body: string,
) {
  const { db } = getDatabase();
  const restaurantId = await getRestaurantId();
  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(
      and(
        eq(customers.id, customerId),
        eq(customers.restaurantId, restaurantId),
      ),
    )
    .limit(1);
  if (!customer) throw new Error("El cliente ya no existe.");
  await db.insert(customerNotes).values({ customerId, adminId, body });
}

export async function saveCustomerAddress(
  customerId: string,
  input: {
    label: string;
    line1: string;
    line2: string | null;
    city: string;
    postalCode: string;
    province: string;
    countryCode: string;
    isDefault: boolean;
  },
) {
  const { db } = getDatabase();
  await db.transaction(async (tx) => {
    const [customer] = await tx
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);
    if (!customer) throw new Error("El cliente ya no existe.");
    if (input.isDefault) {
      await tx
        .update(customerAddresses)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(customerAddresses.customerId, customerId));
    }
    await tx.insert(customerAddresses).values({ customerId, ...input });
  });
}

export async function deleteCustomerAddress(customerId: string, id: string) {
  const { db } = getDatabase();
  await db
    .delete(customerAddresses)
    .where(
      and(
        eq(customerAddresses.id, id),
        eq(customerAddresses.customerId, customerId),
      ),
    );
}
