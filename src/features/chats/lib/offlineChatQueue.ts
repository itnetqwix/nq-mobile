/**
 * Offline-tolerant chat send queue.
 *
 * When the device is offline (or any /chat-send call fails with a
 * network-level error), the outgoing message is pushed onto a
 * MMKV-backed queue. We flush whenever:
 *
 *   • the network store reports `online === true`, or
 *   • a manual `flushOfflineChatQueue()` is invoked (e.g. on app start
 *     once auth is ready, or when the chat screen mounts).
 *
 * Each item carries enough context to be re-sent without the caller
 * being on screen — including the conversationId/receiverId so a queued
 * message survives navigating away or relaunching the app.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  mmkvHotStorage,
  readJsonFromMmkv,
  writeJsonToMmkv,
} from "../../../lib/storage/mmkvHotStorage";
import { useEffect, useSyncExternalStore } from "react";
import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import {
  abortChatMediaUpload,
  getPresignedUploadUrl,
  uploadToS3,
} from "./mediaSendUtils";
import {
  isNetworkOnline,
  useNetworkOnline,
} from "../../../lib/networkStatusStore";

const STORAGE_KEY = "nq.offline.chat.queue.v1";

export type QueuedChatMessage = {
  /** Stable client-side id matching the optimistic bubble in the chat. */
  clientId: string;
  /** Either of these will identify the destination. */
  conversationId?: string | null;
  receiverId?: string | null;
  content: string;
  type: "text" | "image" | "video" | "voice";
  mediaUrl?: string | null;
  /** Local file path for media retry after offline / failed upload. */
  localFileUri?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  /** S3 key from presign — used to abort orphan objects if send fails. */
  mediaS3Key?: string | null;
  replyToMessageId?: string | null;
  /** Used for "X queued · sending now" UI sorting. */
  enqueuedAt: number;
  /** Soft retry cap — we drop and surface an error after this many failures. */
  attempts: number;
};

export type OfflineChatQueueEvent =
  | { type: "sent"; clientId: string; message: Record<string, unknown> }
  | { type: "failed"; clientId: string; attempts: number };

type Listener = () => void;
type EventListener = (event: OfflineChatQueueEvent) => void;

const listeners = new Set<Listener>();
const eventListeners = new Set<EventListener>();
let queue: QueuedChatMessage[] = [];
let hydrated = false;
let flushing = false;

function emit() {
  for (const l of listeners) l();
}

