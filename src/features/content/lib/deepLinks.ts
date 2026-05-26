/**
 * Tiny helper so Tips/Banner CTAs can route either through React Navigation
 * (deep link starting with `netqwix://`) or external `https://` URLs.
 */
export function isReactNavigationDeepLink(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  const lower = url.toLowerCase();

  return lower.startsWith("netqwix://") || lower.startsWith("nq://");
}
