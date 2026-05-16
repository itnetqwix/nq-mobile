import { API_BASE_URL } from "../../config/env";

/**
 * Certificate pinning scaffold for production builds.
 * Wire native pins via expo-dev-client / config plugin before enforcing in prod.
 */
export function assertCertificatePinningAllowed(): boolean {
  if (__DEV__) return true;
  const host = tryParseHost(API_BASE_URL);
  if (!host) return true;
  // Fail closed in production until pins are configured in native layer.
  const pinsConfigured = process.env.EXPO_PUBLIC_SSL_PINS_CONFIGURED === "1";
  return pinsConfigured;
}

function tryParseHost(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
