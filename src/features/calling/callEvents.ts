/**
 * Backend socket event names for the call lifecycle. Source of truth is
 * `nq-backend-main/src/config/constance.ts → EVENTS.VIDEO_CALL` and
 * `nq-backend-main/src/modules/socket/socket.service.ts`.
 *
 * Names match the strings actually emitted/received on the wire, NOT the JS keys.
 */
export const CALL_EVENTS = {
  /** Trainee/Trainer announces they are ready to receive `offer`/`answer`. */
  ON_CALL_JOIN: "ON_CALL_JOIN",
  /** Server fans out once both peers have joined; safe to start SDP exchange. */
  ON_BOTH_JOIN: "ON_BOTH_JOIN",

  /** Caller sends SDP offer to callee (peer-id payload + sdp). */
  ON_OFFER: "offer",
  /** Callee answers with SDP. */
  ON_ANSWER: "answer",
  /** ICE candidates exchanged in both directions. */
  ON_ICE_CANDIDATE: "ice-candidate",

  /** Mute / camera-off pubsub so the remote UI can show muted state. */
  MUTE_ME: "MUTE_ME",
  STOP_FEED: "STOP_FEED",

  /** Peer hung up. */
  ON_CLOSE: "close",
  /** Backend-level end (timer expired, admin closed). */
  CALL_END: "CALL_END",
} as const;

export type CallEventName = (typeof CALL_EVENTS)[keyof typeof CALL_EVENTS];
