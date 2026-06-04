/** Trainee-facing label for applied promo (platform vs coach-sponsored). */
export function promoDisplayLabel(
  sponsorType?: string | null,
  displayLabel?: string | null
): string | undefined {
  if (displayLabel?.trim()) return displayLabel.trim();
  if (sponsorType === "trainer") return "Coach promo";
  if (sponsorType === "platform") return "NetQwix promo";
  return undefined;
}

export type PromoSponsorType = "platform" | "trainer";

export function promoSponsorFromResult(
  data?: { sponsor_type?: string | null } | null
): PromoSponsorType | undefined {
  const t = data?.sponsor_type;
  if (t === "platform" || t === "trainer") return t;
  return undefined;
}
