/**
 * @deprecated Import from `queryInvalidation.ts` instead. Re-exports for backward compatibility.
 */
export {
  invalidateForSocketEvent,
  invalidateOnBookingSocketEvent,
  invalidateOnPresenceSocketEvent,
  invalidateOnSessionSocketEvent,
  invalidateOnWalletSocketEvent,
} from "./queryInvalidation";

export const SOCKET_SESSION_EVENTS = [
  "LESSON_TIMER_EXTENDED",
  "SESSION_EXTENSION_APPLIED",
  "SESSION_EXTENSION_REQUESTED",
  "SESSION_EXTENSION_ACCEPTED",
  "SESSION_EXTENSION_REJECTED",
  "SESSION_EXTENSION_CANCELLED",
  "SESSION_EXTENSION_EXPIRED",
  "BOOKING_CREATED",
  "BOOKING_UPDATED",
  "BOOKING_STATUS_UPDATED",
  "BOOKING_CANCELLED",
  "INSTANT_LESSON_PHASE",
] as const;

export const SOCKET_WALLET_EVENTS = [
  "BOOKING_CREATED",
  "BOOKING_STATUS_UPDATED",
  "INSTANT_LESSON_PHASE",
] as const;

export const SOCKET_PRESENCE_EVENTS = ["userStatus", "onlineUser"] as const;
