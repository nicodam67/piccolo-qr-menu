import "server-only";

import { asc, eq, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import {
  customerSegments,
  customers,
  restaurantSettings,
} from "@/db/schema";
import {
  customerMatchesSegment,
  normalizeCustomerFilters,
  type CustomerFilters,
} from "@/features/customer-segments/config";

async function restaurantId() {
  const { db } = getDatabase();
  const [row] = await db.select({ id: restaurantSettings.id }).from(restaurantSettings).limit(1);
  if (!row) throw new Error("No existe un restaurante configurado.");
  return row.id;
}

export async function getCustomerSegments() {
  const { db } = getDatabase();
  const id = await restaurantId();
  const [segments, customerRows] = await Promise.all([
    db
      .select()
      .from(customerSegments)
      .where(eq(customerSegments.restaurantId, id))
      .orderBy(asc(customerSegments.name)),
    db
      .select({
        id: customers.id,
        firstName: customers.firstName,
        lastName: customers.lastName,
        phone: customers.phone,
        email: customers.email,
        isActive: customers.isActive,
        lastVisitAt: customers.lastVisitAt,
        tagIds: sql<string[]>`coalesce((select array_agg(cta.tag_id::text) from customer_tag_assignments cta where cta.customer_id = ${customers.id}), array[]::text[])`,
        points: sql<number>`coalesce((select balance from customer_loyalty_accounts cla where cla.customer_id = ${customers.id}), 0)::integer`,
        loyaltyConsent: sql<string | null>`(select status from customer_consents cc where cc.customer_id = ${customers.id} and cc.consent_type = 'loyalty_program' order by created_at desc limit 1)`,
        emailConsent: sql<string | null>`(select status from customer_consents cc where cc.customer_id = ${customers.id} and cc.consent_type = 'marketing_email' order by created_at desc limit 1)`,
        phoneConsent: sql<string | null>`(select status from customer_consents cc where cc.customer_id = ${customers.id} and cc.consent_type = 'marketing_phone' order by created_at desc limit 1)`,
        noShowCount: sql<number>`(select count(*)::integer from reservations r where r.customer_id = ${customers.id} and r.status = 'no_show')`,
        daysSinceLastVisit: sql<number | null>`case when ${customers.lastVisitAt} is null then null else extract(day from now() - ${customers.lastVisitAt})::integer end`,
      })
      .from(customers)
      .where(eq(customers.restaurantId, id)),
  ]);
  return segments.map((segment) => {
    const filters = normalizeCustomerFilters(segment.filters);
    const matchingCount = customerRows.filter((customer) =>
      customerMatchesSegment(
        {
          isActive: customer.isActive,
          tagIds: customer.tagIds,
          loyaltyParticipating: customer.loyaltyConsent === "granted",
          points: customer.points,
          emailConsent: customer.emailConsent ?? undefined,
          phoneConsent: customer.phoneConsent ?? undefined,
          noShowCount: customer.noShowCount,
          daysSinceLastVisit: customer.daysSinceLastVisit ?? undefined,
          searchText: `${customer.firstName} ${customer.lastName} ${customer.phone} ${customer.email ?? ""}`,
        },
        filters,
      ),
    ).length;
    return { ...segment, filters, matchingCount };
  });
}

export async function getCustomerSegment(id: string) {
  const { db } = getDatabase();
  const [segment] = await db
    .select()
    .from(customerSegments)
    .where(eq(customerSegments.id, id))
    .limit(1);
  return segment
    ? { ...segment, filters: normalizeCustomerFilters(segment.filters) }
    : null;
}

export async function saveCustomerSegment(input: {
  id?: string;
  name: string;
  description: string;
  filters: CustomerFilters;
  isActive: boolean;
}) {
  const { db } = getDatabase();
  if (input.id) {
    await db
      .update(customerSegments)
      .set({
        name: input.name,
        description: input.description || null,
        filters: input.filters,
        isActive: input.isActive,
        updatedAt: new Date(),
      })
      .where(eq(customerSegments.id, input.id));
  } else {
    await db.insert(customerSegments).values({
      restaurantId: await restaurantId(),
      name: input.name,
      description: input.description || null,
      filters: input.filters,
      isActive: input.isActive,
    });
  }
}
