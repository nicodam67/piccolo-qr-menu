import "server-only";

import {
  PaymentProviderNotConfigured,
  type PaymentProvider,
} from "./provider";

export function isOnlinePaymentProviderEnabled() {
  return (
    process.env.PAYMENT_PROVIDER === "stripe" &&
    Boolean(process.env.PAYMENT_SECRET_KEY) &&
    Boolean(process.env.PAYMENT_WEBHOOK_SECRET)
  );
}

export async function getPaymentProvider(): Promise<PaymentProvider> {
  if (process.env.PAYMENT_PROVIDER === "stripe") {
    const { StripePaymentProvider } = await import("./stripe-provider");
    return new StripePaymentProvider();
  }
  return new PaymentProviderNotConfigured();
}
