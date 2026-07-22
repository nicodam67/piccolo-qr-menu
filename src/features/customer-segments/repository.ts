import "server-only";

import { eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { customers } from "@/db/schema";
import type { CustomerFilters } from "./config";

export function buildCustomerFilterConditions(filters: CustomerFilters) {
  const conditions: SQL[] = [];
  if (filters.query?.trim()) {
    const pattern = `%${filters.query.trim()}%`;
    const search = or(
      sql`${customers.firstName} || ' ' || ${customers.lastName} ilike ${pattern}`,
      ilike(customers.phone, pattern),
      ilike(customers.email, pattern),
    );
    if (search) conditions.push(search);
  }
  if (filters.isActive !== undefined) {
    conditions.push(eq(customers.isActive, filters.isActive));
  }
  if (filters.hasPoints !== undefined) {
    conditions.push(
      filters.hasPoints
        ? sql`exists (select 1 from customer_loyalty_accounts cla where cla.customer_id = ${customers.id} and cla.balance > 0)`
        : sql`not exists (select 1 from customer_loyalty_accounts cla where cla.customer_id = ${customers.id} and cla.balance > 0)`,
    );
  }
  if (filters.loyaltyParticipating !== undefined) {
    const expression = sql`coalesce((select cc.status = 'granted' from customer_consents cc where cc.customer_id = ${customers.id} and cc.consent_type = 'loyalty_program' order by cc.created_at desc limit 1), false)`;
    conditions.push(
      filters.loyaltyParticipating ? expression : sql`not (${expression})`,
    );
  }
  if (filters.emailConsent) {
    conditions.push(
      sql`(select cc.status from customer_consents cc where cc.customer_id = ${customers.id} and cc.consent_type = 'marketing_email' order by cc.created_at desc limit 1) = ${filters.emailConsent}`,
    );
  }
  if (filters.phoneConsent) {
    conditions.push(
      sql`(select cc.status from customer_consents cc where cc.customer_id = ${customers.id} and cc.consent_type = 'marketing_phone' order by cc.created_at desc limit 1) = ${filters.phoneConsent}`,
    );
  }
  if (filters.tagIds?.length) {
    for (const tagId of filters.tagIds) {
      conditions.push(
        sql`exists (select 1 from customer_tag_assignments cta where cta.customer_id = ${customers.id} and cta.tag_id = ${tagId})`,
      );
    }
  }
  if (filters.hasNoShows !== undefined) {
    conditions.push(
      filters.hasNoShows
        ? sql`exists (select 1 from reservations r where r.customer_id = ${customers.id} and r.status = 'no_show')`
        : sql`not exists (select 1 from reservations r where r.customer_id = ${customers.id} and r.status = 'no_show')`,
    );
  }
  if (filters.noVisitsSinceDays !== undefined) {
    conditions.push(
      sql`(${customers.lastVisitAt} is null or ${customers.lastVisitAt} < now() - (${filters.noVisitsSinceDays} * interval '1 day'))`,
    );
  }
  return conditions;
}

