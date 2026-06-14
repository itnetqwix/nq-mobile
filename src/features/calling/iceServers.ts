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

/** Drop invalid ICE entries that crash native RTCPeerConnection on device builds. */
export function sanitizeIceServers(servers: IceServer[] | undefined): IceServer[] {
  const list = Array.isArray(servers) ? servers : [];
  const cleaned: IceServer[] = [];

  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    let urls = entry.urls;
    if (typeof urls === "string") {
      const trimmed = urls.trim();
      if (!trimmed) continue;
      urls = trimmed;
    } else if (Array.isArray(urls)) {
      const filtered = urls
        .map((u) => (typeof u === "string" ? u.trim() : ""))
        .filter(Boolean);
      if (filtered.length === 0) continue;
      urls = filtered;
    } else {
      continue;
    }

    const urlList = Array.isArray(urls) ? urls : [urls];
    const needsAuth = urlList.some((u) => /^turns?:/i.test(String(u)));
    if (needsAuth && (!entry.username || !entry.credential)) continue;

    cleaned.push({
      urls,
      ...(entry.username ? { username: entry.username } : {}),
      ...(entry.credential ? { credential: entry.credential } : {}),
    });
  }

  return cleaned.length > 0 ? cleaned : DEFAULT_ICE_SERVERS;
}

export function buildIceConfig(provided?: IceServer[] | { iceServers?: IceServer[] }): {
  iceServers: IceServer[];
} {
  let raw: IceServer[] | undefined;
  if (Array.isArray(provided) && provided.length > 0) raw = provided;
  else if (provided && typeof provided === "object" && Array.isArray((provided as any).iceServers)) {
    const list = (provided as any).iceServers as IceServer[];
    if (list.length > 0) raw = list;
  }
  return { iceServers: sanitizeIceServers(raw) };
}
