import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, lte } from "drizzle-orm";
import { getDatabase } from "@/db";
import { customers, reservationEconomicEvents, reservationPayments, reservations, restaurantSettings } from "@/db/schema";
import { canMarkNoShow } from "./domain";
import type { PaymentMethod } from "./provider";
import { getPaymentProvider } from "./provider-factory";

export async function startOnlinePayment(reservationId:string,method:Exclude<PaymentMethod,"cash">) {
  const {db}=getDatabase();
  const [row]=await db.select({reservation:reservations, currency:restaurantSettings.currencyCode})
    .from(reservations).innerJoin(restaurantSettings,eq(reservations.restaurantId,restaurantSettings.id))
    .where(eq(reservations.id,reservationId)).limit(1);
  if(!row||!row.reservation.depositRequired) throw new Error("Reserva sin adelanto pendiente.");
  const key=randomUUID(); const provider=await getPaymentProvider();
  const remote=await provider.createPayment({amountCents:row.reservation.depositTotalCents,currency:row.currency,idempotencyKey:key,method});
  const expiresAt=new Date(Date.now()+30*60_000);
  await db.transaction(async tx=>{
    const [payment]=await tx.insert(reservationPayments).values({restaurantId:row.reservation.restaurantId,reservationId,method,provider:provider.id,externalId:remote.externalId,expectedAmountCents:row.reservation.depositTotalCents,currencyCode:row.currency,status:"processing",expiresAt,idempotencyKey:key}).returning({id:reservationPayments.id});
    await tx.insert(reservationEconomicEvents).values({restaurantId:row.reservation.restaurantId,reservationId,paymentId:payment.id,eventType:"payment_started",amountCents:row.reservation.depositTotalCents});
    await tx.update(reservations).set({economicStatus:"processing",updatedAt:new Date()}).where(eq(reservations.id,reservationId));
  });
  return remote.redirectUrl;
}

export async function processProviderWebhook(payload:string,signature:string,eventId:string) {
  const provider=await getPaymentProvider();
  if(!(await provider.verifyWebhook(payload,signature))) throw new Error("Firma de webhook inválida.");
  const result=await provider.processWebhook(payload);
  const {db}=getDatabase();
  await db.transaction(async tx=>{
    const [seen]=await tx.select({id:reservationEconomicEvents.id}).from(reservationEconomicEvents).where(eq(reservationEconomicEvents.providerEventId,eventId)).limit(1);
    if(seen) return;
    const [payment]=await tx.select().from(reservationPayments).where(and(eq(reservationPayments.provider,provider.id),eq(reservationPayments.externalId,result.externalId))).for("update").limit(1);
    if(!payment) throw new Error("Pago desconocido.");
    const paid=result.status==="paid"; const expired=result.status==="expired";
    await tx.update(reservationPayments).set({status:paid?"paid":expired?"expired":"failed",paidAmountCents:paid?result.paidAmountCents:payment.paidAmountCents,paidAt:paid?new Date():payment.paidAt,updatedAt:new Date()}).where(eq(reservationPayments.id,payment.id));
    await tx.update(reservations).set({economicStatus:paid?"paid":expired?"expired":"failed",remainingDepositCents:paid?result.paidAmountCents:0,status:paid?"confirmed":"pending",updatedAt:new Date()}).where(eq(reservations.id,payment.reservationId));
    await tx.insert(reservationEconomicEvents).values({restaurantId:payment.restaurantId,reservationId:payment.reservationId,paymentId:payment.id,providerEventId:eventId,eventType:paid?"payment_confirmed":expired?"payment_expired":"payment_failed",amountCents:result.paidAmountCents});
  });
}

export async function registerCashPayment(reservationId:string,amountCents:number,note:string,method:"cash"|"card"="cash") {
  if(!Number.isInteger(amountCents)||amountCents<=0) throw new Error("Importe no válido.");
  const {db}=getDatabase(); await db.transaction(async tx=>{
    const [r]=await tx.select().from(reservations).where(eq(reservations.id,reservationId)).for("update").limit(1); if(!r) throw new Error("Reserva inexistente.");
    const [settings]=await tx.select().from(restaurantSettings).where(eq(restaurantSettings.id,r.restaurantId)).limit(1); if(!settings) throw new Error("Restaurante inexistente.");
    const [p]=await tx.insert(reservationPayments).values({restaurantId:r.restaurantId,reservationId,method,provider:method==="cash"?"cash_admin":"external_card_admin",expectedAmountCents:r.depositTotalCents,paidAmountCents:amountCents,currencyCode:settings.currencyCode,status:"paid",paidAt:new Date(),idempotencyKey:randomUUID(),note:note.slice(0,500)}).returning({id:reservationPayments.id});
    await tx.update(reservations).set({economicStatus:"paid",remainingDepositCents:amountCents,status:"confirmed",updatedAt:new Date()}).where(eq(reservations.id,reservationId));
    await tx.insert(reservationEconomicEvents).values({restaurantId:r.restaurantId,reservationId,paymentId:p.id,eventType:"cash_payment_recorded",amountCents,reason:note.slice(0,500)});
  });
}

export async function registerDepositCourtesy(reservationId:string,reason:string) {
  const {db}=getDatabase();
  await db.transaction(async tx=>{
    const [r]=await tx.select().from(reservations).where(eq(reservations.id,reservationId)).for("update").limit(1);
    if(!r)throw new Error("Reserva inexistente.");
    await tx.update(reservations).set({economicStatus:"exempt",depositRequired:false,remainingDepositCents:0,updatedAt:new Date()}).where(eq(reservations.id,reservationId));
    await tx.insert(reservationEconomicEvents).values({restaurantId:r.restaurantId,reservationId,eventType:"deposit_waived",reason:reason.slice(0,500),amountCents:r.depositTotalCents});
  });
}

