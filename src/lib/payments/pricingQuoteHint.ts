export type PricingPaymentMethodHint = "card_domestic_us" | "wallet_us";

/** Pick quote fee profile based on whether wallet balance can cover the charge. */
export function resolvePaymentMethodHint(
  availableDollars: number,
  requiredDollars: number
): PricingPaymentMethodHint {
  const available = Math.max(0, Number(availableDollars) || 0);
  const required = Math.max(0, Number(requiredDollars) || 0);
  if (required > 0 && available >= required) return "wallet_us";
  return "card_domestic_us";
}
