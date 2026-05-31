/** Web parity: `userInfo.country`, `state`, `zip_code` on payment / quote calls. */

export type TraineeBillingAddress = {
  country: string;
  state?: string;
  postalCode?: string;
};

function pickString(...values: unknown[]): string {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

export function resolveTraineeBillingAddress(
  user: Record<string, unknown> | null | undefined
): TraineeBillingAddress {
  const extra =
    user?.extraInfo && typeof user.extraInfo === "object"
      ? (user.extraInfo as Record<string, unknown>)
      : null;

  const country = pickString(user?.country, extra?.country) || "US";
  const state = pickString(user?.state, extra?.state);
  const postalCode = pickString(
    user?.zip_code,
    user?.postal_code,
    user?.zipCode,
    extra?.zip_code,
    extra?.postal_code
  );

  return {
    country: country.toUpperCase(),
    state: state || undefined,
    postalCode: postalCode || undefined,
  };
}
