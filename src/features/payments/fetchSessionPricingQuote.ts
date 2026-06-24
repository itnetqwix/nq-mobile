import { apiClient } from "../../api/client";
import { API_ROUTES } from "../../config/apiRoutes";
import { unwrapApiData } from "../../lib/http/unwrapApiData";
import type { PricingQuote } from "./pricingTypes";
import { resolveTraineeBillingAddress } from "./resolveTraineeBillingAddress";

export type SessionQuoteProduct =
  | "instant_lesson"
  | "session_booking"
  | "session_extension";

type Args = {
  productType: SessionQuoteProduct;
  sessionSubtotalCents: number;
  trainerId: string;
  promoDiscountCents?: number;
  promoSponsorType?: "platform" | "trainer";
  billingCountry?: string;
  billingState?: string;
  scheduledAt?: string;
  /** When set, overrides country/state from the trainee profile. */
  user?: Record<string, unknown> | null;
  paymentMethodHint?: "card_domestic_us" | "wallet_us";
};

/** Trainee-facing quote used in wizards, extension modal, and duration previews. */
export async function fetchSessionPricingQuote({
  productType,
  sessionSubtotalCents,
  trainerId,
  promoDiscountCents = 0,
  promoSponsorType,
  billingCountry,
  billingState,
  scheduledAt,
  user,
  paymentMethodHint = "card_domestic_us",
}: Args): Promise<PricingQuote> {
  const billing = user
    ? resolveTraineeBillingAddress(user)
    : {
        country: billingCountry ?? "US",
        state: billingState,
      };
  const country = billing.country;
  const state = billing.state ?? (country === "US" ? "TX" : undefined);
  const res = await apiClient.post(API_ROUTES.payments.quote, {
    region: country,
    productType,
    sessionSubtotalCents,
    trainerId,
    paymentMethodHint,
    promoDiscountCents,
    promoSponsorType,
    scheduledAt,
    billingAddress: { country, state },
  });
  return unwrapApiData<PricingQuote>(res);
}
