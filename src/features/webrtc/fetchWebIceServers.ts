import { WEB_APP_ORIGIN } from "../../config/env";
import type { RtcIceServer } from "./defaultIceServers";

const DEFAULT_PEER_PATH = "/api/peer";

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Optional override for the Next.js route that returns ICE (default: `{WEB_APP_ORIGIN}/api/peer`).
 * Set in `.env` if the peer route is hosted elsewhere.
 */
const ICE_CONFIG_URL = (() => {
  const raw = process.env.EXPO_PUBLIC_ICE_CONFIG_URL?.replace(/^\uFEFF/, "").trim().replace(/^["']|["']$/g, "");
  if (raw) {
    try {
      const u = new URL(raw);
      if (u.protocol === "http:" || u.protocol === "https:") return stripTrailingSlash(raw);
    } catch {
      /* ignore */
    }
  }
  return `${WEB_APP_ORIGIN}${DEFAULT_PEER_PATH}`;
})();

type PeerApiResponse = {
  formattedIceServers?: RtcIceServer[];
};

/**
 * Fetches TURN (Cloudflare) + STUN bundle from the **marketing / web app**, same as the browser:
 * `nq-frontend-main/app/api/peer/route.js`.
 *
 * On failure (network, non-JSON), returns `null` so callers can use `DEFAULT_STUN_ICE_SERVERS` only.
 */
export async function fetchWebIceServers(): Promise<RtcIceServer[] | null> {
  try {
    const res = await fetch(ICE_CONFIG_URL, { method: "GET" });
    if (!res.ok) return null;
    const data = (await res.json()) as PeerApiResponse;
    if (!Array.isArray(data.formattedIceServers) || data.formattedIceServers.length === 0) {
      return null;
    }
    return data.formattedIceServers;
  } catch {
    return null;
  }
}

export function getIceConfigUrl(): string {
  return ICE_CONFIG_URL;
}
