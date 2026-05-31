import { apiClient } from "../../api/client";
import { API_ROUTES } from "../../config/apiRoutes";
import { unwrapApiData } from "../../lib/http/unwrapApiData";
import type { PricingQuote } from "./pricingTypes";

export type SessionQuoteProduct =
  | "instant_lesson"
  | "session_booking"
  | "session_extension";

type Args = {
  productType: SessionQuoteProduct;
  sessionSubtotalCents: number;
  trainerId: string;
  promoDiscountCents?: number;
  billingCountry?: string;
  billingState?: string;
};

/** Trainee-facing quote used in wizards, extension modal, and duration previews. */
export async function fetchSessionPricingQuote({
  productType,
  sessionSubtotalCents,
  trainerId,
  promoDiscountCents = 0,
  billingCountry = "US",
  billingState = "TX",
}: Args): Promise<PricingQuote> {
  const res = await apiClient.post(API_ROUTES.payments.quote, {
    region: billingCountry,
    productType,
    sessionSubtotalCents,
    trainerId,
    paymentMethodHint: "card_domestic_us",
    promoDiscountCents,
    billingAddress: { country: billingCountry, state: billingState },
  });
  return unwrapApiData<PricingQuote>(res);
}
