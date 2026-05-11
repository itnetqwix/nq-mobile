import { DEFAULT_STUN_ICE_SERVERS, type RtcIceServer } from "./defaultIceServers";

/**
 * Mirrors `buildIceConfig` in `nq-frontend-main/app/components/video/callEngine.js`.
 * `startMeetingIceServers` is whatever the API / Redux stores (array or `{ iceServers: [...] }`).
 */
export function buildIceConfiguration(startMeetingIceServers: unknown): { iceServers: RtcIceServer[] } {
  try {
    if (Array.isArray(startMeetingIceServers) && startMeetingIceServers.length > 0) {
      return { iceServers: startMeetingIceServers as RtcIceServer[] };
    }

    if (
      startMeetingIceServers &&
      typeof startMeetingIceServers === "object" &&
      Array.isArray((startMeetingIceServers as { iceServers?: unknown }).iceServers)
    ) {
      return {
        iceServers: (startMeetingIceServers as { iceServers: RtcIceServer[] }).iceServers,
      };
    }
  } catch {
    // fall through
  }

  return { iceServers: [...DEFAULT_STUN_ICE_SERVERS] };
}
