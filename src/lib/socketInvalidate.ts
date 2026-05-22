import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";

/** Socket events that should refresh session lists (server + mobile parity). */
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

export const SOCKET_WALLET_EVENTS = ["BOOKING_CREATED", "BOOKING_STATUS_UPDATED", "INSTANT_LESSON_PHASE"] as const;

export const SOCKET_PRESENCE_EVENTS = ["userStatus", "onlineUser"] as const;

export function invalidateOnSessionSocketEvent(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.scheduledMeetings });
}

export function invalidateOnBookingSocketEvent(queryClient: QueryClient): void {
  invalidateOnSessionSocketEvent(queryClient);
  void queryClient.invalidateQueries({ queryKey: queryKeys.trainer.availabilityAll });
}

export function invalidateOnWalletSocketEvent(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.wallet.all });
}

export function invalidateOnPresenceSocketEvent(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.presence.onlineUsers });
  void queryClient.invalidateQueries({ queryKey: queryKeys.presence.bookExpertOnline });
  void queryClient.invalidateQueries({ queryKey: queryKeys.friends.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.chats.conversations });
  void queryClient.invalidateQueries({ queryKey: queryKeys.presence.recentTrainees });
}

export function invalidateForSocketEvent(
  queryClient: QueryClient,
  event: string
): void {
  if ((SOCKET_SESSION_EVENTS as readonly string[]).includes(event)) {
    invalidateOnSessionSocketEvent(queryClient);
  }
  if ((SOCKET_WALLET_EVENTS as readonly string[]).includes(event)) {
    invalidateOnWalletSocketEvent(queryClient);
  }
  if ((SOCKET_PRESENCE_EVENTS as readonly string[]).includes(event)) {
    invalidateOnPresenceSocketEvent(queryClient);
  }
  if (event.includes("friend")) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.friends.requests });
  }
}