function emitQueueEvent(event: OfflineChatQueueEvent) {
  for (const l of eventListeners) l(event);
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function subscribeOfflineChatQueueEvents(listener: EventListener) {
  eventListeners.add(listener);
  return () => {
    eventListeners.delete(listener);
  };
}

function countSnapshot(): number {
  return queue.length;
}

function countForConversationSnapshot(
  conversationId: string | undefined,
  receiverId: string | undefined
): number {
  if (!conversationId && !receiverId) return 0;
  return queue.filter((item) => {
    if (conversationId && item.conversationId === conversationId) return true;
    if (receiverId && item.receiverId === receiverId) return true;
    return false;
  }).length;
}

async function persist() {
  try {
    await writeJsonToMmkv(STORAGE_KEY, queue);
  } catch {
    /* storage failures are non-blocking */
  }
}

async function migrateLegacyQueue(): Promise<void> {
  if (mmkvHotStorage.getString(STORAGE_KEY)) return;
  try {
    const legacy = await AsyncStorage.getItem(STORAGE_KEY);
    if (legacy) {
      mmkvHotStorage.set(STORAGE_KEY, legacy);
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* ignore migration errors */
  }
}

export async function hydrateOfflineChatQueue(): Promise<void> {
  if (hydrated) return;
  try {
    await migrateLegacyQueue();
    queue = await readJsonFromMmkv<QueuedChatMessage[]>(STORAGE_KEY, []);
  } catch {
    queue = [];
  } finally {
    hydrated = true;
    emit();
  }
}

export function getOfflineChatQueue(): QueuedChatMessage[] {
  return [...queue];
}

export async function enqueueChatMessage(item: QueuedChatMessage): Promise<void> {
  await hydrateOfflineChatQueue();
  // Dedup by clientId — re-enqueues replace the existing row.
  queue = queue.filter((q) => q.clientId !== item.clientId).concat(item);
  await persist();
  emit();
}

export async function removeFromOfflineChatQueue(clientId: string): Promise<void> {
  queue = queue.filter((q) => q.clientId !== clientId);
  await persist();
  emit();
}

/**
 * Walk the queue and attempt to deliver each item. Stops early when a
 * request fails with a network error so we don't keep flooding while
 * still offline.
 */
export async function flushOfflineChatQueue(): Promise<{ sent: number; failed: number }> {
  await hydrateOfflineChatQueue();
  if (flushing) return { sent: 0, failed: 0 };
  flushing = true;
  let sent = 0;
  let failed = 0;
  try {
    const pending = [...queue];
    for (const item of pending) {
      if (!isNetworkOnline()) break;
      let uploadedKey: string | undefined = item.mediaS3Key ?? undefined;
      try {
        let mediaUrl = item.mediaUrl ?? undefined;
        if (!mediaUrl && item.localFileUri && item.fileName && item.mimeType) {
          const { uploadUrl, mediaUrl: remoteUrl, key } = await getPresignedUploadUrl(
            item.fileName,
            item.mimeType
          );
          uploadedKey = key;
          await uploadToS3(uploadUrl, item.localFileUri, item.mimeType);
          mediaUrl = remoteUrl;
        }
        const res = await apiClient.post(API_ROUTES.chat.send, {
          receiverId: item.receiverId ?? undefined,
          conversationId: item.conversationId ?? undefined,
          content: item.content,
          type: item.type,
          mediaUrl,
          replyToMessageId: item.replyToMessageId ?? undefined,
          clientMessageId: item.clientId,
        });
        const data = (res as any)?.data?.data ?? (res as any)?.data;
        const message = data?.message ?? data;
        await removeFromOfflineChatQueue(item.clientId);
        if (message && typeof message === "object") {
          emitQueueEvent({ type: "sent", clientId: item.clientId, message });
        }
        sent += 1;
      } catch (err: any) {
        if (uploadedKey) {
          await abortChatMediaUpload(uploadedKey);
        }
        const isNetwork =
          !err?.response &&
          (err?.code === "ERR_NETWORK" ||
            err?.code === "ECONNABORTED" ||
            err?.message === "Network Error");
        if (isNetwork) {
          // Still offline; stop flushing and try again on next online tick.
          break;
        }
        const nextAttempts = (item.attempts ?? 0) + 1;
        if (nextAttempts >= 3) {
          await removeFromOfflineChatQueue(item.clientId);
          emitQueueEvent({ type: "failed", clientId: item.clientId, attempts: nextAttempts });
        } else {
          await enqueueChatMessage({ ...item, attempts: nextAttempts });
        }
        failed += 1;
      }
    }
  } finally {
    flushing = false;
  }
  return { sent, failed };
}

/**
 * Hook that returns the live queue length. Use it for the "X queued"
 * badge in the network banner and chat composer.
 */
export function usePendingChatQueueCount(): number {
  return useSyncExternalStore(subscribe, countSnapshot, countSnapshot);
}

/** Pending sends for the open conversation (header badge). */
export function usePendingChatQueueCountForConversation(
  conversationId: string | undefined,
  receiverId: string | undefined
): number {
  return useSyncExternalStore(
    subscribe,
    () => countForConversationSnapshot(conversationId, receiverId),
    () => countForConversationSnapshot(conversationId, receiverId)
  );
}

/**
 * Mount once at app root. Watches the network store and automatically
 * flushes the queue whenever connectivity returns.
 */
export function useOfflineChatQueueFlusher(): void {
  const online = useNetworkOnline();
  useEffect(() => {
    void hydrateOfflineChatQueue();
  }, []);
  useEffect(() => {
    if (online && hydrated && queue.length > 0) {
      void flushOfflineChatQueue();
    }
  }, [online]);
}
