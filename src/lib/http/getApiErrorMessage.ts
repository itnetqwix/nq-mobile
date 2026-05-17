import { isAxiosError } from "axios";
import {
  API_BASE_URL,
  API_BASE_URL_CONFIGURED,
  isLocalDevApiHost,
} from "../../config/env";

/** Best-effort message from NetQwix API error bodies (same shape as web toasts). */
function isTransportFailureMessage(msg: string | undefined): boolean {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return (
    m === "network error" ||
    m.includes("network request failed") ||
    m.includes("failed to connect") ||
    m.includes("load failed")
  );
}

function isTlsCertificateMessage(msg: string | undefined): boolean {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return (
    m.includes("certificate") ||
    m.includes("pretending to be") ||
    m.includes("ssl error") ||
    m.includes("secure connection") ||
    m.includes("server trust") ||
    m.includes("untrusted cert")
  );
}

/** Appends nested `cause` messages (Expo fetch often puts TLS text on the cause). */
function collectCauseChain(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const parts: string[] = [];
  let cur: unknown = (error as { cause?: unknown }).cause;
  for (let depth = 0; cur != null && depth < 6; depth++) {
    if (cur instanceof Error) {
      parts.push(cur.message);
      cur = cur.cause;
    } else if (typeof cur === "string") {
      parts.push(cur);
      break;
    } else {
      break;
    }
  }
  return parts.join(" ");
}

function devLocalTransportHint(): string | null {
  if (!__DEV__) return null;
  const configuredLocal =
    API_BASE_URL_CONFIGURED.includes("localhost") ||
    API_BASE_URL_CONFIGURED.includes("127.0.0.1");
  const resolvedLocal = isLocalDevApiHost(API_BASE_URL);
  if (!configuredLocal && !resolvedLocal) return null;

  return (
    `Cannot reach the API at ${API_BASE_URL}. ` +
    (configuredLocal && API_BASE_URL !== API_BASE_URL_CONFIGURED
      ? `(.env has ${API_BASE_URL_CONFIGURED}; rewritten for this device.) `
      : "") +
    "Start the backend on your computer (npm run dev in nq-backend-main, port 8000), use the same Wi‑Fi as the phone, then restart Metro: npx expo start -c. " +
    "If it still fails, set EXPO_PUBLIC_API_BASE_URL=http://YOUR_MAC_LAN_IP:8000 in nq-mobile/.env."
  );
}

export function getApiErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  const devHint = devLocalTransportHint();
  const transportHint =
    devHint ??
    "Network error — switch Wi‑Fi vs cellular (no VPN), or use an unrestricted network. School/work/public Wi‑Fi often blocks API domains; Safari may show “Web page blocked”. Ask the network admin to allow api-netqwix.com, or develop from home/hotspot. Confirm API_BASE_URL in Metro ([nq-mobile] …) and run `npx expo start -c`.";

  const tlsHint =
    "TLS / certificate error — often a filtered network: firewalls that block “API” sites or SSL‑inspect traffic show this on iPhone (and “Web page blocked” in Safari). Try cellular or another Wi‑Fi, turn off VPN and DNS filters (NextDNS, AdGuard, “child safety”). If it works on a clean network, whitelist api-netqwix.com on the blocking router or filter. Otherwise check date/time, update Expo Go, and have ops verify SSL at https://www.ssllabs.com/ssltest/ for api-netqwix.com.";

  const combinedAxiosText = isAxiosError(error)
    ? `${error.message ?? ""} ${collectCauseChain(error)}`.trim()
    : "";

  if (isAxiosError(error) && isTlsCertificateMessage(combinedAxiosText)) {
    return tlsHint;
  }

  if (isAxiosError(error)) {
    if (
      error.code === "ERR_NETWORK" ||
      error.code === "ECONNABORTED" ||
      isTransportFailureMessage(error.message)
    ) {
      return transportHint;
    }
    const status = error.response?.status;
    const raw = error.response?.data;
    if (typeof raw === "string" && raw.length > 0) {
      const snippet = raw.replace(/\s+/g, " ").slice(0, 120);
      return status ? `Server returned ${status}: ${snippet}` : snippet;
    }
    const data = raw as { error?: string; message?: string; status?: string } | undefined;
    if (typeof data?.error === "string") return data.error;
    if (typeof data?.message === "string") return data.message;
    if (status) return `Request failed (${status}).`;
  }
  if (error instanceof Error && error.message) {
    const full = `${error.message} ${collectCauseChain(error)}`.trim();
    if (isTlsCertificateMessage(full)) return tlsHint;
    if (isTransportFailureMessage(error.message)) return transportHint;
    return error.message;
  }
  return fallback;
}
