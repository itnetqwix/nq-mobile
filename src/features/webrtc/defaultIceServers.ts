/** Shape accepted by `RTCPeerConnection` / React Native WebRTC `iceServers`. */
export type RtcIceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

/**
 * Same STUN fallbacks as `nq-frontend-main/app/components/video/callEngine.js` → `DEFAULT_ICE_SERVERS`.
 * Used when the meeting payload has no `iceServers` yet (e.g. cron / Cloudflare TURN not populated).
 *
 * TURN + time-limited credentials come from the **website** Next route
 * `nq-frontend-main/app/api/peer/route.js` (`GET /api/peer`) — see `fetchWebIceServers.ts`.
 */
export const DEFAULT_STUN_ICE_SERVERS: RtcIceServer[] = [
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:stun.cloudflare.com:53" },
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
];
