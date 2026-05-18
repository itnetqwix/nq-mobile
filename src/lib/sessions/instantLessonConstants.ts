/** Instant-lesson timing — keep in sync with `nq-backend` `config/instantLesson.ts`. */
export const INSTANT_ACCEPT_WINDOW_MS = 2 * 60 * 1000;
export const INSTANT_JOIN_AFTER_ACCEPT_MS = 2 * 60 * 1000;
export const INSTANT_BUFFER_AFTER_SESSION_MS = 15 * 60 * 1000;

export const INSTANT_PHASE = {
  PENDING_ACCEPT: "pending_accept",
  PENDING_JOIN: "pending_join",
  ACTIVE: "active",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;
