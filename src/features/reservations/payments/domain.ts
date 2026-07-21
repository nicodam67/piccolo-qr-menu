export type EconomicStatus = "pending"|"processing"|"paid"|"failed"|"expired"|"refunded"|"partially_refunded"|"exempt"|"retained";
export function calculateDeposit(partySize:number, perGuestCents:number, minimumPartySize:number, enabled:boolean) {
  if (!Number.isInteger(partySize)||partySize<1||!Number.isInteger(perGuestCents)||perGuestCents<0) throw new Error("Datos económicos no válidos.");
  return enabled && partySize >= minimumPartySize ? partySize * perGuestCents : 0;
}
export function enabledPaymentMethods(settings:{cardEnabled:boolean;bizumEnabled:boolean;cashEnabled:boolean}, origin:"online"|"manual") {
  return [
    ...(settings.cardEnabled ? ["card" as const] : []),
    ...(settings.bizumEnabled ? ["bizum" as const] : []),
    ...(origin === "manual" && settings.cashEnabled ? ["cash" as const] : []),
  ];
}
export function calculateGraceDeadline(reservationAt:Date, minutes:number) {
  return new Date(reservationAt.getTime()+minutes*60000);
}
export function canMarkNoShow(status:string, graceDeadline:Date, arrivedAt:Date|null, now:Date) {
  return status === "confirmed" && !arrivedAt && now > graceDeadline;
}
export function refundableAmount(paid:number, refunded:number, requested:number) {
  if (requested<0 || requested > paid-refunded) throw new Error("Devolución no válida.");
  return requested;
}
export function remainingForTpv(paid:number, refunded:number, applied:number, retained:boolean) {
  if (retained) return 0;
  return Math.max(0,paid-refunded-applied);
}
export function canApplyToTpv(arrivedAt:Date|null,economicStatus:EconomicStatus,remaining:number) {
  return Boolean(arrivedAt && economicStatus==="paid" && remaining>0);
}
