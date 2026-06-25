/** Maps pricing breakdown line keys to i18n paths under `pricing.chargeInfo.*`. */
export const PRICING_CHARGE_INFO_KEYS: Record<string, string> = {
  session_subtotal: "sessionSubtotal",
  sessionSubtotal: "sessionSubtotal",
  promo_discount: "promoDiscount",
  discount: "promoDiscount",
  surge_fee: "surgeFee",
  trainee_platform_fee: "platformFee",
  processing_fee: "processingFee",
  tax: "tax",
  wallet_portion: "walletPortion",
  card_portion: "cardPortion",
  total: "totalCharged",
  totalCharged: "totalCharged",
};

export function pricingChargeInfoI18nKey(lineKey: string): string | null {
  const slug = PRICING_CHARGE_INFO_KEYS[lineKey];
  return slug ? `pricing.chargeInfo.${slug}` : null;
}
