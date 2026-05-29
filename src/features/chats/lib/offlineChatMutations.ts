/**
 * Offline queue for chat edit/delete — flushed when connectivity returns.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect } from "react";
import { editChatMessage, deleteChatMessage } from "../api/chatActionsApi";
import { isNetworkOnline, useNetworkOnline } from "../../../lib/networkStatusStore";

const STORAGE_KEY = "nq.offline.chat.mutations.v1";

export type QueuedChatMutation =
  | {
      id: string;
      type: "edit";
      messageId: string;
      content: string;
      conversationId: string;
      enqueuedAt: number;
      attempts: number;
    }
  | {
      id: string;
      type: "delete";
      messageId: string;
      conversationId: string;
      enqueuedAt: number;
      attempts: number;
    };

let queue: QueuedChatMutation[] = [];
let hydrated = false;
let flushing = false;

async function persist() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    /* noop */
  }
}

export async function hydrateOfflineChatMutations(): Promise<void> {
  if (hydrated) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    queue = raw ? (JSON.parse(raw) as QueuedChatMutation[]) : [];
  } catch {
    queue = [];
  } finally {
    hydrated = true;
  }
}

export async function enqueueChatMutation(item: QueuedChatMutation): Promise<void> {
  await hydrateOfflineChatMutations();
  queue = queue
    .filter(
      (q) =>
        !(
          q.messageId === item.messageId &&
          q.type === item.type &&
          q.conversationId === item.conversationId
        )
    )
    .concat(item);
  await persist();
}

export async function removeChatMutation(id: string): Promise<void> {
  queue = queue.filter((q) => q.id !== id);
  await persist();
}

export function getPendingChatMutationCount(): number {
  return queue.length;
}

export async function flushOfflineChatMutations(): Promise<void> {
  await hydrateOfflineChatMutations();
  if (flushing || !isNetworkOnline()) return;
  flushing = true;
  try {
    const pending = [...queue];
    for (const item of pending) {
      if (!isNetworkOnline()) break;
      try {
        if (item.type === "edit") {
          await editChatMessage(item.messageId, item.content);
        } else {
          await deleteChatMessage(item.messageId);
        }
        await removeChatMutation(item.id);
      } catch {
        const nextAttempts = item.attempts + 1;
        if (nextAttempts >= 3) {
          await removeChatMutation(item.id);
        } else {
          await enqueueChatMutation({ ...item, attempts: nextAttempts });
        }
      }
    }
  } finally {
    flushing = false;
  }
}

export function useOfflineChatMutationsFlusher(): void {
  const online = useNetworkOnline();
  useEffect(() => {
    void hydrateOfflineChatMutations();
  }, []);
  useEffect(() => {
    if (online) void flushOfflineChatMutations();
  }, [online]);
}
