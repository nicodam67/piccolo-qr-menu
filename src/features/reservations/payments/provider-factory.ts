import "server-only";

import {
  PaymentProviderNotConfigured,
  type PaymentProvider,
} from "./provider";
import { StripePaymentProvider } from "./stripe-provider";

export function getPaymentProvider(): PaymentProvider {
  if (process.env.PAYMENT_PROVIDER === "stripe") {
    return new StripePaymentProvider();
  }
  return new PaymentProviderNotConfigured();
}
