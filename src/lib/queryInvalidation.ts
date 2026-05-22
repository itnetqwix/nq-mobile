import type { QueryClient } from "@tanstack/react-query";
import { queryKeys, queryKeyRoots } from "./queryKeys";

export function invalidateSessions(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.scheduledMeetings });
}

export function invalidateWallet(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.wallet.all });
}

export function invalidateFriends(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.friends.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.friends.requests });
  void queryClient.invalidateQueries({ queryKey: queryKeys.friends.sentRequests });
}

export function invalidateChats(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.chats.conversations });
  void queryClient.invalidateQueries({ queryKey: queryKeys.chats.groupInvites });
}

export function invalidatePresence(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.presence.onlineUsers });
  void queryClient.invalidateQueries({ queryKey: queryKeys.presence.bookExpertOnline });
  void queryClient.invalidateQueries({ queryKey: queryKeys.presence.communityAll });
  void queryClient.invalidateQueries({ queryKey: queryKeys.presence.recentTrainees });
  void queryClient.invalidateQueries({ queryKey: queryKeys.presence.recentTrainers });
}

export function invalidateTrainerSchedule(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.trainer.schedule });
  void queryClient.invalidateQueries({ queryKey: queryKeys.trainer.availabilityAll });
}

export function invalidateLocker(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.locker.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.instant.lessonClipsAll });
}

export function invalidateNotifications(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
}

/** After booking / timer / extension socket events. */
export function invalidateOnBookingSocketEvent(queryClient: QueryClient): void {
  invalidateSessions(queryClient);
  invalidateTrainerSchedule(queryClient);
  invalidateWallet(queryClient);
}

/** @deprecated Alias — use invalidateSessions or invalidateOnBookingSocketEvent */
export function invalidateOnSessionSocketEvent(queryClient: QueryClient): void {
  invalidateSessions(queryClient);
}

/** After wallet-related booking events. */
export function invalidateOnWalletSocketEvent(queryClient: QueryClient): void {
  invalidateWallet(queryClient);
}

/** Presence, friends, chats refresh. */
export function invalidateOnPresenceSocketEvent(queryClient: QueryClient): void {
  invalidatePresence(queryClient);
  invalidateFriends(queryClient);
  invalidateChats(queryClient);
}

export function invalidateForSocketEvent(queryClient: QueryClient, event: string): void {
  const sessionEvents = [
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
  ];
  const walletEvents = ["BOOKING_CREATED", "BOOKING_STATUS_UPDATED", "INSTANT_LESSON_PHASE"];
  const presenceEvents = ["userStatus", "onlineUser"];

  if (sessionEvents.includes(event)) {
    invalidateOnBookingSocketEvent(queryClient);
  }
  if (walletEvents.includes(event)) {
    invalidateOnWalletSocketEvent(queryClient);
  }
  if (presenceEvents.includes(event)) {
    invalidateOnPresenceSocketEvent(queryClient);
  }
  if (event.includes("friend")) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.friends.requests });
  }
  if (event === "receive" || event === "notification") {
    invalidateNotifications(queryClient);
  }
}

/** Full refresh after socket reconnect. */
export function invalidateOnSocketReconnect(queryClient: QueryClient): void {
  invalidateSessions(queryClient);
  invalidatePresence(queryClient);
  invalidateChats(queryClient);
  void queryClient.invalidateQueries({ queryKey: queryKeys.trainee.favorites });
  void queryClient.invalidateQueries({ queryKey: queryKeys.wallet.earnings });
  void queryClient.invalidateQueries({ queryKey: queryKeys.trainer.slots });
}
