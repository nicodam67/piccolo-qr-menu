import "server-only";

import { asc, eq, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import {
  customerTagAssignments,
  customerTags,
  restaurantSettings,
} from "@/db/schema";

async function restaurantId() {
  const { db } = getDatabase();
  const [row] = await db.select({ id: restaurantSettings.id }).from(restaurantSettings).limit(1);
  if (!row) throw new Error("No existe un restaurante configurado.");
  return row.id;
}

export async function getCustomerTags() {
  const { db } = getDatabase();
  const id = await restaurantId();
  return db
    .select({
      id: customerTags.id,
      name: customerTags.name,
      color: customerTags.color,
      isActive: customerTags.isActive,
      sortOrder: customerTags.sortOrder,
      assignmentCount: sql<number>`count(${customerTagAssignments.customerId})::integer`,
    })
    .from(customerTags)
    .leftJoin(
      customerTagAssignments,
      eq(customerTagAssignments.tagId, customerTags.id),
    )
    .where(eq(customerTags.restaurantId, id))
    .groupBy(customerTags.id)
    .orderBy(asc(customerTags.sortOrder), asc(customerTags.name));
}

export async function createCustomerTag(input: {
  name: string;
  color: string;
  sortOrder: number;
}) {
  const { db } = getDatabase();
  await db.insert(customerTags).values({
    restaurantId: await restaurantId(),
    ...input,
  });
}

export async function updateCustomerTag(
  id: string,
  input: {
    name: string;
    color: string;
    sortOrder: number;
    isActive: boolean;
  },
) {
  const { db } = getDatabase();
  await db
    .update(customerTags)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(customerTags.id, id));
}

export async function setCustomerTagActive(id: string, isActive: boolean) {
  const { db } = getDatabase();
  await db
    .update(customerTags)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(customerTags.id, id));
}

export async function assignCustomerTag(customerId: string, tagId: string) {
  const { db } = getDatabase();
  await db
    .insert(customerTagAssignments)
    .values({ customerId, tagId })
    .onConflictDoNothing();
}

export async function unassignCustomerTag(customerId: string, tagId: string) {
  const { db } = getDatabase();
  await db
    .delete(customerTagAssignments)
    .where(
      sql`${customerTagAssignments.customerId} = ${customerId} and ${customerTagAssignments.tagId} = ${tagId}`,
    );
}