export async function registerArrival(reservationId:string,at=new Date()) {
  const {db}=getDatabase(); await db.transaction(async tx=>{const [r]=await tx.select().from(reservations).where(eq(reservations.id,reservationId)).for("update").limit(1);if(!r)throw new Error("Reserva inexistente.");await tx.update(reservations).set({arrivedAt:at,status:"seated",tpvApplicationStatus:r.economicStatus==="paid"?"available":"not_ready",updatedAt:new Date()}).where(eq(reservations.id,reservationId));if(r.customerId)await tx.update(customers).set({lastVisitAt:at,updatedAt:new Date()}).where(eq(customers.id,r.customerId));await tx.insert(reservationEconomicEvents).values({restaurantId:r.restaurantId,reservationId,eventType:"arrival_recorded",reason:"Llegada registrada por administración"});});
}
export async function extendGrace(reservationId:string,minutes:number,reason:string) {
  if(!Number.isInteger(minutes)||minutes<1||minutes>240)throw new Error("Ampliación no válida.");const {db}=getDatabase();await db.transaction(async tx=>{const [r]=await tx.select().from(reservations).where(eq(reservations.id,reservationId)).for("update").limit(1);if(!r?.graceDeadlineAt)throw new Error("Sin límite de cortesía.");const next=new Date(r.graceDeadlineAt.getTime()+minutes*60000);await tx.update(reservations).set({graceDeadlineAt:next,updatedAt:new Date()}).where(eq(reservations.id,reservationId));await tx.insert(reservationEconomicEvents).values({restaurantId:r.restaurantId,reservationId,eventType:"grace_extended",reason:reason.slice(0,500),metadata:{minutes}});});
}
export async function markNoShow(reservationId:string,reason:string,now=new Date()) {
  const {db}=getDatabase();await db.transaction(async tx=>{const [r]=await tx.select().from(reservations).where(eq(reservations.id,reservationId)).for("update").limit(1);if(!r?.graceDeadlineAt||!canMarkNoShow(r.status,r.graceDeadlineAt,r.arrivedAt,now))throw new Error("No se puede marcar no presentada antes del límite.");await tx.update(reservations).set({status:"no_show",noShowAt:now,economicStatus:r.economicStatus==="paid"?"retained":r.economicStatus,tpvApplicationStatus:"blocked",remainingDepositCents:0,updatedAt:new Date()}).where(eq(reservations.id,reservationId));await tx.insert(reservationEconomicEvents).values({restaurantId:r.restaurantId,reservationId,eventType:"no_show_recorded",reason:reason.slice(0,500),amountCents:r.depositTotalCents});});
}

export async function expirePendingPayments(now=new Date()) {
  const {db}=getDatabase();const rows=await db.select().from(reservationPayments).where(and(inArray(reservationPayments.status,["pending","processing"]),lte(reservationPayments.expiresAt,now)));for(const p of rows){await db.transaction(async tx=>{await tx.update(reservationPayments).set({status:"expired",updatedAt:now}).where(eq(reservationPayments.id,p.id));await tx.update(reservations).set({economicStatus:"expired",status:"cancelled",updatedAt:now}).where(eq(reservations.id,p.reservationId));await tx.insert(reservationEconomicEvents).values({restaurantId:p.restaurantId,reservationId:p.reservationId,paymentId:p.id,eventType:"payment_expired"});});}return rows.length;
}

export async function refundReservationPayment(reservationId:string,amountCents:number,reason:string) {
  if(!Number.isInteger(amountCents)||amountCents<=0)throw new Error("Importe de devolución no válido.");
  const {db}=getDatabase();const [payment]=await db.select().from(reservationPayments).where(and(eq(reservationPayments.reservationId,reservationId),eq(reservationPayments.status,"paid"))).orderBy(reservationPayments.createdAt).limit(1);
  if(!payment)throw new Error("No existe un pago confirmado.");
  let confirmed=payment.method==="cash";
  if(!confirmed){if(!payment.externalId)throw new Error("Pago sin identificador externo.");const provider=await getPaymentProvider();const result=await provider.refund({externalId:payment.externalId,amountCents,idempotencyKey:randomUUID()});confirmed=result.status==="succeeded";}
  if(!confirmed)throw new Error("La devolución aún no ha sido confirmada por el proveedor.");
  await db.transaction(async tx=>{const refunded=payment.refundedAmountCents+amountCents;if(refunded>payment.paidAmountCents)throw new Error("La devolución supera el importe pagado.");const full=refunded===payment.paidAmountCents;await tx.update(reservationPayments).set({refundedAmountCents:refunded,status:full?"refunded":"partially_refunded",refundedAt:new Date(),updatedAt:new Date()}).where(eq(reservationPayments.id,payment.id));await tx.update(reservations).set({economicStatus:full?"refunded":"partially_refunded",remainingDepositCents:Math.max(0,payment.paidAmountCents-refunded),updatedAt:new Date()}).where(eq(reservations.id,reservationId));await tx.insert(reservationEconomicEvents).values({restaurantId:payment.restaurantId,reservationId,paymentId:payment.id,eventType:full?"refund_confirmed":"partial_refund_confirmed",amountCents,reason:reason.slice(0,500)});});
}
