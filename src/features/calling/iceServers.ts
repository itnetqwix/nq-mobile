import type { IceServer } from "./types";

/**
 * Mirrors the web fallback in `callEngine.js` → `DEFAULT_ICE_SERVERS`. Used only when the
 * backend `startMeeting.iceServers` array (TURN credentials minted by the 5-minute cron)
 * is unavailable; STUN alone is enough for >90% of carrier NATs but TURN is required for
 * symmetric NATs / strict mobile networks.
 */
export const DEFAULT_ICE_SERVERS: IceServer[] = [
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:stun.cloudflare.com:53" },
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
];

export function buildIceConfig(provided?: IceServer[] | { iceServers?: IceServer[] }): {
  iceServers: IceServer[];
} {
  if (Array.isArray(provided) && provided.length > 0) return { iceServers: provided };
  if (provided && typeof provided === "object" && Array.isArray((provided as any).iceServers)) {
    const list = (provided as any).iceServers as IceServer[];
    if (list.length > 0) return { iceServers: list };
  }
  return { iceServers: DEFAULT_ICE_SERVERS };
}
