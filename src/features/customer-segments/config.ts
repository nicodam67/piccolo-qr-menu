import { z } from "zod";

export const customerFilterSchema = z
  .object({
    query: z.string().max(160).optional(),
    isActive: z.boolean().optional(),
    tagIds: z.array(z.string().uuid()).max(30).optional(),
    loyaltyParticipating: z.boolean().optional(),
    hasPoints: z.boolean().optional(),
    emailConsent: z
      .enum(["granted", "rejected", "withdrawn"])
      .optional(),
    phoneConsent: z
      .enum(["granted", "rejected", "withdrawn"])
      .optional(),
    hasNoShows: z.boolean().optional(),
    noVisitsSinceDays: z.number().int().min(1).max(3650).optional(),
  })
  .strict();

export type CustomerFilters = z.infer<typeof customerFilterSchema>;

export function normalizeCustomerFilters(value: unknown): CustomerFilters {
  return customerFilterSchema.parse(value);
}

export function customerMatchesSegment(
  customer: {
    isActive: boolean;
    tagIds: string[];
    loyaltyParticipating: boolean;
    points: number;
    emailConsent?: string;
    phoneConsent?: string;
    noShowCount: number;
    daysSinceLastVisit?: number;
    searchText?: string;
  },
  filters: CustomerFilters,
) {
  if (
    filters.query &&
    !customer.searchText
      ?.normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .includes(
        filters.query
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLowerCase(),
      )
  )
    return false;
  if (filters.isActive !== undefined && customer.isActive !== filters.isActive)
    return false;
  if (
    filters.tagIds?.length &&
    !filters.tagIds.every((id) => customer.tagIds.includes(id))
  )
    return false;
  if (
    filters.loyaltyParticipating !== undefined &&
    customer.loyaltyParticipating !== filters.loyaltyParticipating
  )
    return false;
  if (filters.hasPoints !== undefined && (customer.points > 0) !== filters.hasPoints)
    return false;
  if (filters.emailConsent && customer.emailConsent !== filters.emailConsent)
    return false;
  if (filters.phoneConsent && customer.phoneConsent !== filters.phoneConsent)
    return false;
  if (filters.hasNoShows !== undefined && (customer.noShowCount > 0) !== filters.hasNoShows)
    return false;
  if (
    filters.noVisitsSinceDays !== undefined &&
    (customer.daysSinceLastVisit ?? Number.POSITIVE_INFINITY) <
      filters.noVisitsSinceDays
  )
    return false;
  return true;
}
