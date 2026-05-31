/**
 * Cross-platform session contract — event names and phases aligned with
 * nq-backend `config/constance.ts` and nq-frontend `helpers/events.ts`.
 *
 * Mobile and web MUST use the same wire strings so MongoDB + socket rooms
 * stay the single source of truth for in-call state.
 */

/** Booking list sync (server → client). Instant accept uses PHASE, not STATUS_UPDATED. */
export const BOOKING_SOCKET_EVENTS = {
  CREATED: "BOOKING_CREATED",
  STATUS_UPDATED: "BOOKING_STATUS_UPDATED",
} as const;

/** Instant lesson lifecycle (client ↔ server). */
export const INSTANT_LESSON_SOCKET_EVENTS = {
  REQUEST: "INSTANT_LESSON_REQUEST",
  ACCEPT: "INSTANT_LESSON_ACCEPT",
  DECLINE: "INSTANT_LESSON_DECLINE",
  EXPIRE: "INSTANT_LESSON_EXPIRE",
  PHASE: "INSTANT_LESSON_PHASE",
  TRAINEE_CANCELLED: "INSTANT_LESSON_TRAINEE_CANCELLED",
  CLIPS_SELECTED: "INSTANT_LESSON_CLIPS_SELECTED",
  SESSION_RECORDING: "INSTANT_LESSON_SESSION_RECORDING",
} as const;

/** In-call room + timer (session:{bookingId} on server). */
export const LESSON_SOCKET_EVENTS = {
  STATE_SYNC: "LESSON_STATE_SYNC",
  STATE_REQUEST: "LESSON_STATE_REQUEST",
  SET_FOCUSED_CLIP: "LESSON_SET_FOCUSED_CLIP",
  LIVE_NOTE_ADD: "LESSON_LIVE_NOTE_ADD",
  QUALITY_UPDATE: "LESSON_QUALITY_UPDATE",
  TIMER_STARTED: "TIMER_STARTED",
  TIME_PAUSED: "LESSON_TIME_PAUSED",
  TIME_RESUMED: "LESSON_TIME_RESUMED",
  TIME_ENDED: "LESSON_TIME_ENDED",
  TIMER_EXTENDED: "LESSON_TIMER_EXTENDED",
  TIMER_ERROR: "LESSON_TIMER_ERROR",
  TIMER_START_REQUEST: "LESSON_TIMER_START_REQUEST",
  TIMER_PAUSE_REQUEST: "LESSON_TIMER_PAUSE_REQUEST",
  TIMER_RESUME_REQUEST: "LESSON_TIMER_RESUME_REQUEST",
} as const;

export const PARTICIPANT_SOCKET_EVENTS = {
  STATUS_CHANGED: "PARTICIPANT_STATUS_CHANGED",
  LEFT: "PARTICIPANT_LEFT",
  STALE: "PARTICIPANT_STALE",
} as const;

/** Mongo `instant_phase` values (backend `config/instantLesson.ts`). */
export const INSTANT_PHASE = {
  PENDING_ACCEPT: "pending_accept",
  PENDING_JOIN: "pending_join",
  ACTIVE: "active",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

/**
 * Layers of truth (read in order for debugging handoffs):
 * 1. MongoDB booking row — status, deadlines, refund, both_joined_at
 * 2. Socket session room `session:{bookingId}` — timer, presence, clips, layout
 * 3. MemCache P2P routing — one socket per user; room events reach all tabs in call
 * 4. Local UI state — instant overlays; rebuilt via reconcile on connect/foreground
 */
