import { StripePaymentProvider } from "./stripe-provider";
export type PaymentMethod = "card" | "bizum" | "cash";

export interface PaymentProvider {
  readonly id: string;
  createPayment(input: { amountCents: number; currency: string; idempotencyKey: string; method: Exclude<PaymentMethod, "cash"> }): Promise<{ externalId: string; redirectUrl: string }>;
  getPayment(externalId: string): Promise<{ status: string; paidAmountCents: number }>;
  verifyWebhook(payload: string, signature: string): Promise<boolean>;
  processWebhook(payload: string): Promise<{ externalId: string; status: string; paidAmountCents: number }>;
  refund(input: { externalId: string; amountCents: number; idempotencyKey: string }): Promise<{ externalRefundId: string; status: string }>;
  getRefund(externalRefundId: string): Promise<{ status: string; amountCents: number }>;
  expire(externalId: string): Promise<void>;
}

export class PaymentProviderNotConfigured implements PaymentProvider {
  readonly id = "not_configured";
  private unavailable(): never { throw new Error("Proveedor de pagos pendiente de autorización."); }
  async createPayment(): Promise<never> { return this.unavailable(); }
  async getPayment(): Promise<never> { return this.unavailable(); }
  async verifyWebhook(payload: string, signature: string): Promise<boolean> { void payload; void signature; return false; }
  async processWebhook(): Promise<never> { return this.unavailable(); }
  async refund(): Promise<never> { return this.unavailable(); }
  async getRefund(): Promise<never> { return this.unavailable(); }
  async expire(): Promise<void> { this.unavailable(); }
}

export function getPaymentProvider(): PaymentProvider {
  if (process.env.PAYMENT_PROVIDER === "stripe") {
    return new StripePaymentProvider();
  }
  return new PaymentProviderNotConfigured();
}
