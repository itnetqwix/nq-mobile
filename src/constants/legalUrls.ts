import { WEB_APP_ORIGIN } from "../config/env";

/** Canonical public URLs for store listings and email footers. */
export const TERMS_AND_CONDITIONS_URL = `${WEB_APP_ORIGIN}/terms`;
export const PRIVACY_POLICY_URL = `${WEB_APP_ORIGIN}/privacy-policy`;
export const CANCELLATION_POLICY_URL = `${WEB_APP_ORIGIN}/cancellation-policy`;
export const REFUND_POLICY_URL = `${WEB_APP_ORIGIN}/refund-policy`;

export type LegalUrlSlug = "terms" | "privacy" | "cancellation" | "refund";

export function legalUrlForSlug(slug: LegalUrlSlug): string {
  switch (slug) {
    case "privacy":
      return PRIVACY_POLICY_URL;
    case "cancellation":
      return CANCELLATION_POLICY_URL;
    case "refund":
      return REFUND_POLICY_URL;
    default:
      return TERMS_AND_CONDITIONS_URL;
  }
}
