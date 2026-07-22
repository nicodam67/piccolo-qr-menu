import "server-only";

import Stripe from "stripe";
import type { PaymentProvider } from "./provider";

export class StripePaymentProvider implements PaymentProvider {
  readonly id = "stripe";
  private readonly stripe: Stripe;
  constructor(
    secretKey = process.env.PAYMENT_SECRET_KEY,
    private readonly webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET,
  ) {
    if (!secretKey) throw new Error("PAYMENT_SECRET_KEY no configurada.");
    this.stripe = new Stripe(secretKey);
  }
  async createPayment(input: { amountCents:number; currency:string; idempotencyKey:string; method:"card"|"bizum" }) {
    const base = process.env.NEXT_PUBLIC_SITE_URL;
    if (!base) throw new Error("NEXT_PUBLIC_SITE_URL no configurada.");
    const session = await this.stripe.checkout.sessions.create({
      mode:"payment",
      payment_method_types:[input.method],
      line_items:[{price_data:{currency:input.currency.toLowerCase(),unit_amount:input.amountCents,product_data:{name:"Adelanto de reserva"}},quantity:1}],
      success_url:`${base}/es/reservas?payment=processing`,
      cancel_url:`${base}/es/reservas?payment=cancelled`,
      expires_at:Math.floor(Date.now()/1000)+30*60,
    },{idempotencyKey:input.idempotencyKey});
    if (!session.url) throw new Error("Stripe no devolvió URL de pago.");
    return {externalId:session.id,redirectUrl:session.url};
  }
  async getPayment(externalId:string) {
    const session=await this.stripe.checkout.sessions.retrieve(externalId);
    return {status:session.payment_status==="paid"?"paid":session.status==="expired"?"expired":"pending",paidAmountCents:session.amount_total ?? 0};
  }
  async verifyWebhook(payload:string,signature:string) {
    if (!this.webhookSecret) return false;
    try { this.stripe.webhooks.constructEvent(payload,signature,this.webhookSecret); return true; } catch { return false; }
  }
  async processWebhook(payload:string) {
    const event=JSON.parse(payload) as Stripe.Event;
    const object=event.data.object as Stripe.Checkout.Session | Stripe.Refund;
    if (event.type.startsWith("checkout.session.")) {
      const session=object as Stripe.Checkout.Session;
      return {externalId:session.id,status:event.type==="checkout.session.completed"&&session.payment_status==="paid"?"paid":event.type==="checkout.session.expired"?"expired":"failed",paidAmountCents:session.amount_total ?? 0};
    }
    const refund=object as Stripe.Refund;
    return {externalId:String(refund.payment_intent ?? refund.id),status:refund.status==="succeeded"?"refunded":"failed",paidAmountCents:refund.amount};
  }
  async refund(input:{externalId:string;amountCents:number;idempotencyKey:string}) {
    const session=await this.stripe.checkout.sessions.retrieve(input.externalId);
    if (!session.payment_intent) throw new Error("Pago sin PaymentIntent.");
    const refund=await this.stripe.refunds.create({payment_intent:String(session.payment_intent),amount:input.amountCents},{idempotencyKey:input.idempotencyKey});
    return {externalRefundId:refund.id,status:refund.status ?? "pending"};
  }
  async getRefund(externalRefundId:string) {
    const refund=await this.stripe.refunds.retrieve(externalRefundId);
    return {status:refund.status ?? "pending",amountCents:refund.amount};
  }
  async expire(externalId:string) { await this.stripe.checkout.sessions.expire(externalId); }
}
