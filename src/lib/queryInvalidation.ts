import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { AccountType } from "../constants/accountType";
import { store } from "../store/store";
import { queryKeys } from "./queryKeys";

/** Coalesce bursty `userStatus` / `onlineUser` socket broadcasts into one refetch wave. */
const PRESENCE_INVALIDATION_DEBOUNCE_MS = 30_000;
const SOCKET_RECONNECT_FRESH_MS = 30_000;
/** Batch invalidations so one socket burst → one refetch wave, not N parallel refetches. */
const INVALIDATION_COALESCE_MS = 2_000;

let presenceInvalidateTimer: ReturnType<typeof setTimeout> | null = null;
let presenceInvalidateClient: QueryClient | null = null;
let lastPresenceOnlineHash: string | null = null;

let coalesceClient: QueryClient | null = null;
let coalesceTimer: ReturnType<typeof setTimeout> | null = null;
const coalesceKeys = new Map<string, QueryKey>();

function queryKeyId(key: QueryKey): string {
  return JSON.stringify(key);
}

function queryRecentlyFetched(
  queryClient: QueryClient,
  queryKey: readonly unknown[]
): boolean {
  const query = queryClient.getQueryCache().find({ queryKey });
  if (!query?.state.dataUpdatedAt) return false;
  return Date.now() - query.state.dataUpdatedAt < SOCKET_RECONNECT_FRESH_MS;
}

/** Schedule invalidation; duplicates within the coalesce window merge into one flush. */
function scheduleInvalidate(queryClient: QueryClient, queryKey: QueryKey): void {
  coalesceClient = queryClient;
  coalesceKeys.set(queryKeyId(queryKey), queryKey);
  if (coalesceTimer) return;
  coalesceTimer = setTimeout(() => {
    coalesceTimer = null;
    const client = coalesceClient;
    const keys = [...coalesceKeys.values()];
    coalesceKeys.clear();
    coalesceClient = null;
    if (!client) return;
    for (const key of keys) {
      void client.invalidateQueries({ queryKey: key });
    }
  }, INVALIDATION_COALESCE_MS);
}

function invalidateQueryIfStale(
  queryClient: QueryClient,
  queryKey: readonly unknown[]
): void {
  if (!queryRecentlyFetched(queryClient, queryKey)) {
    scheduleInvalidate(queryClient, queryKey as QueryKey);
  }
}

/** Session list tabs only — never `sessions.all` (that prefix refetches every cached lesson row). */
export function invalidateSessions(queryClient: QueryClient): void {
  scheduleInvalidate(queryClient, queryKeys.sessions.upcoming);
  scheduleInvalidate(queryClient, queryKeys.sessions.list("confirmed"));
  scheduleInvalidate(queryClient, queryKeys.scheduledMeetings);
}

/** Optimistically merge session fields into every cached session list (instant accept / confirm). */
export function patchSessionInQueryCaches(
  queryClient: QueryClient,
  lessonId: string,
  patch: Record<string, unknown>
): void {
  if (!lessonId) return;
  queryClient.setQueriesData(
    {
      predicate: (query) =>
        query.queryKey[0] === queryKeys.sessions.all[0] ||
        query.queryKey[0] === queryKeys.scheduledMeetings[0],
    },
    (old: unknown) => {
      if (!Array.isArray(old)) return old;
      let changed = false;
      const next = old.map((row: Record<string, unknown>) => {
        const id = String(row._id ?? row.id ?? "");
        if (id !== lessonId) return row;
        changed = true;
        return { ...row, ...patch };
      });
      return changed ? next : old;
    }
  );
}

/** Insert or merge a session row so dashboards update before refetch (schedule book). */
export function upsertSessionInQueryCaches(
  queryClient: QueryClient,
  session: Record<string, unknown>
): void {
  const lessonId = String(session._id ?? session.id ?? "");
  if (!lessonId) return;
  queryClient.setQueriesData(
    {
      predicate: (query) =>
        query.queryKey[0] === queryKeys.sessions.all[0] ||
        query.queryKey[0] === queryKeys.scheduledMeetings[0],
    },
    (old: unknown) => {
      if (!Array.isArray(old)) return [session];
      const idx = old.findIndex(
        (row: Record<string, unknown>) =>
          String(row._id ?? row.id ?? "") === lessonId
      );
      if (idx >= 0) {
        const next = [...old];
        next[idx] = { ...next[idx], ...session };
        return next;
      }
      return [session, ...old];
    }
  );
}

export function invalidateWallet(queryClient: QueryClient): void {
  scheduleInvalidate(queryClient, queryKeys.wallet.balance);
  scheduleInvalidate(queryClient, queryKeys.wallet.earnings);
}

export function invalidateFriends(queryClient: QueryClient): void {
  scheduleInvalidate(queryClient, queryKeys.friends.requests);
}

