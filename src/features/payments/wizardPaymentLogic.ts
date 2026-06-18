import type { PricingPaymentMethodHint } from "../../lib/payments/pricingQuoteHint";
import { resolvePaymentMethodHint } from "../../lib/payments/pricingQuoteHint";

export function resolveWizardPayableAmount(opts: {
  payableAmountProp?: number | null;
  promoValid?: boolean;
  promoFinalAmount?: number | null;
  expectedPrice: number;
}): number {
  if (opts.payableAmountProp != null) return opts.payableAmountProp;
  if (opts.promoValid && opts.promoFinalAmount != null) {
    return Number(opts.promoFinalAmount);
  }
  return opts.expectedPrice;
}

export function shouldSkipPaymentIntent(payableAmount: number, expectedPrice: number): boolean {
  return payableAmount <= 0 || expectedPrice <= 0;
}

export function resolveWizardPaymentMethodHint(
  canPayWithWallet: boolean,
  availableDollars: number,
  chargeDollars: number
): PricingPaymentMethodHint {
  if (canPayWithWallet) return "wallet_us";
  return resolvePaymentMethodHint(availableDollars, chargeDollars);
}

export function resolveWizardChargeTotal(
  quoteChargeTotalCents: number | null | undefined,
  priceInfoAmount: number | undefined,
  payableAmount: number
): number {
  if (quoteChargeTotalCents != null) return quoteChargeTotalCents / 100;
  return priceInfoAmount ?? payableAmount;
}
