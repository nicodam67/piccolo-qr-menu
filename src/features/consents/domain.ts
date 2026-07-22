export const CONSENT_TYPES = [
  "marketing_email",
  "marketing_phone",
  "loyalty_program",
  "personalization",
] as const;
export const CONSENT_STATUSES = [
  "granted",
  "rejected",
  "withdrawn",
] as const;

export type ConsentType = (typeof CONSENT_TYPES)[number];
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

export function isConsentType(value: string): value is ConsentType {
  return CONSENT_TYPES.includes(value as ConsentType);
}

export function isConsentStatus(value: string): value is ConsentStatus {
  return CONSENT_STATUSES.includes(value as ConsentStatus);
}

export function getCurrentConsentStates(
  history: Array<{
    consentType: ConsentType;
    status: ConsentStatus;
    createdAt: Date;
  }>,
) {
  const result = new Map<ConsentType, ConsentStatus>();
  for (const item of [...history].sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
  )) {
    if (!result.has(item.consentType)) {
      result.set(item.consentType, item.status);
    }
  }
  return result;
}
