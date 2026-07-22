import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { getDatabase } from "@/db";
import {
  customerAddresses,
  customerNotes,
  customerTagAssignments,
  customers,
  reservations,
  restaurantSettings,
} from "@/db/schema";
import type { CustomerInput } from "@/features/customers/domain";
import type { CustomerFilters } from "@/features/customer-segments/config";
import { buildCustomerFilterConditions } from "@/features/customer-segments/repository";

export async function getCustomerRestaurantId() {
  const { db } = getDatabase();
  const [restaurant] = await db
    .select({ id: restaurantSettings.id })
    .from(restaurantSettings)
    .limit(1);
  if (!restaurant) throw new Error("No existe un restaurante configurado.");
  return restaurant.id;
}

export async function getAdminCustomers(
  filters: CustomerFilters = {},
  page = 1,
) {
  const { db } = getDatabase();
  const restaurantId = await getCustomerRestaurantId();
  const conditions = [
    eq(customers.restaurantId, restaurantId),
    ...buildCustomerFilterConditions(filters),
  ];
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
      pointsBalance: sql<number>`coalesce((select balance from customer_loyalty_accounts cla where cla.customer_id = ${customers.id}), 0)::integer`,
      tagNames: sql<string>`coalesce((select string_agg(ct.name, ', ' order by ct.sort_order) from customer_tag_assignments cta inner join customer_tags ct on ct.id = cta.tag_id where cta.customer_id = ${customers.id}), '')`,
      emailConsent: sql<string | null>`(select cc.status from customer_consents cc where cc.customer_id = ${customers.id} and cc.consent_type = 'marketing_email' order by cc.created_at desc limit 1)`,
      phoneConsent: sql<string | null>`(select cc.status from customer_consents cc where cc.customer_id = ${customers.id} and cc.consent_type = 'marketing_phone' order by cc.created_at desc limit 1)`,
    })
    .from(customers)
    .leftJoin(reservations, eq(reservations.customerId, customers.id))
    .where(and(...conditions))
    .groupBy(customers.id)
    .orderBy(desc(customers.updatedAt))
    .limit(50)
    .offset((Math.max(1, page) - 1) * 50);
}

export async function getAdminCustomerDetail(id: string) {
  const { db } = getDatabase();
  const restaurantId = await getCustomerRestaurantId();
  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, id), eq(customers.restaurantId, restaurantId)))
    .limit(1);
  if (!customer) return null;
  const [notes, addresses, history, assignedTags] = await Promise.all([
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
    db
      .select({ tagId: customerTagAssignments.tagId })
      .from(customerTagAssignments)
      .where(eq(customerTagAssignments.customerId, id)),
  ]);
  return {
    customer,
    notes,
    addresses,
    history,
    assignedTagIds: assignedTags.map(({ tagId }) => tagId),
  };
}

export async function createCustomer(input: CustomerInput) {
  const { db } = getDatabase();
  const restaurantId = await getCustomerRestaurantId();
  const [created] = await db
    .insert(customers)
    .values({ restaurantId, ...input })
    .returning({ id: customers.id });
  if (!created) throw new Error("No se pudo crear el cliente.");
  return created.id;
}

export async function updateCustomer(id: string, input: CustomerInput) {
  const { db } = getDatabase();
  const restaurantId = await getCustomerRestaurantId();
  const [updated] = await db
    .update(customers)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(customers.id, id), eq(customers.restaurantId, restaurantId)))
    .returning({ id: customers.id });
  if (!updated) throw new Error("El cliente ya no existe.");
}

export async function setCustomerActive(id: string, isActive: boolean) {
  const { db } = getDatabase();
  const restaurantId = await getCustomerRestaurantId();
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
  const restaurantId = await getCustomerRestaurantId();
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
