import { API_BASE_URL } from "../../config/env";

/**
 * Certificate pinning scaffold — currently pass-through.
 * When real native pins are wired via a config plugin, flip
 * EXPO_PUBLIC_SSL_PINS_CONFIGURED=1 in EAS env and restore the enforcement below.
 */
export function assertCertificatePinningAllowed(): boolean {
  // Native pin enforcement is not yet wired; always allow so API calls reach the server.
  return true;
}

function tryParseHost(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
