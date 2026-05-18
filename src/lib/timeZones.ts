import ianaTimeZones from "./ianaTimeZones.generated.json";

/** Sorted IANA identifiers bundled for consistent behavior across devices. */
export const IANA_TIME_ZONES: readonly string[] = Object.freeze(
  [...(ianaTimeZones as string[])].sort((a, b) => a.localeCompare(b))
);