export function invalidateChats(queryClient: QueryClient): void {
  scheduleInvalidate(queryClient, queryKeys.chats.conversations);
}

export function invalidatePresence(queryClient: QueryClient): void {
  scheduleInvalidate(queryClient, queryKeys.presence.onlineUsers);
  scheduleInvalidate(queryClient, queryKeys.presence.bookExpertOnline);
}

export function invalidateTrainerSchedule(queryClient: QueryClient): void {
  scheduleInvalidate(queryClient, queryKeys.trainer.schedule);
}

export function invalidateLocker(queryClient: QueryClient): void {
  scheduleInvalidate(queryClient, queryKeys.locker.myClips);
  scheduleInvalidate(queryClient, queryKeys.locker.sharedClips);
}

export function invalidateNotifications(queryClient: QueryClient): void {
  scheduleInvalidate(queryClient, queryKeys.notifications.all);
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

/**
 * Presence-only refresh (online lists, recent trainees/trainers).
 * Debounced — socket broadcasts fire on every connect/heartbeat cluster.
 */
export function invalidateOnPresenceSocketEvent(
  queryClient: QueryClient,
  payload?: { user?: Record<string, unknown> }
): void {
  const onlineHash = payload?.user
    ? Object.keys(payload.user).sort().join(",")
    : null;
  if (onlineHash && onlineHash === lastPresenceOnlineHash) {
    return;
  }
  if (onlineHash) lastPresenceOnlineHash = onlineHash;

  presenceInvalidateClient = queryClient;
  if (presenceInvalidateTimer) clearTimeout(presenceInvalidateTimer);
  presenceInvalidateTimer = setTimeout(() => {
    presenceInvalidateTimer = null;
    const client = presenceInvalidateClient;
    presenceInvalidateClient = null;
    if (!client) return;

    const accountType = store.getState().auth.accountType;
    if (accountType === AccountType.TRAINEE) {
      invalidateQueryIfStale(client, queryKeys.presence.bookExpertOnline);
      return;
    }
    if (accountType === AccountType.TRAINER) {
      invalidateQueryIfStale(client, queryKeys.presence.recentTrainees);
      return;
    }
    invalidateQueryIfStale(client, queryKeys.presence.onlineUsers);
  }, PRESENCE_INVALIDATION_DEBOUNCE_MS);
}

/** Banners, tips, legal, blogs, FAQ — after `CMS_UPDATED` socket broadcast. */
export function invalidateContent(queryClient: QueryClient): void {
  scheduleInvalidate(queryClient, queryKeys.content.all);
}

export function invalidateForSocketEvent(
  queryClient: QueryClient,
  event: string,
  payload?: unknown
): void {
  if (typeof event !== "string" || !event) return;

  if (event === "CMS_UPDATED") {
    invalidateContent(queryClient);
    return;
  }

  const sessionEvents = [
    "LESSON_TIME_ENDED",
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
    invalidateOnPresenceSocketEvent(
      queryClient,
      payload as { user?: Record<string, unknown> } | undefined
    );
  }
  if (event.includes("friend")) {
    scheduleInvalidate(queryClient, queryKeys.friends.requests);
  }
  if (event === "receive" || event === "notification") {
    invalidateNotifications(queryClient);
  }
}

/** Refresh after socket reconnect — skip queries fetched within the last 30s. */
export function invalidateOnSocketReconnect(queryClient: QueryClient): void {
  if (presenceInvalidateTimer) {
    clearTimeout(presenceInvalidateTimer);
    presenceInvalidateTimer = null;
    presenceInvalidateClient = null;
  }

  invalidateQueryIfStale(queryClient, queryKeys.sessions.upcoming);

  const accountType = store.getState().auth.accountType;
  if (accountType === AccountType.TRAINEE) {
    invalidateQueryIfStale(queryClient, queryKeys.presence.bookExpertOnline);
    invalidateQueryIfStale(queryClient, queryKeys.trainee.favorites);
  }
  if (accountType === AccountType.TRAINER) {
    invalidateQueryIfStale(queryClient, queryKeys.presence.recentTrainees);
    invalidateQueryIfStale(queryClient, queryKeys.wallet.earnings);
    invalidateQueryIfStale(queryClient, queryKeys.trainer.slots);
  }

  invalidateQueryIfStale(queryClient, queryKeys.chats.conversations);
}

/** Test helper — flush pending coalesced invalidations immediately. */
export function flushScheduledInvalidationsForTests(queryClient: QueryClient): void {
  if (coalesceTimer) {
    clearTimeout(coalesceTimer);
    coalesceTimer = null;
  }
  for (const key of coalesceKeys.values()) {
    void queryClient.invalidateQueries({ queryKey: key });
  }
  coalesceKeys.clear();
  coalesceClient = null;
}
