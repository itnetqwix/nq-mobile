/**
 * Instant-lesson Socket.IO names — must match `nq-backend` `EVENTS.INSTANT_LESSON`
 * (`src/config/constance.ts`) and `instantLesson.socket.ts` relay handlers.
 */
export const INSTANT_LESSON_SOCKET = {
  REQUEST: "INSTANT_LESSON_REQUEST",
  ACCEPT: "INSTANT_LESSON_ACCEPT",
  DECLINE: "INSTANT_LESSON_DECLINE",
  EXPIRE: "INSTANT_LESSON_EXPIRE",
  TRAINEE_CANCELLED: "INSTANT_LESSON_TRAINEE_CANCELLED",
} as const;
